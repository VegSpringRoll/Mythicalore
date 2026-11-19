import { ProviderId, SamplerSettings } from './settings';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatRequest {
  provider: ProviderId;
  model: string;
  messages: LLMMessage[];
  samplers: SamplerSettings;
  apiKey?: string;
  baseUrl?: string;
}

export interface StreamChunkEvent {
  type: 'chunk' | 'done' | 'error' | 'meta';
  text?: string;
  error?: string;
  tokens?: number;
  finishReason?: string;
  latencyMs?: number;
}

export interface PromptInspectionData {
  systemPrompt: string;
  directorRules: string[];
  pinnedMemories: string[];
  rollingSummary: string;
  activeWindowMessages: LLMMessage[];
  triggeredLore: Array<{
    name: string;
    keys: string[];
    content: string;
  }>;
  totalTokensEstimated: number;
  rawPayload: Record<string, unknown>;
}
