import { buildProviderRequest } from '../providers/sanitizer.js';

export async function handleUpdateWorldState(req, res) {
  try {
    const provider = req.headers['x-provider'] || req.body.provider || 'openrouter';
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    const baseUrl = req.headers['x-base-url'] || req.body.baseUrl;
    const model = req.body.model || 'anthropic/claude-3.5-sonnet';
    const { currentWeatherState, recentTurns, characterName, personaName } = req.body;

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
