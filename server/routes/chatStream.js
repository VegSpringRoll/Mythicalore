import { buildProviderRequest } from '../providers/sanitizer.js';

export async function handleChatStream(req, res) {
  // Set CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-provider, x-base-url');

  if (req.method === 'OPTIONS') {
    return res.status ? res.status(200).end() : res.writeHead(200).end();
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientAbort = new AbortController();
  req.on('close', () => {
    clientAbort.abort();
  });

  try {
    const body = req.body || {};
    const provider = req.headers['x-provider'] || body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || body.apiKey;
    const baseUrl = req.headers['x-base-url'] || body.baseUrl;
    const model = body.model;
    const messages = body.messages || [];
    const samplers = body.samplers || {};
    const promptCache = body.promptCache ?? true;

    console.log(`[Stream] Received request: ${provider} -> ${model} (${messages.length} messages)`);

    if (!model) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No model specified' })}\n\n`);
      return res.end();
    }

    const sanitized = buildProviderRequest({
      provider,
      model,
      messages,
      samplers,
      apiKey,
      baseUrl,
      stream: true,
      promptCache,
    });

    const upstreamResponse = await fetch(sanitized.url, {
      method: 'POST',
      headers: sanitized.headers,
      body: JSON.stringify(sanitized.body),
      signal: clientAbort.signal,
    });

    if (!upstreamResponse.ok) {
      let errBody = '';
      try {
        errBody = await upstreamResponse.text();
      } catch {
        errBody = upstreamResponse.statusText;
      }
      console.error(`[Stream Error] ${provider} HTTP ${upstreamResponse.status}:`, errBody.slice(0, 300));
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: `Provider HTTP ${upstreamResponse.status}: ${errBody.slice(0, 400)}` 
      })}\n\n`);
      return res.end();
    }

    if (!upstreamResponse.body) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Upstream body is empty' })}\n\n`);
      return res.end();
    }

    // Stream decoder
    const reader = upstreamResponse.body.getReader();
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
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const rawData = trimmed.slice(6).trim();
          if (rawData === '[DONE]') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            continue;
          }

          try {
            const parsed = JSON.parse(rawData);

            // Anthropic Messages API format
            if (sanitized.isAnthropic) {
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'chunk', 
                  text: parsed.delta.text 
                })}\n\n`);
              } else if (parsed.type === 'message_stop') {
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              }
            } 
            // OpenAI-compatible format
            else {
              const deltaText = parsed.choices?.[0]?.delta?.content;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              if (typeof deltaText === 'string') {
                res.write(`data: ${JSON.stringify({ 
                  type: 'chunk', 
                  text: deltaText 
                })}\n\n`);
              }

              if (finishReason) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'done', 
                  finishReason 
                })}\n\n`);
              }
            }
          } catch {
            // Buffer chunk split across boundaries
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    if (clientAbort.signal.aborted) {
      return res.end();
    }
    const errorMsg = err instanceof Error ? err.message : 'Streaming failed';
    console.error('[Stream Catch Error]:', errorMsg);
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
    res.end();
  }
}
