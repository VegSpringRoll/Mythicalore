import React from 'react';
import { SamplerSettings } from '../../types/settings';
import { Sliders, RotateCcw, Zap, BookOpen, Flame } from 'lucide-react';

interface SamplerDrawerProps {
  samplers: SamplerSettings;
  onChange: (updated: SamplerSettings) => void;
}

const PRESETS: Record<string, Partial<SamplerSettings>> = {
  'Balanced (Default)': {
    temperature: 0.85,
    top_p: 0.95,
    min_p: 0.05,
    top_k: 40,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    repetition_penalty: 1.1,
    max_tokens: 1200,
    min_tokens: 0,
  },
  'Literary & Expansive': {
    temperature: 0.9,
    top_p: 0.98,
    min_p: 0.03,
    top_k: 60,
    frequency_penalty: 0.2,
    presence_penalty: 0.15,
    repetition_penalty: 1.12,
    max_tokens: 2000,
    min_tokens: 250, // enforces long multi-paragraph depth
  },
  'Creative & Unpredictable': {
    temperature: 1.15,
    top_p: 0.92,
    min_p: 0.08,
    top_k: 80,
    frequency_penalty: 0.25,
    presence_penalty: 0.25,
    repetition_penalty: 1.15,
    max_tokens: 1500,
    min_tokens: 0,
  },
  'Strict & Grounded': {
    temperature: 0.65,
    top_p: 0.85,
    min_p: 0.1,
    top_k: 20,
    frequency_penalty: 0.05,
    presence_penalty: 0.05,
    repetition_penalty: 1.08,
    max_tokens: 1000,
    min_tokens: 0,
  },
};

export const SamplerDrawer: React.FC<SamplerDrawerProps> = ({ samplers, onChange }) => {
  const update = (key: keyof SamplerSettings, value: number) => {
    onChange({
      ...samplers,
      [key]: value,
    });
  };

  const applyPreset = (presetName: string) => {
    const p = PRESETS[presetName];
    if (p) {
      onChange({ ...samplers, ...p });
    }
  };

  return (
    <div className="space-y-6">
      {/* Presets Row */}
      <div>
        <label className="block text-xs font-semibold text-zinc-300 mb-2.5 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-white" />
          <span>Sampler Presets</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.keys(PRESETS).map((pName) => (
            <button
              key={pName}
              type="button"
              onClick={() => applyPreset(pName)}
              className="px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-white/30 text-zinc-200 text-xs font-medium transition-all text-left truncate"
            >
              {pName}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Temperature */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-white" />
              Temperature
            </span>
            <span className="font-mono text-white font-bold">{samplers.temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.05"
            value={samplers.temperature}
            onChange={(e) => update('temperature', parseFloat(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Controls randomness (0 = deterministic, 2 = wild).</p>
        </div>

        {/* Top P */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Top P (Nucleus Sampling)</span>
            <span className="font-mono text-white font-bold">{samplers.top_p.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={samplers.top_p}
            onChange={(e) => update('top_p', parseFloat(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Restricts sampling to tokens within cumulative probability.</p>
        </div>

        {/* Min P */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-white" />
              Min P (Modern Truncation)
            </span>
            <span className="font-mono text-white font-bold">{samplers.min_p.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.5"
            step="0.01"
            value={samplers.min_p}
            onChange={(e) => update('min_p', parseFloat(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Filters tokens below percentage of top token probability.</p>
        </div>

        {/* Top K */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Top K</span>
            <span className="font-mono text-white font-bold">{samplers.top_k}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={samplers.top_k}
            onChange={(e) => update('top_k', parseInt(e.target.value, 10))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Limits sample pool to the K most probable tokens (0 = off).</p>
        </div>

        {/* Repetition Penalty */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Repetition Penalty</span>
            <span className="font-mono text-white font-bold">{samplers.repetition_penalty.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="2.0"
            step="0.02"
            value={samplers.repetition_penalty}
            onChange={(e) => update('repetition_penalty', parseFloat(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Prevents repetitive phrases and looping (1.0 = neutral).</p>
        </div>

        {/* Frequency & Presence Penalties */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Frequency / Presence Penalty</span>
            <span className="font-mono text-white font-bold">{samplers.frequency_penalty.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1.0"
            max="1.5"
            step="0.05"
            value={samplers.frequency_penalty}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange({ ...samplers, frequency_penalty: val, presence_penalty: val });
            }}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Encourages introducing new vocabulary and concepts.</p>
        </div>

        {/* Max Tokens */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white">Max Generation Tokens</span>
            <span className="font-mono text-white font-bold">{samplers.max_tokens}</span>
          </div>
          <input
            type="range"
            min="256"
            max="4096"
            step="128"
            value={samplers.max_tokens}
            onChange={(e) => update('max_tokens', parseInt(e.target.value, 10))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Ceiling for response length per turn.</p>
        </div>

        {/* Min Tokens */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-white" />
              Min Tokens (Expansive Directive)
            </span>
            <span className="font-mono text-white font-bold">{samplers.min_tokens}</span>
          </div>
          <input
            type="range"
            min="0"
            max="800"
            step="50"
            value={samplers.min_tokens}
            onChange={(e) => update('min_tokens', parseInt(e.target.value, 10))}
            className="w-full accent-white cursor-pointer"
          />
          <p className="text-[10px] text-zinc-400">Enforces descriptive multi-paragraph length via system directives.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => applyPreset('Balanced (Default)')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset to Defaults</span>
        </button>
      </div>
    </div>
  );
};
