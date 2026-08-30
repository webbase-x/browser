function extractArrayAfter(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const start = text.indexOf('[', at + marker.length);
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function videoIdFromUrl(value='') {
  try {
    const u = new URL(value);
    if (/(^|\.)youtu\.be$/i.test(u.hostname)) return u.pathname.split('/').filter(Boolean)[0] || '';
    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
      if (u.pathname === '/watch') return u.searchParams.get('v') || '';
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      return m?.[1] || '';
    }
  } catch {}
  return '';
}

export async function getThaiCaptionSegments(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const htmlRes = await fetch(watchUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!htmlRes.ok) throw new Error(`youtube_page_${htmlRes.status}`);
  const html = await htmlRes.text();
  const raw = extractArrayAfter(html, '"captionTracks":');
  if (!raw) return { segments: [], reason: 'no_captions' };

  let tracks;
  try { tracks = JSON.parse(raw); } catch { return { segments: [], reason: 'caption_parse_failed' }; }
  if (!Array.isArray(tracks) || !tracks.length) return { segments: [], reason: 'no_captions' };

  let track = tracks.find(t => t.languageCode === 'th') || tracks.find(t => t.kind !== 'asr') || tracks[0];
  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  if (track.languageCode !== 'th' && track.isTranslatable !== false) captionUrl.searchParams.set('tlang', 'th');

  const capRes = await fetch(captionUrl.toString(), {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'th,en;q=0.8' }
  });
  if (!capRes.ok) throw new Error(`caption_fetch_${capRes.status}`);
  const data = await capRes.json();
  const segments = [];
  for (const ev of data.events || []) {
    if (!Array.isArray(ev.segs) || !Number.isFinite(ev.tStartMs)) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    segments.push({
      start: ev.tStartMs / 1000,
      duration: Math.max(0.2, (ev.dDurationMs || 1500) / 1000),
      text
    });
  }
  return {
    segments,
    sourceLanguage: track.languageCode || 'unknown',
    translated: track.languageCode !== 'th',
    trackName: track.name?.simpleText || track.name?.runs?.map(r => r.text).join('') || ''
  };
}
