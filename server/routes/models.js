export async function handleFetchModels(req, res) {
  // Ensure CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-provider, x-base-url');

  if (req.method === 'OPTIONS') {
    return res.status ? res.status(200).end() : res.writeHead(200).end();
  }

  if (!res.status) {
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function (data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }

  try {
    const body = req.body || {};
    const provider = req.headers['x-provider'] || body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || body.apiKey;
    const baseUrl = req.headers['x-base-url'] || body.baseUrl;

    console.log(`[Models] Fetching models for provider: ${provider}`);

    // 1. OPENROUTER
    if (provider === 'openrouter') {
      const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/models` : 'https://openrouter.ai/api/v1/models';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: `OpenRouter returned ${upstream.status}: ${err.slice(0, 200)}` });
      }

      const data = await upstream.json();
      const models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        context_length: m.context_length,
      }));

      return res.json({ models });
    }

    // 2. OPENAI DIRECT
    if (provider === 'openai') {
      const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/models` : 'https://api.openai.com/v1/models';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: `OpenAI returned ${upstream.status}: ${err.slice(0, 200)}` });
      }

      const data = await upstream.json();
      const chatModels = (data.data || [])
        .filter((m) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('chat'))
        .map((m) => ({ id: m.id, name: m.id }));

      return res.json({ models: chatModels });
    }

    // 3. GROQ
    if (provider === 'groq') {
      const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/models` : 'https://api.groq.com/openai/v1/models';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: `Groq returned ${upstream.status}: ${err.slice(0, 200)}` });
      }

      const data = await upstream.json();
      const models = (data.data || []).map((m) => ({ id: m.id, name: m.id }));
      return res.json({ models });
    }

    // 4. MISTRAL
    if (provider === 'mistral') {
      const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/models` : 'https://api.mistral.ai/v1/models';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: `Mistral returned ${upstream.status}: ${err.slice(0, 200)}` });
      }

      const data = await upstream.json();
      const models = (data.data || []).map((m) => ({ id: m.id, name: m.id }));
      return res.json({ models });
    }

    // 5. LOCAL / CUSTOM (Ollama / vLLM / llama.cpp)
    if (provider === 'custom') {
      const base = baseUrl ? baseUrl.replace(/\/+$/, '') : 'http://localhost:11434/v1';
      const url = `${base}/models`;
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      try {
        const upstream = await fetch(url, { headers });
        if (upstream.ok) {
          const data = await upstream.json();
          const models = (data.data || []).map((m) => ({ id: m.id, name: m.id }));
          if (models.length > 0) return res.json({ models });
        }
      } catch {
        // Fallback to Ollama native /api/tags if /v1/models was not found
        try {
          const ollamaUrl = base.replace(/\/v1$/, '') + '/api/tags';
          const oUpstream = await fetch(ollamaUrl);
          if (oUpstream.ok) {
            const oData = await oUpstream.json();
            const models = (oData.models || []).map((m) => ({ id: m.name, name: m.name }));
            if (models.length > 0) return res.json({ models });
          }
        } catch {}
      }

      return res.json({
        models: [
          { id: 'llama3.2', name: 'llama3.2' },
          { id: 'llama3.1:8b', name: 'llama3.1:8b' },
          { id: 'mistral-nemo', name: 'mistral-nemo' },
        ],
      });
    }

    // 6. ANTHROPIC (Curated List)
    if (provider === 'anthropic') {
      return res.json({
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest / Best)' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast / Low Cost)' },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Deep Reasoning)' },
        ],
      });
    }

    // 7. GEMINI
    if (provider === 'gemini') {
      return res.json({
        models: [
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Fast / Cheap)' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep 2M Context)' },
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
        ],
      });
    }

    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch models';
    console.error('[Models Error]:', errorMsg);
    return res.status(500).json({ error: errorMsg });
  }
}
