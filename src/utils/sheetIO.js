/**
 * Export/Import de fichas em JSON.
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
 *   "character": { ... }   // campos da ficha conforme grupos selecionados
 * }
 *
 * Os grupos seguem o que foi pedido pelo usuário:
 *  - mecanica:        atributos, habilidades, inventário, equipamento, status (combate)
 *  - narrativa:       anotações, lore, documentos, galeria, traços
 *  - personalizacao:  atalhos de dado, modos
 *
 * Campos sempre incluídos no export (para a ficha funcionar minimamente):
 *  - name, level, image, isMain, characterInfo
 */

export const EXPORT_FORMAT_VERSION = 1;

export const SHEET_GROUPS = {
  mecanica: {
    label: "Mecânica",
    description:
      "Atributos, habilidades, inventário, equipamento, barras, moedas, focus.",
    fields: [
      "bars",
      "stats",
      "abilities",
      "inventory",
      "equipment",
      "coins",
      "caArmorMod",
      "focusType",
      "focusPoints",
      "pendingRollPower",
      "effects",
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

/**
 * Constrói o objeto de export filtrando pelos grupos selecionados.
 * @param {object} sheet - ficha completa
 * @param {string[]} selectedGroups - ids: "mecanica" | "narrativa" | "personalizacao"
 * @returns {object} payload pronto para serializar
 */
export function buildExportPayload(sheet, selectedGroups) {
  if (!sheet || typeof sheet !== "object") {
    throw new Error("Ficha inválida.");
  }
  const groups = Array.isArray(selectedGroups) && selectedGroups.length > 0
    ? selectedGroups
    : Object.keys(SHEET_GROUPS);

  const character = {};
  ALWAYS_INCLUDED_FIELDS.forEach((f) => {
    if (sheet[f] !== undefined) character[f] = sheet[f];
  });

  groups.forEach((g) => {
    const def = SHEET_GROUPS[g];
    if (!def) return;
    def.fields.forEach((f) => {
      if (sheet[f] !== undefined) character[f] = sheet[f];
    });
  });

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

/**
 * Valida payload importado e retorna a ficha extraída.
 * Aceita tanto o formato com `_meta`/`character` quanto uma ficha "crua"
 * (sem _meta) caso o usuário cole um JSON manualmente.
 *
 * @returns {{ ok: boolean, character?: object, warnings: string[], error?: string }}
 */
export function validateImportPayload(payload) {
  const warnings = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, warnings, error: "Conteúdo inválido." };
  }

  let character = null;

  if (payload._meta && payload.character) {
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
    character = payload.character;
  } else if (payload.name || payload.bars || payload.stats) {
    warnings.push("Arquivo sem metadados; tratando como ficha crua.");
    character = payload;
  } else {
    return { ok: false, warnings, error: "Não foi possível identificar uma ficha no arquivo." };
  }

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
 * (id é responsabilidade do Firestore; createdAt vira novo).
 */
export function prepareForImport(character, { keepId = false } = {}) {
  const copy = { ...character };
  if (!keepId) delete copy.id;
  delete copy._meta;
  copy.createdAt = Date.now();
  return copy;
}
