import { buildProviderRequest } from '../providers/sanitizer.js';

export async function handleSummarize(req, res) {
  try {
    const provider = req.headers['x-provider'] || req.body.provider || 'groq';
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    const baseUrl = req.headers['x-base-url'] || req.body.baseUrl;
    const model = req.body.model || 'llama-3.3-70b-versatile';

    const { existingSummary, turnsToSummarize, characterName, personaName } = req.body;

    const systemPrompt = `You are a meticulous narrative archivist and summarizer for an ongoing roleplay chronicle.
Your mission is to digest recent roleplay turns between ${characterName} and ${personaName} into a cohesive, atmospheric summary.
- Highlight major plot shifts, key character revelations, location changes, physical status, and relational tension.
- Keep the summary literature-grade, objective, and dense with narrative facts.
- Do NOT include conversational filler, meta-chatter, or preambles. Output the updated summary only.`;

    const userPrompt = existingSummary 
      ? `PREVIOUS CHRONICLE SUMMARY:\n${existingSummary}\n\nNEW RECENT TURNS TO INCORPORATE:\n${turnsToSummarize}\n\nSynthesize the updated narrative summary:`
      : `RECENT TURNS TO SUMMARIZE:\n${turnsToSummarize}\n\nSynthesize the cohesive narrative summary:`;

    const sanitized = buildProviderRequest({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      samplers: {
        max_tokens: 800,
        temperature: 0.3,
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
      return res.status(upstreamResponse.status).json({ error: `Summarizer HTTP ${upstreamResponse.status}: ${errText.slice(0, 200)}` });
    }

    const json = await upstreamResponse.json();
    let text = '';
    if (sanitized.isAnthropic) {
      text = json.content?.[0]?.text?.trim() || '';
    } else {
      text = json.choices?.[0]?.message?.content?.trim() || '';
    }

    return res.json({ summary: text });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Summarization failed';
    return res.status(500).json({ error: errorMsg });
  }
}
