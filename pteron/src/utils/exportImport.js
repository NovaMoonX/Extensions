const EXPORT_FORMAT_VERSION = 2;

export async function exportData() {
  const allData = await chrome.storage.sync.get(null);
  const exportObj = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    links: {},
    notes: {},
    blockedSuggestions: allData['__blockedSuggestions'] || [],
    settings: allData['__settings'] || {},
  };

  for (const [key, value] of Object.entries(allData)) {
    if (key.startsWith('__note_')) {
      exportObj.notes[key.slice('__note_'.length)] = value;
    } else if (!key.startsWith('__') && value?.url) {
      exportObj.links[key] = value;
    }
  }

  return JSON.stringify(exportObj, null, 2);
}

export async function importData(jsonText, overwrite) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON file');
  }

  const toSet = {};

  // Support both new key names (links/notes) and legacy names (lilyPads/leaflets)
  const linksData = parsed.links || parsed.lilyPads;
  const notesData = parsed.notes || parsed.leaflets;

  if (linksData && typeof linksData === 'object') {
    for (const [keyword, value] of Object.entries(linksData)) {
      if (!keyword || keyword.startsWith('__') || typeof keyword !== 'string') continue;
      if (!value || typeof value !== 'object' || !value.url) continue;
      if (!overwrite) {
        const existing = await chrome.storage.sync.get(keyword);
        if (existing[keyword]) continue;
      }
      toSet[keyword] = value;
    }
  }

  if (notesData && typeof notesData === 'object') {
    for (const [keyword, noteText] of Object.entries(notesData)) {
      if (!keyword || keyword.startsWith('__') || typeof keyword !== 'string') continue;
      if (typeof noteText !== 'string') continue;
      const noteKey = `__note_${keyword}`;
      if (!overwrite) {
        const existing = await chrome.storage.sync.get(noteKey);
        if (existing[noteKey]) continue;
      }
      if (noteText) toSet[noteKey] = noteText;
    }
  }

  if (parsed.blockedSuggestions && Array.isArray(parsed.blockedSuggestions)) {
    const { __blockedSuggestions: existing = [] } = await chrome.storage.sync.get('__blockedSuggestions');
    toSet['__blockedSuggestions'] = [...new Set([...existing, ...parsed.blockedSuggestions])];
  }

  if (overwrite && parsed.settings && typeof parsed.settings === 'object') {
    toSet['__settings'] = parsed.settings;
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.sync.set(toSet);
  }

  return Object.keys(toSet).length;
}
