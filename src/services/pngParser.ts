import extract from 'png-chunks-extract';
import encode from 'png-chunks-encode';
import pako from 'pako';
import { 
  CharacterCardV2Data, 
  CharacterRecord, 
  AnyCharacterCardJSON,
  CharacterCardV2
} from '../types/characterCard';

/**
 * Decodes a base64 string to a UTF-8 string safely handling unicode characters.
 */
export function base64ToUtf8(base64: string): string {
  // Remove whitespace/newlines that might be in PNG text chunks
  const cleaned = base64.replace(/\s/g, '');
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Encodes a UTF-8 string to base64 safely handling unicode characters.
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Blob to a persistent base64 Data URL that never revokes or expires.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ParsedCardResult {
  cardData: CharacterCardV2Data;
  avatarBlob?: Blob;
  avatarUrl?: string;
  genre?: string;
}

/**
 * Normalizes any format (V1 legacy Tavern, V2, or V3) into CharacterCardV2Data.
 */
export function normalizeCardData(json: AnyCharacterCardJSON | Record<string, unknown>): CharacterCardV2Data {
  // If wrapped in V2/V3 spec
  if ('data' in json && json.data && typeof json.data === 'object') {
    const d = json.data as Partial<CharacterCardV2Data>;
    return {
      name: d.name || 'Unnamed Character',
      description: d.description || '',
      personality: d.personality || '',
      scenario: d.scenario || '',
      first_mes: d.first_mes || '',
      mes_example: d.mes_example || '',
      creator_notes: d.creator_notes || '',
      system_prompt: d.system_prompt || '',
      post_history_instructions: d.post_history_instructions || '',
      alternate_greetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [],
      character_book: d.character_book,
      tags: Array.isArray(d.tags) ? d.tags : [],
      creator: d.creator || '',
      character_version: d.character_version || '1.0',
    };
  }

  // Legacy Tavern V1 format
  const leg = json as Partial<CharacterCardV2Data>;
  return {
    name: leg.name || 'Unnamed Character',
    description: leg.description || '',
    personality: leg.personality || '',
    scenario: leg.scenario || '',
    first_mes: leg.first_mes || '',
    mes_example: leg.mes_example || '',
    creator_notes: leg.creator_notes || '',
    system_prompt: leg.system_prompt || '',
    post_history_instructions: leg.post_history_instructions || '',
    alternate_greetings: Array.isArray(leg.alternate_greetings) ? leg.alternate_greetings : [],
    character_book: leg.character_book,
    tags: Array.isArray(leg.tags) ? leg.tags : [],
    creator: leg.creator || '',
    character_version: '1.0',
  };
}

/**
 * Parses a PNG buffer or file, extracts embedded tEXt/zTXt chunks for 'chara' or 'ccv3',
 * decodes the character JSON, and returns the character data along with avatar image blob.
 */
export async function parseCharacterPng(file: File | Blob | ArrayBuffer): Promise<ParsedCardResult> {
  const arrayBuffer = file instanceof ArrayBuffer 
    ? file 
    : await file.arrayBuffer();
  
  const uint8 = new Uint8Array(arrayBuffer);
  const chunks = extract(uint8);

  let rawJsonStr: string | null = null;

  for (const chunk of chunks) {
    if (chunk.name === 'tEXt') {
      // Format: keyword + null(0) + text
      const data = chunk.data;
      const nullIndex = data.indexOf(0);
      if (nullIndex > 0) {
        const keyword = String.fromCharCode(...data.slice(0, nullIndex)).toLowerCase();
        if (keyword === 'chara' || keyword === 'ccv3') {
          const textBytes = data.slice(nullIndex + 1);
          let base64 = '';
          for (let i = 0; i < textBytes.length; i++) {
            base64 += String.fromCharCode(textBytes[i]);
          }
          try {
            rawJsonStr = base64ToUtf8(base64);
            break;
          } catch (e) {
            console.warn('Failed to parse tEXt chunk as base64 UTF-8:', e);
          }
        }
      }
    } else if (chunk.name === 'zTXt') {
      // Format: keyword + null(0) + compressionMethod(1 byte: 0) + compressedData
      const data = chunk.data;
      const nullIndex = data.indexOf(0);
      if (nullIndex > 0) {
        const keyword = String.fromCharCode(...data.slice(0, nullIndex)).toLowerCase();
        if (keyword === 'chara' || keyword === 'ccv3') {
          const compressedData = data.slice(nullIndex + 2); // skip null and compression method byte
          try {
            const decompressed = pako.inflate(compressedData);
            let base64 = '';
            for (let i = 0; i < decompressed.length; i++) {
              base64 += String.fromCharCode(decompressed[i]);
            }
            rawJsonStr = base64ToUtf8(base64);
            break;
          } catch (e) {
            console.warn('Failed to decompress zTXt chunk:', e);
          }
        }
      }
    }
  }

  if (!rawJsonStr) {
    throw new Error('No valid Character Card metadata found in PNG chunks (checked "chara" & "ccv3").');
  }

  const parsedJson = JSON.parse(rawJsonStr);
  const cardData = normalizeCardData(parsedJson);

  // Avatar blob is the image itself! Persistent Base64 Data URL so image never disappears
  const avatarBlob = file instanceof Blob ? file : new Blob([uint8 as BlobPart], { type: 'image/png' });
  const avatarUrl = await blobToDataUrl(avatarBlob);

  return {
    cardData,
    avatarBlob,
    avatarUrl,
    genre: detectGenre(cardData),
  };
}

/**
 * Parses raw JSON string or file into character card data.
 */
export async function parseCharacterJson(fileOrJson: File | Blob | string): Promise<ParsedCardResult> {
  let content = '';
  if (typeof fileOrJson === 'string') {
    content = fileOrJson;
  } else {
    content = await fileOrJson.text();
  }

  const parsedJson = JSON.parse(content);
  const cardData = normalizeCardData(parsedJson);

  return {
    cardData,
    genre: detectGenre(cardData),
  };
}

/**
 * Automatically infers genre from tags, description, or personality.
 */
export function detectGenre(data: CharacterCardV2Data): string {
  const combined = `${data.tags?.join(' ') || ''} ${data.description} ${data.personality} ${data.scenario}`.toLowerCase();
  if (combined.includes('cyber') || combined.includes('neon') || combined.includes('hack') || combined.includes('corp')) {
    return 'Cyberpunk';
  }
  if (combined.includes('grim') || combined.includes('gothic') || combined.includes('cathedral') || combined.includes('inquisit') || combined.includes('blood')) {
    return 'Grimdark';
  }
  if (combined.includes('space') || combined.includes('star') || combined.includes('planet') || combined.includes('ship') || combined.includes('sci-fi')) {
    return 'Sci-Fi';
  }
  if (combined.includes('magic') || combined.includes('sword') || combined.includes('elf') || combined.includes('spell') || combined.includes('fantasy')) {
    return 'High Fantasy';
  }
  if (combined.includes('detective') || combined.includes('noir') || combined.includes('smoke') || combined.includes('crime')) {
    return 'Modern Noir';
  }
  if (combined.includes('horror') || combined.includes('eldritch') || combined.includes('haunt') || combined.includes('decay')) {
    return 'Horror';
  }
  return 'Adventure';
}

/**
 * Re-encodes updated character card data into a PNG file with embedded tEXt chunk.
 */
export async function exportCharacterPng(card: CharacterRecord, sourceImageBlob?: Blob): Promise<Blob> {
  let imageBytes: Uint8Array;
  
  if (sourceImageBlob) {
    imageBytes = new Uint8Array(await sourceImageBlob.arrayBuffer());
  } else if (card.avatarBlob) {
    imageBytes = new Uint8Array(await card.avatarBlob.arrayBuffer());
  } else {
    // Generate a simple fallback 512x512 canvas PNG if no image exists
    imageBytes = await generatePlaceholderPngBytes(card.name);
  }

  const chunks = extract(imageBytes);

  // Filter out any existing 'chara' or 'ccv3' tEXt/zTXt chunks
  const filteredChunks = chunks.filter((chunk: { name: string; data: Uint8Array }) => {
    if (chunk.name !== 'tEXt' && chunk.name !== 'zTXt') return true;
    const nullIdx = chunk.data.indexOf(0);
    if (nullIdx <= 0) return true;
    const kw = String.fromCharCode(...chunk.data.slice(0, nullIdx)).toLowerCase();
    return kw !== 'chara' && kw !== 'ccv3';
  });

  // Prepare V2 card JSON
  const v2Card: CharacterCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: card.data,
  };

  const jsonString = JSON.stringify(v2Card);
  const base64Payload = utf8ToBase64(jsonString);

  // Create tEXt chunk: keyword 'chara' + 0x00 + base64Payload
  const keyword = 'chara';
  const chunkData = new Uint8Array(keyword.length + 1 + base64Payload.length);
  for (let i = 0; i < keyword.length; i++) {
    chunkData[i] = keyword.charCodeAt(i);
  }
  chunkData[keyword.length] = 0; // null separator
  for (let i = 0; i < base64Payload.length; i++) {
    chunkData[keyword.length + 1 + i] = base64Payload.charCodeAt(i);
  }

  const newChunk = {
    name: 'tEXt',
    data: chunkData,
  };

  // Insert before IEND chunk (usually last)
  const iendIndex = filteredChunks.findIndex((c: { name: string }) => c.name === 'IEND');
  if (iendIndex !== -1) {
    filteredChunks.splice(iendIndex, 0, newChunk);
  } else {
    filteredChunks.push(newChunk);
  }

  const outputBytes = encode(filteredChunks);
  return new Blob([outputBytes as BlobPart], { type: 'image/png' });
}

/**
 * Creates a clean placeholder PNG if no avatar is provided.
 */
async function generatePlaceholderPngBytes(name: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 400, 400);
    gradient.addColorStop(0, '#18181b');
    gradient.addColorStop(1, '#09090b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 2).toUpperCase(), 200, 200);
  }

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (blob) {
        resolve(new Uint8Array(await blob.arrayBuffer()));
      } else {
        resolve(new Uint8Array([]));
      }
    }, 'image/png');
  });
}
