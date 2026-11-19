import { handleFetchModels } from '../server/routes/models.js';

export default async function handler(req, res) {
  return handleFetchModels(req, res);
}
