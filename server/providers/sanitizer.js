export const PROVIDER_CAPABILITIES = {
  openrouter: {
    supportsMinP: true,
    supportsTopK: true,
    supportsRepetitionPenalty: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  openai: {
    supportsMinP: false,
    supportsTopK: false,
    supportsRepetitionPenalty: false,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    supportsMinP: false,
    supportsTopK: true,
    supportsRepetitionPenalty: false,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    supportsSystemRoleInMessages: false, // system must be top-level field
    supportsStreaming: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  gemini: {
    supportsMinP: false,
    supportsTopK: true,
    supportsRepetitionPenalty: false,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  groq: {
    supportsMinP: false,
    supportsTopK: false,
    supportsRepetitionPenalty: false,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  mistral: {
    supportsMinP: false,
    supportsTopK: false,
    supportsRepetitionPenalty: false,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  custom: {
    supportsMinP: true,
    supportsTopK: true,
    supportsRepetitionPenalty: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    supportsSystemRoleInMessages: true,
    supportsStreaming: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
};

/**
 * Sanitizes parameters according to provider capability whitelist.
 */
export function buildProviderRequest(config) {
  const { provider, model, messages, samplers = {}, apiKey, baseUrl, stream = true } = config;
  const capabilities = PROVIDER_CAPABILITIES[provider] || PROVIDER_CAPABILITIES.custom;

  const effectiveBaseUrl = (baseUrl && baseUrl.trim().length > 0)
    ? baseUrl.trim().replace(/\/+$/, '')
    : capabilities.defaultBaseUrl;

  const processedMessages = [...(messages || [])];
  if (samplers.min_tokens && samplers.min_tokens > 0) {
    const minTokenDirective = `\n\n[DIRECTOR INSTRUCTION: Generate an expansive, descriptive, multi-paragraph response of at least ${samplers.min_tokens} tokens. Detail micro-expressions, atmosphere, internal pacing, and sensory depth.]`;
    const sysIndex = processedMessages.findIndex((m) => m.role === 'system');
    if (sysIndex >= 0) {
      processedMessages[sysIndex] = {
        role: 'system',
        content: processedMessages[sysIndex].content + minTokenDirective,
      };
    } else {
      processedMessages.unshift({
        role: 'system',
        content: minTokenDirective.trim(),
      });
    }
  }

  // 1. ANTHROPIC Messages API
  if (provider === 'anthropic') {
    const url = `${effectiveBaseUrl}/messages`;
    const systemParts = [];
    const conversationTurns = [];

    for (const msg of processedMessages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        conversationTurns.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    if (conversationTurns.length === 0) {
      conversationTurns.push({ role: 'user', content: 'Begin roleplay.' });
    }

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const body = {
      model,
      messages: conversationTurns,
      max_tokens: samplers.max_tokens || 1024,
      stream,
    };

    if (systemParts.length > 0) {
      if (config.promptCache) {
        body.system = [
          {
            type: 'text',
            text: systemParts.join('\n\n'),
            cache_control: { type: 'ephemeral' },
          },
        ];
      } else {
        body.system = systemParts.join('\n\n');
      }
    }

    if (typeof samplers.temperature === 'number') {
      body.temperature = Math.max(0, Math.min(1.0, samplers.temperature));
    }
    if (typeof samplers.top_p === 'number') {
      body.top_p = Math.max(0, Math.min(1.0, samplers.top_p));
    }
    if (capabilities.supportsTopK && typeof samplers.top_k === 'number' && samplers.top_k > 0) {
      body.top_k = samplers.top_k;
    }

    return { url, headers, body, isAnthropic: true };
  }

  // 2. OPENAI-COMPATIBLE API (OpenRouter, OpenAI, Groq, Mistral, Gemini, Ollama)
  let cleanBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');
  if (provider === 'gemini') {
    if (!cleanBaseUrl.includes('/openai')) {
      cleanBaseUrl = `${cleanBaseUrl}/openai`;
    }
  }

  let endpointPath = '/chat/completions';
  if (cleanBaseUrl.endsWith('/chat/completions')) {
    endpointPath = '';
  }

  let url = `${cleanBaseUrl}${endpointPath}`;

  // For Gemini, pass key both as Bearer header and query param to guarantee acceptance by Google
  if (provider === 'gemini' && apiKey) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}key=${encodeURIComponent(apiKey)}`;
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://aetheria.roleplay';
    headers['X-Title'] = 'Aetheria Universal Roleplay Engine';
    if (config.promptCache) {
      headers['X-OpenRouter-Prompt-Cache'] = 'true';
    }
  }

  const body = {
    model,
    messages: processedMessages,
    stream,
  };

  if (typeof samplers.temperature === 'number') {
    body.temperature = samplers.temperature;
  }
  if (typeof samplers.top_p === 'number') {
    body.top_p = samplers.top_p;
  }
  if (typeof samplers.max_tokens === 'number' && samplers.max_tokens > 0) {
    body.max_tokens = samplers.max_tokens;
  }
  if (capabilities.supportsMinP && typeof samplers.min_p === 'number' && samplers.min_p > 0) {
    body.min_p = samplers.min_p;
  }
  if (capabilities.supportsTopK && typeof samplers.top_k === 'number' && samplers.top_k > 0) {
    body.top_k = samplers.top_k;
  }
  if (capabilities.supportsFrequencyPenalty && typeof samplers.frequency_penalty === 'number') {
    body.frequency_penalty = samplers.frequency_penalty;
  }
  if (capabilities.supportsPresencePenalty && typeof samplers.presence_penalty === 'number') {
    body.presence_penalty = samplers.presence_penalty;
  }
  if (capabilities.supportsRepetitionPenalty && typeof samplers.repetition_penalty === 'number' && samplers.repetition_penalty !== 1.0) {
    body.repetition_penalty = samplers.repetition_penalty;
  }

  return { url, headers, body, isAnthropic: false };
}
