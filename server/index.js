import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleChatStream } from './routes/chatStream.js';
import { handleTestConnection } from './routes/testConnection.js';
import { handleSummarize } from './routes/summarize.js';
import { handleFetchModels } from './routes/models.js';
import { handleUpdateWorldState } from './routes/worldState.js';
import { handleGenerateImage } from './routes/imageGen.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-provider', 'x-base-url'],
}));

app.use(express.json({ limit: '20mb' }));

// Health check
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Mythicalore Roleplay Engine Stateless Proxy (JavaScript ESM)',
    timestamp: Date.now(),
  });
});

app.get(['/api/models', '/models'], handleFetchModels);
app.post(['/api/models', '/models'], handleFetchModels);
app.post(['/api/chat/stream', '/chat/stream'], handleChatStream);
app.post(['/api/test-connection', '/test-connection'], handleTestConnection);
app.post(['/api/summarize', '/summarize'], handleSummarize);
app.post(['/api/world-state/update', '/world-state/update'], handleUpdateWorldState);
app.post(['/api/generate-image', '/generate-image'], handleGenerateImage);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Proxy Backend] Stateless BYOK Engine running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Proxy Backend] Port ${PORT} already active, continuing.`);
    } else {
      console.error('[Proxy Backend] Server error:', err);
    }
  });
}

export default app;
