import React, { useEffect, useState } from "react";
import { subscribeGmLibrary } from "../services/gmLibraryService";
import {
  updateRoundTracker,
  switchSessionMap,
} from "../services/sessionService";
import { subscribeSessionRolls } from "../services/sessionRollService";
import {
  fetchCharacterSheet,
  writeCharacterSheet,
} from "../services/characterPatchService";
import {
  normalizeRoundTracker,
  buildTurnOrderFromTokens,
  getCurrentParticipant,
  getGlobalTurnNumber,
  setTurnOrder,
  moveTurnOrderEntry,
} from "../utils/roundTracker";
import { processTurnAdvance, resolveParticipantCharacter } from "../utils/sessionCombatTick";
import { normalizeEffect } from "../utils/rampageRules";
import "./SessionGmPanel.css";

export default function SessionGmPanel({
  session,
  sessionId,
  username,
  isGM,
  tokens = [],
  onSessionUpdate,
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [images, setImages] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderTrigger, setReminderTrigger] = useState("round");
  const [reminderAt, setReminderAt] = useState(1);
  const [reminderVisibility, setReminderVisibility] = useState("gm");
  const [sessionRolls, setSessionRolls] = useState([]);
  const [combatSheets, setCombatSheets] = useState({});
  const [combatLog, setCombatLog] = useState([]);
  const [damageDraft, setDamageDraft] = useState({});

  const tracker = normalizeRoundTracker(session?.roundTracker);
  const currentParticipant = getCurrentParticipant(tracker);
  const mapSequence = session?.mapSequence || [];
  const currentMapIndex = Number(session?.currentMapIndex) || 0;
  const selectedImageIds = session?.selectedImageIds || [];
  const selectedSoundIds = session?.selectedSoundIds || [];
  const gmUsername = session?.gmUsername;

  useEffect(() => {
    if (!username || !isGM) return;
    const u1 = subscribeGmLibrary(username, "images", setImages);
    const u2 = subscribeGmLibrary(username, "sounds", setSounds);
    return () => {
      u1 && u1();
      u2 && u2();
    };
  }, [username, isGM]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeSessionRolls(sessionId, setSessionRolls, 30);
  }, [sessionId]);

  const refreshCombatSheets = async () => {
    if (!isGM) return;
    const next = {};
    for (const p of tracker.turnOrder || []) {
      const target = resolveParticipantCharacter(p, tokens, gmUsername);
      if (!target?.ownerUsername || !target.characterId) continue;
      const key = `${target.ownerUsername}/${target.characterId}`;
      if (next[key]) continue;
      const sheet = await fetchCharacterSheet(target.ownerUsername, target.characterId);
      if (sheet) next[key] = { ...sheet, _label: target.label, _owner: target.ownerUsername };
    }
    setCombatSheets(next);
  };

  useEffect(() => {
    if (isGM && showPanel) refreshCombatSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGM, showPanel, tracker.currentTurnIndex, tracker.currentRound, tokens.length]);

  const sessionImages = images.filter((i) => selectedImageIds.includes(i.id));
  const sessionSounds = sounds.filter((s) => selectedSoundIds.includes(s.id));

  const saveTracker = async (next) => {
    await updateRoundTracker(sessionId, next);
    onSessionUpdate && onSessionUpdate({ ...session, roundTracker: next });
  };

  const checkReminders = (nextTracker, kind) => {
    const value =
      kind === "round"
        ? nextTracker.currentRound
        : getGlobalTurnNumber(nextTracker);
    const due = (nextTracker.reminders || []).filter(
      (r) => !r.fired && r.triggerType === kind && Number(r.triggerAt) === value
    );
    if (due.length === 0) return nextTracker;

    let lastPublicReminder = nextTracker.lastPublicReminder;
    due.forEach((r) => {
      if (r.visibility === "all") {
        lastPublicReminder = { text: r.text, at: Date.now() };
      } else if (isGM) {
        alert(`🔔 ${r.text}`);
      }
    });

    return {
      ...nextTracker,
      lastPublicReminder,
      reminders: nextTracker.reminders.map((r) =>
        due.some((d) => d.id === r.id) ? { ...r, fired: true } : r
      ),
    };
  };

  const applyTurnChange = async (direction) => {
    try {
      const { tracker: advanced, combatLogs } = await processTurnAdvance({
        session,
        tokens,
        direction,
      });
      let next = checkReminders(advanced, "turn");
      if (direction > 0 && next.currentRound > tracker.currentRound) {
        next = checkReminders(next, "round");
      } else if (direction < 0 && next.currentRound < tracker.currentRound) {
        next = checkReminders(next, "round");
      }
      await saveTracker(next);
      if (combatLogs?.length) {
        setCombatLog((prev) => [...combatLogs, ...prev].slice(0, 40));
        refreshCombatSheets();
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao avançar turno / aplicar ticks: " + (err?.message || err));
    }
  };

  const applyGmDamage = async (owner, characterId, amount) => {
    const sheet = await fetchCharacterSheet(owner, characterId);
    if (!sheet) return;
    const s = JSON.parse(JSON.stringify(sheet));
    if (!s.bars) s.bars = {};
    s.bars.hp = Math.max(0, (Number(s.bars.hp) || 0) - Number(amount || 0));
    await writeCharacterSheet(owner, characterId, s);
    refreshCombatSheets();
  };

  const addGmEffect = async (owner, characterId) => {
    const name = window.prompt("Nome do efeito (ex: Envenenado)");
    if (!name) return;
    const tickMode = window.prompt("tickMode: turnStart | turnEnd | round", "turnEnd") || "turnEnd";
    const damage = Number(window.prompt("Dano por tick", "0") || 0);
    const rounds = Number(window.prompt("Duração (0 = até remover)", "3") || 0);
    const sheet = await fetchCharacterSheet(owner, characterId);
    if (!sheet) return;
    const s = JSON.parse(JSON.stringify(sheet));
    s.effects = [...(s.effects || []), normalizeEffect({ id: Date.now(), name, damage, rounds, tickMode })];
    await writeCharacterSheet(owner, characterId, s);
    refreshCombatSheets();
  };

  const syncTurnOrderFromMap = async () => {
    const built = buildTurnOrderFromTokens(tokens, gmUsername);
    let next = setTurnOrder(tracker, built);
    if (built.length > 0 && !currentParticipant) {
      next = { ...next, currentTurnIndex: 0, currentRound: 1 };
    }
    await saveTracker(next);
  };

  const addReminder = async () => {
    const text = reminderText.trim();
    if (!text) return;
    const next = {
      ...tracker,
      reminders: [
        ...(tracker.reminders || []),
        {
          id: `rem-${Date.now()}`,
          text,
          triggerType: reminderTrigger,
          triggerAt: Number(reminderAt) || 1,
          visibility: reminderVisibility,
          fired: false,
        },
      ],
    };
    await saveTracker(next);
    setReminderText("");
  };

  const showHandout = async (url) => {
    await saveTracker({
      ...tracker,
      activeHandoutUrl: url,
      activeHandoutAt: Date.now(),
    });
  };

  const clearHandout = async () => {
    await saveTracker({
      ...tracker,
      activeHandoutUrl: "",
    });
  };

  const broadcastSound = async (url) => {
    await saveTracker({
      ...tracker,
      activeSoundUrl: url,
      activeSoundAt: Date.now(),
    });
  };

  if (!isGM) return null;

  return (
    <>
      <button
        type="button"
        className="btn-outline"
        onClick={() => setShowPanel((v) => !v)}
        title="Ferramentas do mestre: rodadas, mídia, mapas"
      >
        ⚙️ Mesa
      </button>
      {showPanel && (
        <div className="session-gm-panel">
          <div className="session-gm-panel-header">
            <strong>Ferramentas do Mestre</strong>
            <button type="button" className="modal-close" onClick={() => setShowPanel(false)}>×</button>
          </div>

          <section className="session-gm-block">
            <h4>Rodadas e turnos</h4>
            <p className="muted small session-turn-hint">
              Cada jogador na ordem joga uma vez; ao fechar o ciclo, a rodada avança.
            </p>
            <div className="session-turn-summary">
              <span>Rodada <strong>{tracker.currentRound}</strong></span>
              {currentParticipant ? (
                <span className="session-turn-active">
                  Vez de <strong>{currentParticipant.label}</strong>
                  <span className="muted small">
                    {" "}({tracker.currentTurnIndex + 1}/{tracker.turnOrder.length})
                  </span>
                </span>
              ) : (
                <span className="muted small">Nenhum jogador na ordem</span>
              )}
            </div>
            <div className="session-counter-row">
              <button
                type="button"
                className="btn-outline small"
                onClick={() => applyTurnChange(-1)}
                disabled={!tracker.turnOrder.length}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="btn-primary small"
                onClick={() => applyTurnChange(1)}
                disabled={!tracker.turnOrder.length}
              >
                Próximo turno →
              </button>
            </div>
            <button
              type="button"
              className="btn-outline small fullwidth"
              style={{ marginTop: 6 }}
              onClick={syncTurnOrderFromMap}
            >
              Sincronizar ordem com tokens do mapa
            </button>
            {tracker.turnOrder.length > 0 && (
              <ol className="session-turn-order-list">
                {tracker.turnOrder.map((p, i) => (
                  <li
                    key={p.id}
                    className={i === tracker.currentTurnIndex ? "session-turn-order-item--active" : ""}
                  >
                    <span className="session-turn-order-label">
                      {i + 1}. {p.label}
                      {p.ownerUsername && p.ownerUsername !== gmUsername && (
                        <span className="muted small"> ({p.ownerUsername})</span>
                      )}
                    </span>
                    <span className="session-turn-order-actions">
                      <button
                        type="button"
                        className="btn-outline small"
                        disabled={i === 0}
                        onClick={async () => saveTracker(moveTurnOrderEntry(tracker, i, -1))}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-outline small"
                        disabled={i === tracker.turnOrder.length - 1}
                        onClick={async () => saveTracker(moveTurnOrderEntry(tracker, i, 1))}
                        title="Descer"
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="session-gm-block">
            <h4>Combate (fichas)</h4>
            <button type="button" className="btn-outline small" onClick={refreshCombatSheets}>Atualizar barras</button>
            <ul className="session-combat-list" style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {Object.entries(combatSheets).map(([key, sh]) => (
                <li key={key} style={{ marginBottom: 10, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                  <strong>{sh._label || sh.name}</strong>
                  <div className="muted small">
                    PV {sh.bars?.hp ?? "?"} / {sh.bars?.maxHp ?? "?"} · PE {sh.bars?.inata ?? "?"} · Éter {sh.bars?.ether ?? "?"} · Vigor {sh.bars?.vigor ?? "?"}
                  </div>
                  <div className="muted small">
                    Efeitos: {(sh.effects || []).map((e) => `${e.name}(${e.tickMode || "?"},${e.rounds || "∞"})`).join(", ") || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      className="input-number"
                      style={{ width: 64 }}
                      placeholder="Dano"
                      value={damageDraft[key] ?? ""}
                      onChange={(e) => setDamageDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-danger small"
                      onClick={() => applyGmDamage(sh._owner, sh.id, damageDraft[key])}
                    >
                      Aplicar dano
                    </button>
                    <button
                      type="button"
                      className="btn-outline small"
                      onClick={() => addGmEffect(sh._owner, sh.id)}
                    >
                      + Efeito
                    </button>
                  </div>
                </li>
              ))}
              {Object.keys(combatSheets).length === 0 && (
                <li className="muted small">Nenhuma ficha linkada aos tokens. Sincronize a ordem e garanta characterId nos tokens.</li>
              )}
            </ul>
            {combatLog.length > 0 && (
              <div className="muted small" style={{ marginTop: 8 }}>
                <strong>Últimos ticks</strong>
                <ul>
                  {combatLog.slice(0, 8).map((c, i) => (
                    <li key={i}>{c.who} [{c.kind}]: {c.logs.join("; ")}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="session-gm-block">
            <h4>Rolagens da mesa</h4>
            <ul style={{ listStyle: "none", padding: 0, maxHeight: 180, overflow: "auto" }}>
              {sessionRolls.map((r) => (
                <li key={r.id} style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>{r.characterName || r.roller}</strong>: {r.diceString} → <strong>{r.total}</strong>
                  {r.attribute && r.attribute !== "puro" ? ` (${r.attribute})` : ""}
                </li>
              ))}
              {sessionRolls.length === 0 && <li className="muted small">Nenhuma rolagem ainda nesta sessão.</li>}
            </ul>
          </section>

          <section className="session-gm-block">
            <h4>Lembretes</h4>
            <div className="session-reminder-form">
              <input className="input-login" placeholder="Texto do lembrete" value={reminderText} onChange={(e) => setReminderText(e.target.value)} />
              <select className="input-login" value={reminderTrigger} onChange={(e) => setReminderTrigger(e.target.value)}>
                <option value="round">Na rodada</option>
                <option value="turn">No turno global</option>
              </select>
              <input type="number" className="input-login" min={1} value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
              <select className="input-login" value={reminderVisibility} onChange={(e) => setReminderVisibility(e.target.value)}>
                <option value="gm">Só mestre</option>
                <option value="all">Todos veem</option>
              </select>
              <button type="button" className="btn-primary small" onClick={addReminder}>Adicionar</button>
            </div>
            <ul className="session-reminder-list">
              {(tracker.reminders || []).map((r) => (
                <li key={r.id} className={r.fired ? "fired" : ""}>
                  {r.text} — {r.triggerType === "round" ? "rod." : "turno glob."} {r.triggerAt}
                  {r.visibility === "all" ? " (todos)" : " (mestre)"}
                  {r.fired && " ✓"}
                </li>
              ))}
            </ul>
          </section>

          {mapSequence.length > 1 && (
            <section className="session-gm-block">
              <h4>Cenas ({mapSequence.length})</h4>
              <select
                className="input-login"
                value={currentMapIndex}
                onChange={(e) => switchSessionMap(sessionId, Number(e.target.value), mapSequence)}
              >
                {mapSequence.map((m, i) => (
                  <option key={i} value={i}>{m.name || `Mapa ${i + 1}`}</option>
                ))}
              </select>
            </section>
          )}

          {(sessionImages.length > 0 || sessionSounds.length > 0) && (
            <section className="session-gm-block">
              <h4>Mídia da sessão</h4>
              {sessionImages.length > 0 && (
                <div className="session-media-actions">
                  {sessionImages.map((img) => (
                    <button key={img.id} type="button" className="btn-primary small" onClick={() => showHandout(img.url)}>
                      🖼 {img.name}
                    </button>
                  ))}
                  <button type="button" className="btn-outline small" onClick={clearHandout}>Fechar handout</button>
                </div>
              )}
              {sessionSounds.length > 0 && (
                <div className="session-media-actions">
                  {sessionSounds.map((s) => (
                    <button key={s.id} type="button" className="btn-primary small" onClick={() => broadcastSound(s.url)}>
                      🔊 {s.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** Handout visível para todos quando o mestre publica imagem */
export function SessionHandoutOverlay({ session }) {
  const url = session?.roundTracker?.activeHandoutUrl;
  if (!url) return null;
  return (
    <div className="session-handout-overlay">
      <img src={url} alt="Handout" className="session-handout-img" />
    </div>
  );
}

/** Lembrete público para jogadores */
export function SessionPublicReminder({ session }) {
  const pub = session?.roundTracker?.lastPublicReminder;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pub?.text) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [pub?.at, pub?.text]);

  if (!visible || !pub?.text) return null;
  return (
    <div className="session-public-reminder" key={pub.at}>
      🔔 {pub.text}
    </div>
  );
}
