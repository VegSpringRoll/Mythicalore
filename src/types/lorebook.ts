export interface LorebookEntryRecord {
  id: string;
  lorebookId: string;
  name: string;
  keys: string[];
  secondaryKeys?: string[];
  content: string;
  enabled: boolean;
  priority: number;
  insertionOrder: number;
  caseSensitive: boolean;
  constant: boolean; // if true, always inject regardless of keys
}

export interface LorebookRecord {
  id: string;
  name: string;
  description: string;
  characterId?: string; // linked to specific character, or global if undefined
  scanDepth: number; // how many messages back to scan for trigger keys
  tokenBudget: number;
  recursiveScanning: boolean;
  createdAt: number;
  updatedAt: number;
}
