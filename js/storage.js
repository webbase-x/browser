const KEYS = {
  favorites: 'aiBrowser.favorites.v1',
  history: 'aiBrowser.history.v1',
  settings: 'aiBrowser.settings.v1'
};

const DEFAULT_SETTINGS = {
  dubEnabled: false,
  sourceLang: 'auto',
  targetLang: 'th',
  voiceStyle: 'female',
  sourceVolume: 15,
  dubVolume: 100,
  showSubtitles: true
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFavorites() { return read(KEYS.favorites, []); }
export function setFavorites(items) { write(KEYS.favorites, items.slice(0, 200)); }
export function getHistory() { return read(KEYS.history, []); }
export function setHistory(items) { write(KEYS.history, items.slice(0, 500)); }
export function getSettings() { return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }; }
export function setSettings(settings) { write(KEYS.settings, { ...DEFAULT_SETTINGS, ...settings }); }

export function exportAll() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: getFavorites(),
    history: getHistory(),
    settings: getSettings()
  };
}

export function importAll(data) {
  if (!data || data.version !== 1) throw new Error('ไฟล์ไม่รองรับ');
  if (Array.isArray(data.favorites)) setFavorites(data.favorites);
  if (Array.isArray(data.history)) setHistory(data.history);
  if (data.settings && typeof data.settings === 'object') setSettings(data.settings);
}
