import React, { useState, useEffect, useRef, useCallback } from "react";
import Tabs from "./Tabs";
import AbilityCard from "./AbilityCard";
import Inventory from "./Inventory";
import { blobToCompressedDataUrl } from "../utils/imageCompress";
import {
  STAT_LABELS,
  ALL_STATS,
  computeCA,
  canSpendResource,
  syncOverheatFlags,
  clearOverheatIfRecovered,
  normalizeEffect,
} from "../utils/rampageRules";
import "./CharacterSheet.css";

const MAX_GALLERY_IMAGES = 24;

const TAB_CONFIG = [
  { id: "attributes", label: "Atributos", icon: "⚔️" },
  { id: "abilities", label: "Habilidades", icon: "✨" },
  { id: "inventory", label: "Inventário", icon: "🎒" },
  { id: "status", label: "Status", icon: "📊" },
  {
    id: "notes",
    label: "Anotações do Personagem",
    icon: "📝",
    title: "Anotações específicas deste personagem. Para notas pessoais que ficam na sua conta, use 'Notas de Perfil' no menu lateral.",
  },
  { id: "info", label: "Info", icon: "👤" },
];

const SHEET_NOTES_HINT_KEY = "cataclysm-sheet-notes-hint";

const MAGIC_FIELDS = [
  { value: "metamagia", label: "Metamagia" },
  { value: "manipulacao", label: "Manipulação" },
  { value: "invocacao", label: "Invocação" },
  { value: "conjuracao", label: "Conjuração" },
  { value: "transmutacao", label: "Transmutação" },
  { value: "abjuracao", label: "Abjuração" },
];

export default function CharacterSheet({ 
  sheet, 
  effectiveStats: effectiveStatsProp,
  onUpdateSheet, 
  onSave,
  username,
  characterId,
  onRequestRest,
  onActivateFocus
}) {
  const effectiveStats = effectiveStatsProp || sheet.stats || {};
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
    cost: "",
    field: ""
  });
  const [newTrait, setNewTrait] = useState({ name: "", effect: "" });
  const [newEffect, setNewEffect] = useState({
    name: "",
    description: "",
    rounds: 0,
    damage: 0,
    effect: "",
    drainType: "",
    drainAmount: 0,
    tickMode: "turnEnd",
  });
  const [showAddModeForm, setShowAddModeForm] = useState(false);
  const [newModeName, setNewModeName] = useState("");
  const [newModeModifiers, setNewModeModifiers] = useState({});
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showLoreModal, setShowLoreModal] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [barStep, setBarStep] = useState("1");
  const lastDeltaBarRef = useRef("hp");
  const [statusSearchQuery, setStatusSearchQuery] = useState("");
  const [documentListSearch, setDocumentListSearch] = useState("");
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [editingGalleryImageId, setEditingGalleryImageId] = useState(null);
  const [imageGallerySearch, setImageGallerySearch] = useState("");
  const galleryFileInputRef = useRef(null);
  const [showSheetNotesHint, setShowSheetNotesHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTab !== "notes") return;
    if (!localStorage.getItem(SHEET_NOTES_HINT_KEY)) {
      setShowSheetNotesHint(true);
    }
  }, [activeTab]);

  const dismissSheetNotesHint = () => {
    setShowSheetNotesHint(false);
    try {
      localStorage.setItem(SHEET_NOTES_HINT_KEY, "1");
    } catch {
      // ignore
    }
  };

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const appendGalleryImageFromBlob = useCallback(
    async (blob) => {
      if (!blob || !String(blob.type || "").startsWith("image/")) return;
      try {
        const dataUrl = await blobToCompressedDataUrl(blob);
        const newId = genId();
        let added = false;
        onUpdateSheet((prev) => {
          const list = prev.galleryImages || [];
          if (list.some((i) => i.id === newId)) return prev;
          if (list.length >= MAX_GALLERY_IMAGES) return prev;
          added = true;
          const img = {
            id: newId,
            title: `Imagem ${list.length + 1}`,
            dataUrl,
            createdAt: Date.now(),
          };
          return { ...prev, galleryImages: [...list, img] };
        });
        if (!added) {
          alert(`Limite de ${MAX_GALLERY_IMAGES} imagens na galeria (para caber no salvamento da ficha).`);
          return;
        }
        setTimeout(() => onSave(), 0);
      } catch (err) {
        console.error(err);
        alert("Não foi possível processar a imagem.");
      }
    },
    [onUpdateSheet, onSave]
  );

  useEffect(() => {
    if (!editingGalleryImageId || !showImagesModal) return;
    const exists = (sheet.galleryImages || []).some((x) => x.id === editingGalleryImageId);
    if (!exists) setEditingGalleryImageId(null);
  }, [editingGalleryImageId, showImagesModal, sheet.galleryImages]);

  useEffect(() => {
    if (!showImagesModal) return;
    const handler = (e) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && String(it.type || "").startsWith("image/")) {
          e.preventDefault();
          const blob = it.getAsFile();
          if (blob) appendGalleryImageFromBlob(blob);
          return;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [showImagesModal, appendGalleryImageFromBlob]);

  const getDocumentContent = (doc) => {
    if (doc.content != null && doc.content !== "") return doc.content;
    if (doc.items && doc.items.length) {
      return doc.items.map((it) => (it.checked ? "[x] " : "[ ] ") + (it.label || "")).join("\n");
    }
    return "";
  };

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

  const getMagicCostReduction = (level) => {
    if (level >= 17) return 0.5;
    if (level >= 13) return 0.4;
    return 0.3;
  };

  const getEffectiveCost = (ability) => {
    const baseCost = typeof ability.cost === "number" ? ability.cost : Number(ability.cost) || 0;
    if (ability.type !== "magia" || !ability.field) return baseCost;
    const dominant = (sheet.characterInfo || {}).dominantField || "";
    if (ability.field !== dominant) return baseCost;
    const level = Number(sheet.level) || 1;
    const reduction = getMagicCostReduction(level);
    return Math.max(0, Math.floor(baseCost * (1 - reduction)));
  };

  const useAbility = (ability) => {
    const resourceBar = getResourceBar(ability.type);
    if (!resourceBar) {
      alert("Tipo de habilidade inválido.");
      return;
    }

    const spendKey = resourceBar === "inata" ? "pe" : resourceBar;
    if (!canSpendResource(sheet, spendKey)) {
      alert("Overheat: este recurso está inutilizável até recuperar pelo menos metade do máximo ou fazer Descanso Longo.");
      return;
    }

    const baseCost = typeof ability.cost === "number" ? ability.cost : Number(ability.cost) || 0;
    if (baseCost <= 0) {
      alert("Esta habilidade não tem custo definido.");
      return;
    }

    const cost = getEffectiveCost(ability);
    const currentResource = sheet.bars?.[resourceBar] || 0;
    if (currentResource < cost) {
      alert(`Recurso insuficiente! Você tem ${currentResource} de ${resourceBar === "inata" ? "PE" : resourceBar === "vigor" ? "Vigor" : "Éter"}, mas precisa de ${cost}.`);
      return;
    }

    let s = JSON.parse(JSON.stringify(sheet));
    if (!s.bars) s.bars = {};
    s.bars[resourceBar] = Math.max(0, currentResource - cost);
    s = syncOverheatFlags(s);
    if (ability.soundUrl) {
      try {
        const audio = new Audio(ability.soundUrl);
        audio.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }
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
      cost: costValue,
      ...(newAbility.type === "magia" && newAbility.field ? { field: newAbility.field } : {})
    };
    
    onUpdateSheet({ ...sheet, abilities: [...sheet.abilities, abilityToAdd] });
    
    // Reset form
    setNewAbility({
      title: "",
      type: activeAbilityTab,
      description: "",
      effect: "",
      damage: "",
      cost: "",
      field: ""
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
    s.effects = [
      ...(s.effects || []),
      normalizeEffect({
        id: Date.now(),
        name: newEffect.name.trim(),
        description: newEffect.description || "",
        rounds: Number(newEffect.rounds) || 0,
        damage: Number(newEffect.damage) || 0,
        effect: newEffect.effect || "",
        drainType: newEffect.drainType || "",
        drainAmount: Number(newEffect.drainAmount) || 0,
        tickMode: newEffect.tickMode || "turnEnd",
      }),
    ];
    onUpdateSheet(s);
    
    // Reset form
    setNewEffect({ name: "", description: "", rounds: 0, damage: 0, effect: "", drainType: "", drainAmount: 0 });
    
    // Save after state update
    setTimeout(() => {
      onSave();
    }, 0);
  };

  const applyCondition = (conditionId) => {
    const s = JSON.parse(JSON.stringify(sheet));
    const condition = s.effects.find(e => e.id === conditionId);
    if (!condition) return;

    if (!s.bars) s.bars = {};

    // Apply HP damage if > 0
    if (condition.damage > 0) {
      const currentHp = s.bars?.hp || 0;
      s.bars.hp = Math.max(0, currentHp - condition.damage);
    }

    // Apply drain to resource bar (hp, ether, vigor, inata)
    const drainType = condition.drainType || "";
    const drainAmount = Number(condition.drainAmount) || 0;
    if (drainType && drainAmount > 0) {
      const barKey = drainType === "hp" ? "hp" : drainType;
      const current = s.bars[barKey] ?? 0;
      s.bars[barKey] = Math.max(0, current - drainAmount);
    }

    const currentRounds = condition.rounds ?? 0;
    if (currentRounds > 0) {
      const newRounds = currentRounds - 1;
      if (newRounds <= 0) {
        s.effects = s.effects.filter(e => e.id !== conditionId);
      } else {
        condition.rounds = newRounds;
      }
    }

    onUpdateSheet(s);
    setTimeout(() => onSave(), 0);
  };

  const getBarMaxForKey = (barKey, s = sheet) => {
    const level = Number(s.level) || 1;
    const bars = s.bars || {};
    if (barKey === "inata") return bars.maxInata || level * 200;
    if (barKey === "ether") return bars.maxEther || level * 100;
    if (barKey === "vigor") return bars.maxVigor || level * 50;
    if (barKey === "hp") return bars.maxHp ?? bars.hp ?? 100;
    if (barKey === "sanity") return 100;
    return 100;
  };

  const applyBarDelta = (barKey, sign) => {
    const raw = Number(barStep);
    const amount = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
    lastDeltaBarRef.current = barKey;
    const s = JSON.parse(JSON.stringify(sheet));
    if (!s.bars) s.bars = {};
    const max = getBarMaxForKey(barKey, s);
    const cur = Number(s.bars[barKey]) || 0;
    s.bars[barKey] = Math.min(max, Math.max(0, cur + sign * amount));
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
      (a.effect || "").toLowerCase().includes(query) ||
      String(a.damage || "").toLowerCase().includes(query)
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
    weight: "",
    dominantField: ""
  };

  return (
    <div className="character-sheet">
      <Tabs tabs={TAB_CONFIG} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "info" && (
        <div className="tab-content">
          <div className="panel">
            <h3>Informações do Personagem</h3>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label>{sheet.focusType === "certainty" ? "Certeza" : "Inspiração"}</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  className="input-login"
                  readOnly
                  value={`${Number(sheet.focusPoints) || 0}${sheet.focusType === "inspiration" ? " / 3" : " / 1"}`}
                  style={{ opacity: 0.85 }}
                />
                <button
                  type="button"
                  className="btn-primary small"
                  onClick={() => onActivateFocus && onActivateFocus()}
                  disabled={(Number(sheet.focusPoints) || 0) <= 0}
                  title={sheet.focusType === "certainty" ? "Usar Certeza (19 automático no próximo d20)" : "Usar Inspiração (vantagem no próximo d20)"}
                >
                  Usar
                </button>
              </div>
              <div className="muted small" style={{ marginTop: "4px" }}>
                {sheet.focusType === "certainty"
                  ? "Enquanto houver Certeza, descanso longo não gera Inspiração."
                  : "Inspiração concede vantagem em uma ação (próximo d20)."}
              </div>
            </div>
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
                <label>Campo que domina (magia)</label>
                <select
                  value={characterInfo.dominantField || ""}
                  onChange={(e) => {
                    const s = JSON.parse(JSON.stringify(sheet));
                    if (!s.characterInfo) s.characterInfo = {};
                    s.characterInfo.dominantField = e.target.value;
                    onUpdateSheet(s);
                  }}
                  onBlur={onSave}
                  className="input-login"
                >
                  <option value="">Nenhum</option>
                  {MAGIC_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <div className="muted small" style={{ marginTop: "4px" }}>Magias do mesmo campo custam 30% menos (40% ao nível 13, 50% ao nível 17).</div>
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
              <div className="bar-step-toolbar">
                <label htmlFor="bar-step-input" className="bar-step-label">
                  Passo
                </label>
                <input
                  id="bar-step-input"
                  type="number"
                  min="1"
                  step="1"
                  value={barStep}
                  onChange={(e) => setBarStep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyBarDelta(lastDeltaBarRef.current || "hp", -1);
                    }
                  }}
                  className="input-number bar-step-input"
                  title="Enter: subtrair da última barra ajustada (+/−), ou Vida se nenhuma"
                />
                <span className="bar-step-hint muted small">
                  Enter − última barra
                </span>
              </div>
              {[
                { 
                  key: "bars.inata", 
                  label: "PE", 
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
                        <div className="bar-delta-actions">
                          <button
                            type="button"
                            className="bar-delta-btn"
                            title="Subtrair passo (dreno/dano)"
                            onClick={() => applyBarDelta(parts[1], -1)}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="bar-delta-btn bar-delta-btn--plus"
                            title="Somar passo (recuperar)"
                            onClick={() => applyBarDelta(parts[1], 1)}
                          >
                            +
                          </button>
                        </div>
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
                {ALL_STATS.map((k) => {
                  const v = sheet.stats?.[k] ?? 0;
                  const baseVal = Number(v) || 0;
                  const effVal = Number(effectiveStats[k]) ?? baseVal;
                  const modDelta = effVal - baseVal;
                  return (
                    <div key={k} className="stat-cell">
                      <div className="stat-key">{STAT_LABELS[k] || k.toUpperCase()}</div>
                      <input
                        className="stat-input"
                        value={v === 0 || v ? v : ""}
                        onChange={(e) => {
                          const s = JSON.parse(JSON.stringify(sheet));
                          if (!s.stats) s.stats = {};
                          s.stats[k] = e.target.value === "" ? 0 : Number(e.target.value);
                          onUpdateSheet(s);
                        }}
                        onBlur={onSave}
                      />
                      {modDelta !== 0 && (
                        <div className="muted small" style={{ fontSize: "10px", marginTop: "2px" }}>
                          Efetivo: {effVal} ({modDelta >= 0 ? "+" : ""}{modDelta})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const fis = Number(effectiveStats.fis ?? sheet.stats?.fis) || 0;
                const des = Number(effectiveStats.des ?? sheet.stats?.des) || 0;
                const ca = computeCA(sheet.level, fis, des, sheet.caArmorMod);
                const oh = sheet.overheat || {};
                return (
              <div className="ca-display" style={{ marginTop: "20px", padding: "12px", background: "rgba(107, 70, 193, 0.15)", borderRadius: "8px", border: "1px solid rgba(107, 70, 193, 0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>Classe de Armadura (CA)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--accent-indigo)" }}>
                      {ca}
                    </div>
                    <label className="muted" style={{ fontSize: "12px" }}>Mod. armadura</label>
                    <input
                      type="number"
                      className="input-number stat-input"
                      style={{ width: "56px" }}
                      value={sheet.caArmorMod ?? ""}
                      onChange={(e) => {
                        const s = JSON.parse(JSON.stringify(sheet));
                        s.caArmorMod = e.target.value === "" ? 0 : Number(e.target.value);
                        onUpdateSheet(s);
                      }}
                      onBlur={onSave}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  floor(1,5×nível + FIS/4 + DES/4) = floor(1,5×{Number(sheet.level) || 0} + {fis}/4 + {des}/4)
                  {(Number(sheet.caArmorMod) || 0) !== 0 && ` + armadura ${sheet.caArmorMod >= 0 ? "+" : ""}${sheet.caArmorMod}`}
                </div>
                {(oh.pe || oh.ether || oh.vigor) && (
                  <div style={{ fontSize: "12px", color: "#f87171", marginTop: "8px" }}>
                    Overheat ativo: {[oh.pe && "PE", oh.ether && "Éter", oh.vigor && "Vigor"].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
                );
              })()}

              <h3 className="mt">Modos</h3>
              <p className="muted small" style={{ marginBottom: "8px" }}>Ative modos para aplicar bônus/penalidade aos atributos (só exibição e rolos).</p>
              {(sheet.modes || []).map((mode) => (
                <div key={mode.id} className="mode-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <label className="mode-toggle">
                    <input
                      type="checkbox"
                      checked={!!mode.active}
                      onChange={() => {
                        const s = JSON.parse(JSON.stringify(sheet));
                        s.modes = (s.modes || []).map((m) => m.id === mode.id ? { ...m, active: !m.active } : m);
                        onUpdateSheet(s);
                        setTimeout(() => onSave(), 0);
                      }}
                    />
                    <span style={{ fontWeight: mode.active ? "600" : "400" }}>{mode.name || "Sem nome"}</span>
                  </label>
                  <button
                    type="button"
                    className="link-danger small"
                    onClick={() => {
                      const s = JSON.parse(JSON.stringify(sheet));
                      s.modes = (s.modes || []).filter((m) => m.id !== mode.id);
                      onUpdateSheet(s);
                      setTimeout(() => onSave(), 0);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {showAddModeForm ? (
                <div className="add-mode-form" style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                  <input
                    type="text"
                    placeholder="Nome do modo"
                    value={newModeName}
                    onChange={(e) => setNewModeName(e.target.value)}
                    className="input-new"
                    style={{ marginBottom: "8px", width: "100%" }}
                  />
                  <div className="muted small" style={{ marginBottom: "6px" }}>Modificadores (deixe 0 ou vazio para não alterar)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                    {ALL_STATS.map((statKey) => (
                      <div key={statKey} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <label style={{ fontSize: "12px", minWidth: "28px" }}>{STAT_LABELS[statKey] || statKey}</label>
                        <input
                          type="number"
                          className="input-number"
                          style={{ width: "52px" }}
                          value={newModeModifiers[statKey] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? "" : Number(e.target.value);
                            setNewModeModifiers((prev) => (v === "" ? { ...prev, [statKey]: undefined } : { ...prev, [statKey]: v }));
                          }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn-primary small"
                      onClick={() => {
                        if (!newModeName.trim()) return;
                        const s = JSON.parse(JSON.stringify(sheet));
                        const modifiers = {};
                        Object.entries(newModeModifiers).forEach(([k, v]) => {
                          if (v !== undefined && v !== "" && Number(v) !== 0) modifiers[k] = Number(v);
                        });
                        s.modes = [...(s.modes || []), { id: Date.now(), name: newModeName.trim(), active: false, modifiers }];
                        onUpdateSheet(s);
                        setNewModeName("");
                        setNewModeModifiers({});
                        setShowAddModeForm(false);
                        setTimeout(() => onSave(), 0);
                      }}
                      disabled={!newModeName.trim()}
                    >
                      Adicionar
                    </button>
                    <button type="button" className="btn-danger small" onClick={() => { setShowAddModeForm(false); setNewModeName(""); setNewModeModifiers({}); }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-primary small" onClick={() => setShowAddModeForm(true)}>
                  + Criar modo
                </button>
              )}
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
                {newAbility.type === "magia" && (
                  <div className="form-row" style={{ marginTop: "8px" }}>
                    <label className="muted small" style={{ width: "100%" }}>Campo da magia</label>
                    <select
                      value={newAbility.field || ""}
                      onChange={(e) => setNewAbility({ ...newAbility, field: e.target.value })}
                      className="select"
                    >
                      <option value="">Selecione</option>
                      {MAGIC_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                        cost: "",
                        field: ""
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
                  getEffectiveCost={getEffectiveCost}
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
                  getEffectiveCost={getEffectiveCost}
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
            equipment={sheet.equipment || undefined}
            coins={sheet.coins || { gold: 0, silver: 0 }}
            onUpdateInventory={(inv) => onUpdateSheet({ ...sheet, inventory: inv })}
            onUpdateEquipment={(equipment) => onUpdateSheet({ ...sheet, equipment })}
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
            <input
              type="search"
              className="input-new sheet-section-search"
              placeholder="Buscar em traços e condições…"
              value={statusSearchQuery}
              onChange={(e) => setStatusSearchQuery(e.target.value)}
              aria-label="Buscar em traços e condições"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
              <button
                type="button"
                className="btn-primary small"
                onClick={() => onRequestRest && onRequestRest()}
                title="Descanso curto ou longo"
              >
                Descanso
              </button>
            </div>
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
              {(sheet.traits || [])
                .filter((tr) => {
                  const q = statusSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (tr.name || "").toLowerCase().includes(q) ||
                    (tr.effect || "").toLowerCase().includes(q)
                  );
                })
                .map((tr) => (
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
                  placeholder="Rodadas (0 = até remover)" 
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
              <div className="form-row">
                <select
                  value={newEffect.tickMode || "turnEnd"}
                  onChange={(e) => setNewEffect({ ...newEffect, tickMode: e.target.value })}
                  className="select"
                  title="Quando o efeito tica na sessão"
                >
                  <option value="turnEnd">Tick: fim do turno</option>
                  <option value="turnStart">Tick: início do turno</option>
                  <option value="round">Tick: fim da rodada</option>
                </select>
                <select
                  value={newEffect.drainType || ""}
                  onChange={(e) => setNewEffect({ ...newEffect, drainType: e.target.value })}
                  className="select"
                >
                  <option value="">Dreno por tick: Nenhum</option>
                  <option value="hp">HP</option>
                  <option value="ether">Ether</option>
                  <option value="vigor">Vigor</option>
                  <option value="inata">Inata</option>
                </select>
                <input 
                  type="number"
                  value={newEffect.drainAmount === "" ? "" : newEffect.drainAmount}
                  onChange={(e) => setNewEffect({ ...newEffect, drainAmount: e.target.value === "" ? "" : Number(e.target.value) || 0 })}
                  placeholder="Qtd. dreno" 
                  className="input-number" 
                  min="0"
                  disabled={!newEffect.drainType}
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
              {(sheet.effects || [])
                .filter((ef) => {
                  const q = statusSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (ef.name || "").toLowerCase().includes(q) ||
                    (ef.description || "").toLowerCase().includes(q) ||
                    (ef.effect || "").toLowerCase().includes(q)
                  );
                })
                .map((ef) => {
                const rounds = ef.rounds !== undefined ? ef.rounds : 0;
                const damage = ef.damage !== undefined ? ef.damage : 0;
                const drainType = ef.drainType || "";
                const drainAmount = Number(ef.drainAmount) || 0;
                const hasRoundEffect = damage > 0 || (drainType && drainAmount > 0);
                const drainLabel = { hp: "HP", ether: "Ether", vigor: "Vigor", inata: "Inata" }[drainType];
                return (
                  <li key={ef.id} className="inventory-item condition-item">
                    <div className="condition-info">
                      <div className="condition-header">
                        <strong>{ef.name}</strong>
                        {rounds > 0 ? (
                          <span className="condition-rounds">({rounds} rodada{rounds !== 1 ? "s" : ""})</span>
                        ) : (
                          <span className="condition-rounds">(até remover)</span>
                        )}
                      </div>
                      {ef.description && <div className="condition-description">{ef.description}</div>}
                      {damage > 0 && (
                        <div className="condition-damage">Dano: {damage} por rodada</div>
                      )}
                      {drainType && drainAmount > 0 && (
                        <div className="condition-damage">Dreno: {drainAmount} {drainLabel} por rodada</div>
                      )}
                      {ef.effect && <div className="condition-effect">{ef.effect}</div>}
                    </div>
                    <div className="condition-actions">
                      {hasRoundEffect && (
                        <button
                          className="btn-primary small"
                          onClick={() => applyCondition(ef.id)}
                          title={rounds > 0 ? "Aplicar (reduz 1 rodada, dano e dreno)" : "Aplicar (dano e dreno desta rodada)"}
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
          <div className="panel notes-panel">
            <h3>Anotações do Personagem</h3>
            <p className="notes-scope-hint muted">
              Estas anotações ficam <strong>apenas neste personagem</strong>.
              Para notas que valem para qualquer ficha sua, use{" "}
              <strong>Notas de Perfil</strong> no menu lateral.
            </p>
            {showSheetNotesHint && (
              <div className="notes-hint-banner inline" role="note">
                <div>
                  <strong>Dica:</strong> esta aba é só do personagem atual.
                  Lore pessoal, ideias para a campanha e regras caseiras vão
                  melhor em <em>Notas de Perfil</em> (acessível pelo menu).
                </div>
                <button
                  type="button"
                  className="btn-outline small"
                  onClick={dismissSheetNotesHint}
                >
                  Entendi
                </button>
              </div>
            )}
            <div className="notes-actions">
              <button
                type="button"
                className="btn-primary notes-action-btn"
                onClick={() => setShowDocumentsModal(true)}
              >
                📋 Documentos
              </button>
              <button
                type="button"
                className="btn-primary notes-action-btn"
                onClick={() => setShowImagesModal(true)}
              >
                🖼️ Imagens
              </button>
              <button
                type="button"
                className="btn-primary notes-action-btn"
                onClick={() => setShowLoreModal(true)}
              >
                📜 Lore
              </button>
            </div>
            <textarea
              className="notes-textarea"
              value={sheet.notes || ""}
              onChange={(e) => onUpdateSheet({ ...sheet, notes: e.target.value })}
              onBlur={onSave}
              placeholder="Anotações sobre o personagem..."
              rows="12"
            />
          </div>

          {/* Modal Documentos — lista (ícone + título) → ao abrir: editor de texto */}
          {showDocumentsModal && (
            <div className="modal-overlay" onClick={() => { setShowDocumentsModal(false); setEditingDocumentId(null); setDocumentListSearch(""); onSave(); }}>
              <div className={`modal-content notes-modal notes-modal-docs ${editingDocumentId ? "notes-modal-docs-editing" : ""}`} onClick={e => e.stopPropagation()}>
                {editingDocumentId === null ? (
                  <>
                    <div className="notes-modal-header">
                      <h3>Documentos</h3>
                      <button type="button" className="modal-close" onClick={() => { setShowDocumentsModal(false); setDocumentListSearch(""); onSave(); }} aria-label="Fechar">×</button>
                    </div>
                    <p className="notes-modal-hint">Clique em um documento para abrir o editor e escrever ou editar o texto.</p>
                    <input
                      type="search"
                      className="input-new document-list-search"
                      placeholder="Buscar documentos por título ou texto…"
                      value={documentListSearch}
                      onChange={(e) => setDocumentListSearch(e.target.value)}
                      aria-label="Buscar documentos"
                    />
                    <div className="documents-grid">
                      {(sheet.documents || [])
                        .filter((doc) => {
                          const q = documentListSearch.trim().toLowerCase();
                          if (!q) return true;
                          const blob = `${doc.title || ""} ${doc.content || ""} ${getDocumentContent(doc)}`.toLowerCase();
                          return blob.includes(q);
                        })
                        .map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          className="document-tile"
                          onClick={() => setEditingDocumentId(doc.id)}
                        >
                          <span className="document-tile-icon">📄</span>
                          <span className="document-tile-title">{doc.title || "Sem título"}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn-outline fullwidth notes-add-doc"
                      onClick={() => {
                        const newDoc = { id: genId(), title: "Novo documento", content: "" };
                        onUpdateSheet({ ...sheet, documents: [...(sheet.documents || []), newDoc] });
                        setEditingDocumentId(newDoc.id);
                      }}
                    >
                      + Novo documento
                    </button>
                  </>
                ) : (() => {
                  const doc = (sheet.documents || []).find((d) => d.id === editingDocumentId);
                  if (!doc) return setEditingDocumentId(null);
                  const displayContent = doc.content != null && doc.content !== "" ? doc.content : getDocumentContent(doc);
                  return (
                    <>
                      <div className="notes-modal-header document-editor-header">
                        <button type="button" className="document-back" onClick={() => { setEditingDocumentId(null); onSave(); }}>
                          ← Voltar
                        </button>
                        <input
                          type="text"
                          className="document-editor-title"
                          value={doc.title || ""}
                          onChange={(e) => {
                            const docs = (sheet.documents || []).map((d) => (d.id === doc.id ? { ...d, title: e.target.value } : d));
                            onUpdateSheet({ ...sheet, documents: docs });
                          }}
                          onBlur={onSave}
                          placeholder="Título do documento"
                        />
                        <button
                          type="button"
                          className="btn-danger small document-remove"
                          onClick={() => {
                            onUpdateSheet({ ...sheet, documents: (sheet.documents || []).filter((d) => d.id !== doc.id) });
                            setEditingDocumentId(null);
                            onSave();
                          }}
                        >
                          Remover
                        </button>
                      </div>
                      <textarea
                        className="document-editor-textarea"
                        value={displayContent}
                        onChange={(e) => {
                          const docs = (sheet.documents || []).map((d) =>
                            d.id === doc.id ? { ...d, content: e.target.value } : d
                          );
                          onUpdateSheet({ ...sheet, documents: docs });
                        }}
                        onBlur={onSave}
                        placeholder="Escreva ou edite o texto do documento..."
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Modal Galeria — colar / arquivo, como documentos */}
          {showImagesModal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowImagesModal(false);
                setEditingGalleryImageId(null);
                setImageGallerySearch("");
                onSave();
              }}
            >
              <div
                className={`modal-content notes-modal notes-modal-docs notes-modal-gallery ${editingGalleryImageId ? "notes-modal-gallery-editing" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={galleryFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="gallery-file-input-hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    for (const f of files) {
                      if (f.type.startsWith("image/")) {
                        await appendGalleryImageFromBlob(f);
                      }
                    }
                    e.target.value = "";
                  }}
                />
                {editingGalleryImageId === null ? (
                  <>
                    <div className="notes-modal-header">
                      <h3>Galeria de imagens</h3>
                      <button
                        type="button"
                        className="modal-close"
                        onClick={() => {
                          setShowImagesModal(false);
                          setEditingGalleryImageId(null);
                          setImageGallerySearch("");
                          onSave();
                        }}
                        aria-label="Fechar"
                      >
                        ×
                      </button>
                    </div>
                    <p className="notes-modal-hint">
                      Cole uma captura ou arte com <kbd>Ctrl</kbd>+<kbd>V</kbd> nesta janela, ou envie arquivos do computador. As imagens são guardadas na ficha (comprimidas).
                    </p>
                    <div className="gallery-toolbar">
                      <button
                        type="button"
                        className="btn-primary small"
                        onClick={() => galleryFileInputRef.current?.click()}
                      >
                        + Arquivo…
                      </button>
                      <span className="muted small">
                        {(sheet.galleryImages || []).length}/{MAX_GALLERY_IMAGES} imagens
                      </span>
                    </div>
                    <input
                      type="search"
                      className="input-new document-list-search"
                      placeholder="Buscar por título…"
                      value={imageGallerySearch}
                      onChange={(e) => setImageGallerySearch(e.target.value)}
                      aria-label="Buscar imagens"
                    />
                    <div className="gallery-grid">
                      {(sheet.galleryImages || [])
                        .filter((g) => {
                          const q = imageGallerySearch.trim().toLowerCase();
                          if (!q) return true;
                          return (g.title || "").toLowerCase().includes(q);
                        })
                        .map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className="gallery-tile"
                            onClick={() => setEditingGalleryImageId(g.id)}
                          >
                            <img className="gallery-thumb" src={g.dataUrl} alt="" />
                            <span className="gallery-tile-title">{g.title || "Sem título"}</span>
                          </button>
                        ))}
                    </div>
                    {(sheet.galleryImages || []).length === 0 && (
                      <p className="muted small gallery-empty-msg">Nenhuma imagem na galeria ainda.</p>
                    )}
                    {(sheet.galleryImages || []).length > 0 &&
                      !(sheet.galleryImages || []).some((g) => {
                        const q = imageGallerySearch.trim().toLowerCase();
                        if (!q) return true;
                        return (g.title || "").toLowerCase().includes(q);
                      }) && (
                        <p className="muted small gallery-empty-msg">Nenhuma imagem encontrada para essa busca.</p>
                      )}
                    {(sheet.galleryImages || []).length >= MAX_GALLERY_IMAGES && (
                      <p className="muted small gallery-limit-msg">
                        Limite da galeria atingido. Remova uma imagem para adicionar outra.
                      </p>
                    )}
                  </>
                ) : (
                  (() => {
                    const g = (sheet.galleryImages || []).find((x) => x.id === editingGalleryImageId);
                    if (!g) return null;
                    return (
                      <>
                        <div className="notes-modal-header document-editor-header">
                          <button
                            type="button"
                            className="document-back"
                            onClick={() => {
                              setEditingGalleryImageId(null);
                              onSave();
                            }}
                          >
                            ← Voltar
                          </button>
                          <input
                            type="text"
                            className="document-editor-title"
                            value={g.title || ""}
                            onChange={(e) => {
                              const next = (sheet.galleryImages || []).map((img) =>
                                img.id === g.id ? { ...img, title: e.target.value } : img
                              );
                              onUpdateSheet({ ...sheet, galleryImages: next });
                            }}
                            onBlur={onSave}
                            placeholder="Título"
                          />
                          <button
                            type="button"
                            className="btn-danger small document-remove"
                            onClick={() => {
                              onUpdateSheet({
                                ...sheet,
                                galleryImages: (sheet.galleryImages || []).filter((img) => img.id !== g.id),
                              });
                              setEditingGalleryImageId(null);
                              onSave();
                            }}
                          >
                            Remover
                          </button>
                        </div>
                        <div className="gallery-detail-wrap">
                          <img className="gallery-detail-img" src={g.dataUrl} alt={g.title || "Imagem da galeria"} />
                        </div>
                        <p className="muted small gallery-detail-hint">
                          Dica: voltando à lista você pode colar outra imagem com Ctrl+V.
                        </p>
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* Modal Lore — grande */}
          {showLoreModal && (
            <div className="modal-overlay notes-modal-overlay-lore" onClick={() => { setShowLoreModal(false); onSave(); }}>
              <div className="modal-content notes-modal notes-modal-lore" onClick={e => e.stopPropagation()}>
                <div className="notes-modal-header">
                  <h3>Lore</h3>
                  <button type="button" className="modal-close" onClick={() => { setShowLoreModal(false); onSave(); }} aria-label="Fechar">×</button>
                </div>
                <p className="notes-modal-hint">História, mundo e informações de lore do seu personagem ou da mesa.</p>
                <textarea
                  className="notes-lore-textarea"
                  value={sheet.lore || ""}
                  onChange={(e) => onUpdateSheet({ ...sheet, lore: e.target.value })}
                  onBlur={onSave}
                  placeholder="Escreva aqui a lore..."
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
