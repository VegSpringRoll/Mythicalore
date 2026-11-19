import { handleFetchModels } from '../server/routes/models.js';
import { handleChatStream } from '../server/routes/chatStream.js';
import { handleTestConnection } from '../server/routes/testConnection.js';
import { handleSummarize } from '../server/routes/summarize.js';
import { handleUpdateWorldState } from '../server/routes/worldState.js';

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

export default async function handler(req, res) {
  // Global CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-provider, x-base-url');

  if (req.method === 'OPTIONS') {
    return res.status ? res.status(200).end() : res.writeHead(200).end();
  }

  // Ensure helper methods exist
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

  // Parse body if needed
  if (!req.body || typeof req.body !== 'object') {
    req.body = await parseBody(req);
  }

  const rawUrl = req.url || '';
  const urlPath = rawUrl.split('?')[0];

  // Route matching
  if (urlPath.includes('chat/stream') || urlPath.endsWith('/stream')) {
    return handleChatStream(req, res);
  }
  if (urlPath.includes('models')) {
    return handleFetchModels(req, res);
  }
  if (urlPath.includes('test-connection')) {
    return handleTestConnection(req, res);
  }
  if (urlPath.includes('summarize')) {
    return handleSummarize(req, res);
  }
  if (urlPath.includes('world-state')) {
    return handleUpdateWorldState(req, res);
  }
  if (urlPath.includes('health') || urlPath === '/' || urlPath === '/api' || urlPath.includes('index')) {
    return res.status(200).json({
      status: 'ok',
      service: 'Mythicalore Roleplay Proxy (JavaScript ESM)',
      timestamp: Date.now(),
    });
  }

  return res.status(404).json({ error: `Not found: ${urlPath}` });
}
