import { useState, useEffect, useRef } from 'react';
import {
  getEngineReady,
  onEngineStatus,
  type AIEngineSession,
} from '../utils/aiEngine.ts';
import {
  extractPageText,
  generateKeywordAndDescription,
  generateTagSuggestions,
  type Tag,
} from '../utils/ai.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AIPhase =
  | 'idle'
  | 'initializing'
  | 'stage2'
  | 'stage3'
  | 'done'
  | 'unavailable';

/** A single AI-proposed tag — either an existing tag match or a brand-new one. */
export interface AITagSuggestion {
  /** Stable key for React lists; equals `existingId` for existing tags. */
  tempId: string;
  label: string;
  /** True when this tag does not yet exist in storage. */
  isNew: boolean;
  /** ID of the matched existing tag; null when `isNew` is true. */
  existingId: string | null;
}

/** All pending AI suggestions. Null means no suggestion for that field. */
export interface AIPendingSuggestions {
  keyword: string | null;
  description: string | null;
  tags: AITagSuggestion[] | null;
}

export interface UseAIEnhancementReturn {
  aiPhase: AIPhase;
  /** Engine loading progress 0–1 while the AI model is loading from cache. */
  modelProgress: number;
  /** Suggestions waiting for user approval. Apply them yourself; call dismiss when done. */
  pendingSuggestions: AIPendingSuggestions;
  dismissKeyword(): void;
  dismissDescription(): void;
  dismissTag(tempId: string): void;
}

const EMPTY_SUGGESTIONS: AIPendingSuggestions = {
  keyword: null,
  description: null,
  tags: null,
};

/**
 * Runs the three-stage AI enhancement pipeline for the link form.
 *
 * @param enabled       Set to false when editing an existing link or using prefill data.
 * @param existingTags  Snapshot of all tags at mount time (used for stage-3 matching).
 * @param titleHint     Page title when known (e.g. from the pending-URL flow).
 *                      When omitted the hook queries `chrome.tabs` directly.
 */
export function useAIEnhancement(
  enabled: boolean,
  existingTags: Tag[],
  titleHint?: string,
): UseAIEnhancementReturn {
  const [aiPhase, setAiPhase] = useState<AIPhase>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [pendingSuggestions, setPendingSuggestions] =
    useState<AIPendingSuggestions>(EMPTY_SUGGESTIONS);

  const sessionRef = useRef<AIEngineSession | null>(null);
  const pipelineRan = useRef(false);
  // Always reflect the latest existingTags in the async pipeline, even if tags loaded after mount
  const existingTagsRef = useRef<Tag[]>(existingTags);
  existingTagsRef.current = existingTags;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function runPipeline(): Promise<void> {
      if (pipelineRan.current || cancelled) return;
      pipelineRan.current = true;

      const handle = await getEngineReady();
      if (!handle || cancelled) {
        if (!cancelled) setAiPhase('unavailable');
        return;
      }

      try {
        console.debug('[Pteron AI] Creating AI session…');
        const session = await handle.createSession(
          'You are a helpful assistant that generates concise, accurate bookmark metadata.',
        );
        if (cancelled) { session.destroy(); return; }
        sessionRef.current = session;

        // ── Stage 2: keyword + description ──────────────────────────────
        setAiPhase('stage2');
        console.debug('[Pteron AI] Stage 2: extracting page text…');
        const pageText = await extractPageText();
        console.debug('[Pteron AI] Page text length:', pageText.length);
        if (cancelled) return;

        // Resolve the page title: use hint if provided, otherwise query the tab
        let title = titleHint ?? '';
        if (!title) {
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            title = tabs[0]?.title ?? '';
            console.debug('[Pteron AI] Resolved page title from tab:', title);
          } catch (err) {
            console.warn('[Pteron AI] Could not query active tab:', err);
          }
        } else {
          console.debug('[Pteron AI] Using provided titleHint:', title);
        }

        // AIEngineSession is structurally identical to ChromeAISession — assignable directly
        const typedSession = session as unknown as import('../utils/ai.ts').ChromeAISession;

        console.debug('[Pteron AI] Generating keyword + description…');
        const { keyword: aiKeyword, description: aiDesc } =
          await generateKeywordAndDescription(typedSession, title, pageText);
        console.debug('[Pteron AI] Stage 2 result — keyword:', aiKeyword, 'description:', aiDesc);
        if (cancelled) return;

        // Store as pending suggestions — NOT applied automatically
        setPendingSuggestions((prev) => ({
          ...prev,
          keyword: aiKeyword || null,
          description: aiDesc || null,
        }));

        // ── Stage 3: tags ────────────────────────────────────────────────
        setAiPhase('stage3');
        console.debug('[Pteron AI] Stage 3: generating tag suggestions…');
        // Use the ref so we always have the latest tags even if they loaded after mount
        const currentTags = existingTagsRef.current;
        const tagResult = await generateTagSuggestions(typedSession, title, pageText, currentTags);
        console.debug('[Pteron AI] Stage 3 result — matched:', tagResult.matched, 'suggested:', tagResult.suggested);
        if (cancelled) return;

        const normalizeLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        const tagSuggestions: AITagSuggestion[] = [
          // Matched existing tags — auto-select, show with indicator
          ...currentTags
            .filter((t) => tagResult.matched.some(
              (m) => normalizeLabel(m) === normalizeLabel(t.label)
            ))
            .map((t) => ({
              tempId: t.id,
              label: t.label,
              isNew: false,
              existingId: t.id,
            })),
          // Suggested new tags — deduplicated against existing (normalize before compare)
          ...tagResult.suggested
            .filter(
              (label) =>
                !currentTags.some(
                  (t) => normalizeLabel(t.label) === normalizeLabel(label),
                ),
            )
            .map((label) => ({
              tempId: crypto.randomUUID(),
              label,
              isNew: true,
              existingId: null,
            })),
        ];

        setPendingSuggestions((prev) => ({
          ...prev,
          tags: tagSuggestions.length > 0 ? tagSuggestions : null,
        }));

        setAiPhase('done');
        console.debug('[Pteron AI] Pipeline complete ✓');
      } catch (err) {
        if (!cancelled) {
          console.error('[Pteron AI] Pipeline failed:', err);
          setAiPhase('unavailable');
        }
      }
    }

    // Subscribe to engine status — starts pipeline when engine is ready,
    // shows 'initializing' while engine loads from cache, stays idle during
    // first-time download (App.jsx overlay handles that UX).
    const unsub = onEngineStatus(({ status, progress }) => {
      if (cancelled) return;
      if (status === 'loading' || status === 'detecting') {
        setAiPhase('initializing');
        setModelProgress(progress);
      } else if (status === 'unavailable') {
        setAiPhase('unavailable');
      } else if (status === 'ready') {
        void runPipeline();
      }
      // 'downloading': App.jsx overlay blocks the form — stay idle here.
    });

    return () => {
      cancelled = true;
      pipelineRan.current = false;
      unsub();
      if (sessionRef.current) {
        try {
          sessionRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        sessionRef.current = null;
      }
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  // `existingTags` and `titleHint` are intentionally captured once at mount.

  // ---------------------------------------------------------------------------
  // Dismiss helpers — each clears just its own suggestion slot
  // ---------------------------------------------------------------------------

  function dismissKeyword(): void {
    setPendingSuggestions((prev) => ({ ...prev, keyword: null }));
  }

  function dismissDescription(): void {
    setPendingSuggestions((prev) => ({ ...prev, description: null }));
  }

  function dismissTag(tempId: string): void {
    setPendingSuggestions((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t.tempId !== tempId) ?? null,
    }));
  }

  return {
    aiPhase,
    modelProgress,
    pendingSuggestions,
    dismissKeyword,
    dismissDescription,
    dismissTag,
  };
}
