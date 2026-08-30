import { cors, handleOptions } from './_cors.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  cors(res);
  res.status(200).json({ ok: true, service: 'ai-thai-browser', mode: 'youtube-caption-dub', at: new Date().toISOString() });
}
