import { cors, handleOptions } from '../../_cors.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(204).end();
}
