import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { rulesSections, highlightPatterns } from "../data/rulesData";
import "./RulesPage.css";

/**
 * Aplica destaques dinâmicos ao texto usando os padrões em rulesData.highlightPatterns.
 * Retorna array de segmentos: { type: string|null, text: string }.
 */
function applyHighlights(text, patterns) {
  if (!text || !patterns?.length) return [{ type: null, text: text || "" }];

  const ranges = []; // { start, end, type }
  for (const { pattern, type } of patterns) {
    try {
      const regex = new RegExp(escapeRegex(pattern), "gi");
      let m;
      while ((m = regex.exec(text)) !== null) {
        ranges.push({ start: m.index, end: m.index + m[0].length, type });
      }
    } catch (_) {
      // padrão inválido ignorado
    }
  }

  // Ordenar por start; mesclar sobreposições (primeiro vence)
  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    if (merged.length === 0 || r.start >= merged[merged.length - 1].end) {
      merged.push({ ...r });
    } else if (r.end > merged[merged.length - 1].end) {
      merged[merged.length - 1].end = r.end;
    }
  }

  if (merged.length === 0) return [{ type: null, text }];

  const segments = [];
  let last = 0;
  for (const { start, end, type } of merged) {
    if (start > last) {
      segments.push({ type: null, text: text.slice(last, start) });
    }
    segments.push({ type, text: text.slice(start, end) });
    last = end;
  }
  if (last < text.length) {
    segments.push({ type: null, text: text.slice(last) });
  }
  return segments;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedParagraph({ text, patterns }) {
  const segments = useMemo(() => applyHighlights(text, patterns), [text, patterns]);
  return (
    <p className="rules-para">
      {segments.map((seg, i) =>
        seg.type ? (
          <span key={i} className={`rules-highlight rules-highlight--${seg.type}`}>
            {seg.text}
          </span>
        ) : (
          seg.text
        )
      )}
    </p>
  );
}

export default function RulesPage() {
  return (
    <div className="rules-page">
      <header className="rules-header">
        <Link to="/" className="rules-back">
          ← Voltar
        </Link>
        <h1 className="rules-title">Regras do Sistema</h1>
        <p className="rules-subtitle">
          Documento de referência para jogadores. Inspirado em Hunter x Hunter e Jujutsu Kaisen.
        </p>
      </header>

      <article className="rules-content">
        {rulesSections.map((section) => (
          <section key={section.id} className="rules-section">
            <h2 className="rules-section-title">{section.title}</h2>
            <div className="rules-section-body">
              {(Array.isArray(section.content) ? section.content : [section.content]).map(
                (paragraph, i) => (
                  <HighlightedParagraph
                    key={i}
                    text={paragraph}
                    patterns={highlightPatterns}
                  />
                )
              )}
            </div>
          </section>
        ))}
      </article>

      <footer className="rules-footer">
        <Link to="/" className="rules-back-bottom">
          Voltar ao editor
        </Link>
      </footer>
    </div>
  );
}
