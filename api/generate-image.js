import { handleGenerateImage } from '../server/routes/imageGen.js';

export default async function handler(req, res) {
  return handleGenerateImage(req, res);
}
