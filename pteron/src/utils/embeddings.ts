// Semantic embedding utilities using Transformers.js (Xenova/all-MiniLM-L6-v2).
// Vectors are stored in IndexedDB via vectorStore.ts; text metadata stays in
// chrome.storage.sync as before.

import type { FeatureExtractionPipeline, Tensor } from '@huggingface/transformers';
import { saveVector, getVector, getAllVectors, deleteVector } from './vectorStore.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkData {
  url: string;
  description?: string;
  tagIds?: string[];
}

export interface TagEntry {
  id: string;
  label: string;
}

export interface SemanticMatch {
  keyword: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Pipeline singleton
// ---------------------------------------------------------------------------

let _pipeline: FeatureExtractionPipeline | null = null;
let _pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;
  if (_pipelinePromise) return _pipelinePromise;

  _pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Disable local model lookup; always fetch from Hugging Face Hub
    env.allowLocalModels = false;
    const ortEnv = env as {
      backends?: {
        onnx?: {
          wasm?: {
            wasmPaths?: string;
          };
        };
      };
    };
    ortEnv.backends ??= {};
    ortEnv.backends.onnx ??= {};
    ortEnv.backends.onnx.wasm ??= {};
    ortEnv.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('ort/');
    const pipe = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32',
    });
    _pipeline = pipe as FeatureExtractionPipeline;
    return _pipeline;
  })();

  return _pipelinePromise;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Builds the combined text that gets embedded for a single link.
 * Format: `[keyword] [tag labels] [description]`
 */
export function buildEmbedText(
  keyword: string,
  tagLabels: string[],
  description: string,
): string {
  const parts: string[] = [keyword];
  if (tagLabels.length > 0) parts.push(tagLabels.join(' '));
  if (description) parts.push(description);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Core embed
// ---------------------------------------------------------------------------

/** Generates a normalized embedding vector for the given text. */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output: Tensor = await pipe._call(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two pre-normalized vectors.
 * Since `embedText` always normalizes, this is equivalent to the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---------------------------------------------------------------------------
// Background sync
// ---------------------------------------------------------------------------

/**
 * Ensures every link in `links` has an up-to-date vector in IndexedDB.
 * Vectors are regenerated only when the combined embed text has changed.
 * Orphaned vectors (deleted links) are pruned.
 *
 * This function is designed to run fire-and-forget on popup mount — it does
 * not block the UI. Failures are silently logged.
 */
export async function syncVectors(
  links: Record<string, LinkData>,
  tags: TagEntry[],
): Promise<void> {
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.label]));

  await Promise.all(
    Object.entries(links).map(async ([keyword, link]) => {
      const tagLabels = (link.tagIds ?? [])
        .map((id) => tagMap[id])
        .filter((l): l is string => Boolean(l));
      const text = buildEmbedText(keyword, tagLabels, link.description ?? '');

      const existing = await getVector(keyword);
      if (existing?.embeddedText === text) return; // already up-to-date

      try {
        const vector = await embedText(text);
        await saveVector({ keyword, embeddedText: text, vector });
        console.debug('[Pteron Embeddings] vectorized:', keyword);
      } catch (err) {
        console.warn('[Pteron Embeddings] failed to embed:', keyword, err);
      }
    }),
  );

  // Prune orphaned vectors for links that have since been deleted
  const allVectors = await getAllVectors();
  await Promise.all(
    allVectors
      .filter((v) => !links[v.keyword])
      .map((v) => deleteVector(v.keyword)),
  );
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

/**
 * Returns keywords sorted by semantic similarity to `query`.
 *
 * @param query           The search string typed by the user.
 * @param excludeKeywords Keywords already shown by exact/fuzzy matching.
 * @param threshold       Minimum cosine similarity to include (default 0.35).
 * @param limit           Maximum number of semantic results (default 5).
 */
export async function semanticSearch(
  query: string,
  excludeKeywords: string[],
  threshold = 0.35,
  limit = 5,
): Promise<SemanticMatch[]> {
  const allVectors = await getAllVectors();
  if (allVectors.length === 0) return [];

  const queryVector = await embedText(query);
  const excludeSet = new Set(excludeKeywords);

  const matches = allVectors
    .filter((v) => !excludeSet.has(v.keyword))
    .map((v) => ({
      keyword: v.keyword,
      score: cosineSimilarity(queryVector, v.vector),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return matches;
}
