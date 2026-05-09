/**
 * aiEngine — popup-lifetime AI engine singleton.
 *
 * Boot sequence (called once in App.jsx on first mount):
 *   1. Detect environment (Chrome Built-In AI or WebLLM).
 *   2. If Chrome Built-In AI is ready → resolve immediately (no download needed for session creation).
 *   3. If WebLLM needs downloading → surface download progress, then resolve.
 *   4. If WebLLM is cached → load silently in the background, resolve when ready.
 *
 * Any code that needs the engine awaits `getEngineReady()`, which returns the
 * same promise regardless of when it's called. The promise resolves with an
 * `EngineHandle` or rejects if setup failed.
 *
 * The hook `useAIEnhancement` subscribes to status changes via `onEngineStatus`.
 */

import {
  detectAIEnvironment,
  createChromeAISession,
  type ChromeAISession,
} from './ai.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EngineStatus =
  | 'idle'           // boot() not yet called
  | 'detecting'      // running detectAIEnvironment
  | 'downloading'    // WebLLM model is being downloaded (first run)
  | 'loading'        // WebLLM engine loading from cache (fast, background)
  | 'ready'          // engine is available
  | 'unavailable';   // no AI support on this device

export interface EngineBootProgress {
  status: EngineStatus;
  /** 0–1 during downloading / loading phases. */
  progress: number;
}

/** Unified session interface — same shape for Chrome and WebLLM. */
export interface AIEngineSession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}

export interface EngineHandle {
  type: 'chrome' | 'webllm';
  createSession(systemPrompt: string): Promise<AIEngineSession>;
}

type StatusListener = (progress: EngineBootProgress) => void;

// ---------------------------------------------------------------------------
// Module-level singleton state
// ---------------------------------------------------------------------------

let _status: EngineStatus = 'idle';
let _progress = 0;
let _handle: EngineHandle | null = null;
let _bootPromise: Promise<EngineHandle | null> | null = null;
const _listeners = new Set<StatusListener>();

function _emit(status: EngineStatus, progress = 0): void {
  _status = status;
  _progress = progress;
  console.debug(`[Pteron AIEngine] status = ${status}, progress = ${Math.round(progress * 100)}%`);
  _listeners.forEach((fn) => fn({ status, progress }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Subscribe to engine status changes. Returns an unsubscribe function. */
export function onEngineStatus(fn: StatusListener): () => void {
  fn({ status: _status, progress: _progress }); // fire immediately with current state
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Returns the current engine state without subscribing. */
export function getEngineStatus(): EngineBootProgress {
  return { status: _status, progress: _progress };
}

/**
 * Returns a promise that resolves to the engine handle (or null if unavailable).
 * Safe to call multiple times — always returns the same promise.
 */
export function getEngineReady(): Promise<EngineHandle | null> {
  if (_bootPromise) return _bootPromise;
  // boot() was not called yet — return a rejected-safe pending promise
  // that will be resolved once boot() is called.
  _bootPromise = new Promise((resolve) => {
    const unsub = onEngineStatus(({ status }) => {
      if (status === 'ready') { unsub(); resolve(_handle); }
      if (status === 'unavailable') { unsub(); resolve(null); }
    });
  });
  return _bootPromise;
}

/**
 * Boot the AI engine. Call once from App.jsx on mount.
 * Subsequent calls are no-ops — returns the same promise.
 */
export function bootAIEngine(): Promise<EngineHandle | null> {
  if (_bootPromise && _status !== 'idle') return _bootPromise;

  _bootPromise = _runBoot();
  return _bootPromise;
}

// ---------------------------------------------------------------------------
// Boot logic
// ---------------------------------------------------------------------------

async function _runBoot(): Promise<EngineHandle | null> {
  _emit('detecting');

  const env = await detectAIEnvironment();
  console.debug('[Pteron AIEngine] environment detected:', env);

  // ── Chrome Built-In AI ─────────────────────────────────────────────────
  if (env.type === 'chrome') {
    _emit('ready');
    _handle = {
      type: 'chrome',
      async createSession(systemPrompt) {
        console.debug('[Pteron AIEngine] Creating Chrome AI session…');
        const session: ChromeAISession = await createChromeAISession(
          systemPrompt,
          (ratio) => {
            // Chrome may download the model on first session create
            _emit('downloading', ratio);
          },
        );
        _emit('ready');
        console.debug('[Pteron AIEngine] Chrome AI session ready');
        return session;
      },
    };
    return _handle;
  }

  // ── WebLLM ────────────────────────────────────────────────────────────
  if (env.type === 'webllm') {
    const needsDownload = env.status === 'not-installed';
    _emit(needsDownload ? 'downloading' : 'loading', 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webllm = await import('@mlc-ai/web-llm' as string) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      CreateMLCEngine: (...args: any[]) => Promise<unknown>;
    };

    let engine: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      engine = await webllm.CreateMLCEngine('Phi-3.5-mini-instruct-q4f16_1-MLC', {
        initProgressCallback: (report: { progress: number; text: string }) => {
          console.debug('[Pteron AIEngine] WebLLM progress:', report.text);
          _emit(needsDownload ? 'downloading' : 'loading', report.progress);
        },
      });
    } catch (err) {
      console.error('[Pteron AIEngine] WebLLM boot failed:', err);
      _emit('unavailable');
      return null;
    }

    window.__webllm_engine = engine;
    _emit('ready');
    console.debug('[Pteron AIEngine] WebLLM engine ready ✓');

    _handle = {
      type: 'webllm',
      async createSession(systemPrompt) {
        // WebLLM uses the shared engine instance; wrap it in the session interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eng = engine as any;
        return {
          async prompt(text: string): Promise<string> {
            console.debug('[Pteron AIEngine] WebLLM prompt (systemPrompt injected)');
            const reply = await eng.chat.completions.create({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
              ],
              temperature: 0.3,
              max_tokens: 128,
            });
            return reply.choices?.[0]?.message?.content ?? '';
          },
          destroy() {
            // WebLLM engine is shared — do not destroy it
          },
        };
      },
    };
    return _handle;
  }

  // ── No AI ────────────────────────────────────────────────────────────
  console.debug('[Pteron AIEngine] No AI environment available');
  _emit('unavailable');
  return null;
}
