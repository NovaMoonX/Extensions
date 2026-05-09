// chrome.storage.sync helpers

export const KEYS = {
  SETTINGS: '__settings',
  BLOCKED: '__blockedSuggestions',
  noteKey: (keyword) => `__note_${keyword}`,
};

// Returns all saved links (excludes internal __ keys)
export async function getLinks() {
  const all = await chrome.storage.sync.get(null);
  const links = {};
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith('__') && value && typeof value === 'object' && !Array.isArray(value) && value.url) {
      links[key] = value;
    }
  }
  return links;
}

export async function saveLink(keyword, data) {
  await chrome.storage.sync.set({ [keyword]: data });
}

export async function deleteLink(keyword) {
  await chrome.storage.sync.remove(keyword);
}

export async function getLink(keyword) {
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

export async function getNote(keyword) {
  const key = KEYS.noteKey(keyword);
  const result = await chrome.storage.sync.get(key);
  return result[key] || '';
}

export async function saveNote(keyword, text) {
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

// Legacy aliases kept for any callers that haven't been updated yet
export const getLilyPads = getLinks;
export const saveLilyPad = saveLink;
export const deleteLilyPad = deleteLink;
export const getLilyPad = getLink;
export const getLeaflet = getNote;
export const saveLeaflet = saveNote;
