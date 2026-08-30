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

function decodeXml(text='') {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

async function fetchTimedTextTrackList(videoId) {
  const url = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'th,en;q=0.8' } });
  if (!res.ok) return [];
  const xml = await res.text();
  const tracks = [];
  const re = /<track\b([^>]*)\/?\s*>/gi;
  for (const m of xml.matchAll(re)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decodeXml(a[2]);
    if (attrs.lang_code) tracks.push(attrs);
  }
  return tracks;
}

async function fetchTimedTextSegments(videoId, track) {
  const params = new URLSearchParams({
    v: videoId,
    lang: track.lang_code,
    fmt: 'json3'
  });
  if (track.name) params.set('name', track.name);
  if (track.lang_code !== 'th') params.set('tlang', 'th');
  const res = await fetch(`https://www.youtube.com/api/timedtext?${params}`, {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'th,en;q=0.8' }
  });
  if (!res.ok) return [];
  let data;
  try { data = await res.json(); } catch { return []; }
  const segments = [];
  for (const ev of data.events || []) {
    if (!Array.isArray(ev.segs) || !Number.isFinite(ev.tStartMs)) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    segments.push({ start: ev.tStartMs / 1000, duration: Math.max(0.2, (ev.dDurationMs || 1500) / 1000), text });
  }
  return segments;
}

async function tryTimedText(videoId) {
  const tracks = await fetchTimedTextTrackList(videoId);
  if (!tracks.length) return null;
  const track = tracks.find(t => t.lang_code === 'th') || tracks.find(t => t.lang_code === 'en') || tracks[0];
  const segments = await fetchTimedTextSegments(videoId, track);
  if (!segments.length) return null;
  return {
    segments,
    sourceLanguage: track.lang_code || 'unknown',
    translated: track.lang_code !== 'th',
    trackName: track.name || track.lang_translated || track.lang_original || '',
    source: 'timedtext'
  };
}

async function tryWatchPage(videoId) {
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
  if (!raw) return null;
  let tracks;
  try { tracks = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(tracks) || !tracks.length) return null;

  const track = tracks.find(t => t.languageCode === 'th') || tracks.find(t => t.kind !== 'asr') || tracks[0];
  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  if (track.languageCode !== 'th' && track.isTranslatable !== false) captionUrl.searchParams.set('tlang', 'th');
  const capRes = await fetch(captionUrl.toString(), { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'th,en;q=0.8' } });
  if (!capRes.ok) return null;
  let data;
  try { data = await capRes.json(); } catch { return null; }
  const segments = [];
  for (const ev of data.events || []) {
    if (!Array.isArray(ev.segs) || !Number.isFinite(ev.tStartMs)) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    segments.push({ start: ev.tStartMs / 1000, duration: Math.max(0.2, (ev.dDurationMs || 1500) / 1000), text });
  }
  if (!segments.length) return null;
  return {
    segments,
    sourceLanguage: track.languageCode || 'unknown',
    translated: track.languageCode !== 'th',
    trackName: track.name?.simpleText || track.name?.runs?.map(r => r.text).join('') || '',
    source: 'watch-page'
  };
}

export async function getThaiCaptionSegments(videoId) {
  const timed = await tryTimedText(videoId).catch(() => null);
  if (timed) return timed;
  const page = await tryWatchPage(videoId).catch(() => null);
  if (page) return page;
  return { segments: [], reason: 'no_captions_or_blocked' };
}
