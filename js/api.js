// Adapter สำหรับ backend เฟสสุดท้าย (เช่น Vercel)
// Frontend สามารถพัฒนา/ทดสอบได้โดยไม่ต้อง deploy backend ก่อน
const DEFAULT_API_BASE = '';

export class DubApi {
  constructor(baseUrl = DEFAULT_API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  get configured() {
    return Boolean(this.baseUrl);
  }

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
    if (!res.ok) throw new Error(`สร้าง session ไม่สำเร็จ (${res.status})`);
    return res.json();
  }

  async stopSession(sessionId) {
    if (!this.configured || !sessionId) return;
    await fetch(`${this.baseUrl}/api/dub/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }
}

export const dubApi = new DubApi(globalThis.AI_BROWSER_API_BASE || '');
