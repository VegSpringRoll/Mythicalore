import { handleUpdateWorldState } from '../../server/routes/worldState.js';

export default async function handler(req, res) {
  return handleUpdateWorldState(req, res);
}
