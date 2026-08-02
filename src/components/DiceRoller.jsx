import React, { useState, useRef, useEffect } from "react";
import { rollDie, dieSides, rollDiceString } from "../utils/dice";
import { saveRollToHistory, getRollHistory } from "../services/rollHistoryService";
import { saveSessionRoll } from "../services/sessionRollService";
import { STAT_LABELS, ALL_STATS, critEffect, isAirBreak, tipText } from "../utils/rampageRules";
import "./DiceRoller.css";

function publishRoll(username, sessionId, sheet, payload) {
  if (username) saveRollToHistory(username, payload);
  if (sessionId) {
    saveSessionRoll(sessionId, {
      ...payload,
      roller: username,
      characterName: sheet?.name || username,
      visibility: "all",
    });
  }
}

export default function DiceRoller({ 
  sheet, 
  effectiveStats,
  onUpdateSheet,
  username,
  sessionId,
  onRollComplete,
  onConsumePendingRollPower
}) {
  const stats = effectiveStats || sheet?.stats || {};
  const shortcuts = sheet?.diceShortcuts || [];
  const [diceType, setDiceType] = useState("d20");
  const [showShortcutForm, setShowShortcutForm] = useState(false);
  const [newShortcutLabel, setNewShortcutLabel] = useState("");
  const [newShortcutDiceString, setNewShortcutDiceString] = useState("1d20");
  const [newShortcutModifierAttr, setNewShortcutModifierAttr] = useState("puro");
  const [diceCount, setDiceCount] = useState(1);
  const [rollResults, setRollResults] = useState([]);
  const [lastRollTotal, setLastRollTotal] = useState(null);
  const [selectedModAttr, setSelectedModAttr] = useState("puro");
  const [manualMod, setManualMod] = useState(0);
  const [haloIndices, setHaloIndices] = useState([]);
  const [highlightedResult, setHighlightedResult] = useState(null);
  const [flash, setFlash] = useState(null);
  const [activeTab, setActiveTab] = useState("roll");
  const [rollHistory, setRollHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("");
  const [rollModifier, setRollModifier] = useState(0);
  const [isAdvantageRoll, setIsAdvantageRoll] = useState(false);
  const [ruleTip, setRuleTip] = useState(null);
  const pendingRollPower = sheet?.pendingRollPower || null;
  const flashTimer = useRef(null);
  const haloTimer = useRef(null);

  const announceTips = (d20Value, finalTotal) => {
    const tips = [];
    const crit = critEffect(d20Value);
    if (crit) tips.push(crit);
    if (isAirBreak(finalTotal, d20Value)) {
      tips.push({ code: "air-break", title: "Air Break!", detail: tipText("air-break") });
    }
    setRuleTip(tips.length ? tips : null);
  };

  useEffect(() => {
    if (username && activeTab === "history") {
      const unsubscribe = getRollHistory(username, (history) => {
        setRollHistory(history);
      }, 20);
      return () => unsubscribe();
    }
  }, [username, activeTab]);

  const triggerFullFlash = (color) => {
    setFlash({ color, full: true });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1200);
  };

  const roll = (type = diceType, count = diceCount) => {
    const sides = dieSides[type] || 20;
    const isSingleD20 = sides === 20 && Number(count) === 1;
    if (pendingRollPower && !isSingleD20) {
      alert("Inspiração/Certeza é aplicada em uma rolagem única de d20.");
      return;
    }
    if (pendingRollPower === "inspiration" && isSingleD20) {
      rollAdvantageDisadvantage(true, true);
      return;
    }
    if (pendingRollPower === "certainty" && isSingleD20) {
      const attrMod = selectedModAttr === "puro" ? 0 : stats[selectedModAttr] || 0;
      const totalMod = attrMod + Number(manualMod || 0);
      const raw = 19;
      const total = raw + totalMod;
      const results = [{ raw, mod: 0, total: raw }];
      setRollResults(results);
      setLastRollTotal(total);
      setRollModifier(totalMod);
      setIsAdvantageRoll(false);
      setHaloIndices([{ index: 0, color: "green" }]);
      setHighlightedResult(0);
      triggerFullFlash("green");
      publishRoll(username, sessionId, sheet, {
        diceString: "Certeza (19 automático)",
        results: [raw],
        modifier: totalMod,
        total,
        attribute: selectedModAttr,
        manualMod: Number(manualMod || 0),
      });
      announceTips(raw, total);
      if (onRollComplete) {
        onRollComplete({ results, total, diceString: "Certeza (19 automático)" });
      }
      if (onConsumePendingRollPower) onConsumePendingRollPower("certainty");
      clearTimeout(haloTimer.current);
      haloTimer.current = setTimeout(() => setHaloIndices([]), 1200);
      return;
    }

    const results = [];
    const haloIndices = [];

    const attrMod = selectedModAttr === "puro" ? 0 : stats[selectedModAttr] || 0;
    const totalMod = attrMod + Number(manualMod || 0);

    for (let i = 0; i < count; i++) {
      const r = rollDie(sides);
      results.push({ raw: r, mod: 0, total: r });

      if (sides === 20) {
        if (r === 1) triggerFullFlash("red");
        if (r === 20) triggerFullFlash("green");
        if (r === 2 || r === 19) haloIndices.push({ index: i, color: r === 2 ? "red" : "green" });
      }
    }

    const diceSum = results.reduce((sum, r) => sum + r.raw, 0);
    const totalSum = diceSum + totalMod;
    setRollResults(results);
    setLastRollTotal(totalSum);
    setRollModifier(totalMod);
    setIsAdvantageRoll(false);
    setHaloIndices(haloIndices);
    setHighlightedResult(null);
    
    publishRoll(username, sessionId, sheet, {
      diceString: `${count}${type}`,
      results: results.map(r => r.raw),
      modifier: totalMod,
      total: totalSum,
      attribute: selectedModAttr,
      manualMod: Number(manualMod || 0)
    });
    if (isSingleD20) announceTips(results[0]?.raw, totalSum);
    else setRuleTip(null);

    if (onRollComplete) {
      onRollComplete({ results, total: totalSum, diceString: `${count}${type}` });
    }
    if (pendingRollPower && onConsumePendingRollPower) onConsumePendingRollPower(pendingRollPower);
    
    if (haloIndices.length > 0) {
      clearTimeout(haloTimer.current);
      haloTimer.current = setTimeout(() => setHaloIndices([]), 1200);
    }
  };

  const rollShortcut = (shortcut) => {
    if (pendingRollPower) {
      alert("Inspiração/Certeza não é aplicada em atalho. Use uma rolagem única de d20.");
      return;
    }
    const modKey = shortcut.modifierAttr;
    const attrMod =
      modKey && modKey !== "puro" ? stats[modKey] || 0 : 0;
    const out = rollDiceString(shortcut.diceString || "1d20", attrMod);
    if (!out) {
      setRollResults([]);
      setLastRollTotal(null);
      return;
    }
    const results = out.results.map((r) => ({ raw: r, mod: 0, total: r }));
    setRollResults(results);
    setLastRollTotal(out.total);
    setHighlightedResult(null);
    setRollModifier(attrMod);
    setIsAdvantageRoll(false);
    if (shortcut.diceString?.toLowerCase().includes("d20") && out.results.length === 1) {
      if (out.results[0] === 1) triggerFullFlash("red");
      if (out.results[0] === 20) triggerFullFlash("green");
    }
    publishRoll(username, sessionId, sheet, {
      diceString: shortcut.diceString || shortcut.label,
      results: out.results,
      modifier: attrMod,
      total: out.total,
      attribute: shortcut.modifierAttr === "puro" || !shortcut.modifierAttr ? "puro" : shortcut.modifierAttr,
      manualMod: 0
    });
    if (out.results.length === 1) announceTips(out.results[0], out.total);
    if (onRollComplete) onRollComplete({ results, total: out.total, diceString: shortcut.diceString });
  };

  const addShortcut = () => {
    const label = newShortcutLabel.trim();
    const diceString = newShortcutDiceString.trim() || "1d20";
    if (!label) return;
    if (!onUpdateSheet) return;
    const next = {
      ...sheet,
      diceShortcuts: [
        ...shortcuts,
        {
          id: Date.now(),
          label,
          diceString,
          modifierAttr: newShortcutModifierAttr === "puro" ? "puro" : newShortcutModifierAttr,
        },
      ],
    };
    onUpdateSheet(next);
    setNewShortcutLabel("");
    setNewShortcutDiceString("1d20");
    setNewShortcutModifierAttr("puro");
    setShowShortcutForm(false);
  };

  const removeShortcut = (id) => {
    if (!onUpdateSheet) return;
    onUpdateSheet({ ...sheet, diceShortcuts: shortcuts.filter((s) => s.id !== id) });
  };

  const rollAdvantageDisadvantage = (isAdvantage, forceConsume = false) => {
    const attrMod = selectedModAttr === "puro" ? 0 : stats[selectedModAttr] || 0;
    const totalMod = attrMod + Number(manualMod || 0);
    const a = [rollDie(20), rollDie(20)];
    const haloIndices = [];
    a.forEach((r, i) => {
      if (r === 2) haloIndices.push({ index: i, color: "red" });
      if (r === 19) haloIndices.push({ index: i, color: "green" });
    });
    const results = a.map((r) => ({ raw: r, mod: 0, total: r }));
    const chosenValue = isAdvantage ? Math.max(...a) : Math.min(...a);
    const highlightIndex = results.findIndex((r) => r.raw === chosenValue);
    const totalSum = chosenValue + totalMod;

    setRollResults(results);
    setLastRollTotal(totalSum);
    setRollModifier(totalMod);
    setIsAdvantageRoll(true);
    setHighlightedResult(highlightIndex);
    if (a.includes(20)) triggerFullFlash("green");
    if (a.includes(1)) triggerFullFlash("red");
    setHaloIndices(haloIndices);

    publishRoll(username, sessionId, sheet, {
      diceString: isAdvantage ? "Vantagem (d20x2)" : "Desvantagem (d20x2)",
      results: a,
      modifier: totalMod,
      total: totalSum,
      attribute: selectedModAttr,
      manualMod: Number(manualMod || 0),
    });
    announceTips(chosenValue, totalSum);
    if ((forceConsume || pendingRollPower) && onConsumePendingRollPower) {
      onConsumePendingRollPower(pendingRollPower || "inspiration");
    }

    if (haloIndices.length > 0) {
      clearTimeout(haloTimer.current);
      haloTimer.current = setTimeout(() => setHaloIndices([]), 1200);
    }
  };

  const rollInitiative = () => {
    if (pendingRollPower) {
      alert("Inspiração/Certeza não é aplicada na rolagem de iniciativa.");
      return;
    }
    const result = rollDie(20);
    setRollResults([{ raw: result, mod: 0, total: result }]);
    setLastRollTotal(result);
    setRollModifier(0);
    setIsAdvantageRoll(false);
    setHighlightedResult(null);
    setHaloIndices([]);
    
    if (result === 1) triggerFullFlash("red");
    if (result === 20) triggerFullFlash("green");
    
    publishRoll(username, sessionId, sheet, {
      diceString: "Iniciativa (d20)",
      results: [result],
      modifier: 0,
      total: result,
      attribute: "puro",
      manualMod: 0
    });
    announceTips(result, result);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredHistory = historyFilter
    ? rollHistory.filter(roll => 
        roll.diceString?.toLowerCase().includes(historyFilter.toLowerCase())
      )
    : rollHistory;

  const historyStats = filteredHistory.length > 0 ? {
    average: Math.round(filteredHistory.reduce((sum, r) => sum + (r.total || 0), 0) / filteredHistory.length),
    max: Math.max(...filteredHistory.map(r => r.total || 0)),
    min: Math.min(...filteredHistory.map(r => r.total || 0))
  } : null;

  return (
    <div className="dice-roller">
      {flash && (
        <div
          className={`flash-overlay ${flash.full ? "flash-full active" : ""}`}
          style={{
            background: flash.color === "red" ? "rgba(220,38,38,.85)" : "rgba(34,197,94,.85)",
          }}
        />
      )}
      
      <div className="dice-roller-tabs">
        <button
          className={`dice-tab-button ${activeTab === "roll" ? "active" : ""}`}
          onClick={() => setActiveTab("roll")}
        >
          Rolar
        </button>
        <button
          className={`dice-tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Histórico
        </button>
      </div>

      {activeTab === "roll" && (
        <div className="dice-panel">
          <h3>Rolo de dados</h3>
        {pendingRollPower && (
          <div className="muted small" style={{ marginBottom: "8px" }}>
            {pendingRollPower === "certainty"
              ? "Certeza ativa: a próxima rolagem de 1d20 será 19 automático."
              : "Inspiração ativa: a próxima rolagem de 1d20 será com vantagem."}
          </div>
        )}
        <div className="dice-controls">
          <select className="select" value={diceType} onChange={(e) => setDiceType(e.target.value)}>
            {Object.keys(dieSides).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={diceCount || ""}
            onChange={(e) => setDiceCount(e.target.value === "" ? 0 : Number(e.target.value))}
            className="input-number"
            min="1"
          />
        </div>
        
        <div className="dice-modifiers">
          <select
            value={selectedModAttr}
            onChange={(e) => setSelectedModAttr(e.target.value)}
            className="select"
          >
            <option value="puro">Puro (0)</option>
            {ALL_STATS.map((k) => (
              <option key={k} value={k}>
                {STAT_LABELS[k] || k} ({stats[k] ?? 0})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={manualMod || ""}
            onChange={(e) => setManualMod(e.target.value === "" ? 0 : Number(e.target.value))}
            className="input-number"
            placeholder="Mod + / -"
          />
        </div>
        
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn-gradient fullwidth mt" onClick={() => roll()}>
            Rolar
          </button>
          <button
            className="btn-primary initiative-btn-small"
            onClick={rollInitiative}
            title="Rolar Iniciativa (d20 puro)"
          >
            I
          </button>
        </div>
        
        {ruleTip && (
          <div className="rule-tip-banner" style={{ marginTop: 8, padding: 8, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8 }}>
            {ruleTip.map((t) => (
              <div key={t.code} style={{ marginBottom: 4 }}>
                <strong>{t.title}</strong>
                <div className="muted small">{t.detail}</div>
              </div>
            ))}
            {ruleTip.some((t) => t.code === "air-break") && onUpdateSheet && (
              <button
                type="button"
                className="btn-primary small"
                style={{ marginTop: 4 }}
                onClick={() => {
                  const s = JSON.parse(JSON.stringify(sheet));
                  if (!s.bars) s.bars = {};
                  for (const key of ["hp", "inata", "ether", "vigor"]) {
                    const cur = Number(s.bars[key]) || 0;
                    s.bars[key] = cur + Math.floor(cur / 2);
                  }
                  onUpdateSheet(s);
                  alert("Air Break aplicado: +metade das barras atuais (lembrete: dano ×2,5 na narrativa).");
                }}
              >
                Aplicar Air Break (recupera metade das barras atuais)
              </button>
            )}
          </div>
        )}

        {lastRollTotal !== null && (
          <div className="roll-summary">
            {rollResults.length > 0 && (
              <div className="roll-breakdown muted small">
                {isAdvantageRoll ? (
                  <>                    {rollResults.map((r, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : ""}
                        {highlightedResult === i ? (
                          <strong>{r.raw}</strong>
                        ) : (
                          <span>{r.raw}</span>
                        )}
                      </span>
                    ))}
                    {rollModifier !== 0 && (
                      <span>
                        {" "}
                        {rollModifier > 0 ? `+ ${rollModifier}` : `− ${Math.abs(rollModifier)}`}
                      </span>
                    )}
                  </>
                ) : rollResults.length > 1 || rollModifier !== 0 ? (
                  <>
                    {rollResults.map((r) => r.raw).join(" + ")}
                    {rollModifier !== 0 && (
                      <span>
                        {" "}
                        {rollModifier > 0 ? `+ ${rollModifier}` : `− ${Math.abs(rollModifier)}`}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            )}
            <div className="roll-total">
              <span className="roll-total-label">Total:</span>
              <span className="roll-total-value">{lastRollTotal}</span>
            </div>
          </div>
        )}

        <div className="results">
          <div className="muted small">Resultados dos dados</div>
          <div className="results-grid">
            {rollResults.map((r, i) => (
              <div
                key={i}
                className={`result-item ${highlightedResult === i ? "highlighted" : ""}`}
              >
                <div className="result-number">
                  {isAdvantageRoll ? (
                    <>
                      <strong>{r.raw}</strong>
                      {highlightedResult === i && rollModifier !== 0 && (
                        <span className="muted small"> + mod</span>
                      )}
                    </>
                  ) : (
                    <strong>{r.raw}</strong>
                  )}
                </div>
                {(diceType === "d20" || isAdvantageRoll) && haloIndices.some((h) => h.index === i) && (
                  <div
                    className="result-halo"
                    style={{
                      boxShadow: `0 0 12px 6px ${
                        haloIndices.find((h) => h.index === i).color === "red"
                          ? "rgba(220,38,38,.6)"
                          : "rgba(34,197,94,.6)"
                      }`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="quick-actions">
          <h4>Ações rápidas</h4>
          <div className="two-buttons">
            <button
              className="btn-primary"
              onClick={() => rollAdvantageDisadvantage(true)}
            >
              Vantagem (d20x2)
            </button>
            <button
              className="btn-danger"
              onClick={() => rollAdvantageDisadvantage(false)}
            >
              Desvantagem (d20x2)
            </button>
          </div>
          <div className="muted small">
            Defina o modificador acima, depois clique em Vantagem/Desvantagem.
            Dicas: 1 → falha crítica. 20 → sucesso crítico.
          </div>
        </div>

        <div className="shortcuts-section" style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <h4>Atalhos</h4>
          {(shortcuts || []).length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0" }}>
              {shortcuts.map((sc) => (
                <li key={sc.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <button type="button" className="btn-primary small" onClick={() => rollShortcut(sc)}>
                    Rolar
                  </button>
                  <span style={{ flex: 1 }}>{sc.label}</span>
                  <span className="muted small">
                    {sc.diceString}
                    {sc.modifierAttr && sc.modifierAttr !== "puro"
                      ? ` +${sc.modifierAttr.toUpperCase()}`
                      : " · Puro"}
                  </span>
                  {onUpdateSheet && (
                    <button type="button" className="link-danger small" onClick={() => removeShortcut(sc.id)} aria-label="Remover">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {showShortcutForm ? (
            <div style={{ marginBottom: "12px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
              <input
                type="text"
                placeholder="Nome do atalho"
                value={newShortcutLabel}
                onChange={(e) => setNewShortcutLabel(e.target.value)}
                className="input-new"
                style={{ width: "100%", marginBottom: "8px" }}
              />
              <input
                type="text"
                placeholder="Fórmula (ex: 1d20, 2d6)"
                value={newShortcutDiceString}
                onChange={(e) => setNewShortcutDiceString(e.target.value)}
                className="input-new"
                style={{ width: "100%", marginBottom: "8px" }}
              />
              <select
                value={newShortcutModifierAttr}
                onChange={(e) => setNewShortcutModifierAttr(e.target.value)}
                className="select"
                style={{ width: "100%", marginBottom: "8px" }}
              >
                <option value="puro">Puro (0)</option>
                {Object.entries(stats).map(([k, v]) => (
                  <option key={k} value={k}>{k.toUpperCase()} ({v})</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn-primary small" onClick={addShortcut} disabled={!newShortcutLabel.trim()}>
                  Adicionar
                </button>
                <button type="button" className="btn-danger small" onClick={() => { setShowShortcutForm(false); setNewShortcutLabel(""); setNewShortcutDiceString("1d20"); setNewShortcutModifierAttr("puro"); }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            onUpdateSheet && (
              <button type="button" className="btn-primary small" onClick={() => setShowShortcutForm(true)}>
                + Criar atalho
              </button>
            )
          )}
        </div>

        <div className="quick-view">
          <h4>Visão rápida</h4>
          <div className="quick-list">
            <div>HP: <span className="bold">{sheet.bars?.hp || 0}</span> / <span className="bold">{sheet.bars?.maxHp || sheet.bars?.hp || 0}</span></div>
            <div>Inata: <span className="bold">{sheet.bars?.inata || 0}</span></div>
            <div>Ether: <span className="bold">{sheet.bars?.ether || 0}</span></div>
            <div>Vigor: <span className="bold">{sheet.bars?.vigor || 0}</span></div>
            <div>Nível: <span className="bold">{sheet.level || 1}</span></div>
          </div>
        </div>
      </div>
      )}

      {activeTab === "history" && (
        <div className="dice-panel">
          <h3>Histórico de Rolagens</h3>
          
          <div className="history-controls">
            <input
              type="text"
              placeholder="Filtrar por tipo de dado..."
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="input-new"
            />
          </div>

          {historyStats && (
            <div className="history-stats">
              <div className="stat-item">
                <span className="stat-label">Média:</span>
                <span className="stat-value">{historyStats.average}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Máximo:</span>
                <span className="stat-value">{historyStats.max}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Mínimo:</span>
                <span className="stat-value">{historyStats.min}</span>
              </div>
            </div>
          )}

          <div className="history-list">
            {filteredHistory.length === 0 ? (
              <div className="empty-state">Nenhuma rolagem encontrada.</div>
            ) : (
              filteredHistory.map((roll, idx) => (
                <div key={roll.id || idx} className="history-item">
                  <div className="history-header">
                    <div className="history-dice">{roll.diceString || "N/A"}</div>
                    <div className="history-total">{roll.total || 0}</div>
                  </div>
                  <div className="history-details">
                    {roll.results && roll.results.length > 0 && (
                      <div className="history-results">
                        Resultados: {roll.results.join(", ")}
                      </div>
                    )}
                    {roll.modifier !== 0 && (
                      <div className="history-modifier">
                        Modificador: {roll.modifier > 0 ? "+" : ""}{roll.modifier}
                      </div>
                    )}
                    {roll.attribute && roll.attribute !== "puro" && (
                      <div className="history-attribute">
                        Atributo: {roll.attribute.toUpperCase()}
                      </div>
                    )}
                    <div className="history-time">
                      {formatTimestamp(roll.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

