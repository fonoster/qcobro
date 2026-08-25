/**
 * Bounded LRU cache for synthesized TTS audio, keyed by `voiceId:text` (see
 * `ttsCacheKey`). Backs `GET /api/voice/tts` in `index.ts`.
 *
 * Two independent limits are enforced together on every insert: a max entry count
 * and a max total byte budget. Entry count alone isn't sufficient — a synthesized MP3
 * can run from tens of KB to a few MB depending on script length, so a handful of
 * long scripts could exhaust memory well under any reasonable entry cap. Eviction is
 * least-recently-used, repeated until BOTH limits are satisfied.
 *
 * A single item larger than the whole byte budget is never cached — it would evict
 * every other entry and still not fit, so `set` is a no-op for it. The caller is
 * still expected to synthesize and serve that item; only caching is skipped.
 *
 * Backed by `Map`, which iterates in insertion order, so re-inserting a key (on a
 * `get` hit, to refresh recency, or on `set`) moves it to the most-recently-used end
 * for free — the least-recently-used entry is always the first one `Map#keys()`
 * yields.
 */
export class TtsCache {
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly entries = new Map<string, Buffer>();
  private totalBytes = 0;

  constructor(options: { maxEntries: number; maxBytes: number }) {
    this.maxEntries = options.maxEntries;
    this.maxBytes = options.maxBytes;
  }

  /** Number of entries currently cached. */
  get size(): number {
    return this.entries.size;
  }

  /** Total bytes of audio currently cached. */
  get byteSize(): number {
    return this.totalBytes;
  }

  /**
   * Returns the cached audio for `key`, or `undefined` on a miss. A hit refreshes
   * `key` as most-recently-used, protecting it from the next eviction.
   */
  get(key: string): Buffer | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  /**
   * Caches `value` under `key`, evicting least-recently-used entries until both the
   * entry-count and byte-budget limits are satisfied. A no-op when `value` alone is
   * larger than `maxBytes`, since it could never fit regardless of what else is
   * evicted.
   */
  set(key: string, value: Buffer): void {
    // Drop any existing entry BEFORE the size check: returning early while leaving the old
    // value in place would keep serving stale audio for a key whose new value is oversized.
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.totalBytes -= existing.byteLength;
      this.entries.delete(key);
    }

    if (value.byteLength > this.maxBytes) return;

    this.entries.set(key, value);
    this.totalBytes += value.byteLength;

    while (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const oldestValue = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldestValue !== undefined) this.totalBytes -= oldestValue.byteLength;
    }
  }
}

/**
 * Builds the cache key for a TTS request. Extracted so the route handler and its
 * tests share one definition instead of re-deriving the `voiceId:text` shape.
 */
export function ttsCacheKey(voiceId: string, text: string): string {
  return `${voiceId}:${text}`;
}

/**
 * Whether `text` is within the accepted length for a TTS request. The route rejects
 * over-long input with 400 before ever calling the TTS provider — see
 * `ttsConfigSchema.maxTextLength` in `@qcobro/common` for why this exists.
 */
export function isTextWithinLimit(text: string, maxLength: number): boolean {
  return text.length <= maxLength;
}
