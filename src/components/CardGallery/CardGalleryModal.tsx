import React, { useState, useEffect } from 'react';
import { CharacterRecord } from '../../types/characterCard';
import { PersonaRecord } from '../../types/persona';
import { db } from '../../db';
import { CardCard } from './CardCard';
import { CardEditorModal } from './CardEditorModal';
import { parseCharacterPng, parseCharacterJson, blobToDataUrl } from '../../services/pngParser';
import { importEmbeddedCharacterBook } from '../../services/lorebookImport';
import { 
  Plus, 
  Upload, 
  Search, 
  Sparkles, 
  X, 
  Filter, 
  FileCode,
  Image as ImageIcon
} from 'lucide-react';

interface CardGalleryModalProps {
  isOpen: boolean;
  activePersona?: PersonaRecord;
  onSelectCharacter: (card: CharacterRecord) => void;
  onClose: () => void;
}

const GENRE_FILTERS = [
  'All',
  'Favorites',
  'Cyberpunk',
  'Grimdark Fantasy',
  'Sci-Fi',
  'High Fantasy',
  'Modern Noir',
  'Horror',
];

export const CardGalleryModal: React.FC<CardGalleryModalProps> = ({
  isOpen,
  activePersona,
  onSelectCharacter,
  onClose,
}) => {
  const [cards, setCards] = useState<CharacterRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [editingCard, setEditingCard] = useState<CharacterRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadCards = async () => {
    try {
      const allCards = await db.characters.toArray();
      // Ensure all cards have persistent base64 avatarUrl from avatarBlob if missing or expired blob:
      for (const card of allCards) {
        if (card.avatarBlob && (!card.avatarUrl || card.avatarUrl.startsWith('blob:'))) {
          card.avatarUrl = await blobToDataUrl(card.avatarBlob);
          await db.characters.update(card.id, { avatarUrl: card.avatarUrl });
        }
      }

      // Sort favorites first, then newest
      allCards.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      setCards(allCards);
    } catch (err) {
      console.error('Failed to load character cards:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCards();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsImporting(true);
    try {
      const isPng = file.name.toLowerCase().endsWith('.png') || file.type === 'image/png';
      const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

      if (!isPng && !isJson) {
        alert('Please upload a .png (with embedded Character Card chunk) or .json file.');
        return;
      }

      let parsedResult;
      if (isPng) {
        parsedResult = await parseCharacterPng(file);
      } else {
        parsedResult = await parseCharacterJson(file);
      }

      const newId = `char-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newRecord: CharacterRecord = {
        id: newId,
        name: parsedResult.cardData.name || 'Imported Character',
        genre: parsedResult.genre || 'Universal',
        tags: parsedResult.cardData.tags || [],
        avatarUrl: parsedResult.avatarUrl,
        avatarBlob: parsedResult.avatarBlob,
        data: parsedResult.cardData,
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.characters.put(newRecord);

      // Check if card has embedded character_book
      if (parsedResult.cardData.character_book) {
        await importEmbeddedCharacterBook(
          newId, 
          newRecord.name, 
          parsedResult.cardData.character_book
        );
      }

      await loadCards();
    } catch (err) {
      console.error('Failed to import character card:', err);
      alert(err instanceof Error ? err.message : 'Failed to import character card.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  const handleSaveCard = async (saved: CharacterRecord) => {
    await db.characters.put(saved);
    if (saved.data.character_book) {
      await importEmbeddedCharacterBook(saved.id, saved.name, saved.data.character_book);
    }
    await loadCards();
  };

  const handleDeleteCard = async (id: string) => {
    await db.characters.delete(id);
    // Also delete any chats associated
    const sessions = await db.sessions.where('characterId').equals(id).toArray();
    for (const s of sessions) {
      await db.messages.where('sessionId').equals(s.id).delete();
    }
    await db.sessions.where('characterId').equals(id).delete();
    await db.lorebooks.where('characterId').equals(id).delete();
    await loadCards();
  };

  const handleToggleFavorite = async (card: CharacterRecord) => {
    const updated = { ...card, isFavorite: !card.isFavorite, updatedAt: Date.now() };
    await db.characters.put(updated);
    await loadCards();
  };

  // Filter cards by search and genre
  const filteredCards = cards.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.data.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedGenre === 'All') return true;
    if (selectedGenre === 'Favorites') return Boolean(c.isFavorite);
    return c.genre.toLowerCase() === selectedGenre.toLowerCase();
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-4 z-50 rounded-3xl border-2 border-dashed border-white/40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none gap-3">
          <Upload className="w-12 h-12 text-white animate-bounce" />
          <h3 className="text-xl font-bold text-white">Drop Character Cards Here</h3>
          <p className="text-xs text-zinc-400">PNG with embedded tEXt chunks or JSON cards</p>
        </div>
      )}

      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col rounded-3xl bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white border border-white/20 shadow-glow-white/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Character Card Vault
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                  {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                SillyTavern V2/V3 JSON & Embedded PNG Chunk Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Import Dropdown / Input */}
            <label className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/15 text-xs font-medium transition-all shadow-sm">
              <Upload className="w-3.5 h-3.5 text-zinc-300" />
              <span>Import Card</span>
              <input
                type="file"
                accept=".png,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                disabled={isImporting}
              />
            </label>

            {/* Create New Card */}
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
            >
              <Plus className="w-4 h-4 text-black" />
              <span>New Card</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Genre Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3.5 border-b border-white/10 bg-black/20">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, tags..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
            />
          </div>

          {/* Genre Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-1 hidden sm:inline" />
            {GENRE_FILTERS.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedGenre === g
                    ? 'bg-white/15 border border-white/30 text-white font-semibold'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredCards.map((c) => (
                <CardCard
                  key={c.id}
                  card={c}
                  onSelect={(card) => {
                    onSelectCharacter(card);
                    onClose();
                  }}
                  onEdit={(card) => setEditingCard(card)}
                  onDelete={handleDeleteCard}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/[0.06] mb-4">
                <ImageIcon className="w-12 h-12 text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-200 mb-1">No Character Cards Found</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed">
                {searchQuery || selectedGenre !== 'All' 
                  ? 'No cards match your filter criteria.'
                  : 'Import a SillyTavern character card (.png with embedded metadata or .json) or create your own.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-glow-white/20 transition-all"
                >
                  <Plus className="w-4 h-4 text-black" />
                  <span>Create Character</span>
                </button>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/15 text-xs font-medium">
                  <FileCode className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Import JSON/PNG</span>
                  <input
                    type="file"
                    accept=".png,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal for Create or Edit */}
      {(isCreating || editingCard) && (
        <CardEditorModal
          card={editingCard}
          activePersona={activePersona}
          onSave={handleSaveCard}
          onClose={() => {
            setIsCreating(false);
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
};
