import { getSettings } from './storage.js';

const frame = document.getElementById('browserFrame');
const dubStatus = document.getElementById('dubStatus');
const dubToggle = document.getElementById('dubToggle');
const frameWrap = document.querySelector('.frame-wrap');

let session = null;
let timer = null;
let lastTime = 0;
let lastSpoken = -1;
let playerState = -1;
let currentVideoId = '';

const subtitle = document.createElement('div');
subtitle.id = 'thaiDubSubtitle';
subtitle.style.cssText = 'position:absolute;left:6%;right:6%;bottom:7%;z-index:5;background:rgba(0,0,0,.72);color:white;padding:10px 14px;border-radius:12px;text-align:center;font-size:clamp(16px,4vw,26px);line-height:1.35;pointer-events:none;display:none;';
frameWrap?.appendChild(subtitle);

function ensureYoutubeJsApi() {
  if (!frame?.src || !/youtube\.com\/embed\//i.test(frame.src)) return;
  const u = new URL(frame.src);
  currentVideoId = u.pathname.split('/').filter(Boolean).pop() || '';
  let changed = false;
  if (u.searchParams.get('enablejsapi') !== '1') { u.searchParams.set('enablejsapi', '1'); changed = true; }
  if (!u.searchParams.get('origin')) { u.searchParams.set('origin', location.origin); changed = true; }
  u.searchParams.set('playsinline', '1');
  if (changed) frame.src = u.toString();
}

new MutationObserver(ensureYoutubeJsApi).observe(frame, { attributes: true, attributeFilter: ['src'] });
frame?.addEventListener('load', () => setTimeout(ensureYoutubeJsApi, 50));
ensureYoutubeJsApi();

function command(func, args=[]) {
  try {
    frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
  } catch {}
}

function currentSegmentIndex(t) {
  const segs = session?.segments || [];
  let lo = 0, hi = segs.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= t + 0.2) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans < 0) return -1;
  const s = segs[ans];
  return t <= s.start + Math.max(s.duration, 2.2) + 0.5 ? ans : -1;
}

function thaiVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => /^th(-|_)/i.test(v.lang)) || voices.find(v => /thai/i.test(v.name)) || null;
}

function speakSegment(index) {
  if (!session || index < 0 || index === lastSpoken || !dubToggle?.checked) return;
  const seg = session.segments[index];
  const settings = getSettings();
  lastSpoken = index;
  subtitle.textContent = seg.text;
  subtitle.style.display = settings.showSubtitles ? 'block' : 'none';

  if (!('speechSynthesis' in window)) {
    if (dubStatus) dubStatus.textContent = 'พากย์ไทย: เครื่องไม่รองรับเสียงระบบ';
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(seg.text);
  u.lang = 'th-TH';
  const v = thaiVoice(); if (v) u.voice = v;
  const charsPerSec = Math.max(1, seg.text.replace(/\s/g,'').length / Math.max(0.8, seg.duration));
  u.rate = Math.min(1.65, Math.max(0.82, charsPerSec / 9));
  u.pitch = settings.voiceStyle === 'male' ? 0.92 : settings.voiceStyle === 'female' ? 1.06 : 1.0;
  u.volume = Math.min(1, Math.max(0, settings.dubVolume / 100));
  speechSynthesis.speak(u);
}

function tick() {
  if (!session || !dubToggle?.checked || !/youtube\.com\/embed\//i.test(frame?.src || '')) return;
  command('getCurrentTime');
  command('getPlayerState');
}

function startPolling() {
  clearInterval(timer);
  timer = setInterval(tick, 300);
  const settings = getSettings();
  command('setVolume', [settings.sourceVolume]);
  if (dubStatus) dubStatus.textContent = `พากย์ไทย: พร้อม ${session?.segments?.length || 0} ช่วง`;
}

function stopDubSpeech() {
  clearInterval(timer); timer = null;
  session = null; lastSpoken = -1; lastTime = 0;
  subtitle.style.display = 'none';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

window.addEventListener('ai-dub-session', e => {
  session = e.detail || null;
  if (!session?.segments?.length) return;
  lastSpoken = -1; lastTime = 0;
  ensureYoutubeJsApi();
  startPolling();
});
window.addEventListener('ai-dub-stop', stopDubSpeech);
dubToggle?.addEventListener('change', () => { if (!dubToggle.checked) stopDubSpeech(); });

window.addEventListener('message', e => {
  if (!/youtube\.com$/i.test(new URL(e.origin || 'https://invalid').hostname)) return;
  let data = e.data;
  try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
  if (!data || data.event !== 'infoDelivery' || !data.info) return;
  const info = data.info;
  if (Number.isFinite(info.playerState)) playerState = info.playerState;
  if (!Number.isFinite(info.currentTime)) return;
  const t = info.currentTime;
  if (t < lastTime - 2.0) lastSpoken = -1;
  lastTime = t;
  if (playerState !== 1 && playerState !== 3 && playerState !== -1) return;
  const idx = currentSegmentIndex(t);
  if (idx >= 0) speakSegment(idx);
});

speechSynthesis?.getVoices?.();
