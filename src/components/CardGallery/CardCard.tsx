import React from 'react';
import { CharacterRecord } from '../../types/characterCard';
import { MessageSquare, Edit3, Download, Trash2, Star, Tag } from 'lucide-react';
import { exportCharacterPng } from '../../services/pngParser';

interface CardCardProps {
  card: CharacterRecord;
  onSelect: (card: CharacterRecord) => void;
  onEdit: (card: CharacterRecord) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (card: CharacterRecord) => void;
}

export const CardCard: React.FC<CardCardProps> = ({
  card,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = JSON.stringify({
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: card.data,
    }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.name.replace(/[^a-z0-9_-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const pngBlob = await exportCharacterPng(card);
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.name.replace(/[^a-z0-9_-]/gi, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert('Error exporting PNG chunk metadata.');
    }
  };

  return (
    <div 
      onClick={() => onSelect(card)}
      className="group relative flex flex-col rounded-2xl bg-[#0e0e12]/80 backdrop-blur-md overflow-hidden cursor-pointer border border-white/10 hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-glow-white/10"
    >
      {/* Avatar Header Image */}
      <div className="relative h-52 w-full overflow-hidden bg-black/60">
        {card.avatarUrl ? (
          <img 
            src={card.avatarUrl} 
            alt={card.name} 
            className="h-full w-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-zinc-900 border-b border-white/10 text-white font-bold text-4xl">
            {card.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e12] via-[#0e0e12]/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-zinc-300 border border-white/15">
            {card.genre || 'Universal'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(card);
            }}
            className="p-1.5 rounded-full bg-black/70 backdrop-blur-md text-zinc-400 hover:text-white border border-white/15 transition-colors"
            title="Toggle Favorite"
          >
            <Star className={`w-3.5 h-3.5 ${card.isFavorite ? 'fill-white text-white' : ''}`} />
          </button>
        </div>

        {/* Character Title Overlay */}
        <div className="absolute bottom-2.5 left-3 right-3">
          <h3 className="text-base font-bold text-white tracking-tight drop-shadow-md">
            {card.name}
          </h3>
          <p className="text-xs text-zinc-400 line-clamp-1">
            {card.data.creator ? `by ${card.data.creator}` : 'Universal Character'}
          </p>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-3.5 flex flex-col justify-between gap-3">
        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
          {card.data.description || card.data.personality || 'No description provided.'}
        </p>

        {/* Tag Pills */}
        <div className="flex flex-wrap gap-1 items-center">
          {card.tags && card.tags.slice(0, 3).map((tag, idx) => (
            <span 
              key={idx}
              className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300 border border-white/10 flex items-center gap-1"
            >
              <Tag className="w-2.5 h-2.5 text-zinc-400" />
              {tag}
            </span>
          ))}
          {card.tags && card.tags.length > 3 && (
            <span className="text-[10px] text-zinc-500">+{card.tags.length - 3}</span>
          )}
        </div>

        {/* Card Actions Bar */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(card);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 hover:border-white text-xs font-medium transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Roleplay</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Edit Card"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExportPng}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Export as PNG (with tEXt chunk metadata)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExportJson}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-mono font-bold"
              title="Export as JSON"
            >
              JSON
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${card.name}? This will also delete related chat histories.`)) {
                  onDelete(card.id);
                }
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
              title="Delete Card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
