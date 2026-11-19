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

export async function handleSummarize(req, res) {
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
    const provider = req.headers['x-provider'] || body.provider || 'groq';
    const apiKey = req.headers['x-api-key'] || body.apiKey;
    const baseUrl = req.headers['x-base-url'] || body.baseUrl;
    const model = body.model || 'llama-3.3-70b-versatile';

    const { existingSummary, turnsToSummarize, characterName = 'Character', personaName = 'User' } = body;

    if (!turnsToSummarize || turnsToSummarize.trim().length === 0) {
      return res.status(400).json({ error: 'No dialogue turns provided to summarize.' });
    }

    const systemPrompt = `You are a meticulous narrative archivist and summarizer for an ongoing roleplay chronicle.
Your mission is to digest ONLY the provided roleplay turns into a self-contained, atmospheric chapter summary.
- Highlight major plot shifts, key character revelations, location changes, physical status, and relational tension that occurred in THESE specific turns between ${characterName} and ${personaName}.
- Keep the summary literature-grade, objective, and dense with narrative facts.
- Do NOT re-summarize past chapters. Focus strictly on what happened in these turns.
- Format your response EXACTLY as:
TITLE: <Vivid Chapter Title, 3-6 words>
SUMMARY: <Cohesive, literature-grade third-person narrative chronicle of these turns in 2-3 dense paragraphs>
- Do NOT include conversational filler, greetings, or meta-chatter.`;

    const userPrompt = existingSummary 
      ? `PRIOR STORY CONTEXT (FOR BACKGROUND REFERENCE ONLY — DO NOT RE-SUMMARIZE THESE PREVIOUS CHAPTERS):\n${existingSummary}\n\nTURNS TO SUMMARIZE FOR THIS NEW CHAPTER:\n${turnsToSummarize}\n\nSynthesize the self-contained summary for this new chapter:`
      : `TURNS TO SUMMARIZE FOR THIS NEW CHAPTER:\n${turnsToSummarize}\n\nSynthesize the self-contained summary for this new chapter:`;

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
      console.warn(`[Summarize Route] Upstream returned ${upstreamResponse.status}:`, errText.slice(0, 200));
      return res.status(upstreamResponse.status).json({ error: `Summarizer HTTP ${upstreamResponse.status}: ${errText.slice(0, 200)}` });
    }

    const json = await upstreamResponse.json();
    let text = '';
    if (sanitized.isAnthropic) {
      text = json.content?.[0]?.text?.trim() || '';
    } else {
      const choiceMsg = json.choices?.[0]?.message;
      if (typeof choiceMsg?.content === 'string') {
        text = choiceMsg.content.trim();
      } else if (Array.isArray(choiceMsg?.content)) {
        text = choiceMsg.content.map((c) => c.text || '').join('').trim();
      } else if (choiceMsg?.reasoning_content && !choiceMsg?.content) {
        text = choiceMsg.reasoning_content.trim();
      }
    }

    return res.json({ summary: text });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Summarization failed';
    console.error('[Summarize Route Error]:', errorMsg);
    return res.status(500).json({ error: errorMsg });
  }
}
