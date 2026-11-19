import { handleTestConnection } from '../server/routes/testConnection.js';

export default async function handler(req, res) {
  return handleTestConnection(req, res);
}
