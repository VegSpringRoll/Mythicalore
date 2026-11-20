export interface PersonaMove {
  id: string;
  name: string;
  triggers: string[]; // trigger words
  description: string;
  enabled?: boolean;
}

export interface PersonaRecord {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarBlob?: Blob;
  gender: string;
  physiqueAndApparel: string;
  psychologicalTraits: string;
  backgroundLore: string;
  moves?: PersonaMove[]; // Movesets / Abilities (Lorebook style)
  lorebookMoveset?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}
