import React, { useEffect, useMemo, useState } from "react";
import {
  CORE_STATS,
  STAT_LABELS,
  LEVEL_UP_FREE_POINTS,
  rollLevelUpDice,
} from "../utils/rampageRules";
import "./LevelUpRitual.css";

/**
 * Overlay de level-up: 3 pontos livres por nível + 1 automático no atributo inicial.
 * Após confirmar alocação, anima os d12 e só então chama onConfirm.
 */
export default function LevelUpRitual({
  open,
  fromLevel,
  toLevel,
  baseStats,
  initialStat,
  requireInitialInInfo = false,
  onInitialStatChange,
  onConfirm,
  onCancel,
}) {
  const levelsGained = Math.max(0, (Number(toLevel) || 0) - (Number(fromLevel) || 0));
  const freeBudget = levelsGained * LEVEL_UP_FREE_POINTS;
  const autoBudget = levelsGained;

  const [chosenInitial, setChosenInitial] = useState(
    CORE_STATS.includes(initialStat) ? initialStat : ""
  );
  const [alloc, setAlloc] = useState(() =>
    Object.fromEntries(CORE_STATS.map((k) => [k, 0]))
  );
  const [phase, setPhase] = useState("alloc"); // alloc | rolling | done
  const [displayRolls, setDisplayRolls] = useState([]);
  const [finalRolls, setFinalRolls] = useState(null);
  const [finalGain, setFinalGain] = useState(0);

  const spentFree = useMemo(
    () => CORE_STATS.reduce((sum, k) => sum + (Number(alloc[k]) || 0), 0),
    [alloc]
  );
  const remaining = freeBudget - spentFree;

  const autoKey = CORE_STATS.includes(chosenInitial) ? chosenInitial : "";
  const totalDelta = useMemo(() => {
    const d = Object.fromEntries(CORE_STATS.map((k) => [k, Number(alloc[k]) || 0]));
    if (autoKey) d[autoKey] = (d[autoKey] || 0) + autoBudget;
    return d;
  }, [alloc, autoKey, autoBudget]);

  const fisDelta = totalDelta.fis || 0;
  const dicePreview = levelsGained + Math.max(0, fisDelta);

  useEffect(() => {
    if (phase !== "rolling" || !finalRolls) return undefined;
    let cancelled = false;
    const targets = finalRolls;
    setDisplayRolls(targets.map((r) => ({ ...r, value: "?", spinning: true })));

    const timers = [];
    targets.forEach((roll, i) => {
      const spin = setInterval(() => {
        if (cancelled) return;
        setDisplayRolls((prev) =>
          prev.map((p, idx) =>
            idx === i && p.spinning
              ? { ...p, value: 1 + Math.floor(Math.random() * 12) }
              : p
          )
        );
      }, 50);
      timers.push(spin);
      const stop = setTimeout(() => {
        clearInterval(spin);
        if (cancelled) return;
        setDisplayRolls((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...roll, spinning: false } : p
          )
        );
      }, 600 + i * 280);
      timers.push(stop);
    });

    const finish = setTimeout(() => {
      if (cancelled) return;
      setPhase("done");
    }, 600 + targets.length * 280 + 400);
    timers.push(finish);

    return () => {
      cancelled = true;
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
    };
  }, [phase, finalRolls]);

  if (!open) return null;

  const bump = (key, dir) => {
    if (phase !== "alloc") return;
    setAlloc((prev) => {
      const cur = Number(prev[key]) || 0;
      if (dir < 0) {
        if (cur <= 0) return prev;
        return { ...prev, [key]: cur - 1 };
      }
      if (remaining <= 0) return prev;
      return { ...prev, [key]: cur + 1 };
    });
  };

  const startRolling = () => {
    if (requireInitialInInfo && !CORE_STATS.includes(initialStat)) {
      alert("Defina o atributo inicial na aba INFO antes do level-up.");
      return;
    }
    if (!autoKey) {
      alert("Escolha o atributo inicial antes de confirmar o level-up.");
      return;
    }
    if (remaining > 0) {
      alert(`Ainda restam ${remaining} ponto(s) para distribuir.`);
      return;
    }
    if (onInitialStatChange && chosenInitial !== initialStat) {
      onInitialStatChange(chosenInitial);
    }
    const rolled = rollLevelUpDice(fromLevel, toLevel, fisDelta);
    setFinalRolls(rolled.rolls);
    setFinalGain(rolled.gain);
    setPhase("rolling");
  };

  const finishConfirm = () => {
    onConfirm({
      deltas: totalDelta,
      fisDelta,
      chosenInitial,
      rolls: finalRolls,
      gain: finalGain,
    });
  };

  return (
    <div className="levelup-overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div className="levelup-panel">
        <h2 id="levelup-title">
          {phase === "alloc" && "Level up!"}
          {phase === "rolling" && "Rolando PV…"}
          {phase === "done" && "Resultado"}
        </h2>
        <p className="levelup-subtitle">
          Nível {fromLevel} → {toLevel}
          {levelsGained > 1 ? ` (${levelsGained} níveis)` : ""}
        </p>

        {phase === "alloc" && (
          <>
            <p className="levelup-hint">
              Distribua <strong>{freeBudget}</strong> ponto(s) livres.
              Mais <strong>{autoBudget}</strong> vai automaticamente para o atributo inicial.
            </p>

            <div className="levelup-initial">
              <label htmlFor="levelup-initial-stat">Atributo inicial</label>
              <select
                id="levelup-initial-stat"
                value={chosenInitial}
                onChange={(e) => setChosenInitial(e.target.value)}
                className="input-login"
                disabled={requireInitialInInfo && CORE_STATS.includes(initialStat)}
              >
                <option value="">Escolha…</option>
                {CORE_STATS.map((k) => (
                  <option key={k} value={k}>
                    {STAT_LABELS[k] || k.toUpperCase()}
                  </option>
                ))}
              </select>
              {autoKey && (
                <span className="muted small">
                  +{autoBudget} automático em {STAT_LABELS[autoKey]}
                </span>
              )}
              {requireInitialInInfo && !CORE_STATS.includes(initialStat) && (
                <span className="muted small" style={{ color: "#f87171" }}>
                  Personagens novos precisam definir o atributo inicial na aba INFO.
                </span>
              )}
            </div>

            <div className="levelup-remaining">
              Pontos livres restantes: <strong>{remaining}</strong> / {freeBudget}
            </div>

            <div className="levelup-stats">
              {CORE_STATS.map((k) => {
                const base = Number(baseStats?.[k]) || 0;
                const free = Number(alloc[k]) || 0;
                const auto = autoKey === k ? autoBudget : 0;
                const next = base + free + auto;
                return (
                  <div key={k} className={`levelup-stat ${autoKey === k ? "is-initial" : ""}`}>
                    <div className="levelup-stat-label">{STAT_LABELS[k] || k}</div>
                    <div className="levelup-stat-values">
                      <span className="muted">{base}</span>
                      <span className="levelup-arrow">→</span>
                      <span className="levelup-next">{next}</span>
                    </div>
                    {(free > 0 || auto > 0) && (
                      <div className="muted small">
                        {free > 0 && `+${free} livre`}
                        {free > 0 && auto > 0 && " · "}
                        {auto > 0 && `+${auto} inicial`}
                      </div>
                    )}
                    <div className="levelup-stat-actions">
                      <button
                        type="button"
                        className="levelup-btn"
                        onClick={() => bump(k, -1)}
                        disabled={free <= 0}
                        aria-label={`Remover ponto de ${k}`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="levelup-btn levelup-btn--plus"
                        onClick={() => bump(k, 1)}
                        disabled={remaining <= 0}
                        aria-label={`Adicionar ponto em ${k}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="levelup-preview">
              PV: rolará <strong>{dicePreview}d12</strong>
              <span className="muted">
                {" "}
                ({levelsGained} do nível
                {fisDelta > 0 ? ` + ${fisDelta} do FIS` : ""}
                ; modos não contam)
              </span>
            </div>

            <div className="levelup-actions">
              <button type="button" className="btn-outline" onClick={onCancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={startRolling}
                disabled={
                  !autoKey ||
                  remaining > 0 ||
                  (requireInitialInInfo && !CORE_STATS.includes(initialStat) && !autoKey)
                }
              >
                Rolar PV e confirmar
              </button>
            </div>
          </>
        )}

        {(phase === "rolling" || phase === "done") && (
          <>
            <div className="levelup-dice-grid">
              {displayRolls.map((r, i) => (
                <div
                  key={i}
                  className={`levelup-die ${r.spinning ? "is-spinning" : "is-settled"} ${
                    r.kind === "fis" ? "is-fis" : "is-level"
                  }`}
                >
                  <span className="levelup-die-value">{r.value}</span>
                  <span className="levelup-die-label">
                    {r.kind === "fis" ? "FIS" : "LVL"}
                  </span>
                </div>
              ))}
            </div>
            {phase === "done" && (
              <div className="levelup-preview">
                Total PV: <strong>+{finalGain}</strong>
              </div>
            )}
            <div className="levelup-actions">
              {phase === "done" ? (
                <button type="button" className="btn-primary" onClick={finishConfirm}>
                  Aplicar na ficha
                </button>
              ) : (
                <button type="button" className="btn-outline" disabled>
                  Rolando…
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
