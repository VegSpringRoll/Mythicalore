import React, { useState } from 'react';
import { CharacterRecord } from '../../types/characterCard';
import { ChatSessionRecord, ChatMessageRecord } from '../../types/chat';
import { PersonaRecord } from '../../types/persona';
import { AppSettingsRecord } from '../../types/settings';
import { db } from '../../db';
import { streamChatCompletion } from '../../services/llmClient';
import { 
  X, 
  Sparkles, 
  Compass, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  MapPin,
  ChevronLeft
} from 'lucide-react';

interface EnterIsekaiModalProps {
  isOpen: boolean;
  settings: AppSettingsRecord;
  activePersona: PersonaRecord;
  onEnterWorld: (params: { character: CharacterRecord; session: ChatSessionRecord }) => void;
  onClose: () => void;
}

const POPULAR_WORLDS = [
  'Jujutsu Kaisen',
  'Cyberpunk 2077',
  'Attack on Titan',
  'Naruto Shippuden',
  'Bleach',
  'Harry Potter',
  'One Piece',
  'Demon Slayer',
  'Solo Leveling',
  'Elden Ring',
];

export const EnterIsekaiModal: React.FC<EnterIsekaiModalProps> = ({
  isOpen,
  settings,
  activePersona,
  onEnterWorld,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [worldName, setWorldName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiLoreProof, setAiLoreProof] = useState('');
  
  // Step 2 Setup
  const [timeline, setTimeline] = useState('');
  const [scenarioStart, setScenarioStart] = useState('');
  const [isEntering, setIsEntering] = useState(false);

  if (!isOpen) return null;

  // Resolve active primary roleplay profile
  const activeProfile = settings.roleplayProfiles?.find(
    (p) => p.id === settings.primaryModel.profileId
  ) || (settings.roleplayProfiles?.length > 0 ? settings.roleplayProfiles[0] : null);

  const roleplayKey = activeProfile?.apiKey?.trim() || 
    (activeProfile ? settings.providers[activeProfile.provider]?.apiKey?.trim() : undefined);

  const handleSearchWorld = async () => {
    const trimmedWorld = worldName.trim();
    if (!trimmedWorld) return;

    if (!activeProfile || !activeProfile.model || (!roleplayKey && activeProfile.provider !== 'custom')) {
      setSearchError('Please connect your Roleplay Model in Settings > Roleplay BYOK Models first.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setAiLoreProof('');

    // Secret prompt formatted strictly as requested:
    const secretPrompt = `Before we start the roleplay , How familiar you are with The '${trimmedWorld}'  lore , characters , character appearances , threats , villains and everything for a text based roleplay . i want proof that you have detailed knowledge of the verse because i am serious for this roleplay.`;

    let accumulated = '';

    try {
      await streamChatCompletion(
        {
          provider: activeProfile.provider,
          model: activeProfile.model,
          messages: [
            {
              role: 'user',
              content: secretPrompt,
            },
          ],
          samplers: {
            ...settings.samplers,
            max_tokens: 2000, // AI allowed up to 2000 tokens response
            temperature: 0.7,
          },
          apiKey: roleplayKey,
          baseUrl: activeProfile.baseUrl || settings.primaryModel.customUrl,
        },
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setAiLoreProof((prev) => prev + chunk);
          },
          onDone: () => {
            setIsSearching(false);
            setStep(2);
          },
          onError: (err) => {
            setIsSearching(false);
            setSearchError(`AI verification failed: ${err}`);
          },
        }
      );
    } catch (err: any) {
      setIsSearching(false);
      setSearchError(err.message || 'Failed to query verse knowledge from AI.');
    }
  };

  const handleEnterWorld = async () => {
    const trimmedWorld = worldName.trim();
    const trimmedTimeline = timeline.trim() || 'Canon Timeline';
    const trimmedScenario = scenarioStart.trim() || `The protagonist awakens in the universe of ${trimmedWorld}.`;

    setIsEntering(true);
    try {
      // 1. Create a dynamic Character Record representing the universe
      const isekaiCard: CharacterRecord = {
        id: `isekai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: `${trimmedWorld} (Isekai)`,
        genre: 'Isekai',
        tags: ['Isekai', trimmedWorld, 'Anime / Verse'],
        data: {
          name: `${trimmedWorld} Universe`,
          description: `An immersive, lore-faithful text roleplay adventure set in the world of ${trimmedWorld}.\nTimeline: ${trimmedTimeline}\nStarting premise: ${trimmedScenario}`,
          personality: `Dynamic world simulator portraying all canonical characters, allies, threats, and environment authentic to ${trimmedWorld}.`,
          scenario: `World: ${trimmedWorld}\nTimeline/Era: ${trimmedTimeline}\nStarting Scenario: ${trimmedScenario}`,
          first_mes: '', // AI will generate the opening reply dynamically
          mes_example: '',
          system_prompt: `You are the master narrator and world simulator for the universe of "${trimmedWorld}".
You portray all canonical characters, NPCs, factions, threats, and environmental hazards with extreme fidelity to canon lore, dialogue mannerisms, combat power systems, and world rules.
TIMELINE / ERA: ${trimmedTimeline}
STARTING PREMISE: ${trimmedScenario}
The protagonist is {{user}}.
Drive the narrative forward dynamically based on the starting scenario. Output rich sensory descriptions, accurate dialogue, and world consequences.`,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.characters.put(isekaiCard);

      // 2. Create a fresh session for this world
      const newSession: ChatSessionRecord = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        characterId: isekaiCard.id,
        personaId: activePersona.id,
        title: `Isekai: ${trimmedWorld} (${trimmedTimeline})`,
        rollingSummary: '',
        pinnedMemories: [],
        worldState: {
          time: 'Day 1 (Opening Scene)',
          date: trimmedTimeline,
          location: `${trimmedWorld} Territory`,
          atmosphere: `${trimmedWorld} World Awakening`,
          weather: 'Dynamic',
          activeNpcs: [],
          mood: 'Tense Anticipation',
          notes: `Starting Premise: ${trimmedScenario}`,
        },
        chapters: [],
        chapterTurnInterval: settings.contextWindow.chapterTurnInterval || 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.sessions.put(newSession);

      // 3. Insert opening user prompt so AI generates opening response immediately
      const openingUserMsg: ChatMessageRecord = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sessionId: newSession.id,
        role: 'user',
        content: `[SCENARIO OPENING: World: ${trimmedWorld} | Era: ${trimmedTimeline} | Starting Premise: ${trimmedScenario}]\n\nBegin the story. Establish the opening environment, sensory atmosphere, current danger or situation, and describe the first NPC or event encountering {{user}} based on the starting premise.`,
        swipes: [],
        swipeIndex: 0,
        timestamp: Date.now(),
      };

      await db.messages.put(openingUserMsg);

      // 4. Trigger transition to chat screen
      onEnterWorld({ character: isekaiCard, session: newSession });
      onClose();
    } catch (err) {
      console.error('[EnterIsekai] Error starting world:', err);
      alert('Failed to initialize Isekai world.');
    } finally {
      setIsEntering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.95)] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Enter Isekai</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                  {step === 1 ? 'Step 1: Choose Verse' : 'Step 2: World Setup'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {step === 1
                  ? 'Enter any anime, movie, or novel world to test AI verse knowledge'
                  : `Configuring entry point into ${worldName}`}
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {searchError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Verse Inquiry Failed</p>
                <p className="text-[11px] text-red-300/80 mt-0.5">{searchError}</p>
              </div>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                Enter your desired fictional world. The AI will secretly be challenged to prove its in-depth mastery of the canon lore, characters, power systems, and villains before roleplay begins.
              </p>

              <div>
                <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Chosen Anime / Movie / Novel World
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={worldName}
                    onChange={(e) => setWorldName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSearching) {
                        handleSearchWorld();
                      }
                    }}
                    placeholder="e.g. Jujutsu Kaisen, Attack on Titan, Cyberpunk, Harry Potter..."
                    disabled={isSearching}
                    className="flex-1 px-4 py-3 rounded-2xl bg-black/60 border border-white/15 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleSearchWorld}
                    disabled={isSearching || !worldName.trim()}
                    className={`px-5 py-3 rounded-2xl font-semibold text-xs flex items-center gap-2 transition-all shrink-0 ${
                      isSearching || !worldName.trim()
                        ? 'bg-white/10 text-zinc-500 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                    }`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-black" />
                        <span>Search World</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Pick World Badges */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Popular Anime &amp; Fiction Universes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_WORLDS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      disabled={isSearching}
                      onClick={() => setWorldName(w)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        worldName === w
                          ? 'bg-white text-black font-semibold shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Streaming Verification Preview while AI is responding */}
              {isSearching && (
                <div className="p-4 rounded-2xl bg-black/60 border border-white/15 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>AI Verifying Knowledge of "{worldName}" (up to 2000 tokens)...</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap select-text p-2 bg-black/40 rounded-xl border border-white/5">
                    {aiLoreProof || 'Contacting Roleplay Model...'}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Card showing AI's generated response proving lore familiarity */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      AI Lore Verification: {worldName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Verse Verified
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap select-text p-3 bg-black/50 rounded-xl border border-white/10">
                  {aiLoreProof}
                </div>
              </div>

              {/* Two simple inputs: Timeline and Scenario Start */}
              <div className="space-y-3.5 pt-1">
                {/* Timeline */}
                <div>
                  <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Timeline / Era</span>
                  </label>
                  <input
                    type="text"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. Shibuya Incident Arc, Pre-Chunin Exams, Year 1, Season 2..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 font-sans"
                  />
                </div>

                {/* Scenario Start */}
                <div>
                  <label className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Scenario Start</span>
                  </label>
                  <textarea
                    rows={3}
                    value={scenarioStart}
                    onChange={(e) => setScenarioStart(e.target.value)}
                    placeholder={`e.g. I wake up in the ruins of ${worldName} with an unknown technique just as the enemies approach...`}
                    className="w-full p-3.5 rounded-2xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/40 font-sans leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/40">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={handleEnterWorld}
              disabled={isEntering}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                isEntering
                  ? 'bg-white/20 text-zinc-400 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_25px_rgba(255,255,255,0.3)]'
              }`}
            >
              {isEntering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Entering World...</span>
                </>
              ) : (
                <>
                  <span>Enter World</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
