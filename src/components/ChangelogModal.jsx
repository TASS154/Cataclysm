import React from "react";
import { CHANGELOG_ENTRIES, markChangelogSeen } from "../data/changelogData";
import "./ChangelogModal.css";

export default function ChangelogModal({ open, onClose }) {
  if (!open) return null;

  const handleClose = () => {
    markChangelogSeen();
    onClose && onClose();
  };

  return (
    <div className="modal-overlay changelog-overlay" onClick={handleClose}>
      <div className="modal-content changelog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="changelog-modal-header">
          <h2>Novidades do Cataclysm</h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="changelog-scroll">
          {CHANGELOG_ENTRIES.map((entry) => (
            <article key={entry.version} className="changelog-entry">
              <header className="changelog-entry-header">
                <span className="changelog-version">v{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </header>
              <h3>{entry.title}</h3>
              {entry.sections.map((sec) => (
                <div key={sec.heading} className="changelog-section">
                  <h4>{sec.heading}</h4>
                  <ul>
                    {sec.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
        <button type="button" className="btn-primary fullwidth" onClick={handleClose}>
          Entendi
        </button>
      </div>
    </div>
  );
}
