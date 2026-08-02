import { cellsInArea } from "./mapAreas";
import { normalizeEffect, syncOverheatFlags } from "./rampageRules";
import { fetchCharacterSheet, writeCharacterSheet } from "../services/characterPatchService";

const CONT_PREFIX = "zone-cont:";

/**
 * Reavalia efeitos de zona após um token se mover.
 * continuous: aplica enquanto dentro; remove ao sair.
 * status: aplica ao entrar (se ainda não tiver sourceAreaId).
 */
export async function reevaluateZoneEffectsForToken({ token, areas, gmUsername }) {
  if (!token?.ownerUsername || !token.characterId) return;
  if (token.ownerUsername === gmUsername && String(token.characterId).startsWith("npc-")) return;

  const sheet = await fetchCharacterSheet(token.ownerUsername, token.characterId);
  if (!sheet) return;

  let s = JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  let effects = (s.effects || []).map((e) => normalizeEffect(e));
  const insideIds = new Set(
    (areas || [])
      .filter((a) => a.zoneEffect && cellsInArea(a, token))
      .map((a) => a.id)
  );

  // Remove continuous from areas we're no longer in
  effects = effects.filter((e) => {
    if (!e.continuous || !e.sourceAreaId) return true;
    return insideIds.has(e.sourceAreaId);
  });

  for (const area of areas || []) {
    const ze = area.zoneEffect;
    if (!ze || !insideIds.has(area.id)) continue;

    if (ze.mode === "continuous" && ze.continuous) {
      const id = `${CONT_PREFIX}${area.id}`;
      if (!effects.some((e) => e.id === id)) {
        // Immediate damage on enter for continuous damage zones
        if (ze.continuous.kind === "damage" && ze.continuous.amount > 0) {
          s.bars.hp = Math.max(0, (Number(s.bars.hp) || 0) - Number(ze.continuous.amount));
        }
        effects.push(
          normalizeEffect({
            id,
            name: area.name || "Zona",
            continuous: true,
            sourceAreaId: area.id,
            tickMode: "turnEnd",
            rounds: 0,
            damage: 0,
            description: "Efeito contínuo de área (remove ao sair)",
          })
        );
      }
    }

    if (ze.mode === "status" && ze.statusTemplate) {
      const already = effects.some((e) => e.sourceAreaId === area.id && !e.continuous);
      if (!already) {
        effects.push(
          normalizeEffect({
            ...ze.statusTemplate,
            id: Date.now() + Math.random(),
            sourceAreaId: area.id,
          })
        );
      }
    }
  }

  s.effects = effects;
  s = syncOverheatFlags(s);
  await writeCharacterSheet(token.ownerUsername, token.characterId, s);
}
