import Dexie, { type EntityTable } from 'dexie';
import { CharacterRecord } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';
import { ChatSessionRecord, ChatMessageRecord } from '../types/chat';
import { LorebookRecord, LorebookEntryRecord } from '../types/lorebook';
import { AppSettingsRecord } from '../types/settings';
import { 
  SEED_SETTINGS, 
  SEED_PERSONAS
} from './seedData';

export class RoleplayEngineDB extends Dexie {
  characters!: EntityTable<CharacterRecord, 'id'>;
  personas!: EntityTable<PersonaRecord, 'id'>;
  sessions!: EntityTable<ChatSessionRecord, 'id'>;
  messages!: EntityTable<ChatMessageRecord, 'id'>;
  lorebooks!: EntityTable<LorebookRecord, 'id'>;
  lorebookEntries!: EntityTable<LorebookEntryRecord, 'id'>;
  settings!: EntityTable<AppSettingsRecord, 'id'>;

  constructor() {
    super('AetheriaRoleplayEngineDB');

    this.version(1).stores({
      characters: 'id, name, createdAt, updatedAt, isFavorite, genre, *tags',
      personas: 'id, name, isDefault, createdAt, updatedAt',
      sessions: 'id, characterId, personaId, createdAt, updatedAt',
      messages: 'id, sessionId, role, timestamp',
      lorebooks: 'id, characterId, name, updatedAt',
      lorebookEntries: 'id, lorebookId, name, enabled, priority, *keys',
      settings: 'id, updatedAt',
    });
  }
}

export const db = new RoleplayEngineDB();

const DUMMY_PROFILE_IDS = new Set([
  'sum-groq',
  'sum-gemini',
  'sum-openai',
  'sum-openrouter',
  'rp-claude-35',
  'rp-openrouter-llama',
  'rp-gpt4o',
]);

/**
 * Initializes the database with seed personas, lorebook, and settings if empty.
 * Ensures zero dummy character cards and zero dummy profiles exist in the user's database.
 */
export async function initDatabase(): Promise<void> {
  try {
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.put(SEED_SETTINGS);
    } else {
      // Purge any legacy dummy profiles from existing stored settings
      const existingSettings = await db.settings.get('default');
      if (existingSettings) {
        const cleanedRp = (existingSettings.roleplayProfiles || []).filter(
          (p) => !DUMMY_PROFILE_IDS.has(p.id) && !p.id.startsWith('dummy-')
        );
        const cleanedSum = (existingSettings.summarizerProfiles || []).filter(
          (p) => !DUMMY_PROFILE_IDS.has(p.id) && !p.id.startsWith('dummy-') && 
                 !p.name.includes('(Fast)') && !p.name.includes('Dummy')
        );

        if (
          cleanedRp.length !== (existingSettings.roleplayProfiles?.length || 0) ||
          cleanedSum.length !== (existingSettings.summarizerProfiles?.length || 0)
        ) {
          await db.settings.update('default', {
            roleplayProfiles: cleanedRp,
            summarizerProfiles: cleanedSum,
          });
        }
      }
    }

    const personaCount = await db.personas.count();
    if (personaCount === 0) {
      await db.personas.bulkPut(SEED_PERSONAS);
    } else {
      // Ensure existing personas have valid persistent avatar URLs
      const existingPersonas = await db.personas.toArray();
      for (const p of existingPersonas) {
        if (!p.avatarUrl || p.avatarUrl.startsWith('blob:')) {
          const matchSeed = SEED_PERSONAS.find((sp) => sp.id === p.id);
          if (matchSeed && matchSeed.avatarUrl) {
            await db.personas.update(p.id, { avatarUrl: matchSeed.avatarUrl });
          }
        }
      }
    }

    // Completely purge any old dummy characters (Kora Vance, Lady Vespera) from DB
    const allExistingChars = await db.characters.toArray();
    for (const c of allExistingChars) {
      if (
        c.id === 'char-kora' ||
        c.id === 'char-vespera' ||
        c.name.toLowerCase().includes('kora') ||
        c.name.toLowerCase().includes('vespera')
      ) {
        await db.characters.delete(c.id);
        const relatedSessions = await db.sessions.where('characterId').equals(c.id).toArray();
        for (const s of relatedSessions) {
          await db.messages.where('sessionId').equals(s.id).delete();
          await db.sessions.delete(s.id);
        }
      }
    }

    // Purge any dummy lorebooks (e.g. 'lorebook-neon-city')
    const allLorebooks = await db.lorebooks.toArray();
    for (const lb of allLorebooks) {
      if (
        lb.id === 'lorebook-neon-city' ||
        lb.name.toLowerCase().includes('neon city') ||
        lb.name.toLowerCase().includes('cyber-underworld')
      ) {
        await db.lorebookEntries.where('lorebookId').equals(lb.id).delete();
        await db.lorebooks.delete(lb.id);
      }
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

export async function getAppSettings(): Promise<AppSettingsRecord> {
  const current = await db.settings.get('default');
  if (current) {
    // Purge any legacy dummy profiles from existing stored settings
    const cleanedRp = (Array.isArray(current.roleplayProfiles) ? current.roleplayProfiles : []).filter(
      (p) => !DUMMY_PROFILE_IDS.has(p.id) && !p.id.startsWith('dummy-')
    );
    const cleanedSum = (Array.isArray(current.summarizerProfiles) ? current.summarizerProfiles : []).filter(
      (p) => !DUMMY_PROFILE_IDS.has(p.id) && !p.id.startsWith('dummy-') && 
             !p.name.includes('(Fast)') && !p.name.includes('Dummy')
    );

    const merged: AppSettingsRecord = {
      ...SEED_SETTINGS,
      ...current,
      roleplayProfiles: cleanedRp,
      summarizerProfiles: cleanedSum,
      universalSystemPrompt: current.universalSystemPrompt || SEED_SETTINGS.universalSystemPrompt,
      enablePromptCache: current.enablePromptCache ?? true,
      contextWindow: {
        ...SEED_SETTINGS.contextWindow,
        ...(current.contextWindow || {}),
        chapterTurnInterval: current.contextWindow?.chapterTurnInterval || 10,
        slidingWindowTurns: current.contextWindow?.slidingWindowTurns || 10,
      },
    };
    return merged;
  }
  await db.settings.put(SEED_SETTINGS);
  return SEED_SETTINGS;
}

export async function saveAppSettings(settings: Partial<AppSettingsRecord>): Promise<AppSettingsRecord> {
  const current = await getAppSettings();
  const updated: AppSettingsRecord = {
    ...current,
    ...settings,
    id: 'default',
    updatedAt: Date.now(),
  };
  await db.settings.put(updated);
  return updated;
}
