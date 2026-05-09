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
      func: () => (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 3000),
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

async function _suggestTags(
  session: ChromeAISession,
  title: string,
  pageText: string,
  existingTags: Tag[],
): Promise<TagSuggestionResult> {
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
  let raw: string;
  try {
    raw = await session.prompt(prompt);
  } catch {
    return { matched: [], suggested: [] };
  }
  try {
    const m = raw.match(/\{[\s\S]*?\}/);
    if (!m) return { matched: [], suggested: [] };
    const parsed = JSON.parse(m[0]) as { matched?: unknown[]; suggested?: unknown[] };
    return {
      matched: (parsed.matched ?? [])
        .filter((l): l is string => typeof l === 'string' && labels.includes(l))
        .slice(0, 3),
      suggested: (parsed.suggested ?? [])
        .filter((l): l is string => typeof l === 'string')
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
