import React, { useState, useEffect } from 'react';
import { LorebookRecord, LorebookEntryRecord } from '../../types/lorebook';
import { db } from '../../db';
import { BookOpen, Plus, Trash2, Edit2, X, Key } from 'lucide-react';

interface LorebookManagerModalProps {
  isOpen: boolean;
  characterId?: string;
  characterName?: string;
  onClose: () => void;
}

export const LorebookManagerModal: React.FC<LorebookManagerModalProps> = ({
  isOpen,
  characterId,
  characterName,
  onClose,
}) => {
  const [lorebooks, setLorebooks] = useState<LorebookRecord[]>([]);
  const [selectedBook, setSelectedBook] = useState<LorebookRecord | null>(null);
  const [entries, setEntries] = useState<LorebookEntryRecord[]>([]);

  // Entry Form
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryName, setEntryName] = useState('');
  const [entryKeysStr, setEntryKeysStr] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [entryPriority, setEntryPriority] = useState(10);
  const [entryConstant, setEntryConstant] = useState(false);

  const loadLorebooks = async () => {
    const list = await db.lorebooks
      .filter((b) => !b.characterId || b.characterId === characterId)
      .toArray();
    setLorebooks(list);
    if (list.length > 0 && !selectedBook) {
      setSelectedBook(list[0]);
    }
  };

  const loadEntries = async (bookId: string) => {
    const list = await db.lorebookEntries
      .where('lorebookId')
      .equals(bookId)
      .sortBy('priority');
    setEntries(list.reverse());
  };

  useEffect(() => {
    if (isOpen) {
      loadLorebooks();
    }
  }, [isOpen, characterId]);

  useEffect(() => {
    if (selectedBook) {
      loadEntries(selectedBook.id);
    }
  }, [selectedBook]);

  if (!isOpen) return null;

  const handleCreateBook = async () => {
    const name = prompt('Enter Lorebook Name:');
    if (!name?.trim()) return;

    const newBook: LorebookRecord = {
      id: `lorebook-${Date.now()}`,
      name: name.trim(),
      description: `Lorebook for ${characterName || 'Universe'}`,
      characterId,
      scanDepth: 5,
      tokenBudget: 800,
      recursiveScanning: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.lorebooks.put(newBook);
    await loadLorebooks();
    setSelectedBook(newBook);
  };

  const handleSaveEntry = async () => {
    if (!selectedBook || !entryName.trim() || !entryContent.trim()) {
      alert('Please fill in entry title and content.');
      return;
    }

    const keys = entryKeysStr
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const record: LorebookEntryRecord = {
      id: editingEntryId || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lorebookId: selectedBook.id,
      name: entryName.trim(),
      keys,
      content: entryContent.trim(),
      enabled: true,
      priority: entryPriority,
      insertionOrder: 0,
      caseSensitive: false,
      constant: entryConstant,
    };

    await db.lorebookEntries.put(record);
    await loadEntries(selectedBook.id);
    setIsEditingEntry(false);
    setEditingEntryId(null);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!selectedBook) return;
    if (confirm('Delete this lore entry?')) {
      await db.lorebookEntries.delete(id);
      await loadEntries(selectedBook.id);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    const book = lorebooks.find((b) => b.id === bookId);
    if (!book) return;
    if (confirm(`Delete lorebook "${book.name}" and all of its lore entries?`)) {
      await db.lorebookEntries.where('lorebookId').equals(bookId).delete();
      await db.lorebooks.delete(bookId);
      const remaining = lorebooks.filter((b) => b.id !== bookId);
      setLorebooks(remaining);
      setSelectedBook(remaining[0] || null);
      if (remaining[0]) {
        await loadEntries(remaining[0].id);
      } else {
        setEntries([]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Lorebook
              </h2>
              <p className="text-xs text-zinc-400">
                Keyword-triggered world info, factions, techniques, and character lorebooks
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

        {/* Content Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Lorebook List */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-black/30 p-4 space-y-3 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Lorebooks</span>
              <button
                type="button"
                onClick={handleCreateBook}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white"
                title="Create New Lorebook"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {lorebooks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBook(b)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all ${
                    selectedBook?.id === b.id
                      ? 'bg-white/15 border border-white/30 text-white font-semibold'
                      : 'bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 border border-transparent'
                  }`}
                >
                  <p className="truncate">{b.name}</p>
                  <span className="text-[10px] text-zinc-500">
                    {b.characterId ? 'Character Book' : 'Global Lorebook'}
                  </span>
                </button>
              ))}

              {lorebooks.length === 0 && (
                <p className="text-[11px] text-zinc-500 text-center py-4">No lorebooks created yet.</p>
              )}
            </div>
          </div>

          {/* Right Main Panel: Entries */}
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
            {selectedBook ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedBook.name}</h3>
                    <p className="text-xs text-zinc-400">{selectedBook.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntryId(null);
                          setEntryName('');
                          setEntryKeysStr('');
                          setEntryContent('');
                          setEntryPriority(10);
                          setEntryConstant(false);
                          setIsEditingEntry(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 text-black" />
                        <span>Add Lore Entry</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteBook(selectedBook.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title={`Delete Lorebook "${selectedBook.name}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditingEntry ? (
                  /* Entry Editor Form */
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/20 space-y-4">
                    <h4 className="text-xs font-bold text-white">
                      {editingEntryId ? 'Edit Entry' : 'Create New Lore Entry'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Entry Title</label>
                        <input
                          type="text"
                          value={entryName}
                          onChange={(e) => setEntryName(e.target.value)}
                          placeholder="e.g. Aras Corp, Neuro-Shard..."
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Trigger Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={entryKeysStr}
                          onChange={(e) => setEntryKeysStr(e.target.value)}
                          placeholder="e.g. aras, corp, megacorp"
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Lore Content Payload</label>
                      <textarea
                        rows={4}
                        value={entryContent}
                        onChange={(e) => setEntryContent(e.target.value)}
                        placeholder="Detailed background information injected when keywords appear..."
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entryConstant}
                          onChange={(e) => setEntryConstant(e.target.checked)}
                          className="w-4 h-4 rounded text-white bg-black/50 border-white/20"
                        />
                        <span>Constant (Always inject into Tier 3 prompt)</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingEntry(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEntry}
                          className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
                        >
                          Save Entry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Entries List */
                  <div className="space-y-3">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 space-y-2 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-white">{entry.name}</h5>
                            {entry.constant && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 border border-white/15">
                                Constant
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntryId(entry.id);
                                setEntryName(entry.name);
                                setEntryKeysStr(entry.keys.join(', '));
                                setEntryContent(entry.content);
                                setEntryPriority(entry.priority);
                                setEntryConstant(entry.constant);
                                setIsEditingEntry(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 text-zinc-400 hover:text-zinc-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {entry.keys.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <Key className="w-3 h-3 text-zinc-400" />
                            {entry.keys.map((k, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-mono">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">
                          {entry.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                <BookOpen className="w-10 h-10 text-zinc-600 mb-3" />
                <h4 className="text-sm font-semibold text-white mb-1">No Lorebook Selected</h4>
                <p className="text-xs text-zinc-400 max-w-sm mb-4">
                  Select a lorebook on the left or create a new one to manage keywords, factions, and world info.
                </p>
                <button
                  type="button"
                  onClick={handleCreateBook}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
                >
                  <Plus className="w-4 h-4 text-black" />
                  <span>Create Lorebook</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
