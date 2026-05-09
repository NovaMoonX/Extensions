// chrome.storage.sync helpers

export const KEYS = {
  SETTINGS: '__settings',
  BLOCKED: '__blockedSuggestions',
  noteKey: (keyword) => `__note_${keyword}`,
};

// Returns all saved links (excludes internal __ keys)
export async function getLilyPads() {
  const all = await chrome.storage.sync.get(null);
  const pads = {};
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith('__') && value && typeof value === 'object' && !Array.isArray(value) && value.url) {
      pads[key] = value;
    }
  }
  return pads;
}

export async function saveLilyPad(keyword, data) {
  await chrome.storage.sync.set({ [keyword]: data });
}

export async function deleteLilyPad(keyword) {
  await chrome.storage.sync.remove(keyword);
}

export async function getLilyPad(keyword) {
  const result = await chrome.storage.sync.get(keyword);
  return result[keyword] || null;
}

export async function getSettings() {
  const { [KEYS.SETTINGS]: settings = {} } = await chrome.storage.sync.get(KEYS.SETTINGS);
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({ [KEYS.SETTINGS]: settings });
}

export async function getBlockedSuggestions() {
  const { [KEYS.BLOCKED]: list = [] } = await chrome.storage.sync.get(KEYS.BLOCKED);
  return list;
}

export async function saveBlockedSuggestions(list) {
  await chrome.storage.sync.set({ [KEYS.BLOCKED]: list });
}

export async function getLeaflet(keyword) {
  const key = KEYS.noteKey(keyword);
  const result = await chrome.storage.sync.get(key);
  return result[key] || '';
}

export async function saveLeaflet(keyword, text) {
  const key = KEYS.noteKey(keyword);
  if (text) {
    await chrome.storage.sync.set({ [key]: text });
  } else {
    await chrome.storage.sync.remove(key);
  }
}

export async function keywordExists(keyword) {
  const result = await chrome.storage.sync.get(keyword);
  return !!result[keyword];
}
