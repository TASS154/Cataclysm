import React, { useState, useRef, useEffect } from "react";
import { rollDie, dieSides } from "../utils/dice";
import { saveRollToHistory, getRollHistory } from "../services/rollHistoryService";
import "./DiceRoller.css";

export default function DiceRoller({ 
  sheet, 
  username, 
  onRollComplete 
}) {
  const [diceType, setDiceType] = useState("d20");
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
  const flashTimer = useRef(null);
  const haloTimer = useRef(null);

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
    const results = [];
    const haloIndices = [];

    const attrMod = selectedModAttr === "puro" ? 0 : sheet.stats[selectedModAttr] || 0;
    const totalMod = attrMod + Number(manualMod || 0);

    for (let i = 0; i < count; i++) {
      const r = rollDie(sides);
      const finalValue = r + totalMod;
      results.push({ raw: r, mod: totalMod, total: finalValue });

      if (sides === 20) {
        if (r === 1) triggerFullFlash("red");
        if (r === 20) triggerFullFlash("green");
        if (r === 2 || r === 19) haloIndices.push({ index: i, color: r === 2 ? "red" : "green" });
      }
    }
    
    const totalSum = results.reduce((sum, r) => sum + r.total, 0);
    setRollResults(results);
    setLastRollTotal(totalSum);
    setHaloIndices(haloIndices);
    setHighlightedResult(null);
    
    // Save to Firebase
    if (username) {
      saveRollToHistory(username, {
        diceString: `${count}${type}`,
        results: results.map(r => r.raw),
        modifier: totalMod,
        total: totalSum,
        attribute: selectedModAttr,
        manualMod: Number(manualMod || 0)
      });
    }
    
    if (onRollComplete) {
      onRollComplete({ results, total: totalSum, diceString: `${count}${type}` });
    }
    
    if (haloIndices.length > 0) {
      clearTimeout(haloTimer.current);
      haloTimer.current = setTimeout(() => setHaloIndices([]), 1200);
    }
  };

  const rollAdvantageDisadvantage = (isAdvantage) => {
    const a = [rollDie(20), rollDie(20)];
    const haloIndices = [];
    a.forEach((r, i) => {
      if (r === 2) haloIndices.push({ index: i, color: "red" });
      if (r === 19) haloIndices.push({ index: i, color: "green" });
    });
    const results = a.map((r) => ({ raw: r, mod: 0, total: r }));
    const highlightIndex = isAdvantage
      ? results.findIndex((r) => r.raw === Math.max(...a))
      : results.findIndex((r) => r.raw === Math.min(...a));
    
    const totalSum = results.reduce((sum, r) => sum + r.total, 0);
    setRollResults(results);
    setLastRollTotal(totalSum);
    setHighlightedResult(highlightIndex);
    if (a.includes(20)) triggerFullFlash("green");
    if (a.includes(1)) triggerFullFlash("red");
    setHaloIndices(haloIndices);
    
    if (username) {
      saveRollToHistory(username, {
        diceString: isAdvantage ? "Vantagem (d20x2)" : "Desvantagem (d20x2)",
        results: a,
        modifier: 0,
        total: totalSum,
        attribute: "puro",
        manualMod: 0
      });
    }
    
    if (haloIndices.length > 0) {
      clearTimeout(haloTimer.current);
      haloTimer.current = setTimeout(() => setHaloIndices([]), 1200);
    }
  };

  const rollInitiative = () => {
    const result = rollDie(20);
    setRollResults([{ raw: result, mod: 0, total: result }]);
    setLastRollTotal(result);
    setHighlightedResult(null);
    setHaloIndices([]);
    
    if (result === 1) triggerFullFlash("red");
    if (result === 20) triggerFullFlash("green");
    
    if (username) {
      saveRollToHistory(username, {
        diceString: "Iniciativa (d20)",
        results: [result],
        modifier: 0,
        total: result,
        attribute: "puro",
        manualMod: 0
      });
    }
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
            {Object.entries(sheet.stats || {}).map(([k, v]) => (
              <option key={k} value={k}>
                {k.toUpperCase()} ({v})
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
        
        {lastRollTotal !== null && (
          <div className="roll-summary">
            <div className="roll-total">
              <span className="roll-total-label">Total:</span>
              <span className="roll-total-value">{lastRollTotal}</span>
            </div>
          </div>
        )}

        <div className="results">
          <div className="muted small">Resultados</div>
          <div className="results-grid">
            {rollResults.map((r, i) => (
              <div
                key={i}
                className={`result-item ${highlightedResult === i ? "highlighted" : ""}`}
              >
                <div className="result-number">
                  {r.raw} + {r.mod} = <strong>{r.total}</strong>
                </div>
                {diceType === "d20" && haloIndices.some((h) => h.index === i) && (
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
          <div className="muted small">Dicas: 1 → falha crítica. 20 → sucesso crítico.</div>
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

