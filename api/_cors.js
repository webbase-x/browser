export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://webbase-x.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  cors(res);
  res.status(204).end();
  return true;
}
