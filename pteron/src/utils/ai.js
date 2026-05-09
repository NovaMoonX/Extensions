// AI Pilot utility — environment detection, session management, and suggestion generation.
// Prioritises Chrome Built-In AI (window.ai.languageModel, Chrome 126+).
// For Firefox / Safari the presence of a pre-loaded WebLLM engine is detected.

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * Returns information about the available AI environment.
 *
 * @returns {{ type: 'chrome'|'webllm'|'none', status: 'readily'|'after-download'|'not-installed'|'no' }}
 */
export async function detectAIEnvironment() {
  if (typeof window === 'undefined') return { type: 'none', status: 'no' };

  // Chrome 126+ Built-In AI (Gemini Nano via window.ai.languageModel)
  if (window.ai?.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available !== 'no') {
        return { type: 'chrome', status: capabilities.available };
      }
    } catch {
      // ignore — fall through to other checks
    }
  }

  // WebLLM engine pre-loaded by a companion script (Firefox / Safari)
  if (typeof window.__webllm_engine !== 'undefined') {
    return { type: 'webllm', status: 'readily' };
  }

  // Firefox / Safari without WebLLM — model not yet installed
  const ua = navigator.userAgent;
  if (ua.includes('Firefox') || (ua.includes('Safari') && !ua.includes('Chrome'))) {
    return { type: 'webllm', status: 'not-installed' };
  }

  return { type: 'none', status: 'no' };
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/**
 * Creates a Chrome Built-In AI language-model session.
 *
 * @param {string} systemPrompt
 * @param {(ratio: number) => void} [onProgress]  Called with values 0–1 while model downloads.
 * @returns {Promise<object>} The AI session object.
 */
export async function createChromeAISession(systemPrompt, onProgress) {
  if (!window.ai?.languageModel) throw new Error('Chrome AI not available');

  const session = await window.ai.languageModel.create({
    systemPrompt,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        if (onProgress && e.total > 0) {
          onProgress(e.loaded / e.total);
        }
      });
    },
  });
  return session;
}

// ---------------------------------------------------------------------------
// Page-text extraction (requires "scripting" permission + <all_urls>)
// ---------------------------------------------------------------------------

/**
 * Extracts visible body text from the active tab (max 3 000 characters).
 *
 * @returns {Promise<string>}
 */
export async function extractPageText() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return '';
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000),
    });
    return results?.[0]?.result || '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Individual generators (private — used by the public composites below)
// ---------------------------------------------------------------------------

async function _generateKeyword(session, title, pageText) {
  const prompt =
    `Generate a concise bookmark keyword for this web page.\n` +
    `Rules: lowercase only, words separated by hyphens, max 5 words, max 25 characters total.\n` +
    `Return ONLY the keyword — no explanation, no punctuation.\n\n` +
    `Title: ${title.slice(0, 120)}\n` +
    `Content: ${pageText.slice(0, 400)}\n\n` +
    `Keyword:`;
  let raw;
  try {
    raw = (await session.prompt(prompt)).trim();
  } catch {
    return '';
  }
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 5)
    .join('-')
    .slice(0, 25);
}

async function _generateDescription(session, title, pageText) {
  const prompt =
    `Write a short bookmark description (3–8 words) starting with an action verb such as "Open", "View", or "Browse".\n` +
    `Return ONLY the description — no explanation.\n\n` +
    `Title: ${title.slice(0, 120)}\n` +
    `Content: ${pageText.slice(0, 400)}\n\n` +
    `Description:`;
  try {
    const raw = (await session.prompt(prompt)).trim();
    return raw.slice(0, 60);
  } catch {
    return '';
  }
}

async function _suggestTags(session, title, pageText, existingTags) {
  const labels = existingTags.map((t) => t.label);
  const prompt =
    `Suggest relevant bookmark tags for this web page.\n` +
    `Existing tags: ${labels.length ? labels.join(', ') : '(none)'}\n` +
    `Rules:\n` +
    `- Choose up to 3 from the existing tags only if they clearly match.\n` +
    `- If confidence is low, suggest 1–2 new tags: lowercase, 1–2 words, concise.\n` +
    `- Respond ONLY with valid JSON: {"matched":["existingTag"],"suggested":["newTag"]}\n\n` +
    `Title: ${title.slice(0, 120)}\n` +
    `Content: ${pageText.slice(0, 400)}\n\n` +
    `JSON:`;
  let raw;
  try {
    raw = await session.prompt(prompt);
  } catch {
    return { matched: [], suggested: [] };
  }
  try {
    const m = raw.match(/\{[\s\S]*?\}/);
    if (!m) return { matched: [], suggested: [] };
    const parsed = JSON.parse(m[0]);
    return {
      matched: (parsed.matched || [])
        .filter((l) => labels.includes(l))
        .slice(0, 3),
      suggested: (parsed.suggested || [])
        .map((l) => l.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim())
        .filter(Boolean)
        .slice(0, 2),
    };
  } catch {
    return { matched: [], suggested: [] };
  }
}

// ---------------------------------------------------------------------------
// Public composites — one per UI stage
// ---------------------------------------------------------------------------

/**
 * Stage 2: refine keyword + description using full page text.
 *
 * @param {object} session  Chrome AI session.
 * @param {string} title    Page title.
 * @param {string} pageText Extracted body text.
 * @returns {Promise<{ keyword: string, description: string }>}
 */
export async function generateKeywordAndDescription(session, title, pageText) {
  const keyword = await _generateKeyword(session, title, pageText);
  const description = await _generateDescription(session, title, pageText);
  return { keyword, description };
}

/**
 * Stage 3: suggest tags from existing tag labels.
 *
 * @param {object} session       Chrome AI session.
 * @param {string} title         Page title.
 * @param {string} pageText      Extracted body text.
 * @param {Array<{id:string,label:string}>} existingTags  All stored tags.
 * @returns {Promise<{ matched: string[], suggested: string[] }>}
 */
export async function generateTagSuggestions(session, title, pageText, existingTags) {
  return _suggestTags(session, title, pageText, existingTags);
}
