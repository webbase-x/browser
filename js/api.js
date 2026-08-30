// Backend adapter connected to the production Vercel API.
const DEFAULT_API_BASE = 'https://browser-phairats-projects.vercel.app';

export class DubApi {
  constructor(baseUrl = DEFAULT_API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  get configured() { return Boolean(this.baseUrl); }

  async health() {
    if (!this.configured) return { ok: false, mode: 'frontend-only' };
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  async createSession(payload) {
    if (!this.configured) throw new Error('ยังไม่ได้เชื่อม backend พากย์สด');
    const res = await fetch(`${this.baseUrl}/api/dub/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `API ${res.status}`);
      err.code = data.error || `http_${res.status}`;
      err.status = res.status;
      err.data = data;
      throw err;
    }
    window.dispatchEvent(new CustomEvent('ai-dub-session', { detail: data }));
    return data;
  }

  async transcribeAudio({ audio, mediaType = 'audio/webm' }) {
    const res = await fetch(`${this.baseUrl}/api/dub/transcribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audio, mediaType })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `API ${res.status}`);
      err.code = data.error || `http_${res.status}`;
      throw err;
    }
    return data;
  }

  async stopSession(sessionId) {
    window.dispatchEvent(new Event('ai-dub-stop'));
    if (!this.configured || !sessionId) return;
    await fetch(`${this.baseUrl}/api/dub/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => {});
  }
}

export const dubApi = new DubApi(globalThis.AI_BROWSER_API_BASE || DEFAULT_API_BASE);
