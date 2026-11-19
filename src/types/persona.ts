export interface PersonaRecord {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarBlob?: Blob;
  gender: string;
  physiqueAndApparel: string;
  psychologicalTraits: string;
  backgroundLore: string;
  lorebookMoveset?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}
