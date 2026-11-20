import { CharacterRecord } from '../types/characterCard';
import { PersonaRecord } from '../types/persona';
import { LorebookRecord, LorebookEntryRecord } from '../types/lorebook';
import { AppSettingsRecord } from '../types/settings';

export const SEED_SETTINGS: AppSettingsRecord = {
  id: 'default',
  providers: {
    openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1' },
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
    anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1' },
    gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    groq: { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1' },
    mistral: { apiKey: '', baseUrl: 'https://api.mistral.ai/v1' },
    custom: { apiKey: '', baseUrl: 'http://localhost:11434/v1' },
  },
  primaryModel: {
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-sonnet',
  },
  roleplayProfiles: [],
  summarizerModel: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  },
  summarizerProfiles: [],
  universalSystemPrompt: `You are a master creative writer and unfiltered simulation engine engaging in high-fidelity, immersive collaborative roleplay.
- Write vivid, literature-grade narrative prose with rich sensory atmosphere, micro-expressions, visceral pacing, and emotional nuance.
- Surround physical actions, environmental details, and internal thoughts in asterisks (*action*).
- Surround spoken dialogue in clear quotation marks ("dialogue").
- Never speak or act on behalf of {{user}}. Allow {{user}} to direct their own protagonist actions and decisions.
- React dynamically and organically to {{user}}'s input. Maintain realism, emotional weight, and character consistency at all times.`,
  enablePromptCache: true,
  samplers: {
    temperature: 0.85,
    top_p: 0.95,
    min_p: 0.05,
    top_k: 40,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    repetition_penalty: 1.1,
    max_tokens: 1200,
    min_tokens: 0,
  },
  contextWindow: {
    slidingWindowTurns: 10,
    chapterTurnInterval: 10,
    autoTriggerSummary: true,
    maxTotalTokens: 8192,
  },
  uiTheme: {
    bubbleNarrationStyle: 'distinct',
    streamSpeed: 'fast',
  },
  soundscape: {
    enabled: false,
    volume: 0.4,
    autoSyncAtmosphere: true,
  },
  ambientWeather: {
    enabled: true,
  },
  imageApi: {
    provider: 'cloudflare',
    accountId: '',
    apiToken: '',
    model: '@cf/black-forest-labs/flux-1-schnell',
    enabled: true,
  },
  updatedAt: Date.now(),
};

const CIPHER_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e1136"/><stop offset="100%" stop-color="%230c0517"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23a855f7"/><stop offset="100%" stop-color="%2306b6d4"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g1)"/><circle cx="50" cy="42" r="22" fill="%232e1854" stroke="%23a855f7" stroke-width="2"/><path d="M22 88 C22 66, 36 62, 50 62 C64 62, 78 66, 78 88 Z" fill="%231a0e33" stroke="%237c3aed" stroke-width="2"/><circle cx="50" cy="38" r="8" fill="url(%23g2)"/><path d="M40 40 L60 40" stroke="%2322d3ee" stroke-width="3" stroke-linecap="round"/><circle cx="56" cy="40" r="2.5" fill="%23ffffff"/></svg>`;

const LYRA_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2324083a"/><stop offset="100%" stop-color="%230e021a"/></linearGradient><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23c084fc"/><stop offset="100%" stop-color="%23f43f5e"/></linearGradient></defs><rect width="100" height="100" fill="url(%23lg1)"/><circle cx="50" cy="40" r="20" fill="%233b0764" stroke="%23c084fc" stroke-width="2"/><path d="M24 90 C24 68, 36 64, 50 64 C64 64, 76 68, 76 90 Z" fill="%23200539" stroke="%23c084fc" stroke-width="2"/><path d="M38 38 Q50 30 62 38 Q50 48 38 38 Z" fill="url(%23lg2)"/><circle cx="50" cy="38" r="3" fill="%23ffffff"/></svg>`;

export const SEED_PERSONAS: PersonaRecord[] = [
  {
    id: 'persona-1',
    name: 'Vaelen "Cipher" Cross',
    gender: 'Male / Androgynous',
    avatarUrl: CIPHER_AVATAR,
    physiqueAndApparel: 'Tall, athletic build, matte black stealth trenchcoat with internal biometric dampeners, silver ocular implant in left eye, fingerless carbon-weave gloves.',
    psychologicalTraits: 'Calculating, guarded, dry wit, highly observant, fiercely loyal once trust is earned, allergic to corporate bureaucracy.',
    backgroundLore: 'Former black-ops counter-intelligence runner turned freelance operator in the neon underbelly. Knows too many forbidden encryption keys.',
    lorebookMoveset: 'Neuro-jamming, optical camouflage spike, close-quarters combat with monomolecular trench knife.',
    moves: [
      {
        id: 'move-cipher-1',
        name: 'Optical Camouflage Spike',
        triggers: ['camouflage', 'cloak', 'invisibility', 'stealth'],
        description: 'Bends ambient photon emissions for 12 seconds, turning Vaelen functionally invisible to optical sensors and human sight.',
        enabled: true,
      },
      {
        id: 'move-cipher-2',
        name: 'Neuro-Jamming Spike',
        triggers: ['neuro-jam', 'jam', 'hack', 'cyber'],
        description: 'Emits an intense directed EM/neuro-frequency pulse that disorients targeting sensors and organic nervous systems.',
        enabled: true,
      },
    ],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'persona-2',
    name: 'Lyra Moonwhisper',
    gender: 'Female',
    avatarUrl: LYRA_AVATAR,
    physiqueAndApparel: 'Slender, obsidian velvet robes woven with constellation thread, silver raven talisman around neck, pale silver eyes that shimmer with arcane pressure.',
    psychologicalTraits: 'Scholarly, enigmatic, composed, subtly predatory curiosity towards forbidden artifacts.',
    backgroundLore: 'Heretic archivist exiled from the Grand Spire for reading the sealed codex of forgotten gods.',
    lorebookMoveset: 'Shadow tethering, memory scrying, silent kinetic glyph wards.',
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const SEED_CHARACTERS: CharacterRecord[] = [];
export const SEED_LOREBOOK: LorebookRecord | null = null;
export const SEED_LOREBOOK_ENTRIES: LorebookEntryRecord[] = [];
