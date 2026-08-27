/**
 * Export/Import de fichas em JSON — alinhado ao documento Firestore
 * `users/{username}/characters/{characterId}`.
 *
 * Formato do arquivo exportado:
 * {
 *   "_meta": {
 *     "app": "cataclysm",
 *     "type": "character",
 *     "version": 1,
 *     "exportedAt": ISO string,
 *     "groups": ["mecanica", "narrativa", "personalizacao"]
 *   },
 *   "character": { ... }   // mesmos campos/shapes do doc no Firebase
 * }
 *
 * Grupos:
 *  - mecanica:        atributos, habilidades, inventário, equipamento, status (combate)
 *  - narrativa:       anotações, lore, documentos, galeria, traços
 *  - personalizacao:  atalhos de dado, modos
 *
 * Sempre incluídos: name, level, image, isMain, characterInfo
 * (e id/owner/createdAt/rays quando existirem na ficha, para fidelidade ao Firebase)
 */

export const EXPORT_FORMAT_VERSION = 1;

/** Campos canônicos de habilidade no Firestore. */
export const ABILITY_KEYS = [
  "id",
  "title",
  "type",
  "description",
  "effect",
  "damage",
  "cost",
  "field",
  "soundUrl",
];

/** Campos canônicos de traço no Firestore. */
export const TRAIT_KEYS = ["id", "name", "effect"];

export const SHEET_GROUPS = {
  mecanica: {
    label: "Mecânica",
    description:
      "Atributos, habilidades, inventário, equipamento, barras, overheat, moedas, focus.",
    fields: [
      "bars",
      "stats",
      "overheat",
      "abilities",
      "inventory",
      "equipment",
      "coins",
      "caArmorMod",
      "focusType",
      "focusPoints",
      "pendingRollPower",
      "effects",
      "rays",
      "levelUpHistory",
    ],
  },
  narrativa: {
    label: "Narrativa",
    description: "Anotações da ficha, lore, documentos, galeria de imagens, traços.",
    fields: ["notes", "lore", "documents", "galleryImages", "traits"],
  },
  personalizacao: {
    label: "Personalização",
    description: "Atalhos de rolagem e modos personalizados.",
    fields: ["diceShortcuts", "modes"],
  },
};

const ALWAYS_INCLUDED_FIELDS = ["name", "level", "image", "isMain", "characterInfo"];

/** Campos de persistência do doc Firebase (incluídos no export se existirem). */
const PERSISTENCE_FIELDS = ["id", "owner", "createdAt"];

/** Aliases PT → chave canônica (import de dumps manuais / antigos). */
const FIELD_ALIASES = {
  habilidades: "abilities",
  habilidade: "abilities",
  tracos: "traits",
  traços: "traits",
  tracoes: "traits",
  trações: "traits",
  atributo: "stats",
  atributos: "stats",
  barras: "bars",
  inventario: "inventory",
  inventário: "inventory",
  moedas: "coins",
  anotacoes: "notes",
  anotações: "notes",
  condicoes: "effects",
  condições: "effects",
};

function coerceCost(cost) {
  if (typeof cost === "number" && Number.isFinite(cost)) return cost;
  if (typeof cost === "string") {
    if (cost.trim() === "") return 0;
    const n = Number(cost);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function coerceId(id, fallback) {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && id.trim() !== "") {
    const n = Number(id);
    if (Number.isFinite(n)) return n;
    return id;
  }
  return fallback;
}

/**
 * Normaliza uma habilidade para o shape do Firebase.
 * Mantém apenas campos canônicos; `field`/`soundUrl` só se preenchidos.
 */
export function normalizeAbility(raw, index = 0) {
  const src = raw && typeof raw === "object" ? raw : {};
  // Aceita aliases comuns em dumps manuais
  const title =
    src.title ?? src.name ?? src.nome ?? src.titulo ?? src.título ?? "";
  const type = src.type ?? src.tipo ?? "inata";
  const description = src.description ?? src.descricao ?? src.descrição ?? "";
  const effect = src.effect ?? src.efeito ?? "";
  const damage = src.damage ?? src.dano ?? "";
  const cost = coerceCost(src.cost ?? src.custo);
  const field = src.field ?? src.campo ?? "";
  const soundUrl = src.soundUrl ?? src.sound ?? src.som ?? "";

  const out = {
    id: coerceId(src.id, Date.now() + index),
    title: String(title),
    type: String(type || "inata"),
    description: String(description),
    effect: String(effect),
    damage: String(damage),
    cost,
  };

  // Preserva `field` se existir no doc (Firebase / magia)
  if (field != null && String(field).trim() !== "") {
    out.field = String(field);
  }

  if (soundUrl) {
    out.soundUrl = String(soundUrl);
  }

  return out;
}

/**
 * Normaliza um traço para o shape do Firebase: { id, name, effect }.
 */
export function normalizeTrait(raw, index = 0) {
  const src = raw && typeof raw === "object" ? raw : {};
  const name = src.name ?? src.title ?? src.nome ?? src.titulo ?? src.título ?? "";
  const effect = src.effect ?? src.efeito ?? src.description ?? src.descricao ?? "";
  return {
    id: coerceId(src.id, Date.now() + index),
    name: String(name),
    effect: String(effect),
  };
}

export function normalizeAbilities(list) {
  if (!Array.isArray(list)) return [];
  return list.map((a, i) => normalizeAbility(a, i));
}

export function normalizeTraits(list) {
  if (!Array.isArray(list)) return [];
  return list.map((t, i) => normalizeTrait(t, i));
}

/**
 * Aplica aliases PT→EN e normaliza abilities/traits no objeto da ficha.
 */
export function canonicalizeCharacterFields(character) {
  if (!character || typeof character !== "object") return character;
  const out = { ...character };

  Object.entries(FIELD_ALIASES).forEach(([alias, canonical]) => {
    if (out[alias] !== undefined && out[canonical] === undefined) {
      out[canonical] = out[alias];
    }
    if (alias in out) delete out[alias];
  });

  if (out.abilities !== undefined) {
    out.abilities = normalizeAbilities(out.abilities);
  }
  if (out.traits !== undefined) {
    out.traits = normalizeTraits(out.traits);
  }

  return out;
}

/**
 * Constrói o objeto de export filtrando pelos grupos selecionados.
 * abilities/traits saem no shape canônico do Firebase.
 */
export function buildExportPayload(sheet, selectedGroups) {
  if (!sheet || typeof sheet !== "object") {
    throw new Error("Ficha inválida.");
  }
  const groups =
    Array.isArray(selectedGroups) && selectedGroups.length > 0
      ? selectedGroups
      : Object.keys(SHEET_GROUPS);

  const source = canonicalizeCharacterFields(sheet);
  const character = {};

  ALWAYS_INCLUDED_FIELDS.forEach((f) => {
    if (source[f] !== undefined) character[f] = source[f];
  });

  PERSISTENCE_FIELDS.forEach((f) => {
    if (source[f] !== undefined) character[f] = source[f];
  });

  groups.forEach((g) => {
    const def = SHEET_GROUPS[g];
    if (!def) return;
    def.fields.forEach((f) => {
      if (source[f] !== undefined) character[f] = source[f];
    });
  });

  // Garante arrays canônicos mesmo se o grupo foi selecionado e a ficha tinha undefined
  if (groups.includes("mecanica") && character.abilities === undefined) {
    character.abilities = [];
  }
  if (groups.includes("narrativa") && character.traits === undefined) {
    character.traits = [];
  }

  return {
    _meta: {
      app: "cataclysm",
      type: "character",
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      groups,
    },
    character,
  };
}

/**
 * Sanitiza nome de arquivo (espaços viram _, remove caracteres ilegais).
 */
export function safeFilename(name, ext = "json") {
  const base = String(name || "ficha")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const safeBase = base.length > 0 ? base : "ficha";
  return `${safeBase}.${ext}`;
}

/**
 * Aciona download de um payload JSON no navegador.
 */
export function downloadJSON(payload, filename) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "ficha.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Lê um File como JSON. Resolve com objeto, rejeita em erro.
 */
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo selecionado."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const obj = JSON.parse(text);
        resolve(obj);
      } catch {
        reject(new Error("Arquivo não é um JSON válido."));
      }
    };
    reader.readAsText(file);
  });
}

function looksLikeCharacter(obj) {
  if (!obj || typeof obj !== "object") return false;
  return !!(
    obj.name ||
    obj.bars ||
    obj.stats ||
    obj.abilities ||
    obj.traits ||
    obj.habilidades ||
    obj.tracos ||
    obj.traços ||
    obj.trações ||
    obj.tracoes
  );
}

/**
 * Tenta extrair uma ficha de formatos extras (doc cru Firebase, backup users.json).
 */
function extractCharacterCandidate(payload) {
  if (!payload || typeof payload !== "object") return null;

  if (payload._meta && payload.character) {
    return { character: payload.character, wrapped: true };
  }

  if (looksLikeCharacter(payload)) {
    return { character: payload, wrapped: false };
  }

  // Backup: { characters: { id: sheet } } ou array
  if (payload.characters && typeof payload.characters === "object") {
    const chars = Array.isArray(payload.characters)
      ? payload.characters
      : Object.entries(payload.characters).map(([id, c]) =>
          c && typeof c === "object" ? { ...c, id: c.id || id } : c
        );
    const first = chars.find((c) => looksLikeCharacter(c));
    if (first) return { character: first, wrapped: false, fromBackup: true };
  }

  // Backup users.json: { Username: { characters: { id: sheet } } }
  const userKeys = Object.keys(payload);
  if (userKeys.length > 0 && userKeys.length < 200) {
    for (const key of userKeys) {
      const user = payload[key];
      if (!user || typeof user !== "object" || !user.characters) continue;
      const chars = user.characters;
      const list = Array.isArray(chars)
        ? chars
        : Object.entries(chars).map(([id, c]) =>
            c && typeof c === "object" ? { ...c, id: c.id || id } : c
          );
      const first = list.find((c) => looksLikeCharacter(c));
      if (first) return { character: first, wrapped: false, fromBackup: true };
    }
  }

  return null;
}

/**
 * Valida payload importado e retorna a ficha extraída (já canônica).
 *
 * Aceita:
 * - formato com `_meta`/`character`
 * - documento cru do Firestore
 * - aliases PT (habilidades, traços, …)
 * - backup users.json / characters (primeira ficha encontrada)
 *
 * @returns {{ ok: boolean, character?: object, warnings: string[], error?: string }}
 */
export function validateImportPayload(payload) {
  const warnings = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, warnings, error: "Conteúdo inválido." };
  }

  if (payload._meta) {
    if (payload._meta.app && payload._meta.app !== "cataclysm") {
      warnings.push(
        `Arquivo gerado por outro app (${payload._meta.app}). Tentaremos importar mesmo assim.`
      );
    }
    if (payload._meta.type && payload._meta.type !== "character") {
      return {
        ok: false,
        warnings,
        error: `Tipo "${payload._meta.type}" não suportado. Esperado "character".`,
      };
    }
    if (payload._meta.version && payload._meta.version > EXPORT_FORMAT_VERSION) {
      warnings.push(
        `Versão do export (${payload._meta.version}) é mais nova que esta versão do app.`
      );
    }
  }

  const extracted = extractCharacterCandidate(payload);
  if (!extracted) {
    return {
      ok: false,
      warnings,
      error: "Não foi possível identificar uma ficha no arquivo.",
    };
  }

  if (!extracted.wrapped) {
    warnings.push(
      extracted.fromBackup
        ? "Arquivo parece backup do Firebase; importando a primeira ficha encontrada."
        : "Arquivo sem metadados; tratando como documento de ficha (formato Firebase)."
    );
  }

  let character = canonicalizeCharacterFields(extracted.character);

  if (!character || typeof character !== "object") {
    return { ok: false, warnings, error: "Ficha vazia ou inválida." };
  }

  if (!character.name || typeof character.name !== "string") {
    warnings.push("Ficha sem nome; ‘Personagem importado’ será usado.");
    character = { ...character, name: "Personagem importado" };
  }

  return { ok: true, character, warnings };
}

/**
 * Detecta conflitos: por id (igual) e por nome (igual, ignorando caixa).
 */
export function findConflicts(importedCharacter, existingCharacters) {
  const result = { byId: null, byName: null };
  if (!importedCharacter) return result;
  const list = Array.isArray(existingCharacters) ? existingCharacters : [];
  if (importedCharacter.id) {
    result.byId = list.find((c) => c.id === importedCharacter.id) || null;
  }
  if (importedCharacter.name) {
    const nLow = String(importedCharacter.name).trim().toLowerCase();
    result.byName =
      list.find((c) => String(c.name || "").trim().toLowerCase() === nLow) || null;
  }
  return result;
}

/**
 * Gera um nome único para a ficha importada (sufixo "(import)" / "(import N)").
 */
export function makeUniqueName(name, existingCharacters) {
  const list = Array.isArray(existingCharacters) ? existingCharacters : [];
  const lowerSet = new Set(list.map((c) => String(c.name || "").trim().toLowerCase()));
  const base = String(name || "Personagem importado").trim();
  if (!lowerSet.has(base.toLowerCase())) return base;
  const baseImport = `${base} (import)`;
  if (!lowerSet.has(baseImport.toLowerCase())) return baseImport;
  let i = 2;
  while (lowerSet.has(`${base} (import ${i})`.toLowerCase())) i += 1;
  return `${base} (import ${i})`;
}

/**
 * Limpa campos que não devem ser persistidos como vieram do arquivo
 * e garante shapes canônicos de abilities/traits.
 */
export function prepareForImport(character, { keepId = false } = {}) {
  const copy = canonicalizeCharacterFields({ ...character });
  if (!keepId) delete copy.id;
  delete copy._meta;
  copy.createdAt = Date.now();
  return copy;
}
