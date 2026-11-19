import { buildProviderRequest } from '../providers/sanitizer.js';

export async function handleTestConnection(req, res) {
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

  const start = Date.now();
  try {
    const body = req.body || {};
    const provider = req.headers['x-provider'] || body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || body.apiKey;
    const baseUrl = req.headers['x-base-url'] || body.baseUrl;
    const model = body.model || 'anthropic/claude-3.5-sonnet';

    console.log(`[TestConnection] Pinging: ${provider} -> ${model}`);

    const sanitized = buildProviderRequest({
      provider,
      model,
      messages: [{ role: 'user', content: 'Ping. Reply with "pong" only.' }],
      samplers: { max_tokens: 10, temperature: 0 },
      apiKey,
      baseUrl,
      stream: false,
    });

    const timeoutSignal = AbortSignal.timeout(10000); // 10s ping ceiling

    const upstreamResponse = await fetch(sanitized.url, {
      method: 'POST',
      headers: sanitized.headers,
      body: JSON.stringify(sanitized.body),
      signal: timeoutSignal,
    });

    const latencyMs = Date.now() - start;

    if (!upstreamResponse.ok) {
      let errText = '';
      try {
        errText = await upstreamResponse.text();
      } catch {
        errText = upstreamResponse.statusText;
      }
      return res.json({
        success: false,
        latencyMs,
        error: `Provider HTTP ${upstreamResponse.status}: ${errText.slice(0, 200)}`,
      });
    }

    const json = await upstreamResponse.json();
    let preview = 'pong';

    if (sanitized.isAnthropic) {
      preview = json.content?.[0]?.text?.trim() || preview;
    } else {
      preview = json.choices?.[0]?.message?.content?.trim() || preview;
    }

    return res.json({
      success: true,
      latencyMs,
      model,
      provider,
      preview: preview.slice(0, 50),
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : 'Connection test failed';
    return res.json({
      success: false,
      latencyMs,
      error: errorMsg,
    });
  }
}
