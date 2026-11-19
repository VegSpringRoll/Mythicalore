import React, { useState } from 'react';
import { ChatSessionRecord, ChapterRecord, ChatMessageRecord } from '../../types/chat';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { AppSettingsRecord } from '../../types/settings';
import { db } from '../../db';
import { generateChapterSummary } from '../../services/summarizerWorker';
import { 
  X, 
  ScrollText, 
  Edit3, 
  Save, 
  ChevronDown,
  ChevronRight,
  BookOpen,
  Trash2,
  Sliders,
  AlertCircle,
  Brain,
  RefreshCw
} from 'lucide-react';

interface WorldStateSidePanelProps {
  isOpen: boolean;
  session: ChatSessionRecord;
  character?: CharacterRecord;
  persona?: PersonaRecord;
  allMessages: ChatMessageRecord[];
  settings: AppSettingsRecord;
  onUpdateSession: (updated: ChatSessionRecord) => void;
  onClose: () => void;
}

export const WorldStateSidePanel: React.FC<WorldStateSidePanelProps> = ({
  isOpen,
  session,
  character,
  persona,
  allMessages,
  settings,
  onUpdateSession,
  onClose,
}) => {
  // Chapter Turn Interval
  const [chapterInterval, setChapterInterval] = useState(
    session.chapterTurnInterval || settings.contextWindow?.chapterTurnInterval || 10
  );
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({ 1: true });

  // Ongoing summary edit state
  const [isEditingOngoing, setIsEditingOngoing] = useState(false);
  const [editedOngoingSummary, setEditedOngoingSummary] = useState(session.rollingSummary || '');

  // Chapter editing state
  const [editingChapterNum, setEditingChapterNum] = useState<number | null>(null);
  const [editedChapterText, setEditedChapterText] = useState('');

  // Manual generation state
  const [isManualSummarizing, setIsManualSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active summarizer verification
  const activeSummarizerProfile = settings.summarizerProfiles?.find(
    (p) => p.id === settings.summarizerModel?.profileId
  ) || (settings.summarizerProfiles?.length > 0 ? settings.summarizerProfiles[0] : null);

  const isSummarizerConnected = Boolean(
    activeSummarizerProfile &&
    activeSummarizerProfile.model &&
    (activeSummarizerProfile.provider === 'custom' || activeSummarizerProfile.apiKey?.trim())
  );

  const handleUpdateInterval = async (newVal: number) => {
    if (newVal < 2) newVal = 2;
    setChapterInterval(newVal);
    const updatedSession: ChatSessionRecord = {
      ...session,
      chapterTurnInterval: newVal,
      updatedAt: Date.now(),
    };
    await db.sessions.update(session.id, { chapterTurnInterval: newVal });
    onUpdateSession(updatedSession);
  };

  const handleSaveOngoingSummary = async () => {
    const updatedSession: ChatSessionRecord = {
      ...session,
      rollingSummary: editedOngoingSummary.trim(),
      updatedAt: Date.now(),
    };
    await db.sessions.update(session.id, { rollingSummary: editedOngoingSummary.trim() });
    onUpdateSession(updatedSession);
    setIsEditingOngoing(false);
  };

  const toggleChapter = (chapterNum: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterNum]: !prev[chapterNum],
    }));
  };

  const handleSaveEditedChapter = async (chapter: ChapterRecord) => {
    const updatedChapters = (session.chapters || []).map((c) =>
      c.chapterNumber === chapter.chapterNumber ? { ...c, summary: editedChapterText } : c
    );
    const updatedSession: ChatSessionRecord = {
      ...session,
      chapters: updatedChapters,
      updatedAt: Date.now(),
    };
    await db.sessions.update(session.id, { chapters: updatedChapters });
    onUpdateSession(updatedSession);
    setEditingChapterNum(null);
  };

  const handleDeleteChapter = async (chapterNum: number) => {
    if (!confirm('Delete this chapter summary?')) return;
    const updatedChapters = (session.chapters || []).filter((c) => c.chapterNumber !== chapterNum);
    const updatedSession: ChatSessionRecord = {
      ...session,
      chapters: updatedChapters,
      updatedAt: Date.now(),
    };
    await db.sessions.update(session.id, { chapters: updatedChapters });
    onUpdateSession(updatedSession);
  };

  const handleManualSummarize = async () => {
    if (isManualSummarizing) return;
    setIsManualSummarizing(true);
    setSummaryError(null);
    try {
      const charToUse = character || ({
        id: session.characterId,
        name: 'Character',
        data: { name: 'Character', first_mes: '', description: '' },
      } as any);
      const personaToUse = persona || ({
        id: session.personaId,
        name: 'User',
      } as any);

      const newChapter = await generateChapterSummary({
        session,
        character: charToUse,
        persona: personaToUse,
        allMessages,
        settings,
        force: false,
      });

      if (newChapter) {
        const updatedChapters = [...(session.chapters || []), newChapter];
        const updatedRolling = updatedChapters
          .map((c) => `[CHAPTER ${c.chapterNumber}: ${c.title} (Turns ${c.startTurn}–${c.endTurn})]\n${c.summary}`)
          .join('\n\n');
        const updated: ChatSessionRecord = {
          ...session,
          chapters: updatedChapters,
          rollingSummary: updatedRolling,
          updatedAt: Date.now(),
        };
        onUpdateSession(updated);
      }
    } catch (err: any) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsManualSummarizing(false);
    }
  };

  // Turn tracking calculations
  const userTurnsCount = allMessages.filter((m) => m.role === 'user').length;
  const chaptersCount = session.chapters?.length || 0;
  const turnsInCurrentChapter = Math.max(0, userTurnsCount - chaptersCount * chapterInterval);

  return (
    <div className="fixed inset-y-0 left-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel Drawer */}
      <div className="relative w-full sm:w-96 h-full bg-[#0a0a0d]/95 backdrop-blur-2xl border-r border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col z-10 transition-all duration-300">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Story Chronicles</h3>
              <p className="text-[11px] text-zinc-400">Chapter Digests &amp; Rolling Narrative Memory</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Chapter Interval Configuration Pill */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-300" />
                Chapter Turn Interval
              </span>
              <span className="text-xs font-mono text-white font-bold">
                Every {chapterInterval} turns
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Determines how many roleplay turns form each chapter before the background AI automatically generates the chapter summary.
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleUpdateInterval(num)}
                  className={`flex-1 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                    chapterInterval === num
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Current Chapter Progress Bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-400">Chapter {chaptersCount + 1} Progress</span>
                <span className="font-mono text-white font-bold">
                  {turnsInCurrentChapter} / {chapterInterval} turns
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"
                  style={{ width: `${Math.min(100, (turnsInCurrentChapter / chapterInterval) * 100)}%` }}
                />
              </div>
            </div>

            {/* Active Model Status / Warning */}
            {isSummarizerConnected ? (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-zinc-200 font-medium">Automatic Chronicle Active</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[140px]" title={activeSummarizerProfile?.name || activeSummarizerProfile?.model}>
                  {activeSummarizerProfile?.name || activeSummarizerProfile?.model}
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-300">Please connect Summarizer Model</p>
                  <p className="text-[11px] text-amber-200/70 leading-relaxed">
                    Select or save an active AI model in <strong>Settings &gt; Summary Model</strong> to enable automatic chapter summaries.
                  </p>
                </div>
              </div>
            )}

            {turnsInCurrentChapter >= chapterInterval && (
              <button
                type="button"
                onClick={handleManualSummarize}
                disabled={isManualSummarizing || !isSummarizerConnected}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all disabled:opacity-50"
              >
                {isManualSummarizing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Chapter {chaptersCount + 1}...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5" />
                    <span>Synthesize Chapter {chaptersCount + 1} Now ({turnsInCurrentChapter}/{chapterInterval} turns)</span>
                  </>
                )}
              </button>
            )}

            {summaryError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-200">Chapter Generation Failed</p>
                  <p className="text-[11px] text-red-300/80 mt-0.5">{summaryError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Active Ongoing Rolling Summary */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-zinc-300" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Ongoing Narrative Memory
                </h4>
              </div>
              {!isEditingOngoing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditedOngoingSummary(session.rollingSummary || '');
                    setIsEditingOngoing(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Edit Rolling Summary"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingOngoing(false)}
                    className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOngoingSummary}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white text-black text-[11px] font-semibold hover:bg-zinc-200"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>

            {isEditingOngoing ? (
              <textarea
                rows={6}
                value={editedOngoingSummary}
                onChange={(e) => setEditedOngoingSummary(e.target.value)}
                placeholder="Enter or paste narrative chronicle summary..."
                className="w-full p-3 rounded-xl bg-black/70 border border-white/20 text-xs text-white leading-relaxed focus:outline-none focus:border-white/40 font-sans"
              />
            ) : (
              <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line bg-black/40 p-3 rounded-xl border border-white/5">
                {session.rollingSummary?.trim() || (
                  <span className="italic text-zinc-500">
                    No summary generated yet. As you roleplay, completed chapters will be synthesized here and injected into Tier 2 historical memory.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Section 2: Chapter Archive */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <span>Completed Chapters</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                  {chaptersCount}
                </span>
              </h4>
            </div>

            {chaptersCount === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <ScrollText className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-zinc-400">No chapters archived yet</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Once you reach {chapterInterval} user turns, Chapter 1 will automatically be recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {session.chapters?.map((ch) => (
                  <div
                    key={ch.chapterNumber}
                    className="rounded-2xl bg-[#0e0e12]/90 border border-white/10 overflow-hidden transition-all hover:border-white/20"
                  >
                    {/* Chapter Header */}
                    <div
                      onClick={() => toggleChapter(ch.chapterNumber)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {expandedChapters[ch.chapterNumber] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white truncate">
                          Ch. {ch.chapterNumber}: {ch.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0 ml-2">
                        Turns {ch.startTurn}-{ch.endTurn}
                      </span>
                    </div>

                    {/* Chapter Expanded Body */}
                    {expandedChapters[ch.chapterNumber] && (
                      <div className="p-3 pt-0 border-t border-white/5 space-y-2">
                        {editingChapterNum === ch.chapterNumber ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              rows={4}
                              value={editedChapterText}
                              onChange={(e) => setEditedChapterText(e.target.value)}
                              className="w-full p-2.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white leading-relaxed focus:outline-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingChapterNum(null)}
                                className="text-xs text-zinc-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditedChapter(ch)}
                                className="px-3 py-1 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200"
                              >
                                Save Chapter
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line mt-2">
                              {ch.summary}
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingChapterNum(ch.chapterNumber);
                                  setEditedChapterText(ch.summary);
                                }}
                                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChapter(ch.chapterNumber)}
                                className="text-[11px] text-zinc-500 hover:text-white flex items-center gap-1 ml-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
