import React, { useState } from 'react';
import { CharacterRecord, CharacterCardV2Data } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { substituteMacros } from '../../services/macroEngine';
import { blobToDataUrl } from '../../services/pngParser';
import { exportCharacterPng } from '../../services/pngParser';
import { X, Save, Image, Eye, EyeOff, Download, Sparkles } from 'lucide-react';

interface CardEditorModalProps {
  card?: CharacterRecord | null;
  activePersona?: PersonaRecord;
  onSave: (card: CharacterRecord) => Promise<void>;
  onClose: () => void;
}

const GENRES = [
  'Universal',
  'Cyberpunk',
  'Grimdark Fantasy',
  'Sci-Fi',
  'High Fantasy',
  'Modern Noir',
  'Horror',
  'Post-Apocalyptic',
  'Romance',
  'Mystery',
];

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  card,
  activePersona,
  onSave,
  onClose,
}) => {
  const isEditing = Boolean(card);

  const [name, setName] = useState(card?.name || '');
  const [genre, setGenre] = useState(card?.genre || 'Universal');
  const [tagsStr, setTagsStr] = useState(card?.tags?.join(', ') || '');
  const [avatarUrl, setAvatarUrl] = useState(card?.avatarUrl || '');
  const [avatarBlob, setAvatarBlob] = useState<Blob | undefined>(card?.avatarBlob);

  const [description, setDescription] = useState(card?.data.description || '');
  const [personality, setPersonality] = useState(card?.data.personality || '');
  const [scenario, setScenario] = useState(card?.data.scenario || '');
  const [firstMes, setFirstMes] = useState(card?.data.first_mes || '');
  const [mesExample, setMesExample] = useState(card?.data.mes_example || '');
  const [systemPrompt, setSystemPrompt] = useState(card?.data.system_prompt || '');
  const [postHistoryInstructions, setPostHistoryInstructions] = useState(card?.data.post_history_instructions || '');
  const [creatorNotes, setCreatorNotes] = useState(card?.data.creator_notes || '');
  const [creator, setCreator] = useState(card?.data.creator || '');

  const [previewMacros, setPreviewMacros] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'scenario' | 'advanced'>('core');

  // Macro Preview Context
  const macroContext = {
    charName: name || 'Character',
    userName: activePersona?.name || 'User',
    scenario: scenario,
    personaLore: activePersona?.backgroundLore || '',
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarBlob(file);
      const url = await blobToDataUrl(file);
      setAvatarUrl(url);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a character name.');
      return;
    }

    setIsSaving(true);
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const cardData: CharacterCardV2Data = {
        name: name.trim(),
        description,
        personality,
        scenario,
        first_mes: firstMes,
        mes_example: mesExample,
        system_prompt: systemPrompt || undefined,
        post_history_instructions: postHistoryInstructions || undefined,
        creator_notes: creatorNotes || undefined,
        creator: creator.trim() || undefined,
        tags,
        character_book: card?.data.character_book,
      };

      const record: CharacterRecord = {
        id: card?.id || `char-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        genre,
        tags,
        avatarUrl,
        avatarBlob,
        data: cardData,
        isFavorite: card?.isFavorite ?? false,
        createdAt: card?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await onSave(record);
      onClose();
    } catch (err) {
      console.error('Failed to save card:', err);
      alert('Error saving character card to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPng = async () => {
    try {
      const tempRecord: CharacterRecord = {
        id: card?.id || 'temp',
        name: name || 'Character',
        genre,
        tags: tagsStr.split(',').map((t) => t.trim()),
        avatarBlob,
        data: {
          name,
          description,
          personality,
          scenario,
          first_mes: firstMes,
          mes_example: mesExample,
          system_prompt: systemPrompt,
          post_history_instructions: postHistoryInstructions,
          creator,
          creator_notes: creatorNotes,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const blob = await exportCharacterPng(tempRecord, avatarBlob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert('Error exporting PNG chunk metadata.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-white border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `Edit: ${name || 'Character Card'}` : 'Create Character Card'}
              </h2>
              <p className="text-xs text-zinc-400">
                SillyTavern V2 & V3 Specification Compatible
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMacros(!previewMacros)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                previewMacros 
                  ? 'bg-white/20 border-white/40 text-white' 
                  : 'bg-white/5 border-white/15 text-zinc-300 hover:text-white'
              }`}
              title="Preview with {{char}} and {{user}} macro substitutions"
            >
              {previewMacros ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{previewMacros ? 'Raw Tokens' : 'Macro Preview'}</span>
            </button>

            {isEditing && (
              <button
                onClick={handleExportPng}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-300 hover:text-white transition-colors"
                title="Download as PNG with embedded tEXt chunk"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PNG</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('core')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'core' 
                ? 'border-white text-white font-semibold' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Identity & Persona
          </button>
          <button
            onClick={() => setActiveTab('scenario')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'scenario' 
                ? 'border-white text-white font-semibold' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Scenario & Opening Message
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'advanced' 
                ? 'border-white text-white font-semibold' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Director & Dialogue Examples
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'core' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Avatar Preview & Upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-44 w-44 rounded-2xl overflow-hidden glass-panel border border-white/15 bg-background-surface flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-gray-500 flex flex-col items-center gap-2">
                        <Image className="w-10 h-10 text-gray-600" />
                        <span className="text-xs">No Avatar</span>
                      </div>
                    )}
                  </div>

                  <label className="cursor-pointer text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors">
                    <Image className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Upload Image (.png/.jpg)</span>
                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/webp" 
                      onChange={handleImageFileChange} 
                      className="hidden" 
                    />
                  </label>
                  <p className="text-[10px] text-gray-500 text-center max-w-[180px]">
                    PNGs will have metadata embedded when exported.
                  </p>
                </div>

                {/* Identity Inputs */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Character Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kora Vance, Lady Vespera..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Genre</label>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white"
                      >
                        {GENRES.map((g) => (
                          <option key={g} value={g} className="bg-background-elevated">
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Creator / Author</label>
                      <input
                        type="text"
                        value={creator}
                        onChange={(e) => setCreator(e.target.value)}
                        placeholder="Your name or handle"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                      placeholder="Cyberpunk, Hacker, Morally Grey..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Description (Physical appearance, background, lore)
                </label>
                <textarea
                  rows={4}
                  value={previewMacros ? substituteMacros(description, macroContext) : description}
                  onChange={(e) => !previewMacros && setDescription(e.target.value)}
                  readOnly={previewMacros}
                  placeholder="24-year-old brilliant black-market hacker operating out of Sector 7..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
              </div>

              {/* Personality */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Personality & Behavioral Nuances
                </label>
                <textarea
                  rows={3}
                  value={previewMacros ? substituteMacros(personality, macroContext) : personality}
                  onChange={(e) => !previewMacros && setPersonality(e.target.value)}
                  readOnly={previewMacros}
                  placeholder="Brash, cynically affectionate, razor-sharp intelligence, guarded about her past..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'scenario' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Scenario (Current setting, immediate stakes, relationship dynamic)
                </label>
                <textarea
                  rows={3}
                  value={previewMacros ? substituteMacros(scenario, macroContext) : scenario}
                  onChange={(e) => !previewMacros && setScenario(e.target.value)}
                  readOnly={previewMacros}
                  placeholder="{{char}} and {{user}} have just bolted into {{char}}'s subterranean safehouse after a corporate hit squad intercepted a high-value memory shard..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
                <p className="text-[10px] text-gray-500 mt-1">Supports {'{{char}}'} and {'{{user}}'} macros.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  First Message / Opening Greeting (first_mes) *
                </label>
                <textarea
                  rows={7}
                  value={previewMacros ? substituteMacros(firstMes, macroContext) : firstMes}
                  onChange={(e) => !previewMacros && setFirstMes(e.target.value)}
                  readOnly={previewMacros}
                  placeholder={'*Rain drums relentlessly against the reinforced corrugated steel of the hideout...*\n\n"Tell me you still have the courier drive, {{user}}."'}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed font-mono focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Dialogue Examples (mes_example)
                </label>
                <textarea
                  rows={5}
                  value={previewMacros ? substituteMacros(mesExample, macroContext) : mesExample}
                  onChange={(e) => !previewMacros && setMesExample(e.target.value)}
                  readOnly={previewMacros}
                  placeholder={'<START>\n{{user}}: "I have the drive."\n{{char}}: *A razor-thin smirk tugs at her lips.* "Good. Don\'t lose it."'}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed font-mono focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Custom System Prompt / Director Instructions
                </label>
                <textarea
                  rows={3}
                  value={previewMacros ? substituteMacros(systemPrompt, macroContext) : systemPrompt}
                  onChange={(e) => !previewMacros && setSystemPrompt(e.target.value)}
                  readOnly={previewMacros}
                  placeholder="Engage in an immersive, literary cyberpunk roleplay. Vivid sensory details, show emotions through micro-expressions..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white ${
                    previewMacros ? 'bg-white/5 border-white/30' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Post History Instructions (Context Anchor)
                </label>
                <textarea
                  rows={2}
                  value={postHistoryInstructions}
                  onChange={(e) => setPostHistoryInstructions(e.target.value)}
                  placeholder="Keep responses detailed and multi-paragraph. Balance narrative worldbuilding with character dialogue."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Creator Notes
                </label>
                <textarea
                  rows={2}
                  value={creatorNotes}
                  onChange={(e) => setCreatorNotes(e.target.value)}
                  placeholder="Notes for other users or personal reference..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
          <div className="text-xs text-zinc-400">
            {previewMacros && (
              <span className="text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Previewing as: {'{{char}}'} → <strong>{name || 'Character'}</strong>, {'{{user}}'} → <strong>{activePersona?.name || 'User'}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-black" />
              <span>{isSaving ? 'Saving...' : 'Save Character'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
