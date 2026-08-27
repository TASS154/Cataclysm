import React, { useEffect, useState } from "react";
import { subscribeGmLibrary } from "../services/gmLibraryService";
import { createSession } from "../services/sessionService";
import "./CreateSessionWizard.css";

const emptyMap = () => ({
  name: "",
  mapWidth: 20,
  mapHeight: 15,
  backgroundImageUrl: "",
});

export default function CreateSessionWizard({ open, onClose, username, onCreated }) {
  const [step, setStep] = useState(0);
  const [sessionName, setSessionName] = useState("Nova Sessão");
  const [customId, setCustomId] = useState("");
  const [maps, setMaps] = useState([emptyMap()]);
  const [images, setImages] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [selectedSoundIds, setSelectedSoundIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !username) return;
    setStep(0);
    setSessionName("Nova Sessão");
    setCustomId("");
    setMaps([{ ...emptyMap(), name: "Mapa 1" }]);
    setSelectedImageIds([]);
    setSelectedSoundIds([]);
    setError("");
    const u1 = subscribeGmLibrary(username, "images", setImages);
    const u2 = subscribeGmLibrary(username, "sounds", setSounds);
    return () => {
      u1 && u1();
      u2 && u2();
    };
  }, [open, username]);

  if (!open) return null;

  const toggleId = (list, setList, id) => {
    setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const mapSequence = maps.map((m, i) => ({
        name: m.name?.trim() || `Mapa ${i + 1}`,
        mapWidth: Number(m.mapWidth) || 20,
        mapHeight: Number(m.mapHeight) || 15,
        backgroundImageUrl: m.backgroundImageUrl || "",
      }));
      const id = await createSession(username, {
        name: sessionName.trim() || "Sessão",
        mapSequence,
        selectedImageIds,
        selectedSoundIds,
        customId,
      });
      onClose && onClose();
      onCreated && onCreated(id);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao criar sessão.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content session-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="session-wizard-header">
          <h2>Criar sessão — passo {step + 1}/3</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {step === 0 && (
          <div className="session-wizard-body">
            <div className="form-group">
              <label>Nome da sessão</label>
              <input className="input-login" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Código / URL da sessão (opcional)</label>
              <input
                className="input-login"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="ex: mesa-sabado (vazio = código aleatório)"
              />
              <div className="muted small" style={{ marginTop: 4 }}>
                Link ficará <code>/session/{customId.trim() ? customId.trim().toLowerCase().replace(/\s+/g, "-") : "…"}</code>
                . Só letras, números, - e _. Sessões expiram em 24h.
              </div>
            </div>
            <p className="muted small">Configure o primeiro mapa. Você pode adicionar mais cenas no próximo passo.</p>
            <div className="form-group">
              <label>Nome do mapa 1</label>
              <input
                className="input-login"
                value={maps[0]?.name || ""}
                onChange={(e) => setMaps([{ ...maps[0], name: e.target.value }])}
              />
            </div>
            <div className="session-wizard-row">
              <div className="form-group">
                <label>Largura</label>
                <input type="number" className="input-login" min={5} max={50} value={maps[0]?.mapWidth ?? 20} onChange={(e) => setMaps([{ ...maps[0], mapWidth: e.target.value }])} />
              </div>
              <div className="form-group">
                <label>Altura</label>
                <input type="number" className="input-login" min={5} max={50} value={maps[0]?.mapHeight ?? 15} onChange={(e) => setMaps([{ ...maps[0], mapHeight: e.target.value }])} />
              </div>
            </div>
            <div className="form-group">
              <label>URL do fundo (opcional)</label>
              <input className="input-login" value={maps[0]?.backgroundImageUrl || ""} onChange={(e) => setMaps([{ ...maps[0], backgroundImageUrl: e.target.value }])} placeholder="https://..." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="session-wizard-body">
            <p className="muted small">Sequência de mapas — tokens ficam separados por cena.</p>
            {maps.map((m, i) => (
              <div key={i} className="session-map-row">
                <strong>Cena {i + 1}</strong>
                <input className="input-login" placeholder="Nome" value={m.name} onChange={(e) => {
                  const next = [...maps];
                  next[i] = { ...next[i], name: e.target.value };
                  setMaps(next);
                }} />
                <div className="session-wizard-row">
                  <input type="number" className="input-login" placeholder="Largura" value={m.mapWidth} onChange={(e) => {
                    const next = [...maps];
                    next[i] = { ...next[i], mapWidth: e.target.value };
                    setMaps(next);
                  }} />
                  <input type="number" className="input-login" placeholder="Altura" value={m.mapHeight} onChange={(e) => {
                    const next = [...maps];
                    next[i] = { ...next[i], mapHeight: e.target.value };
                    setMaps(next);
                  }} />
                </div>
                <input className="input-login" placeholder="URL fundo" value={m.backgroundImageUrl || ""} onChange={(e) => {
                  const next = [...maps];
                  next[i] = { ...next[i], backgroundImageUrl: e.target.value };
                  setMaps(next);
                }} />
                {maps.length > 1 && (
                  <button type="button" className="btn-danger small" onClick={() => setMaps(maps.filter((_, j) => j !== i))}>
                    Remover cena
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-outline" onClick={() => setMaps([...maps, { ...emptyMap(), name: `Mapa ${maps.length + 1}` }])}>
              + Adicionar cena
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="session-wizard-body">
            <p className="muted small">
              Selecione mídia da sua biblioteca. Gerencie em Biblioteca do Mestre.
              {images.length === 0 && sounds.length === 0 && " (Biblioteca vazia — pode pular.)"}
            </p>
            <h4>Imagens</h4>
            <div className="session-media-pick">
              {images.length === 0 ? <span className="muted">Nenhuma imagem.</span> : images.map((img) => (
                <label key={img.id} className={`session-media-chip ${selectedImageIds.includes(img.id) ? "selected" : ""}`}>
                  <input type="checkbox" checked={selectedImageIds.includes(img.id)} onChange={() => toggleId(selectedImageIds, setSelectedImageIds, img.id)} />
                  {img.name}
                </label>
              ))}
            </div>
            <h4>Sons</h4>
            <div className="session-media-pick">
              {sounds.length === 0 ? <span className="muted">Nenhum som.</span> : sounds.map((s) => (
                <label key={s.id} className={`session-media-chip ${selectedSoundIds.includes(s.id) ? "selected" : ""}`}>
                  <input type="checkbox" checked={selectedSoundIds.includes(s.id)} onChange={() => toggleId(selectedSoundIds, setSelectedSoundIds, s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="session-wizard-footer">
          {step > 0 && (
            <button type="button" className="btn-outline" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>
              Próximo
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? "Criando…" : "Criar sessão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
