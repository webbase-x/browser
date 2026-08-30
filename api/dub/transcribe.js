import { cors, handleOptions } from '../_cors.js';

function cleanBase64(value='') {
  const i = value.indexOf(',');
  return i >= 0 ? value.slice(i + 1) : value;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { audio, mediaType = 'audio/webm' } = req.body || {};
    if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'audio_required' });
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) return res.status(503).json({ error: 'ai_gateway_not_configured' });

    const tr = await fetch('https://ai-gateway.vercel.sh/v4/ai/transcription-model', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'ai-model-id': 'openai/whisper-1'
      },
      body: JSON.stringify({ audio: cleanBase64(audio), mediaType })
    });
    const trText = await tr.text();
    if (!tr.ok) return res.status(502).json({ error: 'transcription_failed', detail: trText.slice(0, 500) });
    let transcript;
    try { transcript = JSON.parse(trText); } catch { transcript = { text: trText }; }
    const sourceText = (transcript.text || '').trim();
    if (!sourceText) return res.status(200).json({ ok: true, text: '', thai: '', noSpeech: true });

    const translate = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        input: `Translate the following spoken content naturally into Thai. Return only the Thai translation, no explanation:\n\n${sourceText}`
      })
    });
    const txText = await translate.text();
    if (!translate.ok) return res.status(502).json({ error: 'translation_failed', detail: txText.slice(0, 500), text: sourceText });
    let thai = '';
    try {
      const j = JSON.parse(txText);
      thai = j.output_text || j.output?.flatMap(x => x.content || []).map(x => x.text || '').join('') || '';
    } catch { thai = txText; }
    return res.status(200).json({ ok: true, text: sourceText, thai: thai.trim(), language: transcript.language || null, durationInSeconds: transcript.durationInSeconds || null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'transcribe_failed', message: error?.message || String(error) });
  }
}
