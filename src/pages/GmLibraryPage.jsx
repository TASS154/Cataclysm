import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import {
  subscribeGmLibrary,
  addGmLibraryItem,
  deleteGmLibraryItem,
  readFileAsDataUrl,
} from "../services/gmLibraryService";
import "./GmLibraryPage.css";

function LibrarySection({ type, label, username, accept, isAudio }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    return subscribeGmLibrary(username, type, setItems);
  }, [username, type]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await addGmLibraryItem(username, type, { name: name || label, url });
      setName("");
      setUrl("");
    } catch (err) {
      setError(err.message || "Erro ao adicionar.");
    }
  };

  const handleFile = async (file) => {
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file, isAudio ? 600000 : 800000);
      await addGmLibraryItem(username, type, {
        name: name || file.name || label,
        url: dataUrl,
      });
      setName("");
      setUrl("");
    } catch (err) {
      setError(err.message || "Erro no upload.");
    }
  };

  return (
    <section className="gm-lib-section">
      <h3>{label}</h3>
      <form onSubmit={handleAdd} className="gm-lib-form">
        <input
          className="input-login"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input-login"
          placeholder="URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          type="file"
          accept={accept}
          className="input-login"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button type="submit" className="btn-primary" disabled={!url.trim()}>
          Adicionar por URL
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <div className="gm-lib-grid">
        {items.length === 0 ? (
          <p className="muted">Nenhum item ainda.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="gm-lib-card">
              {type === "images" ? (
                <img src={item.url} alt={item.name} className="gm-lib-thumb" />
              ) : (
                <div className="gm-lib-audio-icon">🔊</div>
              )}
              <div className="gm-lib-card-name">{item.name}</div>
              {type === "sounds" && (
                <audio controls src={item.url} className="gm-lib-audio" preload="none" />
              )}
              <button
                type="button"
                className="btn-danger small fullwidth"
                onClick={() => {
                  if (window.confirm(`Remover "${item.name}"?`)) {
                    deleteGmLibraryItem(username, type, item.id);
                  }
                }}
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function GmLibraryPage() {
  const navigate = useNavigate();
  const { username } = useUser() || {};

  return (
    <div className="gm-library-page">
      <div className="gm-library-header">
        <button type="button" className="btn-outline" onClick={() => navigate(-1)}>
          ← Voltar
        </button>
        <h1>Biblioteca do Mestre</h1>
      </div>
      <p className="muted gm-library-intro">
        Imagens e sons ficam no seu perfil. Ao criar uma sessão, você escolhe quais
        usar na mesa (handouts, ambiente, etc.).
      </p>
      <LibrarySection
        type="images"
        label="Imagens"
        username={username}
        accept="image/*"
        isAudio={false}
      />
      <LibrarySection
        type="sounds"
        label="Sons"
        username={username}
        accept="audio/*"
        isAudio
      />
    </div>
  );
}
