/**
 * Personalizações por usuário — só quem está listado aqui vê/usa o recurso.
 * Não expor para contas genéricas.
 */

const KAKA_USERNAMES = new Set(["ocmiguel"]);
const KAKA_NAME_RE = /^k[aá]k[aá]$/i;

const MAKU_USERNAMES = new Set(["Mamaku"]);

/** Contador de raios (Kaká / ocmiguel). */
export function canUseKakaRays(username, sheet) {
  if (!username || !KAKA_USERNAMES.has(username)) return false;
  const name = String(sheet?.name || "").trim();
  return KAKA_NAME_RE.test(name);
}

export const KAKA_RAY_PE_COST = 20;

export function getRayCount(sheet) {
  const n = Number(sheet?.rays);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Adiciona raios gastando PE (20 cada). Retorna sheet clonada ou null se PE insuficiente.
 */
export function addRaysSpendingPe(sheet, count = 1) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const cost = n * KAKA_RAY_PE_COST;
  const s = JSON.parse(JSON.stringify(sheet || {}));
  if (!s.bars) s.bars = {};
  const pe = Number(s.bars.inata) || 0;
  if (pe < cost) return { ok: false, sheet: s, error: `PE insuficiente (precisa ${cost}, tem ${pe}).` };
  s.bars.inata = pe - cost;
  s.rays = getRayCount(s) + n;
  return { ok: true, sheet: s };
}

export function removeRays(sheet, count = 1) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const s = JSON.parse(JSON.stringify(sheet || {}));
  s.rays = Math.max(0, getRayCount(s) - n);
  return s;
}

/** Decai 1 raio (rodada). */
export function decayRaysOnRound(sheet) {
  const cur = getRayCount(sheet);
  if (cur <= 0) return { sheet, changed: false };
  const s = JSON.parse(JSON.stringify(sheet));
  s.rays = cur - 1;
  return { sheet: s, changed: true };
}

/** Círculo do Caos no mapa (Maku / Mamaku). */
export function canUseMakuCircle(username) {
  return Boolean(username && MAKU_USERNAMES.has(username));
}

export const MAKU_CIRCLE_DEFAULT_COLOR = "#a855f780";
export const MAKU_CIRCLE_NAME = "Círculo do Caos";
