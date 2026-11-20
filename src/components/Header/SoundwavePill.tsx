import React, { useState, useEffect, useRef } from 'react';
import { soundscape, AtmosphereMood } from '../../services/soundscapeService';
import { Volume2, VolumeX, Sparkles, Music } from 'lucide-react';

interface SoundwavePillProps {
  currentAtmosphere?: string;
  autoSync?: boolean;
}

const AVAILABLE_MOODS: AtmosphereMood[] = [
  'Rain',
  'Thunderstorm',
  'Tense Combat',
  'Tavern',
  'Embers',
  'Mysterious',
  'Romantic Night',
  'Clear Night',
  'Peaceful',
];

export const SoundwavePill: React.FC<SoundwavePillProps> = ({
  currentAtmosphere,
  autoSync = true,
}) => {
  const [state, setState] = useState(soundscape.getState());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = soundscape.subscribe(() => {
      setState(soundscape.getState());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (autoSync && currentAtmosphere) {
      soundscape.syncWithAtmosphere(currentAtmosphere);
    }
  }, [currentAtmosphere, autoSync]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundscape.togglePlay();
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Soundwave Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all ${
          state.isPlaying
            ? 'bg-white/[0.1] border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:border-white/60'
            : 'bg-black/50 border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300'
        }`}
        title={
          state.isPlaying
            ? `BGM Active: ${state.currentTrack?.title || state.currentMood}. Click for volume & controls.`
            : 'Soundscape BGM (Muted/Paused). Click to play and adjust.'
        }
      >
        {/* Animated Soundwave Equalizer Bars */}
        <div 
          onClick={handleToggle}
          className="flex items-end gap-[2.5px] h-3 w-3.5 cursor-pointer py-0.5"
          title={state.isPlaying ? 'Pause BGM' : 'Play BGM'}
        >
          <span
            className={`w-[2.5px] rounded-full transition-all duration-300 ${
              state.isPlaying
                ? 'bg-white animate-[bounce_0.8s_ease-in-out_infinite_alternate] h-3 shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                : 'bg-zinc-600 h-1.5'
            }`}
          />
          <span
            className={`w-[2.5px] rounded-full transition-all duration-300 ${
              state.isPlaying
                ? 'bg-white animate-[bounce_1.1s_ease-in-out_0.2s_infinite_alternate] h-2.5 shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                : 'bg-zinc-600 h-2'
            }`}
          />
          <span
            className={`w-[2.5px] rounded-full transition-all duration-300 ${
              state.isPlaying
                ? 'bg-white animate-[bounce_0.9s_ease-in-out_0.4s_infinite_alternate] h-3.5 shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                : 'bg-zinc-600 h-1'
            }`}
          />
        </div>

        <span className="hidden md:inline font-semibold text-[11px] truncate max-w-[85px]">
          {state.isPlaying ? state.currentMood : 'BGM'}
        </span>
      </button>

      {/* Sleek Floating Soundscape Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0c0c0f]/95 backdrop-blur-2xl border border-white/20 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)] z-50 animate-fadeIn space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-white" />
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">Adaptive Soundscape</h4>
                <p className="text-[10px] text-zinc-400">Royalty-free via freetouse.com</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggle}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                state.isPlaying
                  ? 'bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.3)] hover:bg-zinc-200'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          {/* Current Track Banner */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-white font-semibold truncate text-[11px]">
                {state.currentTrack?.title || `${state.currentMood} Ambience`}
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                {state.currentTrack?.artist || 'Free To Use Music'}
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 shrink-0">
              {state.currentMood}
            </span>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-300">
              <span className="flex items-center gap-1.5">
                {state.volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                <span>Volume</span>
              </span>
              <span className="font-mono text-white">{Math.round(state.volume * 100)}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={state.volume}
              onChange={(e) => soundscape.setVolume(parseFloat(e.target.value))}
              className="w-full accent-white bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Atmosphere Mood Selector Pills */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-zinc-400" />
              <span>Atmosphere Soundscapes</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => soundscape.setMood(m)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${
                    state.currentMood === m
                      ? 'bg-white text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
