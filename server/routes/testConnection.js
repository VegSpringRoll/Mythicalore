import { buildProviderRequest } from '../providers/sanitizer.js';

export async function handleTestConnection(req, res) {
  const start = Date.now();
  try {
    const provider = req.headers['x-provider'] || req.body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    const baseUrl = req.headers['x-base-url'] || req.body.baseUrl;
    const model = req.body.model || 'anthropic/claude-3.5-sonnet';

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
