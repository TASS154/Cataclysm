import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../context/UserContext";
import { getSession, addToken, hasTokenInSession } from "../services/sessionService";
import "./JoinPage.css";

export default function JoinPage() {
  const navigate = useNavigate();
  const { username } = useUser();
  const [code, setCode] = useState("");
  const [step, setStep] = useState("code"); // "code" | "pick" | "joining"
  const [session, setSession] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    getDocs(collection(db, "users", username, "characters")).then((snap) => {
      setCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [username]);

  const extractSessionId = (input) => {
    const t = input.trim();
    const match = t.match(/\/session\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return t;
  };

  const handleSubmitCode = async (e) => {
    e.preventDefault();
    setError("");
    const sessionId = extractSessionId(code);
    if (!sessionId) {
      setError("Digite o código ou cole o link da sessão.");
      return;
    }
    const data = await getSession(sessionId);
    if (!data) {
      setError("Sessão não encontrada. Verifique o código.");
      return;
    }
    setSession(data);
    const hasToken = await hasTokenInSession(sessionId, username);
    if (hasToken) {
      navigate(`/session/${sessionId}`);
      return;
    }
    if (characters.length === 0) {
      setError("Você não tem nenhum personagem. Crie uma ficha primeiro.");
      return;
    }
    setStep("pick");
  };

  const handlePickCharacter = async (character) => {
    if (!session) return;
    setError("");
    setStep("joining");
    try {
      const centerX = Math.floor(session.mapWidth / 2);
      const centerY = Math.floor(session.mapHeight / 2);
      await addToken(session.id, {
        ownerUsername: username,
        characterId: character.id,
        characterName: character.name || "Personagem",
        x: centerX,
        y: centerY,
      });
      navigate(`/session/${session.id}`);
    } catch (err) {
      console.error(err);
      setError("Erro ao entrar na sessão: " + err.message);
      setStep("pick");
    }
  };

  return (
    <div className="join-page">
      <div className="join-panel">
        <h2>Entrar na sessão</h2>
        {step === "code" && (
          <form onSubmit={handleSubmitCode}>
            <div className="form-group">
              <label>Código ou link da sessão</label>
              <input
                type="text"
                className="input-login"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Cole o link ou o código"
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn-primary fullwidth">
              Entrar
            </button>
          </form>
        )}
        {step === "pick" && (
          <div className="join-pick">
            <p className="muted">Escolha o personagem para esta sessão:</p>
            <ul className="join-char-list">
              {characters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="btn-primary fullwidth"
                    onClick={() => handlePickCharacter(c)}
                  >
                    {c.name || "Sem nome"}
                  </button>
                </li>
              ))}
            </ul>
            {error && <div className="error-message">{error}</div>}
            <button
              type="button"
              className="btn-secondary fullwidth"
              onClick={() => { setStep("code"); setSession(null); setError(""); }}
            >
              Voltar
            </button>
          </div>
        )}
        {step === "joining" && (
          <p className="muted">Entrando na sessão...</p>
        )}
        <button
          type="button"
          className="btn-secondary fullwidth"
          style={{ marginTop: 16 }}
          onClick={() => navigate("/")}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
