export type ProviderId = 
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'mistral'
  | 'custom';

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SamplerSettings {
  temperature: number; // 0.0 to 2.0
  top_p: number; // 0.0 to 1.0
  min_p: number; // 0.0 to 1.0
  top_k: number; // 0 to 100
  frequency_penalty: number; // -2.0 to 2.0
  presence_penalty: number; // -2.0 to 2.0
  repetition_penalty: number; // 1.0 to 2.0
  max_tokens: number; // Ceiling on generation
  min_tokens: number; // Minimum tokens
}

export interface RoleplayProfile {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
  createdAt: number;
}

export interface SummarizerProfile {
  id: string;
  name: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
  createdAt: number;
}

export interface ImageApiProfile {
  id: string;
  name: string;
  provider: 'cloudflare';
  accountId: string;
  apiToken: string;
  model: string;
  createdAt: number;
}

export interface ImageApiConfig {
  provider: 'cloudflare';
  accountId: string;
  apiToken: string;
  model: string;
  enabled: boolean;
  activeProfileId?: string;
  profiles?: ImageApiProfile[];
}

export interface AppSettingsRecord {
  id: string; // 'default'
  providers: Record<ProviderId, ProviderConfig>;
  
  // Roleplay Model (BYOK profiles saved by user)
  primaryModel: {
    provider: ProviderId;
    model: string;
    customUrl?: string;
    profileId?: string;
  };
  roleplayProfiles: RoleplayProfile[];

  // Dedicated Background Summarizer Model (BYOK profiles saved by user)
  summarizerModel: {
    provider: ProviderId;
    model: string;
    customUrl?: string;
    profileId?: string;
  };
  summarizerProfiles: SummarizerProfile[];

  // Universal System Prompt & Prompt Caching
  universalSystemPrompt: string;
  enablePromptCache: boolean;

  // Samplers & Context Window Limits
  samplers: SamplerSettings;
  contextWindow: {
    slidingWindowTurns: number; // default: 10 user turns
    chapterTurnInterval: number; // default: 10 turns per chapter
    autoTriggerSummary: boolean; // default: true
    maxTotalTokens: number;
  };

  uiTheme: {
    bubbleNarrationStyle: 'italic' | 'quote' | 'distinct';
    streamSpeed: 'fast' | 'natural' | 'instant';
  };

  soundscape: {
    enabled: boolean;
    volume: number; // 0.0 - 1.0
    autoSyncAtmosphere: boolean;
  };

  ambientWeather: {
    enabled: boolean;
  };

  imageApi?: ImageApiConfig;

  updatedAt: number;
}
