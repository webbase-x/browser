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
      const reason = data.error === 'no_captions' ? 'คลิปนี้ไม่มีคำบรรยายที่ใช้พากย์ได้' : (data.message || data.error || `API ${res.status}`);
      throw new Error(reason);
    }
    window.dispatchEvent(new CustomEvent('ai-dub-session', { detail: data }));
    return data;
  }

  async stopSession(sessionId) {
    window.dispatchEvent(new Event('ai-dub-stop'));
    if (!this.configured || !sessionId) return;
    await fetch(`${this.baseUrl}/api/dub/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => {});
  }
}

export const dubApi = new DubApi(globalThis.AI_BROWSER_API_BASE || DEFAULT_API_BASE);
