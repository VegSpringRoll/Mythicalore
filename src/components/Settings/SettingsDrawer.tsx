import React, { useState, useEffect } from 'react';
import { AppSettingsRecord } from '../../types/settings';
import { saveAppSettings } from '../../db';
import { SamplerDrawer } from './SamplerDrawer';
import { RoleplayProfiles } from './RoleplayProfiles';
import { SummarizerProfiles } from './SummarizerProfiles';
import { 
  X, 
  Save, 
  Sliders, 
  Brain, 
  Cpu, 
  Sparkles,
  Zap
} from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  settings: AppSettingsRecord;
  onUpdateSettings: (settings: AppSettingsRecord) => void;
  onClose: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [current, setCurrent] = useState<AppSettingsRecord>(settings);
  const [activeTab, setActiveTab] = useState<'roleplay' | 'universal' | 'summarizer' | 'samplers'>('roleplay');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever settings or drawer open state changes
  useEffect(() => {
    if (isOpen) {
      setCurrent(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const updated = await saveAppSettings(current);
      onUpdateSettings(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = (updated: AppSettingsRecord) => {
    setCurrent(updated);
    onUpdateSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-4xl h-[92vh] flex flex-col rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Engine Settings & BYOK
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
                  Dual-Model Architecture
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Unified BYOK Profiles, Auto-Fetch Models, Universal Prompt & Context
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 gap-2 sm:gap-4 text-xs font-medium overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('roleplay')}
            className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'roleplay'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Roleplay BYOK Models</span>
          </button>

          <button
            onClick={() => setActiveTab('universal')}
            className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'universal'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span>Universal Prompt & Cache</span>
          </button>

          <button
            onClick={() => setActiveTab('summarizer')}
            className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'summarizer'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-zinc-300" />
            <span>Background Summarizer BYOK</span>
          </button>

          <button
            onClick={() => setActiveTab('samplers')}
            className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'samplers'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Samplers & min_p</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ROLEPLAY BYOK (PROFILES & SLIDING WINDOW) */}
          {activeTab === 'roleplay' && (
            <RoleplayProfiles
              settings={current}
              onUpdateSettings={handleUpdate}
            />
          )}

          {/* TAB 2: UNIVERSAL SYSTEM PROMPT & PROMPT CACHE */}
          {activeTab === 'universal' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-white shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-white">Universal System Prompt & Prompt Caching:</strong> This prompt is injected on every single roleplay turn ahead of character descriptions. With <strong>Prompt Cache</strong> enabled, compatible providers (such as Anthropic Claude with ephemeral cache breakpoints and OpenRouter) cache this invariant prefix, cutting generation latency by up to 85% and substantially saving tokens!
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-white">Universal System Prompt (Injected on Every Turn)</label>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ~{Math.round(current.universalSystemPrompt.length / 3.8)} tokens
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={current.universalSystemPrompt}
                  onChange={async (e) => {
                    const updated = { ...current, universalSystemPrompt: e.target.value };
                    setCurrent(updated);
                    await saveAppSettings(updated);
                    onUpdateSettings(updated);
                  }}
                  placeholder="Universal roleplay engine directives, formatting instructions, narrative tone..."
                  className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white font-sans"
                />
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-white" />
                    <span>Enable Prompt Cache (Ephemeral Cache Breakpoints)</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Sends `cache_control: &#123; type: "ephemeral" &#125;` to Anthropic and OpenRouter cache headers for ultra-fast turns.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.enablePromptCache}
                    onChange={async (e) => {
                      const updated = { ...current, enablePromptCache: e.target.checked };
                      setCurrent(updated);
                      await saveAppSettings(updated);
                      onUpdateSettings(updated);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-checked:after:bg-black"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: DEDICATED BACKGROUND SUMMARIZER BYOK (PROFILES & CHAPTER INTERVAL) */}
          {activeTab === 'summarizer' && (
            <SummarizerProfiles
              settings={current}
              onUpdateSettings={handleUpdate}
            />
          )}

          {/* TAB 4: SAMPLERS */}
          {activeTab === 'samplers' && (
            <SamplerDrawer
              samplers={current.samplers}
              onChange={async (updatedSamplers) => {
                const updated = { ...current, samplers: updatedSamplers };
                setCurrent(updated);
                await saveAppSettings(updated);
                onUpdateSettings(updated);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
          <div className="text-xs text-zinc-400">
            Active Roleplay Model: <span className="text-white font-mono">{current.primaryModel.provider}: {current.primaryModel.model}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-black" />
              <span>{isSaving ? 'Saving...' : 'Done'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
