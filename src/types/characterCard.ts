export interface CharacterBookEntry {
  id?: string | number;
  keys: string[];
  secondary_keys?: string[];
  comment?: string;
  content: string;
  constant?: boolean;
  selective?: boolean;
  insertion_order?: number;
  enabled?: boolean;
  position?: 'before_char' | 'after_char' | number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export interface CharacterCardV2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown>;
}

export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CharacterCardV2Data;
}

export interface CharacterCardV3 {
  spec: 'chara_card_v3';
  spec_version: '3.0';
  data: CharacterCardV2Data & {
    assets?: Array<{
      type: string;
      uri: string;
      name: string;
      ext: string;
    }>;
  };
}

export interface LegacyTavernCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CharacterBook;
  tags?: string[];
}

export type AnyCharacterCardJSON = CharacterCardV2 | CharacterCardV3 | LegacyTavernCard;

export interface CharacterRecord {
  id: string;
  name: string;
  avatarUrl?: string; // object URL or data URL
  avatarBlob?: Blob; // Stored in IndexedDB
  tags: string[];
  genre: string;
  data: CharacterCardV2Data;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
}
