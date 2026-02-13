import React from "react";
import "./ThemeToggle.css";

export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label="Alternar tema">
      <span className="theme-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}

