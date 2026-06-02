import React, { useEffect, useRef, useState } from "react";
import {
  SHEET_GROUPS,
  buildExportPayload,
  downloadJSON,
  safeFilename,
  readJSONFile,
  validateImportPayload,
  findConflicts,
  makeUniqueName,
  prepareForImport,
} from "../utils/sheetIO";
import "./ImportExportModal.css";

const ALL_GROUP_IDS = Object.keys(SHEET_GROUPS);

export default function ImportExportModal({
  open,
  mode = "menu", // "menu" | "export" | "import"
  onClose,
  sheet, // ficha selecionada para exportar
  characters, // lista de fichas existentes (para detectar conflitos)
  onImportConfirmed, // (preparedCharacter, options) => Promise<void>
}) {
  const [activeMode, setActiveMode] = useState(mode);
  const [selectedGroups, setSelectedGroups] = useState(ALL_GROUP_IDS);
  const fileInputRef = useRef(null);

  // import state
  const [parsedPayload, setParsedPayload] = useState(null);
  const [parsedCharacter, setParsedCharacter] = useState(null);
  const [parsedWarnings, setParsedWarnings] = useState([]);
  const [parseError, setParseError] = useState("");
  const [conflict, setConflict] = useState(null); // {byId, byName}
  const [conflictChoice, setConflictChoice] = useState("new"); // "new" | "overwrite" | "skip"
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveMode(mode);
    setSelectedGroups(ALL_GROUP_IDS);
    setParsedPayload(null);
    setParsedCharacter(null);
    setParsedWarnings([]);
    setParseError("");
    setConflict(null);
    setConflictChoice("new");
    setImporting(false);
  }, [open, mode]);

  if (!open) return null;

  const toggleGroup = (id) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const doExport = () => {
    try {
      const payload = buildExportPayload(sheet, selectedGroups);
      const filename = safeFilename(`${sheet?.name || "ficha"}-cataclysm`);
      downloadJSON(payload, filename);
    } catch (err) {
      console.error(err);
      alert("Erro ao exportar: " + err.message);
    }
  };

  const handleFilePicked = async (file) => {
    setParseError("");
    setParsedPayload(null);
    setParsedCharacter(null);
    setParsedWarnings([]);
    setConflict(null);
    if (!file) return;
    try {
      const obj = await readJSONFile(file);
      const validation = validateImportPayload(obj);
      if (!validation.ok) {
        setParseError(validation.error || "Arquivo inválido.");
        setParsedWarnings(validation.warnings || []);
        return;
      }
      setParsedPayload(obj);
      setParsedCharacter(validation.character);
      setParsedWarnings(validation.warnings || []);
      const c = findConflicts(validation.character, characters);
      if (c.byId || c.byName) {
        setConflict(c);
        setConflictChoice("new");
      }
    } catch (err) {
      console.error(err);
      setParseError(err.message || "Falha ao ler arquivo.");
    }
  };

  const confirmImport = async () => {
    if (!parsedCharacter) return;
    try {
      setImporting(true);

      if (conflict && conflictChoice === "skip") {
        onClose && onClose();
        return;
      }

      let prepared = prepareForImport(parsedCharacter, {
        keepId: conflict && conflictChoice === "overwrite",
      });

      if (conflict && conflictChoice === "overwrite") {
        const target = conflict.byId || conflict.byName;
        if (target?.id) prepared.id = target.id;
      } else {
        prepared.name = makeUniqueName(prepared.name, characters);
      }

      await onImportConfirmed(prepared, {
        action: conflict ? conflictChoice : "new",
      });
      onClose && onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content import-export-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-export-header">
          <div className="import-export-tabs">
            <button
              type="button"
              className={`import-export-tab ${activeMode === "export" ? "active" : ""}`}
              onClick={() => setActiveMode("export")}
            >
              Exportar
            </button>
            <button
              type="button"
              className={`import-export-tab ${activeMode === "import" ? "active" : ""}`}
              onClick={() => setActiveMode("import")}
            >
              Importar
            </button>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {activeMode === "export" ? (
          <div className="import-export-body">
            {!sheet ? (
              <div className="muted">
                Selecione uma ficha primeiro para exportar.
              </div>
            ) : (
              <>
                <div className="export-target">
                  <strong>Ficha:</strong> {sheet.name || "Sem nome"}
                  {sheet.level ? <span className="muted"> · Nível {sheet.level}</span> : null}
                </div>
                <p className="muted">
                  Escolha quais grupos de informações exportar. Campos sempre incluídos:
                  nome, nível, imagem, info de personagem.
                </p>
                <div className="export-groups">
                  {ALL_GROUP_IDS.map((id) => {
                    const def = SHEET_GROUPS[id];
                    const checked = selectedGroups.includes(id);
                    return (
                      <label
                        key={id}
                        className={`export-group-card ${checked ? "checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(id)}
                        />
                        <div>
                          <div className="export-group-title">{def.label}</div>
                          <div className="export-group-desc">{def.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="import-export-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setSelectedGroups(ALL_GROUP_IDS)}
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setSelectedGroups([])}
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={doExport}
                    disabled={selectedGroups.length === 0}
                  >
                    Baixar JSON
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="import-export-body">
            <p className="muted">
              Importe uma ficha exportada do Cataclysm (arquivo .json). Conflitos
              de nome ou ID podem ser tratados antes da confirmação.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="input-login"
              onChange={(e) => handleFilePicked(e.target.files?.[0])}
            />

            {parseError && (
              <div className="error-message">{parseError}</div>
            )}

            {parsedWarnings.length > 0 && (
              <ul className="import-warnings">
                {parsedWarnings.map((w, i) => (
                  <li key={i}>⚠️ {w}</li>
                ))}
              </ul>
            )}

            {parsedCharacter && (
              <div className="import-preview">
                <h4>Ficha encontrada</h4>
                <div>
                  <strong>{parsedCharacter.name}</strong>
                  {parsedCharacter.level ? (
                    <span className="muted"> · Nível {parsedCharacter.level}</span>
                  ) : null}
                </div>
                {parsedPayload?._meta?.groups && (
                  <div className="muted">
                    Grupos no arquivo: {parsedPayload._meta.groups.join(", ")}
                  </div>
                )}
              </div>
            )}

            {conflict && (
              <div className="import-conflict">
                <h4>Conflito detectado</h4>
                {conflict.byId && (
                  <div className="muted">
                    Já existe ficha com o mesmo ID: <strong>{conflict.byId.name}</strong>
                  </div>
                )}
                {conflict.byName && !conflict.byId && (
                  <div className="muted">
                    Já existe ficha com o mesmo nome: <strong>{conflict.byName.name}</strong>
                  </div>
                )}
                <div className="import-conflict-options">
                  <label>
                    <input
                      type="radio"
                      name="conflict-choice"
                      checked={conflictChoice === "new"}
                      onChange={() => setConflictChoice("new")}
                    />
                    Criar nova ficha (renomear automaticamente se necessário)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="conflict-choice"
                      checked={conflictChoice === "overwrite"}
                      onChange={() => setConflictChoice("overwrite")}
                    />
                    Substituir a ficha existente <strong className="danger-text">(perde dados antigos)</strong>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="conflict-choice"
                      checked={conflictChoice === "skip"}
                      onChange={() => setConflictChoice("skip")}
                    />
                    Pular (não importar)
                  </label>
                </div>
              </div>
            )}

            {parsedCharacter && (
              <div className="import-export-actions">
                <button type="button" className="btn-outline" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmImport}
                  disabled={importing}
                >
                  {importing
                    ? "Importando…"
                    : conflict && conflictChoice === "skip"
                    ? "Fechar"
                    : "Importar"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
