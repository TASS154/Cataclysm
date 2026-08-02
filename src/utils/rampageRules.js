/** Núcleo mecânico Rampage — fórmulas e migração de ficha. */

export const CORE_STATS = ["fis", "des", "men", "car"];
export const SPECIAL_STATS = ["inata", "arteDivina", "magica"];
export const ALL_STATS = [...CORE_STATS, ...SPECIAL_STATS];

export const STAT_LABELS = {
  fis: "FIS",
  des: "DES",
  men: "MEN",
  car: "CAR",
  inata: "Inata",
  arteDivina: "Arte Divina",
  magica: "Mágica",
};

export const MAGIC_FIELDS = [
  "Manipulação",
  "Invocação",
  "Conjuração",
  "Transmutação",
  "Abjuração",
  "Metamagia",
];

export const EMPTY_STATS = {
  fis: 0,
  des: 0,
  men: 0,
  car: 0,
  inata: 0,
  arteDivina: 0,
  magica: 0,
};

const OLD_STAT_KEYS = ["for", "con", "int", "sab"];

export function hasLegacyStats(stats = {}) {
  return OLD_STAT_KEYS.some((k) => stats[k] !== undefined && stats[k] !== null);
}

/** Converte FOR/CON/INT/SAB → FIS/MEN (ceil). Mantém DES/CAR/especiais. */
export function migrateStats(stats = {}) {
  if (!hasLegacyStats(stats)) {
    return { ...EMPTY_STATS, ...pickKnownStats(stats) };
  }
  const forVal = Number(stats.for) || 0;
  const conVal = Number(stats.con) || 0;
  const intVal = Number(stats.int) || 0;
  const sabVal = Number(stats.sab) || 0;
  return {
    fis: stats.fis !== undefined ? Number(stats.fis) || 0 : Math.ceil((forVal + conVal) / 2),
    des: Number(stats.des) || 0,
    men: stats.men !== undefined ? Number(stats.men) || 0 : Math.ceil((intVal + sabVal) / 2),
    car: Number(stats.car) || 0,
    inata: Number(stats.inata) || 0,
    arteDivina: Number(stats.arteDivina) || 0,
    magica: Number(stats.magica) || 0,
  };
}

function pickKnownStats(stats) {
  const out = {};
  for (const k of ALL_STATS) {
    if (stats[k] !== undefined) out[k] = Number(stats[k]) || 0;
  }
  return out;
}

export function floor(n) {
  return Math.floor(Number(n) || 0);
}

/** CA = floor(1.5×nível + FIS/4 + DES/4) + armorMod */
export function computeCA(level, fis, des, armorMod = 0) {
  const lvl = Number(level) || 1;
  const f = Number(fis) || 0;
  const d = Number(des) || 0;
  return floor(1.5 * lvl + f / 4 + d / 4) + (Number(armorMod) || 0);
}

export function getBarMaxes(sheet) {
  const level = Number(sheet?.level) || 1;
  const bars = sheet?.bars || {};
  return {
    hp: Number(bars.maxHp) || Number(bars.hp) || 0,
    inata: Number(bars.maxInata) || level * 200,
    ether: Number(bars.maxEther) || level * 100,
    vigor: Number(bars.maxVigor) || level * 50,
  };
}

/** Descanso curto: +floor(atual/2) em cada barra, cap no máx. */
export function applyShortRestBars(sheet) {
  const s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const maxes = getBarMaxes(s);
  for (const key of ["hp", "inata", "ether", "vigor"]) {
    const cur = Number(s.bars[key]) || 0;
    s.bars[key] = Math.min(maxes[key], cur + floor(cur / 2));
  }
  return s;
}

export function clearOverheat(sheet) {
  const s = { ...sheet, overheat: { pe: false, ether: false, vigor: false } };
  return s;
}

export function normalizeOverheat(sheet) {
  const o = sheet?.overheat || {};
  return {
    pe: !!o.pe,
    ether: !!o.ether,
    vigor: !!o.vigor,
  };
}

/** Marca Overheat quando barra chega a 0. */
export function syncOverheatFlags(sheet) {
  const bars = sheet?.bars || {};
  const o = normalizeOverheat(sheet);
  if ((Number(bars.inata) || 0) <= 0) o.pe = true;
  if ((Number(bars.ether) || 0) <= 0) o.ether = true;
  if ((Number(bars.vigor) || 0) <= 0) o.vigor = true;
  return { ...sheet, overheat: o };
}

/** Limpa Overheat se recuperou ≥ metade do máx. */
export function clearOverheatIfRecovered(sheet) {
  const maxes = getBarMaxes(sheet);
  const bars = sheet?.bars || {};
  const o = normalizeOverheat(sheet);
  if (o.pe && (Number(bars.inata) || 0) >= floor(maxes.inata / 2)) o.pe = false;
  if (o.ether && (Number(bars.ether) || 0) >= floor(maxes.ether / 2)) o.ether = false;
  if (o.vigor && (Number(bars.vigor) || 0) >= floor(maxes.vigor / 2)) o.vigor = false;
  return { ...sheet, overheat: o };
}

/** resource: "pe"|"inata"|"ether"|"vigor" */
export function canSpendResource(sheet, resource) {
  const o = normalizeOverheat(sheet);
  const key = resource === "inata" || resource === "pe" ? "pe" : resource;
  if (key === "pe") return !o.pe;
  if (key === "ether") return !o.ether;
  if (key === "vigor") return !o.vigor;
  return true;
}

/** Regen no início do turno: PE +10×nível, Éter +5×nível. */
export function applyTurnRegen(sheet) {
  let s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const level = Number(s.level) || 1;
  const maxes = getBarMaxes(s);
  s.bars.inata = Math.min(maxes.inata, (Number(s.bars.inata) || 0) + 10 * level);
  s.bars.ether = Math.min(maxes.ether, (Number(s.bars.ether) || 0) + 5 * level);
  s = clearOverheatIfRecovered(s);
  return s;
}

export function critEffect(d20) {
  const n = Number(d20);
  if (n === 1) return { code: "crit-fail", title: "Falha Crítica", detail: "Consequência grave, temporária ou permanente." };
  if (n === 2) return { code: "fail-light", title: "Falha Leve", detail: "Consequência apenas narrativa." };
  if (n === 19) return { code: "crit-19", title: "Acerto Crítico (19)", detail: "Dobra os dados de dano." };
  if (n === 20) return { code: "crit-20", title: "Acerto Crítico (20)", detail: "Dobra os dados de dano e concede vantagem narrativa significativa." };
  return null;
}

/** Air Break: total final múltiplo de 7 (aplica mesmo com crítico). */
export function isAirBreak(finalTotal, _d20) {
  const total = Number(finalTotal);
  if (!Number.isFinite(total) || total === 0) return false;
  return total % 7 === 0;
}

export function woundTier(damage, maxHp) {
  const dmg = Number(damage) || 0;
  const max = Number(maxHp) || 0;
  if (max <= 0 || dmg <= 0) return null;
  const pct = dmg / max;
  if (pct >= 0.75) return { tier: "critico", label: "Ferimento Crítico", pct: 75 };
  if (pct >= 0.5) return { tier: "grave", label: "Ferimento Grave", pct: 50 };
  if (pct >= 0.25) return { tier: "leve", label: "Ferimento Leve", pct: 25 };
  return null;
}

export function rollD12() {
  return 1 + Math.floor(Math.random() * 12);
}

/**
 * Level-up PV: (1 + FIS) d12 → maxHp e hp (cap no novo máx).
 * Também atualiza máximos PE/Éter/Vigor por nível.
 */
export function applyLevelUpHp(sheet, fromLevel, toLevel) {
  const s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const stats = migrateStats(s.stats || {});
  s.stats = stats;
  const fis = Math.max(0, Number(stats.fis) || 0);
  const steps = Math.max(0, (Number(toLevel) || 0) - (Number(fromLevel) || 0));
  const rolls = [];
  let gain = 0;
  for (let step = 0; step < steps; step++) {
    const base = rollD12();
    rolls.push({ kind: "base", value: base });
    gain += base;
    for (let i = 0; i < fis; i++) {
      const v = rollD12();
      rolls.push({ kind: "fis", value: v });
      gain += v;
    }
  }
  const oldMax = Number(s.bars.maxHp) || Number(s.bars.hp) || 0;
  const oldHp = Number(s.bars.hp) || 0;
  const newMax = oldMax + gain;
  s.bars.maxHp = newMax;
  s.bars.hp = Math.min(newMax, oldHp + gain);
  s.level = Number(toLevel) || s.level;
  // sync bar maxes by level
  s.bars.maxInata = (Number(toLevel) || 1) * 200;
  s.bars.maxEther = (Number(toLevel) || 1) * 100;
  s.bars.maxVigor = (Number(toLevel) || 1) * 50;
  return { sheet: s, rolls, gain, fromLevel, toLevel };
}

export function normalizeEffect(effect = {}) {
  return {
    id: effect.id ?? Date.now(),
    name: effect.name || "",
    description: effect.description || "",
    rounds: Number(effect.rounds) || 0,
    damage: Number(effect.damage) || 0,
    effect: effect.effect || "",
    drainType: effect.drainType || "",
    drainAmount: Number(effect.drainAmount) || 0,
    tickMode: ["turnStart", "turnEnd", "round"].includes(effect.tickMode)
      ? effect.tickMode
      : "turnEnd",
    sourceAreaId: effect.sourceAreaId || null,
    continuous: !!effect.continuous,
  };
}

/**
 * Aplica um tick de efeitos filtrados por tickMode.
 * @returns {{ sheet, log: string[] }}
 */
export function tickEffects(sheet, tickMode) {
  let s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const log = [];
  const next = [];
  for (const raw of s.effects || []) {
    const ef = normalizeEffect(raw);
    if (ef.tickMode !== tickMode) {
      next.push(ef);
      continue;
    }
    if (ef.damage > 0) {
      s.bars.hp = Math.max(0, (Number(s.bars.hp) || 0) - ef.damage);
      log.push(`${ef.name || "Efeito"}: -${ef.damage} PV`);
    }
    if (ef.drainType && ef.drainAmount > 0) {
      const barKey = ef.drainType === "pe" ? "inata" : ef.drainType;
      if (["hp", "inata", "ether", "vigor"].includes(barKey)) {
        s.bars[barKey] = Math.max(0, (Number(s.bars[barKey]) || 0) - ef.drainAmount);
        log.push(`${ef.name || "Efeito"}: -${ef.drainAmount} ${barKey}`);
      }
    }
    if (ef.rounds > 0) {
      ef.rounds -= 1;
      if (ef.rounds <= 0) {
        log.push(`${ef.name || "Efeito"} expirou`);
        continue;
      }
    }
    next.push(ef);
  }
  s.effects = next;
  s = syncOverheatFlags(s);
  return { sheet: s, log };
}

export function tipText(key) {
  const tips = {
    "crit-fail": "1 — Falha Crítica: consequência grave.",
    "fail-light": "2 — Falha Leve: consequência narrativa.",
    "crit-19": "19 — Dobra os dados de dano.",
    "crit-20": "20 — Dobra dano + vantagem narrativa.",
    "air-break": "Air Break: total múltiplo de 7 (também com crítico). Dano ×2,5 e recupera metade das barras atuais.",
    overheat: "Overheat: recurso zerado fica inutilizável até recuperar ≥ metade do máximo ou Descanso Longo.",
    ferimentos: "Ferimentos: golpe ≥25/50/75% do PV máx → Leve / Grave / Crítico.",
    esquiva: "Esquiva (Reação): 1d20+DES vs ataque. Sucesso evita; falha = Dano Agravado.",
    aguentar: "Aguentar: 1d20+FIS vs ataque (não gasta Reação). Sucesso = metade do dano; falha = Agravado.",
  };
  return tips[key] || "";
}
