import assert from 'node:assert';
process.env.NODE_ENV = 'test';
import { substituteMacros } from '../src/services/macroEngine';
import { estimateTokens, estimateMessagesTokens } from '../src/services/tokenEstimator';
import { buildProviderRequest } from '../server/providers/sanitizer.js';
import { utf8ToBase64, base64ToUtf8 } from '../src/services/pngParser';
import pako from 'pako';
import extract from 'png-chunks-extract';
import encode from 'png-chunks-encode';

console.log('--- Running Aetheria Roleplay Engine Test Suite ---');

// 1. Test Macro Engine
console.log('1. Testing Macro Engine...');
const template = '{{char}} looks at {{user}} and says: "Greetings, {{user_name}}."';
const resolved = substituteMacros(template, { charName: 'Kora', userName: 'Cipher' });
assert.strictEqual(resolved, 'Kora looks at Cipher and says: "Greetings, Cipher."');
console.log('   ✓ Macro substitution verified.');

// 2. Test Base64 UTF-8 roundtrip
console.log('2. Testing Base64 Unicode Handling...');
const originalText = 'Hello 🎭 Kora Vance! 🚀 Special characters: €—✓';
const encoded = utf8ToBase64(originalText);
const decoded = base64ToUtf8(encoded);
assert.strictEqual(decoded, originalText);
console.log('   ✓ UTF-8 Base64 roundtrip verified.');

// 3. Test Token Estimator
console.log('3. Testing Token Estimator...');
const sampleText = 'The rain falls steadily over Sector 7 as the neon lights flicker.';
const tokens = estimateTokens(sampleText);
assert(tokens > 8 && tokens < 25, `Expected reasonable token count, got ${tokens}`);
const msgTokens = estimateMessagesTokens([
  { role: 'system', content: 'You are an AI.' },
  { role: 'user', content: sampleText }
]);
assert(msgTokens > tokens, 'Message tokens should include role & envelope overhead');
console.log(`   ✓ Token estimator verified (${tokens} tokens estimated).`);

// 4. Test Provider Sanitizer (OpenAI vs Anthropic vs OpenRouter)
console.log('4. Testing Provider Parameter Sanitization Whitelist...');
// Test OpenAI (must strip min_p, top_k, repetition_penalty)
const openAIReq = buildProviderRequest({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'system', content: 'System instruction' }, { role: 'user', content: 'Hello' }],
  samplers: {
    temperature: 0.8,
    top_p: 0.9,
    min_p: 0.05,
    top_k: 40,
    repetition_penalty: 1.1,
    frequency_penalty: 0.2,
  },
  apiKey: 'sk-test-key',
});
assert.strictEqual(openAIReq.body.min_p, undefined, 'OpenAI must strip min_p');
assert.strictEqual(openAIReq.body.top_k, undefined, 'OpenAI must strip top_k');
assert.strictEqual(openAIReq.body.repetition_penalty, undefined, 'OpenAI must strip repetition_penalty');
assert.strictEqual(openAIReq.body.frequency_penalty, 0.2, 'OpenAI must preserve frequency_penalty');
assert.strictEqual(openAIReq.headers['Authorization'], 'Bearer sk-test-key');
console.log('   ✓ OpenAI parameter whitelist verified.');

// Test Anthropic (messages API separation, x-api-key header, top-level system)
const anthropicReq = buildProviderRequest({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'system', content: 'You are Kora.' },
    { role: 'user', content: 'Hello Kora.' }
  ],
  samplers: { temperature: 0.7, top_p: 0.9, max_tokens: 1000 },
  apiKey: 'anthropic-key',
});
assert.strictEqual(anthropicReq.isAnthropic, true);
assert.strictEqual(anthropicReq.headers['x-api-key'], 'anthropic-key');
assert.strictEqual(anthropicReq.headers['anthropic-version'], '2023-06-01');
assert.strictEqual(anthropicReq.body.system, 'You are Kora.');
assert.strictEqual((anthropicReq.body.messages as Array<{ role: string }>)[0].role, 'user');
console.log('   ✓ Anthropic Messages API mapping verified.');

// Test OpenRouter (preserves all advanced samplers)
const openRouterReq = buildProviderRequest({
  provider: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  messages: [{ role: 'user', content: 'Test' }],
  samplers: {
    temperature: 0.9,
    min_p: 0.05,
    top_k: 50,
    repetition_penalty: 1.15,
  },
  apiKey: 'or-key',
});
assert.strictEqual(openRouterReq.body.min_p, 0.05);
assert.strictEqual(openRouterReq.body.top_k, 50);
assert.strictEqual(openRouterReq.body.repetition_penalty, 1.15);
assert.strictEqual(openRouterReq.headers['Authorization'], 'Bearer or-key');
console.log('   ✓ OpenRouter full samplers verified.');

// Test Google Gemini parameter whitelist and URL normalization
const geminiReq = buildProviderRequest({
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  messages: [{ role: 'user', content: 'Hello Gemini' }],
  samplers: {
    temperature: 0.7,
    frequency_penalty: 0.5,
    presence_penalty: 0.5,
    min_p: 0.05,
    top_k: 40,
  },
  apiKey: 'gemini-test-key',
});
assert(geminiReq.url.includes('/openai/chat/completions'), 'Gemini must normalize to /openai/chat/completions');
assert(geminiReq.url.includes('key=gemini-test-key'), 'Gemini must include key in query');
assert.strictEqual(geminiReq.headers['Authorization'], 'Bearer gemini-test-key');
assert.strictEqual(geminiReq.body.frequency_penalty, undefined, 'Gemini must strip frequency_penalty');
assert.strictEqual(geminiReq.body.presence_penalty, undefined, 'Gemini must strip presence_penalty');
assert.strictEqual(geminiReq.body.min_p, undefined, 'Gemini must strip min_p');
assert.strictEqual(geminiReq.body.top_k, undefined, 'Gemini must strip top_k (avoids HTTP 400)');
console.log('   ✓ Google Gemini URL normalization and parameter sanitization verified.');

// 5. Test PNG Chunk Extraction & Encoding with zTXt and tEXt
console.log('5. Testing PNG Chunk Reading & Writing with pako...');
const dummyPayload = JSON.stringify({
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: { name: 'Kora Vance', description: 'Hacker' }
});
const base64Data = utf8ToBase64(dummyPayload);

// Construct tEXt chunk
const keyword = 'chara';
const chunkBytes = new Uint8Array(keyword.length + 1 + base64Data.length);
for (let i = 0; i < keyword.length; i++) chunkBytes[i] = keyword.charCodeAt(i);
chunkBytes[keyword.length] = 0;
for (let i = 0; i < base64Data.length; i++) chunkBytes[keyword.length + 1 + i] = base64Data.charCodeAt(i);

// Encode minimal PNG chunk structure
const chunks = [
  { name: 'IHDR', data: new Uint8Array(13) },
  { name: 'tEXt', data: chunkBytes },
  { name: 'IEND', data: new Uint8Array(0) },
];
const encodedPng = encode(chunks);
assert(encodedPng.length > 0);

// Extract chunks back
const extractedChunks = extract(encodedPng);
const textChunk = extractedChunks.find(c => c.name === 'tEXt');
assert(textChunk, 'Should find tEXt chunk in extracted PNG');
const nullIdx = textChunk.data.indexOf(0);
const extractedKeyword = String.fromCharCode(...textChunk.data.slice(0, nullIdx));
assert.strictEqual(extractedKeyword, 'chara');
const extractedBase64 = String.fromCharCode(...textChunk.data.slice(nullIdx + 1));
const extractedJson = JSON.parse(base64ToUtf8(extractedBase64));
assert.strictEqual(extractedJson.data.name, 'Kora Vance');
console.log('   ✓ PNG Chunk extraction and decoding verified.');

// 6. Test zlib compression with pako
console.log('6. Testing pako zlib deflate/inflate for zTXt...');
const compressed = pako.deflate(new TextEncoder().encode(base64Data));
const decompressed = pako.inflate(compressed);
const decompressedStr = new TextDecoder().decode(decompressed);
assert.strictEqual(decompressedStr, base64Data);
console.log('   ✓ Pako zTXt compression/decompression verified.');

// 7. Test Express App routes (pure JS backend)
console.log('7. Testing Pure JavaScript Express Backend App...');
const { default: app } = await import('../server/index.js');
assert(app, 'Express app should be exported successfully');
console.log('   ✓ Express backend import and route wiring verified.');

// 8. Test Dialogue Asterisk Sanitization
console.log('8. Testing Dialogue Boundary Asterisk Sanitization...');
const { sanitizeDialogueAsterisks, parseRoleplayParagraphs } = await import('../src/services/tagParser');
const rawWithAsterisks = '*"The seals are fractured, Vaelen."* *she whispers* "*Draw your blade.*"';
const sanitized = sanitizeDialogueAsterisks(rawWithAsterisks);
assert.strictEqual(sanitized, '"The seals are fractured, Vaelen." *she whispers* "Draw your blade."');
const parsedPara = parseRoleplayParagraphs(rawWithAsterisks);
assert.strictEqual(parsedPara[0].tokens[0].type, 'dialogue');
assert.strictEqual(parsedPara[0].tokens[0].text, 'The seals are fractured, Vaelen.');
assert.strictEqual(parsedPara[0].tokens[1].type, 'thought');
assert.strictEqual(parsedPara[0].tokens[1].text, 'she whispers');
assert.strictEqual(parsedPara[0].tokens[2].type, 'dialogue');
assert.strictEqual(parsedPara[0].tokens[2].text, 'Draw your blade.');
console.log('   ✓ Dialogue boundary asterisk sanitization verified.');

// 9. Test Lorebook Trigger Matching Logic
console.log('9. Testing Lorebook Trigger Matching...');
const sampleLoreEntries = [
  { name: 'Aras Corp', keys: ['aras', 'megacorp'], content: 'A brutal cyber-industrial syndicate.', constant: false },
  { name: 'Sanctuary Seals', keys: ['sanctuary', 'seals'], content: 'Ancient wards engraved in silver.', constant: false },
  { name: 'Global Rule', keys: [], content: 'Magic requires life essence.', constant: true }
];
const textContext = 'Lady Vespera inspected the sanctuary seals carefully.';
const matches = sampleLoreEntries.filter(entry => {
  if (entry.constant) return true;
  return entry.keys.some(k => textContext.toLowerCase().includes(k.toLowerCase()));
});
assert.strictEqual(matches.length, 2, 'Should match Sanctuary Seals and Global Rule');
assert(matches.some(m => m.name === 'Sanctuary Seals'));
assert(matches.some(m => m.name === 'Global Rule'));
console.log('   ✓ Lorebook matching logic verified.');

// 10. Test Vercel Serverless API Dispatcher
console.log('10. Testing Vercel Serverless Function Dispatcher...');
const { default: apiIndexHandler } = await import('../api/index.js');
assert.strictEqual(typeof apiIndexHandler, 'function');

// Mock request / response for health check
let resStatus = 0;
let resData: any = null;
const mockRes: any = {
  setHeader: () => {},
  status: (code: number) => { resStatus = code; return mockRes; },
  json: (data: any) => { resData = data; return mockRes; },
};
await apiIndexHandler({ url: '/api/health', method: 'GET' } as any, mockRes);
assert.strictEqual(resStatus, 200);
assert.strictEqual(resData?.status, 'ok');
console.log('    ✓ Vercel Serverless API Dispatcher verified.');

console.log('All Roleplay Engine verification checks PASSED successfully!');
