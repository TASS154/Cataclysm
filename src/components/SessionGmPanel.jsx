import React, { useEffect, useState } from "react";
import { subscribeGmLibrary } from "../services/gmLibraryService";
import {
  updateRoundTracker,
  switchSessionMap,
} from "../services/sessionService";
import "./SessionGmPanel.css";

const defaultTracker = () => ({
  currentRound: 1,
  currentTurn: 1,
  reminders: [],
  activeHandoutUrl: "",
  activeSoundUrl: "",
  activeSoundAt: 0,
});

export default function SessionGmPanel({
  session,
  sessionId,
  username,
  isGM,
  onSessionUpdate,
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [images, setImages] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderTrigger, setReminderTrigger] = useState("round");
  const [reminderAt, setReminderAt] = useState(1);
  const [reminderVisibility, setReminderVisibility] = useState("gm");

  const tracker = session?.roundTracker || defaultTracker();
  const mapSequence = session?.mapSequence || [];
  const currentMapIndex = Number(session?.currentMapIndex) || 0;
  const selectedImageIds = session?.selectedImageIds || [];
  const selectedSoundIds = session?.selectedSoundIds || [];

  useEffect(() => {
    if (!username || !isGM) return;
    const u1 = subscribeGmLibrary(username, "images", setImages);
    const u2 = subscribeGmLibrary(username, "sounds", setSounds);
    return () => {
      u1 && u1();
      u2 && u2();
    };
  }, [username, isGM]);

  const sessionImages = images.filter((i) => selectedImageIds.includes(i.id));
  const sessionSounds = sounds.filter((s) => selectedSoundIds.includes(s.id));

  const saveTracker = async (next) => {
    await updateRoundTracker(sessionId, next);
    onSessionUpdate && onSessionUpdate({ ...session, roundTracker: next });
  };

  const checkReminders = (nextTracker, kind) => {
    const value = kind === "round" ? nextTracker.currentRound : nextTracker.currentTurn;
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

  const bumpRound = async (delta) => {
    let next = {
      ...defaultTracker(),
      ...tracker,
      currentRound: Math.max(1, (tracker.currentRound || 1) + delta),
    };
    next = checkReminders(next, "round");
    await saveTracker(next);
  };

  const bumpTurn = async (delta) => {
    let next = {
      ...defaultTracker(),
      ...tracker,
      currentTurn: Math.max(1, (tracker.currentTurn || 1) + delta),
    };
    next = checkReminders(next, "turn");
    await saveTracker(next);
  };

  const addReminder = async () => {
    const text = reminderText.trim();
    if (!text) return;
    const next = {
      ...defaultTracker(),
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
      ...defaultTracker(),
      ...tracker,
      activeHandoutUrl: url,
      activeHandoutAt: Date.now(),
    });
  };

  const clearHandout = async () => {
    await saveTracker({
      ...defaultTracker(),
      ...tracker,
      activeHandoutUrl: "",
    });
  };

  const broadcastSound = async (url) => {
    await saveTracker({
      ...defaultTracker(),
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
            <h4>Rodadas</h4>
            <div className="session-counter-row">
              <span>Rodada: <strong>{tracker.currentRound || 1}</strong></span>
              <button type="button" className="btn-primary small" onClick={() => bumpRound(-1)}>−</button>
              <button type="button" className="btn-primary small" onClick={() => bumpRound(1)}>+</button>
            </div>
            <div className="session-counter-row">
              <span>Turno: <strong>{tracker.currentTurn || 1}</strong></span>
              <button type="button" className="btn-primary small" onClick={() => bumpTurn(-1)}>−</button>
              <button type="button" className="btn-primary small" onClick={() => bumpTurn(1)}>+</button>
            </div>
          </section>

          <section className="session-gm-block">
            <h4>Lembretes</h4>
            <div className="session-reminder-form">
              <input className="input-login" placeholder="Texto do lembrete" value={reminderText} onChange={(e) => setReminderText(e.target.value)} />
              <select className="input-login" value={reminderTrigger} onChange={(e) => setReminderTrigger(e.target.value)}>
                <option value="round">Na rodada</option>
                <option value="turn">No turno</option>
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
                  {r.text} — {r.triggerType === "round" ? "rod." : "turno"} {r.triggerAt}
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
