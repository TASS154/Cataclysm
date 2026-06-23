/** @typedef {{ id: string, label: string, ownerUsername?: string | null, tokenId?: string }} TurnParticipant */

export function defaultRoundTracker() {
  return {
    currentRound: 1,
    currentTurnIndex: 0,
    turnOrder: [],
    reminders: [],
    activeHandoutUrl: "",
    activeSoundUrl: "",
    activeSoundAt: 0,
  };
}

export function normalizeRoundTracker(tracker) {
  const base = defaultRoundTracker();
  if (!tracker || typeof tracker !== "object") return base;
  return {
    ...base,
    ...tracker,
    currentRound: Math.max(1, Number(tracker.currentRound) || 1),
    currentTurnIndex: Math.max(0, Number(tracker.currentTurnIndex) || 0),
    turnOrder: Array.isArray(tracker.turnOrder) ? tracker.turnOrder : [],
    reminders: Array.isArray(tracker.reminders) ? tracker.reminders : [],
  };
}

/**
 * Monta ordem de turno a partir dos tokens visíveis no mapa.
 * Um jogador = uma entrada (mesmo com vários tokens). NPCs do mestre = uma entrada por token.
 */
export function buildTurnOrderFromTokens(tokens, gmUsername) {
  const order = [];
  const seenPlayers = new Set();

  for (const token of tokens || []) {
    const owner = token.ownerUsername;
    if (!owner || owner === gmUsername) continue;
    if (seenPlayers.has(owner)) continue;
    seenPlayers.add(owner);
    order.push({
      id: `player:${owner}`,
      label: token.characterName || owner,
      ownerUsername: owner,
    });
  }

  for (const token of tokens || []) {
    const owner = token.ownerUsername;
    if (owner && owner !== gmUsername) continue;
    order.push({
      id: `token:${token.id}`,
      label: token.characterName || "NPC",
      ownerUsername: owner || null,
      tokenId: token.id,
    });
  }

  return order;
}

export function getCurrentParticipant(tracker) {
  const t = normalizeRoundTracker(tracker);
  const order = t.turnOrder;
  if (!order.length) return null;
  const idx = Math.min(t.currentTurnIndex, order.length - 1);
  return order[idx] || null;
}

export function getGlobalTurnNumber(tracker) {
  const t = normalizeRoundTracker(tracker);
  const len = t.turnOrder.length || 1;
  return (t.currentRound - 1) * len + t.currentTurnIndex + 1;
}

/**
 * Avança ou retrocede um turno. Ao passar do último jogador, inicia nova rodada (ciclo fechado).
 */
export function advanceTurn(tracker, direction = 1) {
  const t = normalizeRoundTracker(tracker);
  const order = t.turnOrder;
  if (!order.length) return t;

  let round = t.currentRound;
  let idx = t.currentTurnIndex;

  if (direction > 0) {
    idx += 1;
    if (idx >= order.length) {
      idx = 0;
      round += 1;
    }
  } else {
    idx -= 1;
    if (idx < 0) {
      if (round > 1) {
        round -= 1;
        idx = order.length - 1;
      } else {
        idx = 0;
      }
    }
  }

  return { ...t, currentRound: round, currentTurnIndex: idx };
}

export function setTurnOrder(tracker, turnOrder) {
  const t = normalizeRoundTracker(tracker);
  const order = Array.isArray(turnOrder) ? turnOrder : [];
  const idx = order.length === 0 ? 0 : Math.min(t.currentTurnIndex, order.length - 1);
  return { ...t, turnOrder: order, currentTurnIndex: idx };
}

export function moveTurnOrderEntry(tracker, index, direction) {
  const t = normalizeRoundTracker(tracker);
  const order = [...t.turnOrder];
  const next = index + direction;
  if (next < 0 || next >= order.length) return t;
  [order[index], order[next]] = [order[next], order[index]];

  let idx = t.currentTurnIndex;
  if (idx === index) idx = next;
  else if (idx === next) idx = index;

  return { ...t, turnOrder: order, currentTurnIndex: idx };
}

export function formatTurnBadge(tracker) {
  const t = normalizeRoundTracker(tracker);
  const current = getCurrentParticipant(t);
  const total = t.turnOrder.length;
  if (!current || !total) {
    return `Rod. ${t.currentRound}`;
  }
  return `Rod. ${t.currentRound} · ${current.label} (${t.currentTurnIndex + 1}/${total})`;
}
