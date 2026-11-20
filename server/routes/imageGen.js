export async function handleGenerateImage(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-account-id, x-api-token');

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
    const accountId = body.accountId || req.headers['x-account-id'];
    const apiToken = body.apiToken || req.headers['x-api-token'];
    const model = body.model || '@cf/black-forest-labs/flux-1-schnell';
    const prompt = body.prompt;

    if (!accountId || !apiToken) {
      return res.status(400).json({ error: 'Cloudflare Account ID and API Token are required. Please configure Image API in the left panel.' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Image prompt is required.' });
    }

    console.log(`[ImageGen] Requesting Cloudflare Workers AI image for model: ${model}`);

    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const cfResponse = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });

    if (!cfResponse.ok) {
      let errText = '';
      try {
        errText = await cfResponse.text();
      } catch {
        errText = cfResponse.statusText;
      }
      console.warn(`[ImageGen Error] Cloudflare HTTP ${cfResponse.status}:`, errText);
      return res.status(cfResponse.status).json({
        error: `Cloudflare HTTP ${cfResponse.status}: ${errText.slice(0, 300)}`
      });
    }

    const contentType = cfResponse.headers.get('content-type') || 'image/jpeg';
    if (contentType.includes('application/json')) {
      const json = await cfResponse.json();
      if (json.result && json.result.image) {
        return res.json({ image: `data:image/jpeg;base64,${json.result.image}` });
      }
      return res.json(json);
    }

    const arrayBuffer = await cfResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return res.json({ image: dataUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ImageGen Exception]:', msg);
    return res.status(500).json({ error: msg });
  }
}
