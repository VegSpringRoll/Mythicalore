import React, { useState } from 'react';
import { ChatMessageRecord } from '../../types/chat';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { parseRoleplayParagraphs } from '../../services/tagParser';
import { 
  Copy, 
  Check, 
  Edit3, 
  RotateCcw, 
  Pin, 
  Trash2, 
  Save, 
  X,
  Zap
} from 'lucide-react';

interface MessageCardProps {
  message: ChatMessageRecord;
  character: CharacterRecord;
  persona: PersonaRecord;
  isStreaming?: boolean;
  onRerollMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string, triggerAiReply?: boolean) => void;
  onPinMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  character,
  persona,
  isStreaming = false,
  onRerollMessage,
  onEditMessage,
  onPinMessage,
  onDeleteMessage,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [userImgError, setUserImgError] = useState(false);
  const [charImgError, setCharImgError] = useState(false);

  const paragraphs = parseRoleplayParagraphs(message.content);

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

                // Internal Monologue / Thought: Clean silver italics without literal asterisks
                if (token.type === 'thought') {
                  return (
                    <span 
                      key={tIdx} 
                      className="italic text-zinc-400 font-serif select-text"
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

                // Actions & Narration: Crisp silver text
                return (
                  <span key={tIdx} className="text-zinc-300 font-sans select-text">
                    {token.text}{' '}
                  </span>
                );
              })}
            </div>
          ))}

          {/* Pulsing indicator during stream */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1 align-middle shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
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
