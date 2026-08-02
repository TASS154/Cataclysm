import {
  applyTurnRegen,
  tickEffects,
  normalizeEffect,
} from "./rampageRules";
import { advanceTurn, getCurrentParticipant, normalizeRoundTracker } from "./roundTracker";
import { fetchCharacterSheet, writeCharacterSheet } from "../services/characterPatchService";

/**
 * Resolve personagem da entrada da iniciativa a partir dos tokens.
 */
export function resolveParticipantCharacter(participant, tokens, gmUsername) {
  if (!participant) return null;
  if (participant.ownerUsername && participant.ownerUsername !== gmUsername) {
    const token = (tokens || []).find(
      (t) => t.ownerUsername === participant.ownerUsername && t.characterId
    );
    return {
      ownerUsername: participant.ownerUsername,
      characterId: token?.characterId || participant.characterId || null,
      tokenId: token?.id || null,
      label: participant.label,
    };
  }
  // NPC — sem ficha de user; combate fica no token.combatState (futuro)
  return {
    ownerUsername: null,
    characterId: null,
    tokenId: participant.tokenId || null,
    label: participant.label,
  };
}

async function applyTickModes(sheet, modes, withRegen) {
  let s = sheet;
  const logs = [];
  if (withRegen) {
    s = applyTurnRegen(s);
    logs.push("Regen PE/Éter");
  }
  for (const mode of modes) {
    const result = tickEffects(s, mode);
    s = result.sheet;
    logs.push(...result.log);
  }
  return { sheet: s, logs };
}

/**
 * Processa avanço de turno: turnEnd do anterior, turnStart (+regen) do novo,
 * e ticks `round` quando a rodada muda.
 */
export async function processTurnAdvance({
  session,
  tokens,
  direction = 1,
}) {
  const gmUsername = session?.gmUsername;
  const before = normalizeRoundTracker(session?.roundTracker);
  const leaving = getCurrentParticipant(before);
  const after = advanceTurn(before, direction);
  const entering = getCurrentParticipant(after);
  const wrappedRound =
    direction > 0 &&
    after.currentRound > before.currentRound;

  const combatLogs = [];

  const leaveTarget = resolveParticipantCharacter(leaving, tokens, gmUsername);
  if (leaveTarget?.ownerUsername && leaveTarget.characterId && direction > 0) {
    const sheet = await fetchCharacterSheet(leaveTarget.ownerUsername, leaveTarget.characterId);
    if (sheet) {
      const { sheet: next, logs } = await applyTickModes(sheet, ["turnEnd"], false);
      await writeCharacterSheet(leaveTarget.ownerUsername, leaveTarget.characterId, next);
      if (logs.length) combatLogs.push({ who: leaveTarget.label, logs, kind: "turnEnd" });
    }
  }

  if (wrappedRound && direction > 0) {
    const seen = new Set();
    for (const p of after.turnOrder) {
      const target = resolveParticipantCharacter(p, tokens, gmUsername);
      if (!target?.ownerUsername || !target.characterId) continue;
      const key = `${target.ownerUsername}/${target.characterId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sheet = await fetchCharacterSheet(target.ownerUsername, target.characterId);
      if (!sheet) continue;
      const { sheet: next, logs } = await applyTickModes(sheet, ["round"], false);
      await writeCharacterSheet(target.ownerUsername, target.characterId, next);
      if (logs.length) combatLogs.push({ who: target.label, logs, kind: "round" });
    }
  }

  const enterTarget = resolveParticipantCharacter(entering, tokens, gmUsername);
  if (enterTarget?.ownerUsername && enterTarget.characterId && direction > 0) {
    const sheet = await fetchCharacterSheet(enterTarget.ownerUsername, enterTarget.characterId);
    if (sheet) {
      const { sheet: next, logs } = await applyTickModes(sheet, ["turnStart"], true);
      await writeCharacterSheet(enterTarget.ownerUsername, enterTarget.characterId, next);
      if (logs.length) combatLogs.push({ who: enterTarget.label, logs, kind: "turnStart" });
    }
  }

  return { tracker: after, combatLogs };
}

export function ensureEffectsNormalized(sheet) {
  if (!sheet) return sheet;
  return {
    ...sheet,
    effects: (sheet.effects || []).map((e) => normalizeEffect(e)),
  };
}
