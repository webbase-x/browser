const $ = id => document.getElementById(id);
const quickTests = $('quickTests');
const urlForm = $('urlForm');
const urlInput = $('urlInput');
const frame = $('browserFrame');
const fallback = $('frameFallback');
const pageStatus = $('pageStatus');
const openDirectBtn = $('openDirectBtn');

const restrictedHosts = [
  /(^|\.)google\./i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)netflix\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i
];

function currentUrl() {
  const value = (urlInput?.value || '').trim();
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

function openDirect() {
  const url = currentUrl();
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

openDirectBtn?.addEventListener('click', openDirect);

quickTests?.addEventListener('click', e => {
  const btn = e.target.closest('[data-test-url]');
  if (!btn) return;
  urlInput.value = btn.dataset.testUrl;
  urlForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

urlForm?.addEventListener('submit', () => {
  const url = currentUrl();
  if (!url) return;
  if (isYoutubeVideo(url)) {
    fallback?.classList.add('hidden');
    if (pageStatus) pageStatus.textContent = 'YouTube: กำลังเปิดวิดีโอแบบ Embed';
    return;
  }
  if (isLikelyRestricted(url)) {
    setTimeout(() => {
      fallback?.classList.remove('hidden');
      if (pageStatus) pageStatus.textContent = 'เว็บนี้มักจำกัดการฝังหน้า — ใช้ “เปิดตรง” ชั่วคราว';
    }, 1200);
  } else {
    setTimeout(() => {
      if (!fallback?.classList.contains('hidden')) return;
      if (pageStatus) pageStatus.textContent = 'หากหน้าเว็บว่าง แปลว่าเว็บปลายทางบล็อก iframe';
    }, 4500);
  }
});

frame?.addEventListener('load', () => {
  const url = currentUrl();
  if (isYoutubeVideo(url)) {
    fallback?.classList.add('hidden');
    if (pageStatus) pageStatus.textContent = 'YouTube: วิดีโอพร้อมเล่น';
    return;
  }
  if (isLikelyRestricted(url)) {
    setTimeout(() => fallback?.classList.remove('hidden'), 300);
  }
});
