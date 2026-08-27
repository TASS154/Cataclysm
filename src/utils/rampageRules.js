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
 * Rola os d12 do level-up sem aplicar na ficha.
 * @returns {{ rolls: Array<{kind:string,value:number}>, gain: number, diceCount: number, steps: number, fisDelta: number }}
 */
export function rollLevelUpDice(fromLevel, toLevel, fisDelta = 0) {
  const steps = Math.max(0, (Number(toLevel) || 0) - (Number(fromLevel) || 0));
  const fisGain = Math.max(0, Math.floor(Number(fisDelta) || 0));
  const rolls = [];
  let gain = 0;
  for (let i = 0; i < steps; i++) {
    const v = rollD12();
    rolls.push({ kind: "level", value: v });
    gain += v;
  }
  for (let i = 0; i < fisGain; i++) {
    const v = rollD12();
    rolls.push({ kind: "fis", value: v });
    gain += v;
  }
  return { rolls, gain, diceCount: steps + fisGain, steps, fisDelta: fisGain };
}

/**
 * Level-up PV: (níveis ganhos + ΔFIS base) d12 → maxHp e hp.
 * Não usa FIS total nem bônus de modos — só o delta de FIS base ganho neste level-up.
 * Também atualiza máximos PE/Éter/Vigor por nível.
 *
 * @param {object} sheet
 * @param {number} fromLevel
 * @param {number} toLevel
 * @param {{ fisDelta?: number, rolls?: Array<{kind:string,value:number}>, gain?: number }} [opts]
 */
export function applyLevelUpHp(sheet, fromLevel, toLevel, { fisDelta = 0, rolls: preRolls, gain: preGain } = {}) {
  const s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.bars) s.bars = {};
  const stats = migrateStats(s.stats || {});
  s.stats = stats;
  const steps = Math.max(0, (Number(toLevel) || 0) - (Number(fromLevel) || 0));
  const fisGain = Math.max(0, Math.floor(Number(fisDelta) || 0));

  let rolls;
  let gain;
  if (Array.isArray(preRolls) && preRolls.length > 0) {
    rolls = preRolls.map((r) => ({ kind: r.kind || "level", value: Number(r.value) || 0 }));
    gain = preGain != null ? Number(preGain) || 0 : rolls.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  } else {
    const rolled = rollLevelUpDice(fromLevel, toLevel, fisGain);
    rolls = rolled.rolls;
    gain = rolled.gain;
  }

  const oldMax = Number(s.bars.maxHp) || Number(s.bars.hp) || 0;
  const oldHp = Number(s.bars.hp) || 0;
  const snapshot = {
    fromLevel: Number(fromLevel) || 0,
    toLevel: Number(toLevel) || 0,
    deltas: {}, // filled by caller
    fisDelta: fisGain,
    rolls,
    gain,
    diceCount: rolls.length,
    maxHpBefore: oldMax,
    hpBefore: oldHp,
    maxInataBefore: Number(s.bars.maxInata) || (Number(fromLevel) || 1) * 200,
    maxEtherBefore: Number(s.bars.maxEther) || (Number(fromLevel) || 1) * 100,
    maxVigorBefore: Number(s.bars.maxVigor) || (Number(fromLevel) || 1) * 50,
    at: Date.now(),
  };

  const newMax = oldMax + gain;
  s.bars.maxHp = newMax;
  s.bars.hp = Math.min(newMax, oldHp + gain);
  s.level = Number(toLevel) || s.level;
  s.bars.maxInata = (Number(toLevel) || 1) * 200;
  s.bars.maxEther = (Number(toLevel) || 1) * 100;
  s.bars.maxVigor = (Number(toLevel) || 1) * 50;
  return { sheet: s, rolls, gain, fromLevel, toLevel, fisDelta: fisGain, diceCount: rolls.length, snapshot };
}

/** Pontos livres por nível (além do +1 automático no atributo inicial). */
export const LEVEL_UP_FREE_POINTS = 3;

/**
 * Fichas já em campanha (lvl >= este valor) não precisam ter initialStat
 * definido na INFO antes do level-up — podem escolher no ritual.
 */
export const LEGACY_INITIAL_STAT_MIN_LEVEL = 10;

export function needsInitialStatBeforeLevelUp(sheet) {
  const level = Number(sheet?.level) || 0;
  const initial = (sheet?.characterInfo || {}).initialStat;
  if (CORE_STATS.includes(initial)) return false;
  if (level >= LEGACY_INITIAL_STAT_MIN_LEVEL) return false;
  return true;
}

/**
 * Desfaz o último registro de levelUpHistory (stats + HP + nível + máximos).
 * @returns {{ ok: boolean, sheet?: object, error?: string }}
 */
export function undoLastLevelUp(sheet) {
  const history = Array.isArray(sheet?.levelUpHistory) ? sheet.levelUpHistory : [];
  if (history.length === 0) {
    return { ok: false, error: "Não há level-up para desfazer." };
  }
  const last = history[history.length - 1];
  const s = structuredClone ? structuredClone(sheet) : JSON.parse(JSON.stringify(sheet));
  if (!s.stats) s.stats = { ...EMPTY_STATS };
  if (!s.bars) s.bars = {};

  const deltas = last.deltas || {};
  Object.entries(deltas).forEach(([k, v]) => {
    const n = Number(v) || 0;
    if (!n) return;
    s.stats[k] = Math.max(0, (Number(s.stats[k]) || 0) - n);
  });

  s.level = Number(last.fromLevel) || s.level;
  const gain = Number(last.gain) || 0;
  if (last.maxHpBefore != null) {
    s.bars.maxHp = Number(last.maxHpBefore) || 0;
  } else {
    s.bars.maxHp = Math.max(0, (Number(s.bars.maxHp) || 0) - gain);
  }
  if (last.hpBefore != null) {
    s.bars.hp = Math.min(Number(s.bars.maxHp) || 0, Number(last.hpBefore) || 0);
  } else {
    s.bars.hp = Math.min(Number(s.bars.maxHp) || 0, Math.max(0, (Number(s.bars.hp) || 0) - gain));
  }
  if (last.maxInataBefore != null) s.bars.maxInata = Number(last.maxInataBefore);
  else s.bars.maxInata = (Number(s.level) || 1) * 200;
  if (last.maxEtherBefore != null) s.bars.maxEther = Number(last.maxEtherBefore);
  else s.bars.maxEther = (Number(s.level) || 1) * 100;
  if (last.maxVigorBefore != null) s.bars.maxVigor = Number(last.maxVigorBefore);
  else s.bars.maxVigor = (Number(s.level) || 1) * 50;

  s.levelUpHistory = history.slice(0, -1);
  return { ok: true, sheet: s };
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
