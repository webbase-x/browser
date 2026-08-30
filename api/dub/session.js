import { cors, handleOptions } from '../_cors.js';
import { videoIdFromUrl, getThaiCaptionSegments } from '../_youtube.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  cors(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { url } = req.body || {};
    const videoId = videoIdFromUrl(url || '');
    if (!videoId) return res.status(400).json({ error: 'youtube_video_required' });
    const captions = await getThaiCaptionSegments(videoId);
    if (!captions.segments.length) {
      return res.status(422).json({ error: captions.reason || 'no_captions', videoId });
    }
    return res.status(200).json({
      id: `yt-${videoId}-${Date.now()}`,
      mode: 'youtube-caption-speech',
      videoId,
      segments: captions.segments,
      sourceLanguage: captions.sourceLanguage,
      translated: captions.translated,
      trackName: captions.trackName
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'session_failed', message: error?.message || String(error) });
  }
}
