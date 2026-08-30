import './youtube-dub.js';

const $ = id => document.getElementById(id);
const quickTests = $('quickTests');
const popularSites = $('popularSites');
const urlForm = $('urlForm');
const urlInput = $('urlInput');
const frame = $('browserFrame');
const fallback = $('frameFallback');
const pageStatus = $('pageStatus');
const openDirectBtn = $('openDirectBtn');
const openExternalBtn = $('openExternalBtn');

const restrictedHosts = [
  /(^|\.)google\./i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)netflix\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)xhaccess\.com$/i,
  /(^|\.)xhamster\.com$/i
];

function normalize(value='') {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return v;
}

function currentUrl() {
  const value = normalize(urlInput?.value || '');
  if (!value) return '';
  try { return new URL(value).href; } catch { return value; }
}

function youtubeVideoId(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtu\.be$/i.test(u.hostname)) return u.pathname.split('/').filter(Boolean)[0] || '';
    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
      if (u.pathname === '/watch') return u.searchParams.get('v') || '';
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      if (m) return m[1];
    }
  } catch {}
  return '';
}

function isYoutubeVideo(url) { return !!youtubeVideoId(url); }

function isLikelyRestricted(url) {
  if (isYoutubeVideo(url)) return false;
  try {
    const host = new URL(url).hostname;
    return restrictedHosts.some(re => re.test(host));
  } catch { return false; }
}

function openDirect(url = currentUrl()) {
  if (!url) return;
  const win = window.open(url, '_blank', 'noopener');
  if (!win && pageStatus) pageStatus.textContent = 'Safari บล็อกการเปิดแท็บใหม่ — แตะ “เปิดตรง ↗” อีกครั้ง';
}

openDirectBtn?.addEventListener('click', () => openDirect());
openExternalBtn?.addEventListener('click', () => openDirect());

function triggerShortcut(e) {
  const btn = e.target.closest('[data-test-url]');
  if (!btn) return;
  urlInput.value = btn.dataset.testUrl;
  urlForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
quickTests?.addEventListener('click', triggerShortcut);
popularSites?.addEventListener('click', triggerShortcut);

urlForm?.addEventListener('submit', () => {
  const url = currentUrl();
  if (!url) return;

  if (isYoutubeVideo(url)) {
    fallback?.classList.add('hidden');
    if (pageStatus) pageStatus.textContent = 'YouTube: กำลังเปิดวิดีโอแบบ Embed';
    return;
  }

  if (isLikelyRestricted(url)) {
    if (frame) frame.src = 'about:blank';
    fallback?.classList.remove('hidden');
    if (pageStatus) pageStatus.textContent = 'เว็บนี้ไม่รองรับการเปิดภายใน AI Browser — กำลังเปิดเว็บต้นทาง';
    openDirect(url);
    return;
  }

  setTimeout(() => {
    if (!fallback?.classList.contains('hidden')) return;
    if (pageStatus) pageStatus.textContent = 'หากหน้าเว็บว่าง แปลว่าเว็บปลายทางบล็อก iframe — ใช้ “เปิดตรง ↗”';
  }, 4500);
});

frame?.addEventListener('load', () => {
  const url = currentUrl();
  if (isYoutubeVideo(url)) {
    fallback?.classList.add('hidden');
    if (pageStatus) pageStatus.textContent = 'YouTube: วิดีโอพร้อมเล่น';
    return;
  }
  if (isLikelyRestricted(url)) {
    fallback?.classList.remove('hidden');
    if (pageStatus) pageStatus.textContent = 'เว็บนี้เปิดได้เฉพาะที่เว็บต้นทาง';
  }
});
