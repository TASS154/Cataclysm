import React from "react";
import { useNavigate } from "react-router-dom";
import NotesPanel from "../components/NotesPanel";
import "./NotesPage.css";

export default function NotesPage() {
  const navigate = useNavigate();
  return (
    <div className="notes-page">
      <div className="notes-page-header">
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate(-1)}
        >
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/")}
        >
          Ficha
        </button>
      </div>
      <NotesPanel />
    </div>
  );
}
