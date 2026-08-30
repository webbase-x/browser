# Backend contract (connect at final phase)

The frontend is intentionally backend-free for now.
When ready, expose these endpoints and set `globalThis.AI_BROWSER_API_BASE` before `app.js` runs.

## GET /api/health
Response: `{ "ok": true }`

## POST /api/dub/session
Input:
```json
{
  "url": "https://example.com/video",
  "sourceLang": "auto",
  "targetLang": "th",
  "voiceStyle": "female",
  "sourceVolume": 15,
  "dubVolume": 100,
  "showSubtitles": true
}
```
Response (minimum):
```json
{ "id": "session-id", "status": "starting" }
```

## DELETE /api/dub/session/:id
Stops the live dubbing session.

## Important
A production-grade solution for arbitrary third-party sites cannot rely on iframe alone. Many sites block embedding using CSP/X-Frame-Options, and protected video/DRM cannot be safely or reliably proxied. The final backend should implement a Remote Browser/Proxy strategy only for sites/content the user is allowed to access and process.
