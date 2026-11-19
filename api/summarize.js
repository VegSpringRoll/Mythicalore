import { handleSummarize } from '../server/routes/summarize.js';

export default async function handler(req, res) {
  return handleSummarize(req, res);
}
