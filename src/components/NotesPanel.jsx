import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser } from "../context/UserContext";
import {
  subscribeNotes,
  createNote,
  updateNote,
  deleteNote,
} from "../services/notesService";
import "./NotesPanel.css";

const FIRST_VISIT_KEY = "cataclysm-notes-first-visit";

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function sortNotes(notes) {
  const arr = [...notes];
  arr.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return arr;
}

export default function NotesPanel({ embedded = false, onClose }) {
  const { username } = useUser() || {};
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTags, setDraftTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showFirstHint, setShowFirstHint] = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      setShowFirstHint(true);
    }
  }, []);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    const unsub = subscribeNotes(username, (arr) => {
      setNotes(arr);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [username]);

  const sortedNotes = useMemo(() => sortNotes(notes), [notes]);

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedNotes.filter((n) => {
      if (activeTagFilter && !(n.tags || []).includes(activeTagFilter)) return false;
      if (!q) return true;
      const inTitle = (n.title || "").toLowerCase().includes(q);
      const inBody = (n.body || "").toLowerCase().includes(q);
      const inTags = (n.tags || []).some((t) => t.toLowerCase().includes(q));
      return inTitle || inBody || inTags;
    });
  }, [sortedNotes, searchQuery, activeTagFilter]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  useEffect(() => {
    if (selectedNote) {
      setDraftTitle(selectedNote.title || "");
      setDraftBody(selectedNote.body || "");
      setDraftTags(selectedNote.tags || []);
    } else {
      setDraftTitle("");
      setDraftBody("");
      setDraftTags([]);
    }
    setTagInput("");
    setPreviewMode(false);
    // Reseta rascunhos ao trocar de nota selecionada;
    // mudanças no próprio selectedNote vêm pelo subscribe e são tratadas pelo save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleCreate = async () => {
    if (!username) return;
    try {
      const id = await createNote(username, {
        title: "Nova nota",
        body: "",
        tags: [],
        pinned: false,
      });
      setSelectedId(id);
    } catch (err) {
      console.error("Erro ao criar nota:", err);
      alert("Não foi possível criar a nota.");
    }
  };

  const flushSave = async (data) => {
    if (!username || !selectedId) return;
    try {
      setSaveStatus("saving");
      await updateNote(username, selectedId, data);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (err) {
      console.error("Erro ao salvar nota:", err);
      setSaveStatus("error");
    }
  };

  const scheduleSave = (data) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(data), 700);
  };

  const handleTitleChange = (value) => {
    setDraftTitle(value);
    scheduleSave({ title: value });
  };

  const handleBodyChange = (value) => {
    setDraftBody(value);
    scheduleSave({ body: value });
  };

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if (draftTags.includes(t)) {
      setTagInput("");
      return;
    }
    const next = [...draftTags, t].slice(0, 20);
    setDraftTags(next);
    setTagInput("");
    flushSave({ tags: next });
  };

  const handleRemoveTag = (tag) => {
    const next = draftTags.filter((t) => t !== tag);
    setDraftTags(next);
    flushSave({ tags: next });
  };

  const togglePin = async () => {
    if (!selectedNote) return;
    await updateNote(username, selectedNote.id, { pinned: !selectedNote.pinned });
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!window.confirm(`Deletar a nota "${selectedNote.title || "Sem título"}"? Essa ação não pode ser desfeita.`)) return;
    await deleteNote(username, selectedNote.id);
    setSelectedId(null);
  };

  const dismissHint = () => {
    setShowFirstHint(false);
    try {
      localStorage.setItem(FIRST_VISIT_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className={`notes-panel-root ${embedded ? "notes-panel-root--embedded" : ""}`}>
      <div className="notes-panel-header">
        <div className="notes-panel-title">
          <h2>Notas de Perfil</h2>
          <span className="notes-panel-sub">Suas notas pessoais — ficam atreladas à sua conta, não a uma ficha.</span>
        </div>
        <div className="notes-panel-header-actions">
          <button type="button" className="btn-primary" onClick={handleCreate}>
            + Nova nota
          </button>
          {onClose && (
            <button type="button" className="btn-outline" onClick={onClose}>
              Fechar
            </button>
          )}
        </div>
      </div>

      {showFirstHint && (
        <div className="notes-hint-banner" role="note">
          <div>
            <strong>Diferença importante:</strong> esta área é para suas notas pessoais
            (lore, ideias, regras caseiras). A aba <em>Anotações do Personagem</em>,
            dentro da ficha, é para anotações específicas daquele personagem.
            Você pode usar <code>**markdown**</code> para formatar.
          </div>
          <button type="button" className="btn-outline small" onClick={dismissHint}>
            Entendi
          </button>
        </div>
      )}

      <div className="notes-panel-body">
        <aside className="notes-list-pane">
          <div className="notes-list-controls">
            <input
              type="search"
              className="input-login"
              placeholder="Buscar (título, texto, tag)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {allTags.length > 0 && (
              <div className="notes-tag-filters">
                <button
                  type="button"
                  className={`notes-tag-chip ${activeTagFilter === "" ? "active" : ""}`}
                  onClick={() => setActiveTagFilter("")}
                >
                  Todas
                </button>
                {allTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`notes-tag-chip ${activeTagFilter === t ? "active" : ""}`}
                    onClick={() => setActiveTagFilter(activeTagFilter === t ? "" : t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="notes-list">
            {loading ? (
              <div className="muted">Carregando…</div>
            ) : filteredNotes.length === 0 ? (
              <div className="muted notes-empty">
                {notes.length === 0
                  ? "Nenhuma nota ainda. Clique em ‘+ Nova nota’ para começar."
                  : "Nenhuma nota corresponde ao filtro."}
              </div>
            ) : (
              filteredNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notes-list-item ${selectedId === n.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(n.id)}
                >
                  <div className="notes-list-item-row">
                    {n.pinned && <span className="notes-pin-badge" title="Fixada">📌</span>}
                    <span className="notes-list-item-title">
                      {n.title?.trim() || <em>Sem título</em>}
                    </span>
                  </div>
                  <div className="notes-list-item-meta">
                    {formatDate(n.updatedAt || n.createdAt)}
                  </div>
                  {n.tags && n.tags.length > 0 && (
                    <div className="notes-list-item-tags">
                      {n.tags.slice(0, 4).map((t) => (
                        <span key={t} className="notes-tag-mini">#{t}</span>
                      ))}
                      {n.tags.length > 4 && <span className="notes-tag-mini">…</span>}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="notes-editor-pane">
          {!selectedNote ? (
            <div className="notes-editor-empty">
              <h3>Nenhuma nota selecionada</h3>
              <p className="muted">
                Crie uma nova nota ou selecione uma da lista. Notas suportam
                <strong> Markdown</strong> (negrito <code>**texto**</code>,
                listas <code>- item</code>, links, tabelas etc.).
              </p>
            </div>
          ) : (
            <>
              <div className="notes-editor-toolbar">
                <input
                  className="title-input notes-title-input"
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título da nota"
                />
                <div className="notes-editor-toolbar-actions">
                  <button
                    type="button"
                    className={`btn-outline small ${selectedNote.pinned ? "pinned" : ""}`}
                    onClick={togglePin}
                    title={selectedNote.pinned ? "Desafixar" : "Fixar no topo"}
                  >
                    {selectedNote.pinned ? "📌 Fixada" : "📌 Fixar"}
                  </button>
                  <button
                    type="button"
                    className={`btn-outline small ${previewMode ? "active" : ""}`}
                    onClick={() => setPreviewMode((v) => !v)}
                  >
                    {previewMode ? "✏️ Editar" : "👁️ Preview"}
                  </button>
                  <button type="button" className="btn-danger small" onClick={handleDelete}>
                    Deletar
                  </button>
                </div>
              </div>

              <div className="notes-tag-editor">
                {draftTags.map((t) => (
                  <span key={t} className="notes-tag-chip in-editor">
                    #{t}
                    <button
                      type="button"
                      className="notes-tag-remove"
                      onClick={() => handleRemoveTag(t)}
                      aria-label={`Remover tag ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className="input-login notes-tag-input"
                  type="text"
                  value={tagInput}
                  placeholder="+ tag (Enter)"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
              </div>

              {previewMode ? (
                <div className="notes-markdown-preview">
                  {draftBody.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftBody}</ReactMarkdown>
                  ) : (
                    <p className="muted">Nada para visualizar ainda.</p>
                  )}
                </div>
              ) : (
                <textarea
                  className="notes-textarea notes-body-textarea"
                  value={draftBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="Escreva aqui. Use Markdown para formatar."
                />
              )}

              <div className="notes-editor-footer muted">
                {saveStatus === "saving" && "Salvando…"}
                {saveStatus === "saved" && "Salvo"}
                {saveStatus === "error" && "Erro ao salvar"}
                {saveStatus === "idle" && (
                  <span>
                    Atualizada em {formatDate(selectedNote.updatedAt || selectedNote.createdAt)}
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
