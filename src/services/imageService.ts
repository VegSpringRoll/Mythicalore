import { db } from '../db';
import { CharacterRecord } from '../types/characterCard';
import { ChatMessageRecord } from '../types/chat';
import { AppSettingsRecord } from '../types/settings';
import { requestBackgroundSummary } from './llmClient';

/**
 * Synthesizes an image prompt using the configured Summarizer Model.
 * Strictly converts any NSFW elements to SFW.
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

  const promptGuidance = `You are an expert cinematic art director and visual prompt engineer.
Your mission is to read the current roleplay message and character visual description, then generate a single concise, high-detail text-to-image prompt (1-2 sentences).

CRITICAL DIRECTIVES:
1. Depict ${character.name}, focusing on visual appearance, attire, facial expression, atmospheric lighting, and key scene action.
2. STRICT SAFETY RULE: If the scene contains explicit adult, sexual, or NSFW elements, you MUST transform it into an elegant, STRICTLY SFW (safe for work), artistic, and cinematic scene.
3. Keep the prompt vivid, dense, and under 50 words.
4. Output ONLY the raw prompt text. Do NOT include greetings, preamble, quotes, or conversational filler.`;

  const charVisuals = character.data?.description || character.data?.personality || character.name;
  const turnsInput = `CHARACTER VISUAL PROFILE:
${charVisuals.slice(0, 500)}

CURRENT SCENE TEXT TO ILLUSTRATE:
${messageContent}

Generate the concise SFW text-to-image prompt:`;

  const rawPrompt = await requestBackgroundSummary({
    provider: activeProfile.provider,
    model: activeProfile.model,
    existingSummary: '',
    turnsToSummarize: `${promptGuidance}\n\n${turnsInput}`,
    characterName: character.name,
    personaName: 'User',
    apiKey,
    baseUrl: activeProfile.baseUrl || settings.summarizerModel.customUrl,
  });

  // Clean any prefixes or quotes
  let cleaned = rawPrompt.replace(/^(TITLE|SUMMARY|PROMPT):\s*/i, '').trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  return cleaned || `Cinematic digital painting of ${character.name}, dramatic lighting, 8k masterpiece`;
}

/**
 * Dispatches an image generation request to Cloudflare Workers AI.
 */
export async function generateCloudflareImage(params: {
  prompt: string;
  settings: AppSettingsRecord;
}): Promise<string> {
  const { prompt, settings } = params;
  const imgConfig = settings.imageApi;

  const accountId = imgConfig?.accountId?.trim();
  const apiToken = imgConfig?.apiToken?.trim();
  const model = imgConfig?.model?.trim() || '@cf/black-forest-labs/flux-1-schnell';

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
 * 1. Generates SFW prompt via Summarizer Model.
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

  onStatusUpdate?.('Synthesizing SFW prompt with Summarizer Model...');
  const prompt = await synthesizeImagePrompt({
    messageContent: message.content,
    character,
    settings,
  });

  onStatusUpdate?.(`Rendering with Cloudflare Workers AI (${prompt.slice(0, 35)}...)...`);
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
