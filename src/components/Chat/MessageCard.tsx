import React, { useState } from 'react';
import { ChatMessageRecord } from '../../types/chat';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { AppSettingsRecord } from '../../types/settings';
import { db } from '../../db';
import { parseRoleplayParagraphs } from '../../services/tagParser';
import { illustrateSceneForMessage } from '../../services/imageService';
import { 
  Copy, 
  Check, 
  Edit3, 
  RotateCcw, 
  Pin, 
  Trash2, 
  Save, 
  X,
  Zap,
  Palette,
  AlertCircle
} from 'lucide-react';

// Helper to render inline markdown: already-italic words become bold, narration stays plain not-italic
function renderFormattedNarration(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*[\s\S]+?\*\*|\*[^\s*][^*]*?\*|_[\s\S]+?_)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(1, -1)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

interface MessageCardProps {
  message: ChatMessageRecord;
  character: CharacterRecord;
  persona: PersonaRecord;
  settings?: AppSettingsRecord;
  isStreaming?: boolean;
  onRerollMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string, triggerAiReply?: boolean) => void;
  onPinMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onUpdateMessage?: (updated: ChatMessageRecord) => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  character,
  persona,
  settings,
  isStreaming = false,
  onRerollMessage,
  onEditMessage,
  onPinMessage,
  onDeleteMessage,
  onUpdateMessage,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [userImgError, setUserImgError] = useState(false);
  const [charImgError, setCharImgError] = useState(false);

  // Image Generation States
  const [isIllustrating, setIsIllustrating] = useState(false);
  const [illustrationStatus, setIllustrationStatus] = useState('');
  const [illustrationError, setIllustrationError] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const paragraphs = parseRoleplayParagraphs(message.content);

  const handleGenerateImage = async () => {
    if (!settings) {
      setIllustrationError('Settings not loaded. Please wait a moment.');
      return;
    }
    setIsIllustrating(true);
    setIllustrationStatus('Analyzing scene context...');
    setIllustrationError(null);
    try {
      const result = await illustrateSceneForMessage({
        message,
        character,
        settings,
        onStatusUpdate: (s) => setIllustrationStatus(s),
      });
      const updated: ChatMessageRecord = {
        ...message,
        imageUrl: result.imageUrl,
        imagePrompt: result.prompt,
      };
      if (onUpdateMessage) {
        onUpdateMessage(updated);
      }
    } catch (err: any) {
      console.error('[IllustrateScene] Error:', err);
      setIllustrationError(err.message || 'Image generation failed');
    } finally {
      setIsIllustrating(false);
      setIllustrationStatus('');
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm('Remove this scene illustration?')) return;
    await db.messages.update(message.id, {
      imageUrl: undefined,
      imagePrompt: undefined,
    });
    const updated: ChatMessageRecord = {
      ...message,
      imageUrl: undefined,
      imagePrompt: undefined,
    };
    if (onUpdateMessage) {
      onUpdateMessage(updated);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (triggerAiReply: boolean = false) => {
    if (onEditMessage && editContent.trim()) {
      onEditMessage(message.id, editContent.trim(), triggerAiReply);
    }
    setIsEditing(false);
  };

  return (
    <div 
      className={`group relative rounded-[28px] transition-all duration-300 p-4 sm:p-6 mb-4 ${
        isUser
          ? 'bg-[#101014]/75 backdrop-blur-2xl border border-white/10 hover:border-white/20 ml-2 sm:ml-10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
          : 'bg-[#0c0c0f]/80 backdrop-blur-2xl border border-white/15 hover:border-white/25 mr-2 sm:mr-8 shadow-[0_12px_40px_rgba(0,0,0,0.8)]'
      } ${message.isPinned ? 'ring-1 ring-white/30 bg-white/[0.04]' : ''}`}
    >
      {/* Top Header Row inside Card: Avatar + Name + NPC/YOU badge + Reroll button */}
      <div className="flex items-center justify-between pb-3 mb-2 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Avatar with glowing silver ring */}
          <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden border border-white/25 bg-zinc-900 shadow-[0_0_12px_rgba(255,255,255,0.12)] shrink-0 flex items-center justify-center">
            {isUser ? (
              persona?.avatarUrl && !userImgError ? (
                <img 
                  src={persona.avatarUrl} 
                  alt={persona.name} 
                  onError={() => setUserImgError(true)}
                  className="h-full w-full object-cover" 
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-tr from-zinc-700 to-zinc-900 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {persona?.name ? persona.name.slice(0, 2).toUpperCase() : 'ME'}
                </div>
              )
            ) : (
              character?.avatarUrl && !charImgError ? (
                <img 
                  src={character.avatarUrl} 
                  alt={character.name} 
                  onError={() => setCharImgError(true)}
                  className="h-full w-full object-cover" 
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-tr from-zinc-800 to-black flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {character?.name ? character.name.slice(0, 2).toUpperCase() : 'NPC'}
                </div>
              )
            )}
          </div>

          {/* Name & Badge */}
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {isUser ? persona.name : character.name}
            </span>

            {/* Monochrome Badge */}
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full uppercase border bg-white/10 text-white border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.08)] shrink-0">
              {isUser ? 'YOU' : 'NPC'}
            </span>
          </div>
        </div>

        {/* Reroll Button for Assistant messages */}
        {isAssistant && !isStreaming && onRerollMessage && (
          <button
            type="button"
            onClick={() => onRerollMessage(message.id)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/20 text-white text-[11px] sm:text-xs font-medium transition-all shadow-sm hover:scale-105 active:scale-95 shrink-0"
            title="Reroll response (replaces current message with a fresh generation)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-300" />
            <span>Reroll</span>
          </button>
        )}
      </div>

      {/* Message Body Content */}
      {isEditing ? (
        <div className="space-y-3 mt-2">
          <textarea
            rows={5}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3.5 rounded-2xl bg-black/70 border border-white/20 text-white text-xs leading-relaxed focus:outline-none focus:border-white/40 font-sans"
          />
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            {isUser ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(false)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors border border-white/10"
                  title="Save edited turn text without regenerating"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all"
                  title="Save edited turn and immediately have the AI generate a new reply"
                >
                  <Zap className="w-3.5 h-3.5 text-black" />
                  <span>Save & Reply ⚡</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveEdit(false)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:bg-zinc-200 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Edit</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {paragraphs.map((para, pIdx) => (
            <div key={pIdx} className="leading-relaxed text-[14px] sm:text-[15px] font-sans my-2.5">
              {para.tokens.map((token, tIdx) => {
                // Dialogue: Luminous bright white text with soft white glow
                if (token.type === 'dialogue') {
                  return (
                    <span 
                      key={tIdx} 
                      className="dialogue-glow text-white font-semibold drop-shadow-[0_0_10px_rgba(255,255,255,0.7)] tracking-wide select-text"
                    >
                      “{token.text}”{' '}
                    </span>
                  );
                }

                // Already italic words generated by AI (enclosed in asterisks): rendered in bold
                if (token.type === 'thought') {
                  return (
                    <span 
                      key={tIdx} 
                      className="font-bold text-white font-sans not-italic select-text"
                    >
                      {token.text}{' '}
                    </span>
                  );
                }

                // OOC
                if (token.type === 'ooc') {
                  return (
                    <span 
                      key={tIdx} 
                      className="inline-block px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/15 text-zinc-300 text-xs font-mono my-0.5 mr-1 select-text"
                    >
                      {token.text}
                    </span>
                  );
                }

                // Actions & Narration: Plain text as generated by AI (NOT italic), with already-italic markdown words rendered bold
                return (
                  <span key={tIdx} className="text-zinc-200 font-sans not-italic select-text">
                    {renderFormattedNarration(token.text)}{' '}
                  </span>
                );
              })}
            </div>
          ))}

          {/* Pulsing indicator during stream */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1 align-middle shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          )}

          {/* Scene Illustration Error Banner */}
          {illustrationError && (
            <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between text-xs text-red-300 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-[11px] font-sans leading-tight break-words">{illustrationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setIllustrationError(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Animated Palette Visualizer while Generating Illustration */}
          {isIllustrating && (
            <div className="relative mt-3 p-4 rounded-2xl bg-black/60 border border-white/20 overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.07)] animate-fadeIn">
              {/* Monochromatic ambient glow behind */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/15 via-blue-900/15 to-emerald-900/15 animate-pulse pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3">
                {/* Rotating palette ring with color pigments */}
                <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full bg-white/5 border border-white/20 animate-spin" style={{ animationDuration: '3s' }} />
                  {/* Subtle color dots on palette ring */}
                  <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" />
                  <div className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  <Palette className="w-5 h-5 text-white animate-pulse" />
                </div>

                <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">Illustrating Scene</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-[11px] text-zinc-300 font-mono animate-pulse truncate">
                    {illustrationStatus || 'Synthesizing artwork...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rendered Scene Illustration Image Card */}
          {message.imageUrl && !isIllustrating && (
            <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.85)] group/img animate-fadeIn">
              <img 
                src={message.imageUrl} 
                alt={message.imagePrompt || 'Scene illustration'}
                className="w-full max-h-96 object-cover rounded-2xl transition-transform duration-300 group-hover/img:scale-[1.01]" 
              />

              {/* Floating Quick Action Overlay */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/80 backdrop-blur-md px-2 py-1 rounded-xl border border-white/20">
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={isIllustrating}
                  className="px-2 py-1 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-medium flex items-center gap-1"
                  title="Re-generate illustration"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Redo</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  className="p-1 rounded-lg text-zinc-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                  title="Remove image"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Prompt Caption Pill */}
              {message.imagePrompt && (
                <div 
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  className="px-3 py-2 bg-black/85 backdrop-blur-md border-t border-white/10 text-[10px] text-zinc-400 font-mono cursor-pointer hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-2">🎨 {message.imagePrompt}</span>
                    <span className="text-[9px] text-zinc-500 uppercase shrink-0 font-sans font-bold">
                      {showFullPrompt ? 'Less' : 'Prompt'}
                    </span>
                  </div>
                  {showFullPrompt && (
                    <p className="mt-1.5 text-zinc-300 whitespace-normal leading-relaxed text-[11px] font-sans border-t border-white/10 pt-1.5">
                      {message.imagePrompt}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Row: Timestamp on Left, Action Icons on Right */}
      {!isStreaming && !isEditing && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
              title="Copy Message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditContent(message.content);
                setIsEditing(true);
              }}
              className="p-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
              title="Edit Turn"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Illustrate Scene with Cloudflare Workers AI */}
            {isAssistant && (
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={isIllustrating}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs ${
                  message.imageUrl
                    ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                    : 'text-zinc-200 hover:text-white bg-white/[0.06] hover:bg-white/15 border border-white/15 shadow-sm'
                } ${isIllustrating ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Illustrate this scene using Cloudflare Workers AI & Summarizer Model"
              >
                <Palette className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-[11px] font-medium hidden sm:inline">
                  {message.imageUrl ? 'Re-illustrate' : 'Illustrate'}
                </span>
              </button>
            )}

            {onPinMessage && (
              <button
                type="button"
                onClick={() => onPinMessage(message.id, message.content)}
                className={`p-1.5 rounded-lg transition-colors ${
                  message.isPinned 
                    ? 'text-white bg-white/20' 
                    : 'hover:text-white hover:bg-white/10'
                }`}
                title="Pin Fact to Tier 3 Memory"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}

            {/* For user message: offer regenerate AI reply button */}
            {isUser && onRerollMessage && (
              <button
                type="button"
                onClick={() => onRerollMessage(message.id)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Regenerate AI Reply from this user turn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {onDeleteMessage && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this message turn?')) {
                    onDeleteMessage(message.id);
                  }
                }}
                className="p-1.5 rounded-lg hover:text-zinc-200 hover:bg-white/10 transition-colors"
                title="Delete Turn"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
