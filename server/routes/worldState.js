import { buildProviderRequest } from '../providers/sanitizer.js';

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (req.readable) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf-8');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function handleUpdateWorldState(req, res) {
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
    const body = await parseBody(req);
    const provider = req.headers['x-provider'] || body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || body.apiKey;
    const baseUrl = req.headers['x-base-url'] || body.baseUrl;
    const model = body.model || 'anthropic/claude-3.5-sonnet';
    const { currentWeatherState, recentTurns, characterName, personaName } = body;

    const systemPrompt = `You are an automated game master and world state tracker for a narrative roleplay simulation.
Analyze the latest roleplay dialogue turns and determine if the in-game Time, Location, Atmosphere/Weather, or Stakes have shifted.

Current World State:
- Time: ${currentWeatherState?.time || 'Unknown'}
- Date: ${currentWeatherState?.date || 'Unknown'}
- Location: ${currentWeatherState?.location || 'Unknown'}
- Atmosphere: ${currentWeatherState?.atmosphere || 'Unknown'}
- Stakes/Notes: ${currentWeatherState?.notes || 'None'}

Return ONLY a valid JSON object in this exact format (no markdown, no backticks):
{
  "time": "<Updated in-game time, e.g. '1:30 AM (Night)' or unchanged>",
  "date": "<Updated in-game date/era or unchanged>",
  "location": "<Exact current location/room of the characters>",
  "atmosphere": "<Updated sensory details, lighting, weather, sounds>",
  "notes": "<Immediate tension, stakes, or active goal>"
}`;

    const userPrompt = `CHARACTERS: ${characterName} and ${personaName}
RECENT TURNS:
${recentTurns}

Output the updated JSON world state:`;

    const sanitized = buildProviderRequest({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      samplers: {
        max_tokens: 400,
        temperature: 0.2,
      },
      apiKey,
      baseUrl,
      stream: false,
    });

    const upstreamResponse = await fetch(sanitized.url, {
      method: 'POST',
      headers: sanitized.headers,
      body: JSON.stringify(sanitized.body),
    });

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return res.status(upstreamResponse.status).json({ error: `AI World State failed: ${errText.slice(0, 200)}` });
    }

    const json = await upstreamResponse.json();
    let text = '';
    if (sanitized.isAnthropic) {
      text = json.content?.[0]?.text?.trim() || '';
    } else {
      text = json.choices?.[0]?.message?.content?.trim() || '';
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedState = JSON.parse(jsonMatch[0]);
      return res.json({
        success: true,
        worldState: parsedState,
      });
    }

    return res.status(422).json({ error: 'Failed to extract JSON world state from model output' });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update world state';
    return res.status(500).json({ error: errorMsg });
  }
}
