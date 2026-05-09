// AI Pilot utility — environment detection, session management, and suggestion generation.
// Prioritizes Chrome Built-In AI when running in a Chrome extension context.
// For Firefox / Safari the presence of a pre-loaded WebLLM engine is detected.

// ---------------------------------------------------------------------------
// Chrome AI global type augmentation
// ---------------------------------------------------------------------------

interface DownloadProgressEvent extends Event {
  loaded: number;
  total: number;
}

interface AIMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (e: DownloadProgressEvent) => void,
  ): void;
}

interface ChromeAICreateOptions {
  systemPrompt: string;
  monitor?: (m: AIMonitor) => void;
}

export interface ChromeAISession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}

declare global {
  interface Window {
    ai?: {
      languageModel?: {
        capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
        create(options: ChromeAICreateOptions): Promise<ChromeAISession>;
      };
    };
    __webllm_engine?: unknown;
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AIEnvType = 'chrome' | 'webllm' | 'none';
export type AIEnvStatus = 'readily' | 'after-download' | 'not-installed' | 'no';

export interface AIEnvironment {
  type: AIEnvType;
  status: AIEnvStatus;
}

export interface Tag {
  id: string;
  label: string;
}

export interface TagSuggestionResult {
  matched: string[];
  suggested: string[];
}

export interface KeywordDescriptionResult {
  keyword: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Environment detection — Chrome extension context checked first
// ---------------------------------------------------------------------------

/**
 * Returns information about the available AI environment.
 *
 * Detection order:
 *  1. Chrome extension context + Built-In AI enabled  →  chrome
 *  2. Chrome extension context + Built-In AI disabled →  fall through to WebLLM
 *  3. Pre-loaded WebLLM engine                        →  webllm / readily
 *  4. Any browser without engine                      →  webllm / not-installed
 *  5. Everything else                                 →  none
 */
export async function detectAIEnvironment(): Promise<AIEnvironment> {
  if (typeof window === 'undefined') {
    console.debug('[Pteron AI] detectAIEnvironment: no window — returning none');
    return { type: 'none', status: 'no' };
  }

  // ── 1 & 2. Chrome extension context — prefer Built-In AI, fall back to WebLLM ──
  const isChrome =
    typeof chrome !== 'undefined' && typeof chrome?.runtime?.id === 'string';

  console.debug('[Pteron AI] detectAIEnvironment: isChrome =', isChrome);

  if (isChrome) {
    if (window.ai?.languageModel) {
      try {
        const capabilities = await window.ai.languageModel.capabilities();
        console.debug('[Pteron AI] Chrome AI capabilities:', capabilities);
        if (capabilities.available !== 'no') {
          console.debug('[Pteron AI] Using Chrome Built-In AI, status =', capabilities.available);
          return { type: 'chrome', status: capabilities.available };
        }
        console.debug('[Pteron AI] Chrome AI available = "no" — falling back to WebLLM');
      } catch (err) {
        console.warn('[Pteron AI] chrome.ai.languageModel.capabilities() threw — falling back to WebLLM:', err);
      }
    } else {
      console.debug('[Pteron AI] window.ai.languageModel not present — falling back to WebLLM');
    }
    // Chrome Built-In AI unavailable or disabled — fall through to WebLLM below
  }

  // ── 3. Check for a pre-loaded WebLLM engine ───────────────────────────────
  if (typeof window.__webllm_engine !== 'undefined') {
    console.debug('[Pteron AI] WebLLM engine already loaded');
    return { type: 'webllm', status: 'readily' };
  }

  // ── 4. No engine loaded yet — offer to download ───────────────────────────
  console.debug('[Pteron AI] WebLLM not installed — will prompt download');
  return { type: 'webllm', status: 'not-installed' };
}

// ---------------------------------------------------------------------------
// WebLLM engine installation (Firefox / Safari)
// ---------------------------------------------------------------------------

/**
 * Attempts to dynamically load and initialize the WebLLM engine.
 * Sets `window.__webllm_engine` on success.
 *
 * @param onProgress  Called with 0–1 as the model downloads.
 * @returns `true` when the engine is ready, `false` on failure.
 */
export async function loadWebLLMEngine(
  onProgress: (ratio: number) => void,
): Promise<boolean> {
  try {
    console.debug('[Pteron AI] loadWebLLMEngine: attempting dynamic import of webllm');

    // webllm is an optional peer dependency — import only when needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webllm = await import('@mlc-ai/web-llm' as string) as { CreateMLCEngine: (...args: any[]) => Promise<unknown> };
    console.debug('[Pteron AI] webllm module loaded');

    const engine = await webllm.CreateMLCEngine('Phi-3.5-mini-instruct-q4f16_1-MLC', {
      initProgressCallback: (report: { progress: number; text: string }) => {
        console.debug('[Pteron AI] WebLLM init progress:', report.text);
        onProgress(report.progress);
      },
    });

    // Expose globally so detectAIEnvironment picks it up on next call
    window.__webllm_engine = engine;
    console.debug('[Pteron AI] WebLLM engine ready');
    return true;
  } catch (err) {
    console.error('[Pteron AI] loadWebLLMEngine failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/**
 * Creates a Chrome Built-In AI language-model session.
 *
 * @param systemPrompt  System prompt for the session.
 * @param onProgress    Called with values 0–1 while the model downloads.
 */
export async function createChromeAISession(
  systemPrompt: string,
  onProgress?: (ratio: number) => void,
): Promise<ChromeAISession> {
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
 */
export async function extractPageText(): Promise<string> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return '';
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        // Prefer structured metadata over raw body text — much less noisy
        const metaDesc =
          document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
          document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
          '';
        const h1 = document.querySelector('h1')?.innerText ?? '';
        const structured = [h1, metaDesc].filter(Boolean).join(' — ');
        if (structured.length > 20) return structured.replace(/\s+/g, ' ').trim().slice(0, 500);
        // Fallback: first 500 chars of body text
        return (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
      },
    });
    return (results?.[0]?.result as string) ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Individual generators (private)
// ---------------------------------------------------------------------------

async function _generateKeyword(
  session: ChromeAISession,
  title: string,
  pageText: string,
): Promise<string> {
  const prompt =
    `Generate a concise bookmark keyword for this web page.\n` +
    `Rules: lowercase only, words separated by hyphens, max 5 words, max 25 characters total.\n` +
    `Return ONLY the keyword — no explanation, no punctuation.\n\n` +
    `Title: ${title.slice(0, 120)}\n` +
    `Content: ${pageText.slice(0, 400)}\n\n` +
    `Keyword:`;
  let raw: string;
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

async function _generateDescription(
  session: ChromeAISession,
  title: string,
  pageText: string,
): Promise<string> {
  const prompt =
    `Complete the bookmark description below in 5-12 words. Start with an action verb (Watch, Open, Browse, View, Read, etc.). Write the description text only — no labels, no bullet points, no explanations, no quotes.\n` +
    `Good: Watch official Hello music video by Adele on YouTube\n` +
    `Good: Browse the latest TypeScript release notes on GitHub\n\n` +
    `Title: ${title.slice(0, 120)}\n` +
    `Content: ${pageText.slice(0, 400)}\n\n` +
    `Description:`;
  try {
    let raw = (await session.prompt(prompt)).trim();
    // If the model output multiple lines, take only the first non-empty one
    const firstLine = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
    raw = firstLine;
    // Strip wrapping quotes the model sometimes adds
    raw = raw.replace(/^["'"']+|["'"']+$/g, '').trim();
    // Strip anything after a parenthesis or "Note:" that models sometimes append
    raw = raw.replace(/\s*[\(\[].*$/, '').trim();
    raw = raw.replace(/\s*\bNote\b.*$/i, '').trim();
    // Strip any leading label the model prefixes (e.g. "Description: ", "Output: ")
    raw = raw.replace(/^(description|output|result|answer)\s*:\s*/i, '').trim();
    // Strip trailing punctuation
    raw = raw.replace(/[.!?,;:]+$/, '').trim();
    return raw.slice(0, 90);
  } catch {
    return '';
  }
}

async function _suggestTags(
  session: ChromeAISession,
  title: string,
  pageText: string,
  existingTags: Tag[],
): Promise<TagSuggestionResult> {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const labels = existingTags.map((t) => t.label);
  const labelsNorm = labels.map(normalize);
  const context = `Title: ${title.slice(0, 120)}\nContent: ${pageText.slice(0, 200)}`;

  // ── Prompt 1: which existing tags apply? ─────────────────────────────────
  const matched: string[] = [];
  if (labels.length > 0) {
    const matchPrompt =
      `You are a bookmark tag assistant.\n` +
      `Given the page below, list which of the following existing tags DIRECTLY describe the main topic.\n` +
      `A tag only qualifies if the page is SPECIFICALLY about that topic — not just related to it.\n` +
      `Example: "musicvideo" qualifies for a YouTube music video page, but NOT for a movie or shopping page.\n` +
      `If none qualify, respond with an empty array.\n` +
      `Existing tags: ${labels.join(', ')}\n` +
      `Respond ONLY with a JSON array of matching tag labels exactly as shown, e.g. ["tag1","tag2"] or [].\n\n` +
      `${context}\n\nMatching tags:`;

    try {
      const raw1 = await session.prompt(matchPrompt);
      console.debug('[Pteron AI] _suggestTags prompt 1 (match) raw:', raw1);
      const m1 = raw1.match(/\[[\s\S]*?\]/);
      if (m1) {
        const parsed1 = JSON.parse(m1[0]) as unknown[];
        for (const l of parsed1) {
          if (typeof l !== 'string') continue;
          const norm = normalize(l);
          const idx = labelsNorm.indexOf(norm);
          if (idx >= 0) matched.push(labels[idx]);
        }
      }
    } catch (err) {
      console.warn('[Pteron AI] _suggestTags prompt 1 failed:', err);
    }
  }

  // ── Prompt 2: is a new tag needed? ───────────────────────────────────────
  const suggested: string[] = [];
  const alreadyCovered = matched.length > 0
    ? `Already selected tags: ${matched.join(', ')}.`
    : `No existing tags matched.`;

  const suggestPrompt =
    `You are a bookmark tag assistant.\n` +
    `${alreadyCovered}\n` +
    `Does this page need ONE additional new tag that the already-selected tags don't cover?\n` +
    `Only suggest a new tag if it adds meaningful organizational value beyond what is already selected.\n` +
    `Rules for a new tag:\n` +
    `- General enough to reuse across many future bookmarks (e.g. "shopping", "tutorial", "news", "movie")\n` +
    `- NOT specific to this one page, brand, or event\n` +
    `- Lowercase, no spaces, no special characters, 1-2 words run together\n` +
    `If no new tag is needed, respond with [].\n` +
    `Respond ONLY with a JSON array, e.g. ["newtag"] or [].\n\n` +
    `${context}\n\nNew tag:`;

  try {
    const raw2 = await session.prompt(suggestPrompt);
    console.debug('[Pteron AI] _suggestTags prompt 2 (new) raw:', raw2);
    const m2 = raw2.match(/\[[\s\S]*?\]/);
    if (m2) {
      const parsed2 = JSON.parse(m2[0]) as unknown[];
      for (const l of parsed2) {
        if (typeof l !== 'string') continue;
        const norm = normalize(l);
        // Only accept if it's not already an existing tag
        if (!labelsNorm.includes(norm)) suggested.push(norm);
      }
    }
  } catch (err) {
    console.warn('[Pteron AI] _suggestTags prompt 2 failed:', err);
  }

  console.debug('[Pteron AI] _suggestTags — matched:', matched, 'suggested:', suggested);
  return { matched: matched.slice(0, 3), suggested: suggested.slice(0, 1) };
}

// ---------------------------------------------------------------------------
// Public composites — one per UI stage
// ---------------------------------------------------------------------------

/**
 * Stage 2: generate keyword + description from page title and body text.
 */
export async function generateKeywordAndDescription(
  session: ChromeAISession,
  title: string,
  pageText: string,
): Promise<KeywordDescriptionResult> {
  const keyword = await _generateKeyword(session, title, pageText);
  const description = await _generateDescription(session, title, pageText);
  return { keyword, description };
}

/**
 * Stage 3: suggest tags from existing tag labels.
 */
export async function generateTagSuggestions(
  session: ChromeAISession,
  title: string,
  pageText: string,
  existingTags: Tag[],
): Promise<TagSuggestionResult> {
  return _suggestTags(session, title, pageText, existingTags);
}
