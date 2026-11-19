import { ProviderId, SamplerSettings } from '../types/settings';
import { LLMMessage } from '../types/llm';
import { WorldState } from '../types/chat';

export interface TestConnectionResult {
  success: boolean;
  latencyMs?: number;
  model?: string;
  provider?: string;
  preview?: string;
  error?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  context_length?: number;
}

export interface StreamChatCallbacks {
  onChunk: (text: string) => void;
  onDone: (finishReason?: string) => void;
  onError: (error: string) => void;
}

const PROVIDER_DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  custom: 'http://localhost:11434/v1',
};

/**
 * Fetches available models from the proxy or directly from the provider.
 */
export async function fetchProviderModels(
  provider: ProviderId,
  apiKey?: string,
  baseUrl?: string
): Promise<ModelOption[]> {
  // 1. Try Proxy first
  try {
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': provider,
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(baseUrl ? { 'x-base-url': baseUrl } : {}),
      },
      body: JSON.stringify({ provider, apiKey, baseUrl }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        return data.models;
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    if (err && err.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('[fetchProviderModels] Proxy offline or error, falling back to direct browser fetch.', err);
  }

  // 2. Direct browser fetch fallback
  const effectiveBase = (baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS[provider]).replace(/\/+$/, '');

  if (provider === 'openrouter') {
    const res = await fetch(`${effectiveBase}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((m: { id: string; name?: string; context_length?: number }) => ({
      id: m.id,
      name: m.name || m.id,
      context_length: m.context_length,
    }));
  }

  if (provider === 'openai' || provider === 'groq' || provider === 'mistral') {
    const res = await fetch(`${effectiveBase}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`${provider} HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }));
  }

  if (provider === 'anthropic') {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest / Best)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultra Fast)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Deep Reasoning)' },
    ];
  }

  if (provider === 'gemini') {
    return [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Fast / Cheap)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep 2M Context)' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
    ];
  }

  if (provider === 'custom') {
    try {
      const res = await fetch(`${effectiveBase}/models`);
      if (res.ok) {
        const data = await res.json();
        return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }));
      }
    } catch {}
    return [
      { id: 'llama3.2', name: 'llama3.2' },
      { id: 'llama3.1:8b', name: 'llama3.1:8b' },
    ];
  }

  return [];
}

/**
 * Tests connection latency and validates credentials.
 */
export async function testConnection(
  provider: ProviderId,
  model: string,
  apiKey?: string,
  baseUrl?: string
): Promise<TestConnectionResult> {
  const start = Date.now();

  // 1. Try proxy
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': provider,
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(baseUrl ? { 'x-base-url': baseUrl } : {}),
      },
      body: JSON.stringify({ model, provider, apiKey, baseUrl }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        return { success: false, latencyMs: Date.now() - start, error: errJson.error };
      }
    }
  } catch {
    console.warn('[testConnection] Proxy offline, testing direct connection from browser.');
  }

  // 2. Direct browser test ping fallback
  try {
    const effectiveBase = (baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS[provider]).replace(/\/+$/, '');
    
    if (provider === 'anthropic') {
      const res = await fetch(`${effectiveBase}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10,
        }),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const err = await res.text();
        return { success: false, latencyMs, error: `Anthropic HTTP ${res.status}: ${err.slice(0, 150)}` };
      }
      return { success: true, latencyMs, model, provider, preview: 'pong' };
    }

    const endpoint = effectiveBase.endsWith('/chat/completions') ? effectiveBase : `${effectiveBase}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 10,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const err = await res.text();
      return { success: false, latencyMs, error: `${provider} HTTP ${res.status}: ${err.slice(0, 150)}` };
    }
    return { success: true, latencyMs, model, provider, preview: 'pong' };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/**
 * Direct browser streaming fallback if backend proxy is offline.
 */
async function streamDirectFromBrowser(
  params: {
    provider: ProviderId;
    model: string;
    messages: LLMMessage[];
    samplers: SamplerSettings;
    apiKey?: string;
    baseUrl?: string;
  },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { provider, model, messages, samplers, apiKey, baseUrl } = params;
  const effectiveBase = (baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS[provider]).replace(/\/+$/, '');

  if (provider === 'anthropic') {
    const res = await fetch(`${effectiveBase}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        model,
        messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        system: messages.find((m) => m.role === 'system')?.content || undefined,
        max_tokens: samplers.max_tokens || 1024,
        temperature: samplers.temperature ?? 0.8,
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      callbacks.onError(`Anthropic HTTP ${res.status}: ${err.slice(0, 200)}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.text) {
              callbacks.onChunk(ev.delta.text);
            }
          } catch {}
        }
      }
    }
    callbacks.onDone();
    return;
  }

  // OpenAI-compatible direct streaming (OpenRouter, Groq, Mistral, OpenAI, Gemini, Ollama)
  const endpoint = effectiveBase.endsWith('/chat/completions') ? effectiveBase : `${effectiveBase}/chat/completions`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://aetheria.roleplay', 'X-Title': 'Aetheria' } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: samplers.temperature ?? 0.85,
      max_tokens: samplers.max_tokens || 1024,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    callbacks.onError(`${provider} HTTP ${res.status}: ${err.slice(0, 200)}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('data: ')) {
        const raw = t.slice(6).trim();
        if (raw === '[DONE]') {
          callbacks.onDone();
          return;
        }
        try {
          const ev = JSON.parse(raw);
          const chunkText = ev.choices?.[0]?.delta?.content;
          if (typeof chunkText === 'string') {
            callbacks.onChunk(chunkText);
          }
        } catch {}
      }
    }
  }
  callbacks.onDone();
}

/**
 * Universal Streaming Chat Completion with Dual-Mode Architecture:
 * Proxies through /api/chat/stream, and automatically falls back to direct browser fetch if proxy is offline.
 */
export async function streamChatCompletion(
  params: {
    provider: ProviderId;
    model: string;
    messages: LLMMessage[];
    samplers: SamplerSettings;
    apiKey?: string;
    baseUrl?: string;
    promptCache?: boolean;
  },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { provider, model, messages, samplers, apiKey, baseUrl, promptCache = true } = params;

  let streamHasError = false;

  // 1. Try backend proxy
  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': provider,
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...(baseUrl ? { 'x-base-url': baseUrl } : {}),
      },
      body: JSON.stringify({
        provider,
        model,
        messages,
        samplers,
        apiKey,
        baseUrl,
        promptCache,
      }),
      signal,
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'chunk' && event.text) {
              callbacks.onChunk(event.text);
            } else if (event.type === 'done') {
              if (!streamHasError) {
                callbacks.onDone(event.finishReason);
              }
            } else if (event.type === 'error') {
              streamHasError = true;
              callbacks.onError(event.error || 'Provider generation error');
              return;
            }
          } catch {}
        }
      }

      if (!streamHasError) {
        callbacks.onDone();
      }
      return;
    } else if (!res.ok) {
      let errorText = '';
      try {
        const errJson = await res.json();
        errorText = errJson.error || JSON.stringify(errJson);
      } catch {
        errorText = await res.text().catch(() => '');
      }
      callbacks.onError(`Proxy Error: ${errorText || `HTTP ${res.status}`}`);
      return;
    }
  } catch (err) {
    if (signal?.aborted) {
      callbacks.onDone('aborted');
      return;
    }
    console.warn('[streamChatCompletion] Proxy stream connection failed, attempting direct browser streaming fallback...');
  }

  // 2. Direct browser streaming fallback
  try {
    await streamDirectFromBrowser(params, callbacks, signal);
  } catch (err: unknown) {
    if (signal?.aborted) {
      callbacks.onDone('aborted');
      return;
    }
    callbacks.onError(err instanceof Error ? err.message : 'Streaming request failed');
  }
}

export async function requestBackgroundSummary(params: {
  provider: ProviderId;
  model: string;
  existingSummary: string;
  turnsToSummarize: string;
  characterName: string;
  personaName: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': params.provider,
        ...(params.apiKey ? { 'x-api-key': params.apiKey } : {}),
        ...(params.baseUrl ? { 'x-base-url': params.baseUrl } : {}),
      },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const json = await res.json();
      return json.summary || '';
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    console.warn('[requestBackgroundSummary] Proxy error:', err);
    throw err;
  }
  return '';
}

export async function requestAiWorldStateUpdate(params: {
  provider: ProviderId;
  model: string;
  currentWorldState: WorldState;
  recentTurns: string;
  characterName: string;
  personaName: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<WorldState> {
  const res = await fetch('/api/world-state/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-provider': params.provider,
      ...(params.apiKey ? { 'x-api-key': params.apiKey } : {}),
      ...(params.baseUrl ? { 'x-base-url': params.baseUrl } : {}),
    },
    body: JSON.stringify({
      provider: params.provider,
      model: params.model,
      currentWeatherState: params.currentWorldState,
      recentTurns: params.recentTurns,
      characterName: params.characterName,
      personaName: params.personaName,
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`World state update failed: ${err}`);
  }

  const data = await res.json();
  if (data.worldState) {
    return data.worldState;
  }
  throw new Error('No world state returned by model');
}
