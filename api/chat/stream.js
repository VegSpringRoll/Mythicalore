import { handleChatStream } from '../../server/routes/chatStream.js';

export default async function handler(req, res) {
  return handleChatStream(req, res);
}
