import React, { useEffect, useState } from 'react';
import { db } from '../../db';
import { ChatSessionRecord, ChatMessageRecord } from '../../types/chat';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { blobToDataUrl } from '../../services/pngParser';
import { 
  X, 
  MessageSquare, 
  Trash2, 
  Plus, 
  Search, 
  Clock, 
  BookOpen, 
  User, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface SessionItemData {
  session: ChatSessionRecord;
  character?: CharacterRecord;
  persona?: PersonaRecord;
  lastMessage?: ChatMessageRecord;
  messageCount: number;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  activeSessionId?: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string, characterId: string, personaId: string) => void;
  onNewChat: () => void;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  isOpen,
  activeSessionId,
  onClose,
  onSelectSession,
  onNewChat,
}) => {
  const [sessionsData, setSessionsData] = useState<SessionItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const allSessions = await db.sessions.orderBy('updatedAt').reverse().toArray();
      const allCharacters = await db.characters.toArray();
      const allPersonas = await db.personas.toArray();

      const charMap = new Map<string, CharacterRecord>();
      for (const c of allCharacters) {
        if (c.avatarBlob && (!c.avatarUrl || c.avatarUrl.startsWith('blob:'))) {
          c.avatarUrl = await blobToDataUrl(c.avatarBlob);
        }
        charMap.set(c.id, c);
      }

      const personaMap = new Map<string, PersonaRecord>();
      for (const p of allPersonas) {
        if (p.avatarBlob && (!p.avatarUrl || p.avatarUrl.startsWith('blob:'))) {
          p.avatarUrl = await blobToDataUrl(p.avatarBlob);
        }
        personaMap.set(p.id, p);
      }

      const items: SessionItemData[] = [];
      for (const s of allSessions) {
        const msgs = await db.messages.where('sessionId').equals(s.id).sortBy('timestamp');
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        items.push({
          session: s,
          character: charMap.get(s.characterId),
          persona: personaMap.get(s.personaId),
          lastMessage: lastMsg,
          messageCount: msgs.length,
        });
      }

      setSessionsData(items);
    } catch (err) {
      console.error('Failed to load chat history sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
      setSearchQuery('');
      setSessionToDelete(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await db.messages.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
      setSessionsData((prev) => prev.filter((item) => item.session.id !== sessionId));
      setSessionToDelete(null);
    } catch (err) {
      console.error('Failed to delete chat session:', err);
      alert('Failed to delete chat session from database.');
    }
  };

  const filteredSessions = sessionsData.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const charName = item.character?.name.toLowerCase() || '';
    const personaName = item.persona?.name.toLowerCase() || '';
    const title = item.session.title?.toLowerCase() || '';
    const lastContent = item.lastMessage?.content.toLowerCase() || '';
    return charName.includes(q) || personaName.includes(q) || title.includes(q) || lastContent.includes(q);
  });

  const formatTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-3xl h-[88vh] max-h-[750px] bg-[#09090c]/95 border border-white/15 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Active Roleplay Chats</h2>
              <p className="text-xs text-zinc-400">All archived and ongoing chat sessions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewChat();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 sm:px-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 bg-white/[0.01]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats by character, persona, or content..."
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewChat();
            }}
            className="sm:hidden flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Chat</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
              <Sparkles className="w-6 h-6 animate-spin text-zinc-400" />
              <p className="text-xs">Loading roleplay chronicles...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center text-zinc-500 gap-2 border border-dashed border-white/10 rounded-2xl p-6">
              <MessageSquare className="w-8 h-8 text-zinc-600 mb-1" />
              <p className="text-sm font-semibold text-zinc-300">
                {searchQuery ? 'No matching chats found' : 'No roleplay chats recorded yet'}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm">
                {searchQuery 
                  ? 'Try a different search term or clear the filter.' 
                  : 'Start your first roleplay session from the character gallery.'}
              </p>
            </div>
          ) : (
            filteredSessions.map((item) => {
              const isSelected = activeSessionId === item.session.id;
              const isConfirmingDelete = sessionToDelete === item.session.id;

              return (
                <div
                  key={item.session.id}
                  onClick={() => onSelectSession(item.session.id, item.session.characterId, item.session.personaId)}
                  className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.08] border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Avatar & Info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Character Avatar */}
                      <div className="relative shrink-0">
                        {item.character?.avatarUrl ? (
                          <img
                            src={item.character.avatarUrl}
                            alt={item.character.name}
                            className="w-12 h-12 rounded-2xl object-cover border border-white/20 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-zinc-300 font-bold text-sm">
                            {item.character?.name?.slice(0, 2) || 'RP'}
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#09090c] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        )}
                      </div>

                      {/* Text info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white truncate">
                            {item.character?.name || 'Unknown Character'}
                          </h3>
                          {isSelected && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                              ACTIVE
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-500" />
                            {item.persona?.name || 'Protagonist'}
                          </span>
                        </div>

                        {/* Last message preview */}
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {item.lastMessage?.content ? (
                            item.lastMessage.content
                          ) : (
                            <span className="italic text-zinc-500">No dialogue recorded yet.</span>
                          )}
                        </p>

                        {/* Session Metadata stats */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(item.session.updatedAt || item.session.createdAt)}
                          </span>
                          <span>•</span>
                          <span>{item.messageCount} messages</span>
                          {(item.session.chapters?.length || 0) > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-zinc-400">
                                <BookOpen className="w-3 h-3" />
                                {item.session.chapters?.length} chapters
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-center">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-red-950/40 border border-red-500/30" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-red-300 px-2 font-medium">Delete chat?</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(item.session.id, e)}
                            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 text-xs transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(item.session.id);
                            }}
                            className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete this chat session permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="p-2 rounded-xl text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{filteredSessions.length} total sessions stored locally</span>
          <span>Click any session to resume</span>
        </div>
      </div>
    </div>
  );
};
