export interface WorldState {
  time: string; // e.g. "Midnight (23:45)"
  date: string; // e.g. "Day 14, Eclipse Phase"
  location: string; // e.g. "Sunken Sanctum - Reliquary Crypts"
  atmosphere: string; // e.g. "Cold stone, distant solemn bells, incense smoke"
  weather?: string; // e.g. "Rain", "Thunderstorm", "Fog", "Embers", "Clear Night", "Snow"
  activeNpcs?: string[]; // e.g. ["Kora Vance", "Inquisitor Malakor"]
  mood?: string; // e.g. "Tense Combat", "Romantic Night", "Mysterious", "Tavern", "Peaceful"
  notes?: string;
}

export interface ChapterRecord {
  chapterNumber: number;
  title: string;
  startTurn: number;
  endTurn: number;
  summary: string;
  keyEvents?: string[];
  createdAt: number;
}

export interface ChatSessionRecord {
  id: string;
  characterId: string;
  personaId: string;
  title: string;
  rollingSummary: string; // Aggregate rolling summary
  pinnedMemories: string[]; // Tier 3 pinned facts / milestones
  worldState: WorldState; // Time, Date, Location, Atmosphere
  chapters: ChapterRecord[]; // Chapter-based summaries (Chapter 1 = turns 1-10, etc.)
  chapterTurnInterval: number; // User configurable interval (e.g. 10 turns)
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  swipes: string[]; // multi-swipe generation rollouts
  swipeIndex: number; // 0-based index of currently visible swipe
  content: string; // convenience copy of swipes[swipeIndex]
  timestamp: number;
  isPinned?: boolean;
  tokens?: number;
  imageUrl?: string;
  imagePrompt?: string;
  meta?: {
    model?: string;
    provider?: string;
    finishReason?: string;
    latencyMs?: number;
    triggeredLore?: string[];
  };
}
