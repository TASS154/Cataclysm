import React, { useState } from "react";
import "./AbilityCard.css";

export default function AbilityCard({ 
  ability, 
  isFavorite, 
  onUpdate, 
  onRemove, 
  onToggleFavorite,
  onSave,
  onUse,
  sheet
}) {
  const getResourceBar = (abilityType) => {
    if (abilityType === "inata") return "inata";
    if (abilityType === "magia") return "vigor";
    if (abilityType === "arte") return "ether";
    return null;
  };

  const getResourceName = (abilityType) => {
    if (abilityType === "inata") return "Inata";
    if (abilityType === "magia") return "Vigor";
    if (abilityType === "arte") return "Ether";
    return "";
  };

  const cost = typeof ability.cost === "number" ? ability.cost : (typeof ability.cost === "string" ? (Number(ability.cost) || 0) : 0);
  const resourceBar = getResourceBar(ability.type);
  const currentResource = sheet?.bars?.[resourceBar] || 0;
  const canUse = cost > 0 && currentResource >= cost;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(ability);

  const handleSave = () => {
    onUpdate(ability.id, editData);
    onSave();
    setShowModal(false);
  };

  return (
    <>
      <div className={`ability-card ${isFavorite ? "favorite" : ""}`}>
        <div className="ability-header">
          <button 
            className="ability-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Recolher" : "Expandir"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
          <input
            className="ability-title"
            value={ability.title}
            onChange={(e) => onUpdate(ability.id, { title: e.target.value })}
            onBlur={onSave}
            placeholder="Nome da habilidade"
          />
          <button
            className={`favorite-btn ${isFavorite ? "active" : ""}`}
            onClick={() => onToggleFavorite(ability.id)}
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            className="ability-info-btn"
            onClick={() => setShowModal(true)}
            aria-label="Detalhes"
          >
            ⓘ
          </button>
          {cost > 0 && onUse && (
            <button
              className="ability-use-btn"
              onClick={() => onUse(ability)}
              disabled={!canUse}
              aria-label="Usar habilidade"
              title={canUse ? `Usar (gasta ${cost} de ${getResourceName(ability.type)})` : `Recurso insuficiente (${currentResource}/${cost})`}
            >
              Usar
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="ability-expanded">
            <textarea
              className="ability-desc"
              value={ability.description}
              placeholder="Descrição"
              onChange={(e) => onUpdate(ability.id, { description: e.target.value })}
              onBlur={onSave}
            />
            <div className="ability-bottom">
              <input
                className="ability-mini"
                value={ability.effect || ""}
                placeholder="Efeito"
                onChange={(e) => onUpdate(ability.id, { effect: e.target.value })}
                onBlur={onSave}
              />
              <input
                className="ability-mini"
                value={ability.damage || ""}
                placeholder="Dano (ex: 1d8)"
                onChange={(e) => onUpdate(ability.id, { damage: e.target.value })}
                onBlur={onSave}
              />
            </div>
            <div className="ability-controls-bottom">
              <select
                value={ability.type}
                onChange={(e) => onUpdate(ability.id, { type: e.target.value })}
                className="ability-select"
                onBlur={onSave}
              >
                <option value="inata">Inata</option>
                <option value="magia">Magia</option>
                <option value="arte">Arte Divina</option>
              </select>
              <button className="link-danger" onClick={() => onRemove(ability.id)}>
                Remover
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content ability-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes da Habilidade</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="input-login"
                />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={editData.description || ""}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="input-login"
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Efeito</label>
                <input
                  type="text"
                  value={editData.effect || ""}
                  onChange={(e) => setEditData({ ...editData, effect: e.target.value })}
                  className="input-login"
                />
              </div>
              <div className="form-group">
                <label>Dano</label>
                <input
                  type="text"
                  value={editData.damage || ""}
                  onChange={(e) => setEditData({ ...editData, damage: e.target.value })}
                  className="input-login"
                  placeholder="ex: 1d8+2"
                />
              </div>
              <div className="form-group">
                <label>Custo</label>
                <input
                  type="number"
                  value={typeof editData.cost === "number" ? editData.cost : (editData.cost === "" ? "" : Number(editData.cost) || 0)}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value) || 0;
                    setEditData({ ...editData, cost: value });
                  }}
                  className="input-login"
                  placeholder="0"
                  min="0"
                />
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  {editData.type === "inata" && "Gasta pontos de Inata"}
                  {editData.type === "magia" && "Gasta pontos de Vigor"}
                  {editData.type === "arte" && "Gasta pontos de Ether"}
                </div>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select
                  value={editData.type}
                  onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                  className="input-login"
                >
                  <option value="inata">Inata</option>
                  <option value="magia">Magia</option>
                  <option value="arte">Arte Divina</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSave}>
                Salvar
              </button>
              <button className="btn-danger" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

