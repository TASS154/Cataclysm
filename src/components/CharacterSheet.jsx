import React, { useState, useEffect } from "react";
import Tabs from "./Tabs";
import AbilityCard from "./AbilityCard";
import Inventory from "./Inventory";
import "./CharacterSheet.css";

const TAB_CONFIG = [
  { id: "attributes", label: "Atributos", icon: "⚔️" },
  { id: "abilities", label: "Habilidades", icon: "✨" },
  { id: "inventory", label: "Inventário", icon: "🎒" },
  { id: "status", label: "Status", icon: "📊" },
  { id: "notes", label: "Anotações", icon: "📝" },
  { id: "info", label: "Info", icon: "👤" },
];

export default function CharacterSheet({ 
  sheet, 
  onUpdateSheet, 
  onSave,
  username,
  characterId 
}) {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(`activeTab-${characterId}`) || "attributes";
  });
  const [favoriteAbilities, setFavoriteAbilities] = useState([]);
  const [activeAbilityTab, setActiveAbilityTab] = useState("inata");
  const [showAddAbilityForm, setShowAddAbilityForm] = useState(false);
  const [abilitySearchQuery, setAbilitySearchQuery] = useState("");
  const [newAbility, setNewAbility] = useState({
    title: "",
    type: "inata",
    description: "",
    effect: "",
    damage: "",
    cost: ""
  });
  const [newTrait, setNewTrait] = useState({ name: "", effect: "" });
  const [newEffect, setNewEffect] = useState({ name: "", description: "", rounds: 0, damage: 0, effect: "" });

  useEffect(() => {
    localStorage.setItem(`activeTab-${characterId}`, activeTab);
  }, [activeTab, characterId]);

  useEffect(() => {
    if (username && characterId) {
      const favoritesKey = `favorites-${username}-${characterId}`;
      const saved = localStorage.getItem(favoritesKey);
      if (saved) {
        try {
          setFavoriteAbilities(JSON.parse(saved));
        } catch (e) {
          console.error("Error loading favorites:", e);
        }
      }
    }
  }, [username, characterId]);

  useEffect(() => {
    setNewAbility(prev => ({ ...prev, type: activeAbilityTab }));
  }, [activeAbilityTab]);

  const saveFavorites = (favorites) => {
    setFavoriteAbilities(favorites);
    if (username && characterId) {
      localStorage.setItem(`favorites-${username}-${characterId}`, JSON.stringify(favorites));
    }
  };

  const toggleFavorite = (abilityId) => {
    const newFavorites = favoriteAbilities.includes(abilityId)
      ? favoriteAbilities.filter(id => id !== abilityId)
      : [...favoriteAbilities, abilityId];
    saveFavorites(newFavorites);
  };

  const getResourceBar = (abilityType) => {
    if (abilityType === "inata") return "inata";
    if (abilityType === "magia") return "vigor";
    if (abilityType === "arte") return "ether";
    return null;
  };

  const useAbility = (ability) => {
    const resourceBar = getResourceBar(ability.type);
    if (!resourceBar) {
      alert("Tipo de habilidade inválido.");
      return;
    }

    const cost = typeof ability.cost === "number" ? ability.cost : Number(ability.cost) || 0;
    if (cost <= 0) {
      alert("Esta habilidade não tem custo definido.");
      return;
    }

    const currentResource = sheet.bars?.[resourceBar] || 0;
    if (currentResource < cost) {
      alert(`Recurso insuficiente! Você tem ${currentResource} de ${resourceBar === "inata" ? "Inata" : resourceBar === "vigor" ? "Vigor" : "Ether"}, mas precisa de ${cost}.`);
      return;
    }

    const s = JSON.parse(JSON.stringify(sheet));
    if (!s.bars) s.bars = {};
    s.bars[resourceBar] = Math.max(0, currentResource - cost);
    onUpdateSheet(s);
    setTimeout(() => onSave(), 0);
  };

  const updateAbility = (id, patch) => {
    // Convert cost to number if it's being updated
    if (patch.cost !== undefined) {
      patch.cost = typeof patch.cost === "string" ? (patch.cost === "" ? 0 : Number(patch.cost) || 0) : patch.cost;
    }
    const updated = sheet.abilities.map(a => {
      if (a.id === id) {
        const updatedAbility = { ...a, ...patch };
        // Ensure cost is a number
        if (typeof updatedAbility.cost === "string") {
          updatedAbility.cost = updatedAbility.cost === "" ? 0 : Number(updatedAbility.cost) || 0;
        }
        return updatedAbility;
      }
      return a;
    });
    onUpdateSheet({ ...sheet, abilities: updated });
  };

  const removeAbility = (id) => {
    const updated = sheet.abilities.filter(a => a.id !== id);
    onUpdateSheet({ ...sheet, abilities: updated });
    onSave();
  };

  const handleAddAbility = () => {
    if (!newAbility.title.trim()) {
      alert("Por favor, insira um nome para a habilidade.");
      return;
    }
    
    const costValue = typeof newAbility.cost === "string" 
      ? (newAbility.cost === "" ? 0 : Number(newAbility.cost) || 0)
      : (newAbility.cost || 0);
    
    const abilityToAdd = {
      id: Date.now(),
      title: newAbility.title.trim(),
      type: newAbility.type || activeAbilityTab,
      description: newAbility.description || "",
      effect: newAbility.effect || "",
      damage: newAbility.damage || "",
      cost: costValue
    };
    
    onUpdateSheet({ ...sheet, abilities: [...sheet.abilities, abilityToAdd] });
    
    // Reset form
    setNewAbility({
      title: "",
      type: activeAbilityTab,
      description: "",
      effect: "",
      damage: "",
      cost: ""
    });
    setShowAddAbilityForm(false);
    
    // Save after state update
    setTimeout(() => {
      onSave();
    }, 0);
  };

  const handleAddTrait = () => {
    if (!newTrait.name.trim()) {
      return;
    }
    
    const s = JSON.parse(JSON.stringify(sheet));
    s.traits = [...(s.traits || []), { 
      id: Date.now(), 
      name: newTrait.name.trim(), 
      effect: newTrait.effect || "" 
    }];
    onUpdateSheet(s);
    
    // Reset form
    setNewTrait({ name: "", effect: "" });
    
    // Save after state update
    setTimeout(() => {
      onSave();
    }, 0);
  };

  const handleAddEffect = () => {
    if (!newEffect.name.trim()) {
      return;
    }
    
    const s = JSON.parse(JSON.stringify(sheet));
    s.effects = [...(s.effects || []), { 
      id: Date.now(), 
      name: newEffect.name.trim(), 
      description: newEffect.description || "",
      rounds: Number(newEffect.rounds) || 0,
      damage: Number(newEffect.damage) || 0,
      effect: newEffect.effect || ""
    }];
    onUpdateSheet(s);
    
    // Reset form
    setNewEffect({ name: "", description: "", rounds: 0, damage: 0, effect: "" });
    
    // Save after state update
    setTimeout(() => {
      onSave();
    }, 0);
  };

  const applyCondition = (conditionId) => {
    const s = JSON.parse(JSON.stringify(sheet));
    const condition = s.effects.find(e => e.id === conditionId);
    if (!condition) return;

    // Reduce rounds
    const newRounds = (condition.rounds || 0) - 1;
    
    // Apply damage if > 0
    if (condition.damage > 0) {
      const currentHp = s.bars?.hp || 0;
      s.bars.hp = Math.max(0, currentHp - condition.damage);
    }

    // Remove if rounds reach 0, otherwise update
    if (newRounds <= 0) {
      s.effects = s.effects.filter(e => e.id !== conditionId);
    } else {
      condition.rounds = newRounds;
    }

    onUpdateSheet(s);
    setTimeout(() => onSave(), 0);
  };

  const filteredAbilities = sheet.abilities.filter(a => {
    const matchesType = a.type === activeAbilityTab;
    if (!matchesType) return false;
    
    if (!abilitySearchQuery.trim()) return true;
    
    const query = abilitySearchQuery.toLowerCase();
    return (
      (a.title || "").toLowerCase().includes(query) ||
      (a.description || "").toLowerCase().includes(query) ||
      (a.type || "").toLowerCase().includes(query) ||
      (a.effect || "").toLowerCase().includes(query)
    );
  });
  const favoriteAbilitiesList = filteredAbilities.filter(a => favoriteAbilities.includes(a.id));
  const otherAbilities = filteredAbilities.filter(a => !favoriteAbilities.includes(a.id));

  const characterInfo = sheet.characterInfo || {
    class: "",
    race: "",
    background: "",
    alignment: "",
    age: "",
    height: "",
    weight: ""
  };

  return (
    <div className="character-sheet">
      <Tabs tabs={TAB_CONFIG} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "info" && (
        <div className="tab-content">
          <div className="panel">
            <h3>Informações do Personagem</h3>
            <div className="character-info-form">
              <div className="form-group">
                <label>Classe</label>
                <input
                  type="text"
                  value={characterInfo.class || ""}
                  onChange={(e) => {
                    const s = JSON.parse(JSON.stringify(sheet));
                    if (!s.characterInfo) s.characterInfo = {};
                    s.characterInfo.class = e.target.value;
                    onUpdateSheet(s);
                  }}
                  onBlur={onSave}
                  className="input-login"
                  placeholder="Ex: Guerreiro, Mago..."
                />
              </div>
              <div className="form-group">
                <label>Raça/Origem</label>
                <input
                  type="text"
                  value={characterInfo.race || ""}
                  onChange={(e) => {
                    const s = JSON.parse(JSON.stringify(sheet));
                    if (!s.characterInfo) s.characterInfo = {};
                    s.characterInfo.race = e.target.value;
                    onUpdateSheet(s);
                  }}
                  onBlur={onSave}
                  className="input-login"
                  placeholder="Ex: Humano, Elfo..."
                />
              </div>
              <div className="form-group">
                <label>Background</label>
                <input
                  type="text"
                  value={characterInfo.background || ""}
                  onChange={(e) => {
                    const s = JSON.parse(JSON.stringify(sheet));
                    if (!s.characterInfo) s.characterInfo = {};
                    s.characterInfo.background = e.target.value;
                    onUpdateSheet(s);
                  }}
                  onBlur={onSave}
                  className="input-login"
                  placeholder="Ex: Soldado, Erudito..."
                />
              </div>
              <div className="form-group">
                <label>Alinhamento</label>
                <input
                  type="text"
                  value={characterInfo.alignment || ""}
                  onChange={(e) => {
                    const s = JSON.parse(JSON.stringify(sheet));
                    if (!s.characterInfo) s.characterInfo = {};
                    s.characterInfo.alignment = e.target.value;
                    onUpdateSheet(s);
                  }}
                  onBlur={onSave}
                  className="input-login"
                  placeholder="Ex: Leal e Bom, Caótico e Neutro..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Idade</label>
                  <input
                    type="text"
                    value={characterInfo.age || ""}
                    onChange={(e) => {
                      const s = JSON.parse(JSON.stringify(sheet));
                      if (!s.characterInfo) s.characterInfo = {};
                      s.characterInfo.age = e.target.value;
                      onUpdateSheet(s);
                    }}
                    onBlur={onSave}
                    className="input-login"
                    placeholder="Ex: 25 anos"
                  />
                </div>
                <div className="form-group">
                  <label>Altura</label>
                  <input
                    type="text"
                    value={characterInfo.height || ""}
                    onChange={(e) => {
                      const s = JSON.parse(JSON.stringify(sheet));
                      if (!s.characterInfo) s.characterInfo = {};
                      s.characterInfo.height = e.target.value;
                      onUpdateSheet(s);
                    }}
                    onBlur={onSave}
                    className="input-login"
                    placeholder="Ex: 1,80m"
                  />
                </div>
                <div className="form-group">
                  <label>Peso</label>
                  <input
                    type="text"
                    value={characterInfo.weight || ""}
                    onChange={(e) => {
                      const s = JSON.parse(JSON.stringify(sheet));
                      if (!s.characterInfo) s.characterInfo = {};
                      s.characterInfo.weight = e.target.value;
                      onUpdateSheet(s);
                    }}
                    onBlur={onSave}
                    className="input-login"
                    placeholder="Ex: 75kg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "attributes" && (
        <div className="tab-content">
          <section className="two-columns">
            <div className="panel bars-panel">
              <h3>Barras</h3>
              {[
                { 
                  key: "bars.inata", 
                  label: "Inata", 
                  colorClass: "bar-blue", 
                  max: sheet.bars?.maxInata || sheet.level * 200,
                  maxKey: "maxInata",
                  maxReadonly: true,
                  defaultMax: () => sheet.level * 200
                },
                { 
                  key: "bars.ether", 
                  label: "Ether", 
                  colorClass: "bar-orange", 
                  max: sheet.bars?.maxEther || sheet.level * 100,
                  maxKey: "maxEther",
                  maxReadonly: false,
                  defaultMax: () => sheet.level * 100
                },
                { 
                  key: "bars.vigor", 
                  label: "Vigor", 
                  colorClass: "bar-purple", 
                  max: sheet.bars?.maxVigor || sheet.level * 50,
                  maxKey: "maxVigor",
                  maxReadonly: false,
                  defaultMax: () => sheet.level * 50
                },
                { key: "bars.hp", label: "Vida (HP)", colorClass: "bar-red", max: sheet.bars?.maxHp || sheet.bars?.hp || 100 },
                { key: "bars.sanity", label: "Sanidade Mental", colorClass: "bar-yellow", max: 100, maxFixed: true },
              ].map((b) => {
                const parts = b.key.split(".");
                const value = sheet[parts[0]]?.[parts[1]] || 0;
                const max = b.max || 100;
                return (
                  <div key={b.key} className="bar-row">
                    <div className="bar-top">
                      <div className="bar-label">{b.label}</div>
                      <div className="bar-inputs">
                        <input
                          type="number"
                          value={value}
                          max={b.max}
                          onChange={(e) => {
                            const s = JSON.parse(JSON.stringify(sheet));
                            s[parts[0]][parts[1]] = e.target.value === "" ? 0 : Number(e.target.value);
                            onUpdateSheet(s);
                          }}
                          onBlur={onSave}
                          className="input-number bar-input"
                        />
                        {(b.key === "bars.inata" || b.key === "bars.ether" || b.key === "bars.vigor") && (
                          <>
                            <span className="bar-separator">/</span>
                            <input
                              type="number"
                              value={b.max}
                              readOnly={b.maxReadonly}
                              onChange={(e) => {
                                if (!b.maxReadonly) {
                                  const s = JSON.parse(JSON.stringify(sheet));
                                  if (!s.bars) s.bars = {};
                                  const defaultVal = b.key === "bars.ether" ? s.level * 100 : s.level * 50;
                                  s.bars[b.maxKey] = e.target.value === "" ? defaultVal : Number(e.target.value);
                                  onUpdateSheet(s);
                                }
                              }}
                              onBlur={onSave}
                              className="input-number bar-input"
                              placeholder="Max"
                              style={b.maxReadonly ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                            />
                          </>
                        )}
                        {b.key === "bars.hp" && (
                          <>
                            <span className="bar-separator">/</span>
                            <input
                              type="number"
                              value={sheet.bars?.maxHp || sheet.bars?.hp || 0}
                              onChange={(e) => {
                                const s = JSON.parse(JSON.stringify(sheet));
                                if (!s.bars) s.bars = {};
                                s.bars.maxHp = e.target.value === "" ? 0 : Number(e.target.value);
                                onUpdateSheet(s);
                              }}
                              onBlur={onSave}
                              className="input-number bar-input"
                              placeholder="Max"
                            />
                          </>
                        )}
                        {b.key === "bars.sanity" && (
                          <>
                            <span className="bar-separator">/</span>
                            <input
                              type="number"
                              value={100}
                              readOnly
                              className="input-number bar-input"
                              style={{ opacity: 0.6, cursor: "not-allowed" }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`bar-fill ${b.colorClass}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }}>
                      <div className="bar-fill-inner" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panel stats-panel">
              <h3>Atributos</h3>
              <div className="stats-grid">
                {Object.entries(sheet.stats || {}).map(([k, v]) => (
                  <div key={k} className="stat-cell">
                    <div className="stat-key">{k.toUpperCase()}</div>
                    <input
                      className="stat-input"
                      value={v || ""}
                      onChange={(e) => {
                        const s = JSON.parse(JSON.stringify(sheet));
                        if (!s.stats) s.stats = {};
                        s.stats[k] = e.target.value === "" ? 0 : Number(e.target.value);
                        onUpdateSheet(s);
                      }}
                      onBlur={onSave}
                    />
                  </div>
                ))}
              </div>
              <div className="ca-display" style={{ marginTop: "20px", padding: "12px", background: "rgba(107, 70, 193, 0.15)", borderRadius: "8px", border: "1px solid rgba(107, 70, 193, 0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>Classe de Armadura (CA)</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--accent-indigo)" }}>
                    {10 + Math.max(
                      Math.floor((sheet.stats?.con || 0) / 2),
                      Math.floor((sheet.stats?.des || 0) / 2)
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  Base 10 + max(CON/2: {Math.floor((sheet.stats?.con || 0) / 2)}, DES/2: {Math.floor((sheet.stats?.des || 0) / 2)})
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "abilities" && (
        <div className="tab-content">
          <div className="abilities-panel">
            <div className="abilities-header">
              <h3>Habilidades</h3>
              <input
                type="text"
                placeholder="Buscar habilidades..."
                value={abilitySearchQuery}
                onChange={(e) => setAbilitySearchQuery(e.target.value)}
                className="input-new"
                style={{ marginBottom: "12px", width: "100%" }}
              />
              <div className="tabs">
                {["inata", "magia", "arte"].map((type) => (
                  <button
                    key={type}
                    className={`tab-button ${activeAbilityTab === type ? "active" : ""}`}
                    onClick={() => setActiveAbilityTab(type)}
                  >
                    {type === "inata" ? "Inata" : type === "magia" ? "Magia" : "Arte Divina"}
                  </button>
                ))}
              </div>
              <button 
                className="btn-primary" 
                onClick={() => setShowAddAbilityForm(!showAddAbilityForm)}
              >
                {showAddAbilityForm ? "✕ Cancelar" : "+ Habilidade"}
              </button>
            </div>

            {/* Add Ability Form */}
            {showAddAbilityForm && (
              <div className="add-ability-form">
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Nome da habilidade *"
                    value={newAbility.title}
                    onChange={(e) => setNewAbility({ ...newAbility, title: e.target.value })}
                    className="input-new"
                    autoFocus
                  />
                  <select
                    value={newAbility.type}
                    onChange={(e) => setNewAbility({ ...newAbility, type: e.target.value })}
                    className="select"
                  >
                    <option value="inata">Inata</option>
                    <option value="magia">Magia</option>
                    <option value="arte">Arte Divina</option>
                  </select>
                </div>
                <textarea
                  placeholder="Descrição"
                  value={newAbility.description}
                  onChange={(e) => setNewAbility({ ...newAbility, description: e.target.value })}
                  className="input-new"
                  rows="3"
                />
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Efeito"
                    value={newAbility.effect}
                    onChange={(e) => setNewAbility({ ...newAbility, effect: e.target.value })}
                    className="input-new"
                  />
                  <input
                    type="text"
                    placeholder="Dano (ex: 1d8)"
                    value={newAbility.damage}
                    onChange={(e) => setNewAbility({ ...newAbility, damage: e.target.value })}
                    className="input-new"
                  />
                  <input
                    type="number"
                    placeholder="Custo"
                    value={newAbility.cost === "" ? "" : newAbility.cost}
                    onChange={(e) => {
                      const value = e.target.value === "" ? "" : Number(e.target.value) || 0;
                      setNewAbility({ ...newAbility, cost: value });
                    }}
                    className="input-new"
                    min="0"
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={handleAddAbility}>
                    Adicionar Habilidade
                  </button>
                  <button 
                    className="btn-danger" 
                    onClick={() => {
                      setShowAddAbilityForm(false);
                      setNewAbility({
                        title: "",
                        type: activeAbilityTab,
                        description: "",
                        effect: "",
                        damage: "",
                        cost: ""
                      });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="abilities-list">
              {favoriteAbilitiesList.map((a) => (
                <AbilityCard
                  key={a.id}
                  ability={a}
                  isFavorite={true}
                  onUpdate={updateAbility}
                  onRemove={removeAbility}
                  onToggleFavorite={toggleFavorite}
                  onSave={onSave}
                  onUse={useAbility}
                  sheet={sheet}
                />
              ))}
              {otherAbilities.map((a) => (
                <AbilityCard
                  key={a.id}
                  ability={a}
                  isFavorite={false}
                  onUpdate={updateAbility}
                  onRemove={removeAbility}
                  onToggleFavorite={toggleFavorite}
                  onSave={onSave}
                  onUse={useAbility}
                  sheet={sheet}
                />
              ))}
              {filteredAbilities.length === 0 && !showAddAbilityForm && (
                <div className="empty-state">
                  {abilitySearchQuery.trim() 
                    ? `Nenhuma habilidade encontrada para "${abilitySearchQuery}".` 
                    : "Nenhuma habilidade deste tipo ainda. Clique em \"+ Habilidade\" para adicionar."}
                </div>
              )}
              {filteredAbilities.length > 0 && abilitySearchQuery.trim() && (
                <div className="muted small" style={{ marginTop: "12px", textAlign: "center" }}>
                  {filteredAbilities.length} habilidade{filteredAbilities.length !== 1 ? "s" : ""} encontrada{filteredAbilities.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="tab-content">
          <Inventory
            inventory={sheet.inventory || []}
            coins={sheet.coins || { gold: 0, silver: 0 }}
            onUpdateInventory={(inv) => onUpdateSheet({ ...sheet, inventory: inv })}
            onUpdateCoins={(coins) => onUpdateSheet({ ...sheet, coins })}
            onSave={onSave}
            characterId={characterId}
            username={username}
          />
        </div>
      )}

      {activeTab === "status" && (
        <div className="tab-content">
          <div className="panel">
            <h3>Traços</h3>
            <div className="trait-add">
              <input 
                type="text"
                value={newTrait.name}
                onChange={(e) => setNewTrait({ ...newTrait, name: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newTrait.name.trim()) {
                    handleAddTrait();
                  }
                }}
                placeholder="Nome do traço" 
                className="input-new" 
              />
              <input 
                type="text"
                value={newTrait.effect}
                onChange={(e) => setNewTrait({ ...newTrait, effect: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newTrait.name.trim()) {
                    handleAddTrait();
                  }
                }}
                placeholder="Efeito" 
                className="input-new" 
              />
              <button
                className="btn-primary small"
                onClick={handleAddTrait}
                disabled={!newTrait.name.trim()}
              >
                +
              </button>
            </div>
            <ul className="trait-list">
              {(sheet.traits || []).map((tr) => (
                <li key={tr.id} className="trait-item">
                  <div>
                    <strong>{tr.name}</strong>: {tr.effect}
                  </div>
                  <button
                    className="link-danger"
                    onClick={() => {
                      const s = JSON.parse(JSON.stringify(sheet));
                      s.traits = (s.traits || []).filter(t => t.id !== tr.id);
                      onUpdateSheet(s);
                      setTimeout(() => onSave(), 0);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <h3 className="mt">Condições</h3>
            <div className="effect-add-form">
              <div className="form-row">
                <input 
                  type="text"
                  value={newEffect.name}
                  onChange={(e) => setNewEffect({ ...newEffect, name: e.target.value })}
                  placeholder="Nome da condição" 
                  className="input-new" 
                />
                <input 
                  type="text"
                  value={newEffect.description}
                  onChange={(e) => setNewEffect({ ...newEffect, description: e.target.value })}
                  placeholder="Descrição" 
                  className="input-new" 
                />
              </div>
              <div className="form-row">
                <input 
                  type="number"
                  value={newEffect.rounds === "" ? "" : newEffect.rounds}
                  onChange={(e) => setNewEffect({ ...newEffect, rounds: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
                  placeholder="Rodadas" 
                  className="input-number" 
                  min="0"
                />
                <input 
                  type="number"
                  value={newEffect.damage === "" ? "" : newEffect.damage}
                  onChange={(e) => setNewEffect({ ...newEffect, damage: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
                  placeholder="Dano por rodada" 
                  className="input-number" 
                  min="0"
                />
                <input 
                  type="text"
                  value={newEffect.effect}
                  onChange={(e) => setNewEffect({ ...newEffect, effect: e.target.value })}
                  placeholder="Efeito adicional" 
                  className="input-new" 
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleAddEffect}
                disabled={!newEffect.name.trim()}
              >
                Adicionar Condição
              </button>
            </div>
            <ul className="inventory-list">
              {(sheet.effects || []).map((ef) => {
                const rounds = ef.rounds !== undefined ? ef.rounds : 0;
                const damage = ef.damage !== undefined ? ef.damage : 0;
                return (
                  <li key={ef.id} className="inventory-item condition-item">
                    <div className="condition-info">
                      <div className="condition-header">
                        <strong>{ef.name}</strong>
                        {rounds > 0 && (
                          <span className="condition-rounds">({rounds} rodada{rounds !== 1 ? "s" : ""})</span>
                        )}
                      </div>
                      {ef.description && <div className="condition-description">{ef.description}</div>}
                      {damage > 0 && (
                        <div className="condition-damage">Dano: {damage} por rodada</div>
                      )}
                      {ef.effect && <div className="condition-effect">{ef.effect}</div>}
                    </div>
                    <div className="condition-actions">
                      {rounds > 0 && (
                        <button
                          className="btn-primary small"
                          onClick={() => applyCondition(ef.id)}
                          title="Aplicar condição (reduz 1 rodada e aplica dano)"
                        >
                          Aplicar
                        </button>
                      )}
                      <button
                        className="link-danger"
                        onClick={() => {
                          const s = JSON.parse(JSON.stringify(sheet));
                          s.effects = (s.effects || []).filter(e => e.id !== ef.id);
                          onUpdateSheet(s);
                          setTimeout(() => onSave(), 0);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="tab-content">
          <div className="panel">
            <h3>Anotações</h3>
            <textarea
              className="notes-textarea"
              value={sheet.notes || ""}
              onChange={(e) => onUpdateSheet({ ...sheet, notes: e.target.value })}
              onBlur={onSave}
              placeholder="Anotações sobre o personagem..."
              rows="15"
            />
          </div>
        </div>
      )}
    </div>
  );
}
