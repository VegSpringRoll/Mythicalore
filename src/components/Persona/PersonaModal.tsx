import React, { useState, useEffect } from 'react';
import { PersonaRecord, PersonaMove } from '../../types/persona';
import { db } from '../../db';
import { blobToDataUrl } from '../../services/pngParser';
import { User, Plus, Check, Edit3, Trash2, X, Image as ImageIcon, Shield, Zap, Key } from 'lucide-react';

interface PersonaModalProps {
  isOpen: boolean;
  activePersonaId?: string;
  onSelectPersona: (persona: PersonaRecord) => void;
  onClose: () => void;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  activePersonaId,
  onSelectPersona,
  onClose,
}) => {
  const [personas, setPersonas] = useState<PersonaRecord[]>([]);
  const [editingPersona, setEditingPersona] = useState<PersonaRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | undefined>();
  const [physiqueAndApparel, setPhysiqueAndApparel] = useState('');
  const [psychologicalTraits, setPsychologicalTraits] = useState('');
  const [backgroundLore, setBackgroundLore] = useState('');
  const [lorebookMoveset, setLorebookMoveset] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Movesets / Abilities (Lorebook Style)
  const [moves, setMoves] = useState<PersonaMove[]>([]);
  const [isEditingMove, setIsEditingMove] = useState(false);
  const [editingMoveId, setEditingMoveId] = useState<string | null>(null);
  const [moveName, setMoveName] = useState('');
  const [moveTriggersStr, setMoveTriggersStr] = useState('');
  const [moveDescription, setMoveDescription] = useState('');

  const loadPersonas = async () => {
    const list = await db.personas.toArray();
    for (const p of list) {
      if (p.avatarBlob && (!p.avatarUrl || p.avatarUrl.startsWith('blob:'))) {
        p.avatarUrl = await blobToDataUrl(p.avatarBlob);
        await db.personas.update(p.id, { avatarUrl: p.avatarUrl });
      }
    }
    list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    setPersonas(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadPersonas();
    }
  }, [isOpen]);

  const openEditor = (persona?: PersonaRecord) => {
    if (persona) {
      setEditingPersona(persona);
      setName(persona.name);
      setGender(persona.gender || '');
      setAvatarUrl(persona.avatarUrl || '');
      setAvatarBlob(persona.avatarBlob);
      setPhysiqueAndApparel(persona.physiqueAndApparel || '');
      setPsychologicalTraits(persona.psychologicalTraits || '');
      setBackgroundLore(persona.backgroundLore || '');
      setLorebookMoveset(persona.lorebookMoveset || '');
      setMoves(persona.moves ? [...persona.moves] : []);
      setIsDefault(Boolean(persona.isDefault));
    } else {
      setEditingPersona(null);
      setName('');
      setGender('Male / Female / Any');
      setAvatarUrl('');
      setAvatarBlob(undefined);
      setPhysiqueAndApparel('');
      setPsychologicalTraits('');
      setBackgroundLore('');
      setLorebookMoveset('');
      setMoves([]);
      setIsDefault(personas.length === 0);
    }
    setIsEditingMove(false);
    setEditingMoveId(null);
    setIsCreating(true);
  };

  const handleOpenAddMove = () => {
    setEditingMoveId(null);
    setMoveName('');
    setMoveTriggersStr('');
    setMoveDescription('');
    setIsEditingMove(true);
  };

  const handleOpenEditMove = (move: PersonaMove) => {
    setEditingMoveId(move.id);
    setMoveName(move.name);
    setMoveTriggersStr((move.triggers || []).join(', '));
    setMoveDescription(move.description);
    setIsEditingMove(true);
  };

  const handleSaveMove = () => {
    if (!moveName.trim() || !moveDescription.trim()) {
      alert('Please enter an ability name and description.');
      return;
    }
    const triggers = moveTriggersStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newMove: PersonaMove = {
      id: editingMoveId || `move-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: moveName.trim(),
      triggers,
      description: moveDescription.trim(),
      enabled: true,
    };

    let updated: PersonaMove[];
    if (editingMoveId) {
      updated = moves.map((m) => (m.id === editingMoveId ? newMove : m));
    } else {
      updated = [...moves, newMove];
    }
    setMoves(updated);
    setIsEditingMove(false);
    setEditingMoveId(null);
    setMoveName('');
    setMoveTriggersStr('');
    setMoveDescription('');
  };

  const handleDeleteMove = (moveId: string) => {
    setMoves(moves.filter((m) => m.id !== moveId));
  };

  const handleToggleMove = (moveId: string) => {
    setMoves(moves.map((m) => (m.id === moveId ? { ...m, enabled: m.enabled === false ? true : false } : m)));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarBlob(file);
      const url = await blobToDataUrl(file);
      setAvatarUrl(url);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a persona name.');
      return;
    }

    // If marked default, unset others
    if (isDefault) {
      const all = await db.personas.toArray();
      for (const p of all) {
        if (p.isDefault) {
          await db.personas.update(p.id, { isDefault: false });
        }
      }
    }

    const record: PersonaRecord = {
      id: editingPersona?.id || `persona-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      gender,
      avatarUrl,
      avatarBlob,
      physiqueAndApparel,
      psychologicalTraits,
      backgroundLore,
      moves,
      lorebookMoveset,
      isDefault,
      createdAt: editingPersona?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await db.personas.put(record);
    await loadPersonas();
    setIsCreating(false);
    setEditingPersona(null);

    // If active persona was edited, update parent
    if (record.id === activePersonaId) {
      onSelectPersona(record);
    }
  };

  const handleDelete = async (id: string) => {
    if (personas.length <= 1) {
      alert('You must have at least one protagonist persona.');
      return;
    }
    if (confirm('Delete this protagonist persona?')) {
      await db.personas.delete(id);
      await loadPersonas();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-black/40 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10 shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                Protagonist Persona Hub
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Manage and switch your character personas across roleplay scenarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isCreating && (
              <button
                onClick={() => openEditor()}
                className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-black" />
                <span>New Persona</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            /* Persona Editor Form */
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-zinc-300" />
                  {editingPersona ? `Edit Persona: ${name}` : 'Create New Protagonist Persona'}
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Avatar Preview */}
                <div className="flex flex-col items-center gap-3">
                  <div className="h-40 w-40 rounded-2xl overflow-hidden border border-white/15 bg-black/50 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Persona Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-zinc-500 flex flex-col items-center gap-2">
                        <User className="w-10 h-10 text-zinc-600" />
                        <span className="text-xs">No Avatar</span>
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Upload Avatar</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  <input
                    type="text"
                    value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Or paste Image URL..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[11px] text-white focus:outline-none focus:border-white text-center"
                  />
                </div>

                {/* Main Fields */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Protagonist Name (`{'{{user}}'}`) *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Vaelen Cross, Lyra Moonwhisper..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Gender / Identity</label>
                      <input
                        type="text"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        placeholder="e.g. Male, Female, Non-binary"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={(e) => setIsDefault(e.target.checked)}
                          className="w-4 h-4 rounded text-white focus:ring-white bg-black/50 border-white/20"
                        />
                        <span>Set as Default Persona</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Physique & Apparel (Visible Appearance)
                    </label>
                    <textarea
                      rows={2}
                      value={physiqueAndApparel}
                      onChange={(e) => setPhysiqueAndApparel(e.target.value)}
                      placeholder="Tall, athletic build, matte black stealth trenchcoat with internal dampeners, silver ocular implant..."
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              </div>

              {/* Psychological Traits */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Psychological Traits & Disposition
                </label>
                <textarea
                  rows={2}
                  value={psychologicalTraits}
                  onChange={(e) => setPsychologicalTraits(e.target.value)}
                  placeholder="Calculating, guarded, dry wit, highly observant, fiercely loyal once trust is earned..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                />
              </div>

              {/* Background Lore */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Background Lore & History
                </label>
                <textarea
                  rows={3}
                  value={backgroundLore}
                  onChange={(e) => setBackgroundLore(e.target.value)}
                  placeholder="Former black-ops counter-intelligence runner turned freelance operator in the neon underbelly..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                />
              </div>

              {/* Movesets / Abilities (Lorebook Style) */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Protagonist Movesets &amp; Abilities (Lorebook Style)
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        Techniques and powers that automatically trigger when keywords appear in chat
                      </p>
                    </div>
                  </div>

                  {!isEditingMove && (
                    <button
                      type="button"
                      onClick={handleOpenAddMove}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Move</span>
                    </button>
                  )}
                </div>

                {/* Inline Move Editor */}
                {isEditingMove && (
                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/20 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-xs font-bold text-white">
                        {editingMoveId ? 'Edit Move / Ability' : 'New Move / Ability'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingMove(false)}
                        className="text-zinc-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                          Ability / Move Name *
                        </label>
                        <input
                          type="text"
                          value={moveName}
                          onChange={(e) => setMoveName(e.target.value)}
                          placeholder="e.g. Shadow Step, Dragon Breath"
                          className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs focus:outline-none focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-300 mb-1 flex items-center gap-1">
                          <Key className="w-3 h-3 text-zinc-400" />
                          <span>Trigger Words (Comma-Separated)</span>
                        </label>
                        <input
                          type="text"
                          value={moveTriggersStr}
                          onChange={(e) => setMoveTriggersStr(e.target.value)}
                          placeholder="e.g. shadow step, teleport, blink"
                          className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Description &amp; Mechanics *
                      </label>
                      <textarea
                        rows={2}
                        value={moveDescription}
                        onChange={(e) => setMoveDescription(e.target.value)}
                        placeholder="Detailed execution, sensory effects, and combat rules when protagonist performs this move..."
                        className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingMove(false)}
                        className="px-3 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveMove}
                        className="px-4 py-1 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                      >
                        {editingMoveId ? 'Update Move' : 'Add Move'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Moves List */}
                <div className="space-y-2 pt-1">
                  {moves.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500">
                      No custom moves added yet. Click &quot;Add Move&quot; above to create abilities with Lorebook-style triggers.
                    </div>
                  ) : (
                    moves.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border transition-all ${
                          m.enabled !== false
                            ? 'bg-white/[0.04] border-white/15'
                            : 'bg-white/[0.01] border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{m.name}</span>
                              {m.triggers && m.triggers.length > 0 ? (
                                m.triggers.map((tr, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300 border border-white/10"
                                  >
                                    🔑 {tr}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400">
                                  Always Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                              {m.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleMove(m.id)}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                                m.enabled !== false
                                  ? 'bg-white/10 border-white/20 text-white'
                                  : 'bg-black/40 border-white/10 text-zinc-500'
                              }`}
                            >
                              {m.enabled !== false ? 'Active' : 'Muted'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditMove(m)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                              title="Edit Move"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMove(m.id)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
                              title="Delete Move"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* General Gear & Techniques Lore */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  General Equipment &amp; Gear Lore (Optional Notes)
                </label>
                <textarea
                  rows={2}
                  value={lorebookMoveset}
                  onChange={(e) => setLorebookMoveset(e.target.value)}
                  placeholder="Neuro-jamming spike, optical camouflage cloak, monomolecular trench knife..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
                >
                  Save Persona
                </button>
              </div>
            </div>
          ) : (
            /* Personas Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personas.map((p) => {
                const isActive = p.id === activePersonaId;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectPersona(p);
                      onClose();
                    }}
                    className={`relative p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all duration-300 ${
                      isActive
                        ? 'border-white/40 bg-white/10 shadow-glow-white/10'
                        : 'border-white/10 hover:border-white/25 bg-[#0e0e12]/80'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-16 w-16 rounded-2xl overflow-hidden border border-white/15 bg-black/50 shrink-0 flex items-center justify-center">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-white">
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                          {p.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10">
                              Default
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-black font-semibold flex items-center gap-1 shadow-sm">
                              <Check className="w-2.5 h-2.5 text-black" />
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-zinc-400">
                            {p.gender || 'Protagonist'}
                          </span>
                          {p.moves && p.moves.length > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/15 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 text-white" />
                              <span>{p.moves.length} {p.moves.length === 1 ? 'Ability' : 'Abilities'}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-2 mt-1 leading-relaxed">
                          {p.backgroundLore || p.psychologicalTraits || 'No background lore set.'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPersona(p);
                          onClose();
                        }}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                          isActive
                            ? 'bg-white text-black font-semibold'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {isActive ? 'Current Protagonist' : '1-Click Switch'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditor(p);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Edit Persona"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
                          title="Delete Persona"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
