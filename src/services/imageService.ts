import { db } from '../db';
import { CharacterRecord } from '../types/characterCard';
import { ChatMessageRecord } from '../types/chat';
import { AppSettingsRecord } from '../types/settings';
import { streamChatCompletion } from './llmClient';

/**
 * Synthesizes a refined 2-sentence text-to-image prompt using the configured Summarizer Model.
 * Reads character physical appearance & attire from the character card, plus current message context.
 * Strictly converts any NSFW elements into SFW artistic compositions.
 */
export async function synthesizeImagePrompt(params: {
  messageContent: string;
  character: CharacterRecord;
  settings: AppSettingsRecord;
}): Promise<string> {
  const { messageContent, character, settings } = params;

  const activeProfile = settings.summarizerProfiles?.find(
    (p) => p.id === settings.summarizerModel?.profileId
  ) || (settings.summarizerProfiles?.length > 0 ? settings.summarizerProfiles[0] : null);

  const apiKey = activeProfile?.apiKey?.trim() || 
    (activeProfile ? settings.providers[activeProfile.provider]?.apiKey?.trim() : undefined);

  if (!activeProfile || !activeProfile.model || (!apiKey && activeProfile.provider !== 'custom')) {
    throw new Error('Please connect your Summarizer Model in Settings > Summary Model to generate scene illustrations.');
  }

  // Extract character visual traits from description, personality, and tags
  const charData = character.data;
  const visualDetails = [
    charData?.description ? `Visual Appearance & Attire: ${charData.description}` : '',
    charData?.personality ? `Personality/Expression: ${charData.personality}` : '',
  ].filter(Boolean).join('\n') || `Character: ${character.name}`;

  const systemPrompt = `You are an expert cinematic art director and visual prompt engineer for high-end diffusion models (FLUX.1 Schnell and Stable Diffusion XL).
Your task is to analyze the character's visual appearance and the current roleplay message, then synthesize a refined, vivid text-to-image generation prompt of EXACTLY 2 sentences.

CRITICAL DIRECTIVES:
1. Depict ${character.name} accurately according to their visual profile (face, eyes, hair color/style, clothing, attire, posture, distinguishing features).
2. Detail the immediate action, emotional expression, environment, lighting (e.g. volumetric lighting, cinematic photography, dramatic shadows), and visual mood from the message.
3. Length: Exactly 2 sentences. Dense, concrete, and visually descriptive.
4. STRICT SFW RULE: If the scene contains explicit adult, sexual, or nude content, convert it into an elegant, tasteful, cinematic SFW artistic composition.
5. FORMAT: Output ONLY the 2-sentence visual prompt. Never include quotes, markdown headers, prefixes like "Prompt:", or narrative commentary.`;

  const userPrompt = `[CHARACTER VISUAL PROFILE]
Name: ${character.name}
${visualDetails.slice(0, 1000)}

[CURRENT SCENE CONTEXT]
${messageContent.slice(0, 1200)}

Synthesize the 2-sentence visual image prompt:`;

  let accumulated = '';
  await new Promise<void>((resolve, reject) => {
    streamChatCompletion(
      {
        provider: activeProfile.provider,
        model: activeProfile.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        samplers: {
          ...settings.samplers,
          max_tokens: 150, // Strict limit ensures only 2 sentences, preventing narrative summary output
          temperature: 0.6,
        },
        apiKey,
        baseUrl: activeProfile.baseUrl || settings.summarizerModel.customUrl,
      },
      {
        onChunk: (chunk) => {
          accumulated += chunk;
        },
        onDone: () => resolve(),
        onError: (err) => reject(new Error(err)),
      }
    );
  });

  let cleaned = accumulated.trim();
  // Strip any accidental markdown quotes, preambles, or prefixes
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/^(Prompt|Image Prompt|Here is the prompt):\s*/i, '').trim();

  return cleaned || `Cinematic digital painting of ${character.name}, detailed character portrait, dramatic atmospheric lighting, 8k resolution.`;
}

/**
 * Dispatches an image generation request to Cloudflare Workers AI.
 * Supports active saved profiles or top-level imageApi credentials.
 */
export async function generateCloudflareImage(params: {
  prompt: string;
  settings: AppSettingsRecord;
}): Promise<string> {
  const { prompt, settings } = params;
  const imgConfig = settings.imageApi;

  // Resolve from active profile if available, otherwise fallback to top-level
  const activeProfile = imgConfig?.profiles?.find((p) => p.id === imgConfig.activeProfileId)
    || imgConfig?.profiles?.[0];

  const accountId = activeProfile?.accountId?.trim() || imgConfig?.accountId?.trim();
  const apiToken = activeProfile?.apiToken?.trim() || imgConfig?.apiToken?.trim();
  const model = activeProfile?.model?.trim() || imgConfig?.model?.trim() || '@cf/black-forest-labs/flux-1-schnell';

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID and API Token not configured. Open the left panel and click "Image API" to enter your credentials.');
  }

  // 1. Try Backend Proxy
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        apiToken,
        model,
        prompt,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.image) {
        return data.image;
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('[ImageService] Backend proxy error, attempting direct browser call to Cloudflare:', err);
  }

  // 2. Direct browser fallback
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const directRes = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!directRes.ok) {
    const errText = await directRes.text();
    throw new Error(`Cloudflare HTTP ${directRes.status}: ${errText.slice(0, 200)}`);
  }

  const contentType = directRes.headers.get('content-type') || 'image/jpeg';
  if (contentType.includes('application/json')) {
    const json = await directRes.json();
    if (json.result && json.result.image) {
      return `data:image/jpeg;base64,${json.result.image}`;
    }
  }

  const blob = await directRes.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * End-to-end scene illustrator:
 * 1. Generates refined 2-sentence SFW prompt via Summarizer Model.
 * 2. Generates image via Cloudflare Workers AI.
 * 3. Saves to IndexedDB on the message record.
 */
export async function illustrateSceneForMessage(params: {
  message: ChatMessageRecord;
  character: CharacterRecord;
  settings: AppSettingsRecord;
  onStatusUpdate?: (status: string) => void;
}): Promise<{ imageUrl: string; prompt: string }> {
  const { message, character, settings, onStatusUpdate } = params;

  onStatusUpdate?.('Crafting 2-sentence visual prompt with Summarizer Model...');
  const prompt = await synthesizeImagePrompt({
    messageContent: message.content,
    character,
    settings,
  });

  onStatusUpdate?.(`Rendering with Cloudflare (${prompt.slice(0, 40)}...)...`);
  const imageUrl = await generateCloudflareImage({
    prompt,
    settings,
  });

  // Update in IndexedDB
  await db.messages.update(message.id, {
    imageUrl,
    imagePrompt: prompt,
  });

  return { imageUrl, prompt };
}
