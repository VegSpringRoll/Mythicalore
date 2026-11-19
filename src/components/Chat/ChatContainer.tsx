import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { ChatSessionRecord, ChatMessageRecord } from '../../types/chat';
import { AppSettingsRecord } from '../../types/settings';
import { PromptInspectionData } from '../../types/llm';
import { db, getAppSettings } from '../../db';
import { MessageCard } from './MessageCard';
import { InputCapsule } from './InputCapsule';
import { PromptInspectorModal } from '../PromptInspector/PromptInspectorModal';
import { WorldStateSidePanel } from '../WorldState/WorldStateSidePanel';
import { assemblePromptContext } from '../../services/contextAssembly';
import { streamChatCompletion, requestAiWorldStateUpdate } from '../../services/llmClient';
import { checkAndTriggerRollingSummary } from '../../services/summarizerWorker';
import { substituteMacros } from '../../services/macroEngine';
import { estimateTokens, estimateMessagesTokens } from '../../services/tokenEstimator';
import { ChevronUp, AlertTriangle, AlertCircle } from 'lucide-react';

interface ChatContainerProps {
  sessionId?: string | null;
  character: CharacterRecord;
  persona: PersonaRecord;
  settings: AppSettingsRecord;
  isWorldStateOpen: boolean;
  setIsWorldStateOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  sessionId,
  character,
  persona,
  settings,
  isWorldStateOpen,
  setIsWorldStateOpen,
  onOpenSettings,
}) => {
  const [session, setSession] = useState<ChatSessionRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draftInput, setDraftInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [summarizerError, setSummarizerError] = useState<string | null>(null);

  // Windowing & expander
  const [showOlderTurns, setShowOlderTurns] = useState(false);

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

      const msgs = await db.messages
        .where('sessionId')
        .equals(currentSession.id)
        .sortBy('timestamp');

      setMessages(msgs);
    } catch (err) {
      console.error('Failed to initialize chat session:', err);
    }
  }, [sessionId, character, persona, settings]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (!showOlderTurns) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, streamingContent, showOlderTurns]);

  // Sliding window calculations
  const slidingWindowSize = settings.contextWindow.slidingWindowTurns || 10;
  let userTurnsSeen = 0;
  let sliceStartIndex = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userTurnsSeen++;
      if (userTurnsSeen > slidingWindowSize) {
        sliceStartIndex = i + 1;
        break;
      }
    }
  }

  const visibleMessages = showOlderTurns ? messages : messages.slice(sliceStartIndex);
  const hiddenCount = showOlderTurns ? 0 : sliceStartIndex;

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
                if (err.message && err.message.includes('Please connect Summarizer Model')) {
                  setSummarizerError('Please connect Summarizer Model in Settings (Background Summarizer BYOK) to generate automatic chapter summaries.');
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
                  notes: 'Sanctuary seals',
                },
                recentTurns: recent,
                characterName: character.name,
                personaName: persona.name,
                apiKey: wsApiKey,
                baseUrl: wsBaseUrl,
              }).then(async (updatedWorld) => {
                if (updatedWorld) {
                  await db.sessions.update(session.id, { worldState: updatedWorld });
                  setSession((prev) => prev ? { ...prev, worldState: updatedWorld } : null);
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

      {/* Top Scene Context Subheader matching image */}
      <div className="px-6 py-2.5 flex items-center justify-between text-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight drop-shadow-md">
            {character.name}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            ACTIVE CHAT
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">
            Window: {messages.length - hiddenCount} turns active
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-2 space-y-4 max-w-5xl w-full mx-auto">
        {/* Tier 1 Window Expander Button */}
        {hiddenCount > 0 && (
          <div className="flex justify-center my-2">
            <button
              type="button"
              onClick={() => setShowOlderTurns(!showOlderTurns)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 text-xs font-medium transition-all shadow-sm"
            >
              <ChevronUp className={`w-3.5 h-3.5 text-zinc-300 transition-transform ${showOlderTurns ? 'rotate-180' : ''}`} />
              <span>
                {showOlderTurns 
                  ? 'Collapse to Active Sliding Window' 
                  : `+ Show Older Turns (${hiddenCount} hidden)`}
              </span>
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
            isStreaming={isStreaming && streamingMessageId === msg.id}
            onRerollMessage={handleRerollMessage}
            onEditMessage={handleEditMessage}
            onPinMessage={handlePinMessage}
            onDeleteMessage={handleDeleteMessage}
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
          character={character}
          persona={persona}
          allMessages={messages}
          settings={settings}
          onUpdateSession={(updated) => setSession(updated)}
          onClose={() => setIsWorldStateOpen(false)}
        />
      )}
    </div>
  );
};
