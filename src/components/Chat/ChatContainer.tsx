import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { ChatSessionRecord, ChatMessageRecord, WorldState } from '../../types/chat';
import { AppSettingsRecord } from '../../types/settings';
import { PromptInspectionData } from '../../types/llm';
import { db, getAppSettings } from '../../db';
import { MessageCard } from './MessageCard';
import { InputCapsule } from './InputCapsule';
import { PromptInspectorModal } from '../PromptInspector/PromptInspectorModal';
import { WorldStateSidePanel } from '../WorldState/WorldStateSidePanel';
import { AmbientWeatherCanvas } from '../UI/AmbientWeatherCanvas';
import { assemblePromptContext } from '../../services/contextAssembly';
import { streamChatCompletion, requestAiWorldStateUpdate } from '../../services/llmClient';
import { checkAndTriggerRollingSummary } from '../../services/summarizerWorker';
import { substituteMacros } from '../../services/macroEngine';
import { estimateTokens, estimateMessagesTokens } from '../../services/tokenEstimator';
import { extractRoleplayState } from '../../services/tagParser';
import { 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  AlertCircle,
  Sparkles,
  Clock,
  Calendar,
  CloudRain,
  Flame,
  Users,
  MapPin,
  Compass,
  X
} from 'lucide-react';

interface ChatContainerProps {
  sessionId?: string | null;
  character: CharacterRecord;
  persona: PersonaRecord;
  settings: AppSettingsRecord;
  isWorldStateOpen: boolean;
  setIsWorldStateOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
  onAtmosphereChange?: (atmosphere: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  sessionId,
  character,
  persona,
  settings,
  isWorldStateOpen,
  setIsWorldStateOpen,
  onOpenSettings,
  onAtmosphereChange,
}) => {
  const [session, setSession] = useState<ChatSessionRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draftInput, setDraftInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [summarizerError, setSummarizerError] = useState<string | null>(null);

  // Dropdown card state for subheader
  const [isStateCardOpen, setIsStateCardOpen] = useState(false);
  const stateCardRef = useRef<HTMLDivElement>(null);

  // Windowing: default to showing previous 10 messages of user
  const [visibleTurnsCount, setVisibleTurnsCount] = useState<number>(10);
  const isExpandingOlderRef = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stateCardRef.current && !stateCardRef.current.contains(event.target as Node)) {
        setIsStateCardOpen(false);
      }
    }
    if (isStateCardOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStateCardOpen]);

  // Inspector modal
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorData, setInspectorData] = useState<PromptInspectionData | null>(null);

  const activeAbortController = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load or create session
  const initSession = useCallback(async () => {
    try {
      let currentSession: ChatSessionRecord | undefined;
      
      if (sessionId) {
        currentSession = await db.sessions.get(sessionId);
      }

      if (!currentSession) {
        const matches = await db.sessions
          .where('characterId')
          .equals(character.id)
          .and((s) => s.personaId === persona.id)
          .sortBy('updatedAt');
        
        if (matches.length > 0) {
          currentSession = matches[matches.length - 1];
        }
      }

      if (!currentSession) {
        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        currentSession = {
          id: newSessionId,
          characterId: character.id,
          personaId: persona.id,
          title: `Roleplay with ${character.name}`,
          rollingSummary: '',
          pinnedMemories: [],
          worldState: {
            time: 'Midnight (23:45)',
            date: 'Day 14, Lunar Eclipse',
            location: character.genre === 'Cyberpunk' ? 'Sector 7 Hideout' : 'Sunken Sanctum - Reliquary Crypts',
            atmosphere: 'Cold stone, distant solemn bells, consecrated wolfsbane and incense smoke',
            notes: 'Prevent the red mist from breaching the sanctuary seals',
          },
          chapters: [],
          chapterTurnInterval: settings.contextWindow.chapterTurnInterval || 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.sessions.put(currentSession);

        if (character.data.first_mes) {
          const resolvedFirstMes = substituteMacros(character.data.first_mes, {
            charName: character.name,
            userName: persona.name,
            scenario: character.data.scenario,
          });

          const initialMessage: ChatMessageRecord = {
            id: `msg-${Date.now()}`,
            sessionId: newSessionId,
            role: 'assistant',
            swipes: [resolvedFirstMes],
            swipeIndex: 0,
            content: resolvedFirstMes,
            timestamp: Date.now(),
          };
          await db.messages.put(initialMessage);
        }
      } else {
        // Ensure modern fields exist
        if (!currentSession.worldState) {
          currentSession.worldState = {
            time: 'Midnight (23:45)',
            date: 'Day 14, Lunar Eclipse',
            location: 'Sunken Sanctum - Reliquary Crypts',
            atmosphere: 'Cold stone, distant solemn bells, incense smoke',
            notes: 'Prevent the red mist from breaching the sanctuary seals',
          };
        }
        if (!currentSession.chapters) {
          currentSession.chapters = [];
        }
        if (!currentSession.chapterTurnInterval) {
          currentSession.chapterTurnInterval = settings.contextWindow.chapterTurnInterval || 10;
        }
      }

      setSession(currentSession);

      if (onAtmosphereChange && currentSession.worldState) {
        onAtmosphereChange(
          currentSession.worldState.weather ||
          currentSession.worldState.mood ||
          currentSession.worldState.atmosphere
        );
      }

      const msgs = await db.messages
        .where('sessionId')
        .equals(currentSession.id)
        .sortBy('timestamp');

      setMessages(msgs);

      // Automatically catch up pending chapters on session load
      const userTurns = msgs.filter((m) => m.role === 'user').length;
      const chCount = currentSession.chapters?.length || 0;
      const interval = currentSession.chapterTurnInterval || settings.contextWindow?.chapterTurnInterval || 10;
      if (userTurns >= (chCount + 1) * interval) {
        getAppSettings().then((freshSettings) => {
          checkAndTriggerRollingSummary({
            session: currentSession!,
            character,
            persona,
            allMessages: msgs,
            settings: freshSettings,
            onSummaryUpdated: (updatedFields) => {
              setSession((prev) => (prev ? { ...prev, ...updatedFields } : null));
              setSummarizerError(null);
            },
            onError: (err) => {
              const msg = err.message || String(err);
              if (msg.includes('Please connect Summarizer Model')) {
                setSummarizerError('Please connect a model in Settings > Summary Model to generate chapter summaries.');
              } else {
                setSummarizerError(`Summary generation failed: ${msg}`);
              }
            },
          });
        });
      }
    } catch (err) {
      console.error('Failed to initialize chat session:', err);
    }
  }, [sessionId, character, persona, settings]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (!isExpandingOlderRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    isExpandingOlderRef.current = false;
  }, [messages.length, streamingContent]);

  // Windowing: render previous 10 messages of user + their assistant responses
  const totalUserTurns = messages.filter((m) => m.role === 'user').length;
  let userTurnsSeen = 0;
  let sliceStartIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userTurnsSeen++;
      if (userTurnsSeen === visibleTurnsCount) {
        sliceStartIndex = i;
        break;
      }
    }
  }

  const hasHiddenPastMessages = sliceStartIndex > 0;
  const hiddenCount = sliceStartIndex;
  const visibleMessages = messages.slice(sliceStartIndex);

  const cumulativeTokens = estimateMessagesTokens(
    messages.map((m) => ({ role: m.role, content: m.content }))
  );

  /**
   * Core AI generation trigger:
   * Dispatches the active sliding history window to the configured roleplay LLM.
   */
  const triggerAiGeneration = async (historyMessages: ChatMessageRecord[]) => {
    if (isStreaming || !session) return;

    // Load freshest settings directly from DB to ensure any newly saved profile is used
    const freshSettings = await getAppSettings();

    const activeRpProfile = freshSettings.roleplayProfiles.find((p) => p.id === freshSettings.primaryModel.profileId)
      || freshSettings.roleplayProfiles[0];

    const provider = activeRpProfile?.provider || freshSettings.primaryModel.provider;
    const model = activeRpProfile?.model || freshSettings.primaryModel.model;
    const apiKey = activeRpProfile?.apiKey || freshSettings.providers[provider]?.apiKey;
    const baseUrl = activeRpProfile?.baseUrl || freshSettings.primaryModel.customUrl || freshSettings.providers[provider]?.baseUrl;

    if (!apiKey && provider !== 'custom') {
      setGenerationError(`No API Key configured for ${provider}! Please click "Settings & BYOK" below to connect your key and select a model.`);
      return;
    }

    setGenerationError(null);

    const { dispatchedMessages } = await assemblePromptContext({
      character,
      persona,
      session,
      allMessages: historyMessages,
      settings: freshSettings,
    });

    setIsStreaming(true);
    setStreamingContent('');
    const assistantMsgId = `msg-${Date.now() + 1}`;
    setStreamingMessageId(assistantMsgId);

    const controller = new AbortController();
    activeAbortController.current = controller;

    let fullAccumulated = '';

    await streamChatCompletion(
      {
        provider,
        model,
        messages: dispatchedMessages,
        samplers: freshSettings.samplers,
        apiKey,
        baseUrl,
        promptCache: freshSettings.enablePromptCache,
      },
      {
        onChunk: (text) => {
          fullAccumulated += text;
          setStreamingContent(fullAccumulated);
        },
        onDone: async () => {
          setIsStreaming(false);
          setStreamingMessageId(null);
          activeAbortController.current = null;

          if (fullAccumulated.trim()) {
            // Extract any hidden telemetry state block output by the AI model
            const { state: extractedState } = extractRoleplayState(fullAccumulated);

            const assistantMsg: ChatMessageRecord = {
              id: assistantMsgId,
              sessionId: session.id,
              role: 'assistant',
              swipes: [fullAccumulated.trim()],
              swipeIndex: 0,
              content: fullAccumulated.trim(),
              timestamp: Date.now(),
              tokens: estimateTokens(fullAccumulated),
              meta: { model, provider },
            };

            await db.messages.put(assistantMsg);
            const finalMessages = [...historyMessages, assistantMsg];
            setMessages(finalMessages);

            // If the model returned an inline state block, update session worldState immediately
            if (extractedState && session) {
              const updatedWorldState: WorldState = {
                ...session.worldState,
                time: extractedState.time || session.worldState?.time || 'Midnight (23:45)',
                date: extractedState.date || session.worldState?.date || 'Day 14, Lunar Eclipse',
                location: extractedState.location || session.worldState?.location || 'Sanctum',
                atmosphere: extractedState.atmosphere || session.worldState?.atmosphere || 'Incense smoke and silence',
                weather: extractedState.weather || session.worldState?.weather || 'Clear Night',
                activeNpcs: extractedState.activeNpcs || session.worldState?.activeNpcs || [character.name],
                mood: extractedState.mood || session.worldState?.mood || 'Mysterious',
                notes: extractedState.notes || session.worldState?.notes,
              };

              await db.sessions.update(session.id, { worldState: updatedWorldState });
              setSession((prev) => prev ? { ...prev, worldState: updatedWorldState } : null);
              if (onAtmosphereChange) {
                onAtmosphereChange(updatedWorldState.weather || updatedWorldState.mood || updatedWorldState.atmosphere);
              }
            }

            // Trigger chapter/rolling summary in background
            checkAndTriggerRollingSummary({
              session,
              character,
              persona,
              allMessages: finalMessages,
              settings: freshSettings,
              onSummaryUpdated: (updatedFields) => {
                setSession((prev) => (prev ? { ...prev, ...updatedFields } : null));
                setSummarizerError(null);
              },
              onError: (err) => {
                const msg = err.message || String(err);
                if (msg.includes('Please connect Summarizer Model')) {
                  setSummarizerError('Please connect a model in Settings > Summary Model to generate automatic chapter summaries.');
                } else {
                  setSummarizerError(`Summary generation failed: ${msg}`);
                }
              },
            });

            // Trigger dynamic AI World State update
            try {
              const recent = [...finalMessages.slice(-4)].map((m) => `${m.role === 'user' ? persona.name : character.name}: ${m.content}`).join('\n\n');
              const activeSumProfile = freshSettings.summarizerProfiles.find((p) => p.id === freshSettings.summarizerModel.profileId) || freshSettings.summarizerProfiles[0];
              const wsProvider = activeSumProfile?.provider || provider;
              const wsModel = activeSumProfile?.model || model;
              const wsApiKey = activeSumProfile?.apiKey || apiKey;
              const wsBaseUrl = activeSumProfile?.baseUrl || baseUrl;

              requestAiWorldStateUpdate({
                provider: wsProvider,
                model: wsModel,
                currentWorldState: session.worldState || {
                  time: 'Midnight (23:45)',
                  date: 'Day 14, Lunar Eclipse',
                  location: 'Reliquary Crypts',
                  atmosphere: 'Cold stone, solemn bells',
                  weather: 'Clear Night',
                  activeNpcs: [character.name],
                  mood: 'Mysterious',
                  notes: 'Sanctuary seals',
                },
                recentTurns: recent,
                characterName: character.name,
                personaName: persona.name,
                apiKey: wsApiKey,
                baseUrl: wsBaseUrl,
              }).then(async (updatedWorld) => {
                if (updatedWorld && session) {
                  const mergedWorld: WorldState = {
                    ...session.worldState,
                    ...updatedWorld,
                  };
                  await db.sessions.update(session.id, { worldState: mergedWorld });
                  setSession((prev) => prev ? { ...prev, worldState: mergedWorld } : null);
                  if (onAtmosphereChange) {
                    onAtmosphereChange(mergedWorld.weather || mergedWorld.mood || mergedWorld.atmosphere);
                  }
                }
              }).catch((err) => {
                console.warn('Background AI world state update skipped:', err);
              });
            } catch (e) {
              console.warn('World state auto-update error:', e);
            }
          }
        },
        onError: (err) => {
          setIsStreaming(false);
          setStreamingMessageId(null);
          activeAbortController.current = null;
          setGenerationError(`Generation failed: ${err}`);
        },
      },
      controller.signal
    );
  };

  // Auto-trigger opening response for newly created Isekai worlds (1 pending user prompt, 0 assistant replies)
  const hasTriggeredInitialRef = useRef(false);
  useEffect(() => {
    if (
      session &&
      messages.length === 1 &&
      messages[0].role === 'user' &&
      !isStreaming &&
      !hasTriggeredInitialRef.current
    ) {
      hasTriggeredInitialRef.current = true;
      triggerAiGeneration(messages);
    }
  }, [session, messages, isStreaming]);

  const handleSendMessage = async () => {
    if (!draftInput.trim() || isStreaming || !session) return;

    const userText = draftInput.trim();
    setDraftInput('');

    const userMsgId = `msg-${Date.now()}`;
    const userMsg: ChatMessageRecord = {
      id: userMsgId,
      sessionId: session.id,
      role: 'user',
      swipes: [userText],
      swipeIndex: 0,
      content: userText,
      timestamp: Date.now(),
      tokens: estimateTokens(userText),
    };

    await db.messages.put(userMsg);
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    await triggerAiGeneration(updatedMessages);
  };

  const handleStopGeneration = () => {
    if (activeAbortController.current) {
      activeAbortController.current.abort();
    }
  };

  const handleRetryLastTurn = async () => {
    if (messages.length === 0 || isStreaming || !session) return;

    const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex !== -1) {
      const historyUpToLastUser = messages.slice(0, lastUserIndex + 1);
      // Remove any trailing failed assistant turn
      const subsequent = messages.slice(lastUserIndex + 1);
      for (const m of subsequent) {
        await db.messages.delete(m.id);
      }
      setMessages(historyUpToLastUser);
      await triggerAiGeneration(historyUpToLastUser);
    }
  };

  const handleRerollMessage = async (messageId: string) => {
    if (isStreaming || !session) return;

    const targetIndex = messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    const target = messages[targetIndex];

    // If regenerating from a user turn: remove any subsequent assistant response and re-ask the AI
    if (target.role === 'user') {
      const subsequent = messages.slice(targetIndex + 1);
      for (const m of subsequent) {
        await db.messages.delete(m.id);
      }
      const historyUpToTarget = messages.slice(0, targetIndex + 1);
      setMessages(historyUpToTarget);
      await triggerAiGeneration(historyUpToTarget);
      return;
    }

    // Assistant message reroll: remove this message and any subsequent messages, then generate fresh!
    const messagesToDelete = messages.slice(targetIndex);
    for (const m of messagesToDelete) {
      await db.messages.delete(m.id);
    }
    const historyBeforeThis = messages.slice(0, targetIndex);
    setMessages(historyBeforeThis);
    await triggerAiGeneration(historyBeforeThis);
  };

  const handleEditMessage = async (messageId: string, newContent: string, triggerAiReply: boolean = false) => {
    const targetIndex = messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    const target = messages[targetIndex];
    const swipes = [...(target.swipes || [target.content])];
    swipes[target.swipeIndex] = newContent;

    const updated: ChatMessageRecord = {
      ...target,
      content: newContent,
      swipes,
      tokens: estimateTokens(newContent),
    };

    await db.messages.put(updated);

    if (triggerAiReply && target.role === 'user') {
      // Remove any subsequent messages that followed this user message
      const subsequent = messages.slice(targetIndex + 1);
      for (const m of subsequent) {
        await db.messages.delete(m.id);
      }

      const truncated = [...messages.slice(0, targetIndex), updated];
      setMessages(truncated);
      await triggerAiGeneration(truncated);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    }
  };

  const handlePinMessage = async (messageId: string, content: string) => {
    if (!session) return;

    const target = messages.find((m) => m.id === messageId);
    if (!target) return;

    const isNowPinned = !target.isPinned;
    await db.messages.update(messageId, { isPinned: isNowPinned });

    let updatedPinned = session.pinnedMemories || [];
    if (isNowPinned) {
      updatedPinned = [...updatedPinned, content.slice(0, 300)];
    } else {
      updatedPinned = updatedPinned.filter((p) => !content.includes(p) && !p.includes(content));
    }

    await db.sessions.update(session.id, { pinnedMemories: updatedPinned });
    setSession({ ...session, pinnedMemories: updatedPinned });
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isPinned: isNowPinned } : m)));
  };

  const handleDeleteMessage = async (messageId: string) => {
    await db.messages.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleOpenInspector = async () => {
    if (!session) return;
    const { inspectionData } = await assemblePromptContext({
      character,
      persona,
      session,
      allMessages: messages,
      draftUserText: draftInput,
      settings,
    });
    setInspectorData(inspectionData);
    setIsInspectorOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-transparent">
      {/* Blurred Scenic Background Image (automatically resizes to any device viewport) */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
        <img
          src="/chat-bg.jpg"
          alt="Chat Atmospheric Background"
          className="w-full h-full object-cover object-center filter blur-[6px] md:blur-[8px] scale-105 opacity-30"
        />
        {/* Soft vertical gradient overlays to maintain high contrast for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/80 via-transparent to-[#050507]/90" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Ambient Weather Visual Canvas (Monochromatic low-res 60fps overlay, z-index: 1) */}
      <AmbientWeatherCanvas
        weather={session?.worldState?.weather}
        mood={session?.worldState?.mood}
        enabled={settings.ambientWeather?.enabled ?? true}
      />

      {/* Minimal Subheader with User Turns & Tappable Dropdown State Pill */}
      <div className="px-4 sm:px-8 py-2 flex items-center justify-between text-xs shrink-0 z-20 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <h2 className="text-sm font-bold text-white tracking-tight">
            {character.name}
          </h2>

          <span className="text-zinc-600 font-mono text-[11px]">•</span>

          {/* User Turns Counter */}
          <span className="text-xs font-mono text-zinc-400">
            {totalUserTurns} {totalUserTurns === 1 ? 'user turn' : 'user turns'}
          </span>

          {/* Tappable Atmosphere / Telemetry Pill */}
          <div className="relative" ref={stateCardRef}>
            <button
              type="button"
              onClick={() => setIsStateCardOpen(!isStateCardOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-mono text-zinc-200 hover:text-white transition-all active:scale-95 shadow-sm"
              title="Click to view Time, Date, Weather, NPCs & Mood"
            >
              <Sparkles className="w-3 h-3 text-white" />
              <span className="capitalize">{session?.worldState?.weather || session?.worldState?.mood || 'Scene State'}</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isStateCardOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Sleek Dark Card Dropdown */}
            {isStateCardOpen && (
              <>
                {/* Mobile Backdrop for tap to dismiss */}
                <div 
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] sm:hidden"
                  onClick={() => setIsStateCardOpen(false)}
                />
                <div className="fixed left-3 right-3 top-20 sm:top-full sm:left-0 sm:right-auto sm:absolute mt-2 sm:w-80 max-w-sm rounded-2xl bg-[#0c0c0f]/98 backdrop-blur-2xl border border-white/25 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.95)] z-50 animate-fadeIn space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-white" />
                      <h4 className="text-xs font-bold text-white tracking-tight">Scene Status & Telemetry</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                        Live State
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsStateCardOpen(false)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors sm:hidden"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* Time */}
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>Time</span>
                      </span>
                      <p className="text-white font-mono font-semibold break-words">
                        {session?.worldState?.time || 'Midnight (23:45)'}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        <span>Date</span>
                      </span>
                      <p className="text-white font-mono font-semibold break-words">
                        {session?.worldState?.date || 'Day 14, Eclipse'}
                      </p>
                    </div>

                    {/* Weather */}
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        <CloudRain className="w-3 h-3 text-zinc-400" />
                        <span>Weather</span>
                      </span>
                      <p className="text-white font-semibold break-words">
                        {session?.worldState?.weather || 'Clear Night'}
                      </p>
                    </div>

                    {/* Mood */}
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                        <Flame className="w-3 h-3 text-zinc-400" />
                        <span>Mood</span>
                      </span>
                      <p className="text-white font-semibold break-words">
                        {session?.worldState?.mood || 'Mysterious'}
                      </p>
                    </div>
                  </div>

                  {/* Active NPCs */}
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3 text-zinc-400" />
                      <span>Active Characters / NPCs</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(session?.worldState?.activeNpcs && session.worldState.activeNpcs.length > 0
                        ? session.worldState.activeNpcs
                        : [character.name]
                      ).map((npc, idx) => (
                        <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-white/10 text-white border border-white/10">
                          {npc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  {session?.worldState?.location && (
                    <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="break-words">{session.worldState.location}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side: compact hidden messages indicator */}
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <span className="text-[10px] font-mono text-zinc-500">
              +{hiddenCount} earlier
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-2 space-y-4 max-w-5xl w-full mx-auto">
        {/* Tier 1 Window Expander Button: Load earlier past messages */}
        {hasHiddenPastMessages && (
          <div className="flex items-center justify-center gap-2.5 py-3 animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                isExpandingOlderRef.current = true;
                setVisibleTurnsCount((prev) => prev + 10);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-semibold text-zinc-200 hover:text-white transition-all shadow-md group active:scale-95"
            >
              <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-white transition-transform group-hover:-translate-y-0.5" />
              <span>+ Show Earlier Messages ({hiddenCount} older messages)</span>
            </button>

            {visibleTurnsCount > 10 && (
              <button
                type="button"
                onClick={() => setVisibleTurnsCount(10)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Collapse back to previous 10 messages of user"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Collapse to 10</span>
              </button>
            )}
          </div>
        )}

        {!hasHiddenPastMessages && totalUserTurns > 10 && (
          <div className="flex items-center justify-center gap-3 py-3 text-[11px] text-zinc-500 animate-fadeIn">
            <span>Beginning of roleplay campaign</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setVisibleTurnsCount(10)}
              className="text-zinc-400 hover:text-white underline transition-colors"
            >
              Collapse back to previous 10 user messages
            </button>
          </div>
        )}

        {/* Message Cards */}
        {visibleMessages.map((msg) => (
          <MessageCard
            key={msg.id}
            message={msg}
            character={character}
            persona={persona}
            settings={settings}
            isStreaming={isStreaming && streamingMessageId === msg.id}
            onRerollMessage={handleRerollMessage}
            onEditMessage={handleEditMessage}
            onPinMessage={handlePinMessage}
            onDeleteMessage={handleDeleteMessage}
            onUpdateMessage={(updated) =>
              setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
            }
          />
        ))}

        {/* Active Streaming Message Card Placeholder */}
        {isStreaming && streamingMessageId && !messages.some((m) => m.id === streamingMessageId) && (
          <MessageCard
            message={{
              id: streamingMessageId,
              sessionId: session?.id || '',
              role: 'assistant',
              swipes: [streamingContent],
              swipeIndex: 0,
              content: streamingContent,
              timestamp: Date.now(),
            }}
            character={character}
            persona={persona}
            isStreaming={true}
          />
        )}

        {/* Summarizer Warning Banner */}
        {summarizerError && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="leading-snug">{summarizerError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs font-semibold transition-colors"
              >
                Connect Model
              </button>
              <button
                type="button"
                onClick={() => setSummarizerError(null)}
                className="text-amber-400/80 hover:text-white px-1.5 py-0.5 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Generation Error Alert Banner */}
        {generationError && (
          <div className="p-4 rounded-2xl bg-[#141418]/90 border border-white/20 shadow-[0_4px_25px_rgba(0,0,0,0.6)] text-xs text-zinc-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-white shrink-0" />
              <div>
                <span className="font-bold text-white block">Engine Notification</span>
                <span className="text-[11px] text-zinc-400 leading-tight block">{generationError}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleRetryLastTurn}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3.5 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
              >
                ⚙️ Settings & BYOK
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Capsule Floating Island */}
      <div className="p-3 sm:p-5 pb-20 sm:pb-5 shrink-0 z-20">
        <InputCapsule
          value={draftInput}
          onChange={setDraftInput}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          isStreaming={isStreaming}
          cumulativeTokens={cumulativeTokens}
          onOpenInspector={handleOpenInspector}
        />
      </div>

      {/* Prompt Inspector Modal */}
      <PromptInspectorModal
        isOpen={isInspectorOpen}
        data={inspectorData}
        onClose={() => setIsInspectorOpen(false)}
      />

      {/* World State & Chapter Chronicles Left Side Panel */}
      {session && (
        <WorldStateSidePanel
          isOpen={isWorldStateOpen}
          session={session}
          allMessages={messages}
          settings={settings}
          summaryError={summarizerError}
          onUpdateSession={(updated) => setSession(updated)}
          onClose={() => setIsWorldStateOpen(false)}
        />
      )}
    </div>
  );
};
