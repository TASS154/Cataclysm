import React, { useState, useEffect } from "react";
import "./Inventory.css";

const DEFAULT_EQUIPMENT = {
  armorMode: "set",
  armorSet: { name: "", notes: "" },
  armorPieces: {
    head: "",
    chest: "",
    hands: "",
    legs: "",
    feet: "",
    accessory: "",
  },
  weapons: [],
  carried: [],
};

const EQUIPMENT_SLOT_LABELS = {
  head: "Cabeça",
  chest: "Peitoral",
  hands: "Mãos",
  legs: "Pernas",
  feet: "Pés",
  accessory: "Acessório",
};

export default function Inventory({
  inventory,
  equipment,
  coins,
  onUpdateInventory,
  onUpdateEquipment,
  onUpdateCoins,
  onSave,
}) {
  const normalizedEquipment = {
    ...DEFAULT_EQUIPMENT,
    ...(equipment || {}),
    armorSet: {
      ...DEFAULT_EQUIPMENT.armorSet,
      ...(equipment?.armorSet || {}),
    },
    armorPieces: {
      ...DEFAULT_EQUIPMENT.armorPieces,
      ...(equipment?.armorPieces || {}),
    },
    weapons: Array.isArray(equipment?.weapons) ? equipment.weapons : [],
    carried: Array.isArray(equipment?.carried) ? equipment.carried : [],
  };
  const [editingIndex, setEditingIndex] = useState(null);
  const [editItem, setEditItem] = useState({ name: "", quantity: 1, description: "", tags: [] });
  const [filterTag, setFilterTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableTags, setAvailableTags] = useState(["consumível", "equipamento", "material"]);
  const [newTagInput, setNewTagInput] = useState("");

  useEffect(() => {
    // Extract unique tags from all items
    const allTags = new Set();
    inventory.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });
    setAvailableTags(prev => {
      const combined = new Set([...prev, ...allTags]);
      return Array.from(combined).sort();
    });
  }, [inventory]);

  const addTag = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    const trimmed = newTagInput.trim();
    if (trimmed && !availableTags.includes(trimmed)) {
      setAvailableTags(prev => [...prev, trimmed].sort());
      setNewTagInput("");
    }
  };

  const handleAddItem = (e) => {
    e?.preventDefault?.();
    if (!editItem.name?.trim()) {
      return;
    }
    
    const newItem = {
      name: editItem.name.trim(),
      quantity: editItem.quantity || 1,
      description: editItem.description || "",
      tags: editItem.tags || []
    };
    
    // Update inventory first
    const updatedInventory = [...inventory, newItem];
    onUpdateInventory(updatedInventory);
    
    // Reset form immediately
    setEditItem({ name: "", quantity: 1, description: "", tags: [] });
    
    // Save after state update completes
    setTimeout(() => {
      onSave();
    }, 100);
  };

  const handleEditItem = (index) => {
    const item = inventory[index];
    setEditItem({
      name: item.name || "",
      quantity: item.quantity || 1,
      description: item.description || "",
      tags: item.tags || []
    });
    setEditingIndex(index);
  };

  const handleSaveEdit = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (editingIndex === null) return;
    
    const updated = [...inventory];
    updated[editingIndex] = {
      name: editItem.name?.trim() || "Novo Item",
      quantity: editItem.quantity || 1,
      description: editItem.description || "",
      tags: editItem.tags || []
    };
    
    onUpdateInventory(updated);
    setEditingIndex(null);
    setEditItem({ name: "", quantity: 1, description: "", tags: [] });
    
    // Save after state update completes
    setTimeout(() => {
      onSave();
    }, 100);
  };

  const handleCancelEdit = (e) => {
    e?.stopPropagation?.();
    setEditingIndex(null);
    setEditItem({ name: "", quantity: 1, description: "", tags: [] });
  };

  const handleRemoveItem = (index) => {
    const updated = inventory.filter((_, i) => i !== index);
    onUpdateInventory(updated);
    setTimeout(() => {
      onSave();
    }, 0);
  };

  const toggleTag = (tag, e) => {
    e?.stopPropagation?.();
    const currentTags = editItem.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setEditItem({ ...editItem, tags: newTags });
  };

  const filteredInventory = inventory.filter(item => {
    // Filter by tag if selected
    if (filterTag && (!item.tags || !Array.isArray(item.tags) || !item.tags.includes(filterTag))) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = (item.name || "").toLowerCase().includes(query);
      const matchesDescription = (item.description || "").toLowerCase().includes(query);
      const matchesTags = item.tags && Array.isArray(item.tags) && 
        item.tags.some(tag => tag.toLowerCase().includes(query));
      
      if (!matchesName && !matchesDescription && !matchesTags) {
        return false;
      }
    }
    
    return true;
  });

  const updateEquipment = (patch) => {
    onUpdateEquipment({
      ...normalizedEquipment,
      ...patch,
    });
    setTimeout(() => onSave(), 0);
  };

  const updateArmorSet = (patch) => {
    updateEquipment({
      armorSet: {
        ...normalizedEquipment.armorSet,
        ...patch,
      },
    });
  };

  const updateArmorPiece = (pieceKey, value) => {
    updateEquipment({
      armorPieces: {
        ...normalizedEquipment.armorPieces,
        [pieceKey]: value,
      },
    });
  };

  const addEquipItem = (field) => {
    const arr = normalizedEquipment[field] || [];
    const next = [...arr, { id: Date.now() + Math.random(), name: "", notes: "", equipped: true }];
    updateEquipment({ [field]: next });
  };

  const updateEquipItem = (field, id, patch) => {
    const arr = normalizedEquipment[field] || [];
    const next = arr.map((it) => (it.id === id ? { ...it, ...patch } : it));
    updateEquipment({ [field]: next });
  };

  const removeEquipItem = (field, id) => {
    const arr = normalizedEquipment[field] || [];
    updateEquipment({ [field]: arr.filter((it) => it.id !== id) });
  };

  return (
    <div className="inventory-panel inventory-panel--expanded">
      <div className="panel equipment-panel">
        <h4>Equipamentos</h4>
        <div className="equipment-mode-row">
          <label>Armadura</label>
          <select
            className="select equipment-mode-select"
            value={normalizedEquipment.armorMode}
            onChange={(e) => updateEquipment({ armorMode: e.target.value })}
          >
            <option value="set">Set completo</option>
            <option value="pieces">Peças separadas</option>
          </select>
        </div>

        {normalizedEquipment.armorMode === "set" ? (
          <div className="equipment-block">
            <input
              className="input-new"
              placeholder="Nome do set de armadura"
              value={normalizedEquipment.armorSet.name || ""}
              onChange={(e) => updateArmorSet({ name: e.target.value })}
            />
            <textarea
              className="input-new equipment-textarea"
              placeholder="Observações do set (bônus, penalidade, etc.)"
              value={normalizedEquipment.armorSet.notes || ""}
              onChange={(e) => updateArmorSet({ notes: e.target.value })}
              rows={3}
            />
          </div>
        ) : (
          <div className="equipment-pieces-grid">
            {Object.entries(EQUIPMENT_SLOT_LABELS).map(([key, label]) => (
              <div key={key} className="form-group">
                <label>{label}</label>
                <input
                  className="input-login"
                  placeholder={`Peça de ${label.toLowerCase()}`}
                  value={normalizedEquipment.armorPieces[key] || ""}
                  onChange={(e) => updateArmorPiece(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="equipment-subsection">
          <div className="equipment-subsection-header">
            <h5>Armas</h5>
            <button type="button" className="btn-primary small" onClick={() => addEquipItem("weapons")}>
              + Arma
            </button>
          </div>
          {(normalizedEquipment.weapons || []).map((w) => (
            <div key={w.id} className="equipment-item-card">
              <input
                className="input-login"
                placeholder="Nome da arma"
                value={w.name || ""}
                onChange={(e) => updateEquipItem("weapons", w.id, { name: e.target.value })}
              />
              <textarea
                className="input-login equipment-textarea"
                placeholder="Detalhes da arma"
                rows={2}
                value={w.notes || ""}
                onChange={(e) => updateEquipItem("weapons", w.id, { notes: e.target.value })}
              />
              <div className="equipment-item-actions">
                <label className="equip-check">
                  <input
                    type="checkbox"
                    checked={!!w.equipped}
                    onChange={(e) => updateEquipItem("weapons", w.id, { equipped: e.target.checked })}
                  />
                  Equipada
                </label>
                <button type="button" className="btn-danger small" onClick={() => removeEquipItem("weapons", w.id)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="equipment-subsection">
          <div className="equipment-subsection-header">
            <h5>Equipamentos carregados</h5>
            <button type="button" className="btn-primary small" onClick={() => addEquipItem("carried")}>
              + Equipamento
            </button>
          </div>
          {(normalizedEquipment.carried || []).map((c) => (
            <div key={c.id} className="equipment-item-card">
              <input
                className="input-login"
                placeholder="Nome do equipamento"
                value={c.name || ""}
                onChange={(e) => updateEquipItem("carried", c.id, { name: e.target.value })}
              />
              <textarea
                className="input-login equipment-textarea"
                placeholder="Detalhes"
                rows={2}
                value={c.notes || ""}
                onChange={(e) => updateEquipItem("carried", c.id, { notes: e.target.value })}
              />
              <div className="equipment-item-actions">
                <label className="equip-check">
                  <input
                    type="checkbox"
                    checked={!!c.equipped}
                    onChange={(e) => updateEquipItem("carried", c.id, { equipped: e.target.checked })}
                  />
                  Em uso
                </label>
                <button type="button" className="btn-danger small" onClick={() => removeEquipItem("carried", c.id)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
      {/* Coins Section */}
      <div className="coins-section">
        <div className="coin-field">
          <span className="coin-icon">🪙</span>
          <label>Ouro</label>
          <input
            type="number"
            value={coins?.gold || 0}
            onChange={(e) => onUpdateCoins({ ...coins, gold: Number(e.target.value) || 0 })}
            onBlur={onSave}
            className="input-number coin-input"
            min="0"
          />
        </div>
        <div className="coin-field">
          <span className="coin-icon">🪙</span>
          <label>Prata</label>
          <input
            type="number"
            value={coins?.silver || 0}
            onChange={(e) => onUpdateCoins({ ...coins, silver: Number(e.target.value) || 0 })}
            onBlur={onSave}
            className="input-number coin-input"
            min="0"
          />
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="filter-section">
        <input
          type="text"
          placeholder="Buscar itens (nome, descrição, tags)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-new"
          style={{ marginBottom: "12px", width: "100%" }}
        />
        <label>Filtrar por tag:</label>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="select"
        >
          <option value="">Todas as tags</option>
          {availableTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* Add New Tag */}
      <div className="tag-manager">
        <input
          type="text"
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              addTag(e);
            }
          }}
          placeholder="Nova tag"
          className="input-new"
        />
        <button className="btn-primary small" onClick={addTag}>
          + Tag
        </button>
      </div>

      {/* Add/Edit Item Form */}
      {editingIndex === null ? (
        <div className="inventory-add-form">
          <h4>Adicionar Item</h4>
          <div className="form-row">
            <input
              type="text"
              value={editItem.name}
              onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === "Enter" && editItem.name?.trim()) {
                  handleAddItem();
                }
              }}
              placeholder="Nome do item"
              className="input-new"
            />
            <input
              type="number"
              value={editItem.quantity}
              onChange={(e) => setEditItem({ ...editItem, quantity: Number(e.target.value) || 1 })}
              placeholder="Qtd"
              className="input-number"
              min="1"
            />
            <button 
              className="btn-primary" 
              onClick={handleAddItem}
              disabled={!editItem.name?.trim()}
            >
              + Adicionar Item
            </button>
          </div>
        </div>
      ) : (
        <div className="item-edit-form">
          <h4>Editar Item</h4>
          <div className="form-group">
            <label>Nome</label>
            <input
              type="text"
              value={editItem.name}
              onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
              className="input-login"
            />
          </div>
          <div className="form-group">
            <label>Quantidade</label>
            <input
              type="number"
              value={editItem.quantity}
              onChange={(e) => setEditItem({ ...editItem, quantity: Number(e.target.value) || 1 })}
              className="input-login"
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={editItem.description}
              onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
              className="input-login"
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Tags</label>
            <div className="tags-container">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-button ${editItem.tags?.includes(tag) ? "active" : ""}`}
                  onClick={(e) => toggleTag(tag, e)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSaveEdit}>
              Salvar
            </button>
            <button className="btn-danger" onClick={handleCancelEdit}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Inventory List */}
      <div className="inventory-list-container">
        <h4>Itens ({filteredInventory.length})</h4>
        <ul className="inventory-list">
          {filteredInventory.map((item, idx) => {
            const actualIndex = inventory.indexOf(item);
            
            return (
              <li key={actualIndex} className="inventory-item">
                <div className="item-info">
                  <span className="item-name">{item.name || "Item sem nome"}</span>
                  {item.quantity > 1 && (
                    <span className="item-quantity">x{item.quantity}</span>
                  )}
                  {item.description && (
                    <span className="item-description">{item.description}</span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="item-tags">
                      {item.tags.map(tag => (
                        <span key={tag} className="tag-badge">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  <button
                    className="link-primary"
                    onClick={() => handleEditItem(actualIndex)}
                  >
                    Editar
                  </button>
                  <button
                    className="link-danger"
                    onClick={() => handleRemoveItem(actualIndex)}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {filteredInventory.length === 0 && (
          <div className="empty-state">
            {searchQuery.trim() || filterTag 
              ? `Nenhum item encontrado${searchQuery.trim() ? ` para "${searchQuery}"` : ""}${filterTag ? ` com a tag "${filterTag}"` : ""}.` 
              : "Inventário vazio. Adicione itens acima."}
          </div>
        )}
        {filteredInventory.length > 0 && (searchQuery.trim() || filterTag) && (
          <div className="muted small" style={{ marginTop: "12px", textAlign: "center" }}>
            {filteredInventory.length} item{filteredInventory.length !== 1 ? "s" : ""} encontrado{filteredInventory.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
