import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TtsCache, ttsCacheKey, isTextWithinLimit } from "./ttsCache.js";

describe("ttsCacheKey", () => {
  it("combines voiceId and text with a colon", () => {
    assert.equal(ttsCacheKey("voice-1", "hello"), "voice-1:hello");
  });
});

describe("isTextWithinLimit", () => {
  it("accepts text at or under the limit", () => {
    assert.equal(isTextWithinLimit("hello", 5), true);
    assert.equal(isTextWithinLimit("hi", 5), true);
  });

  it("rejects text over the limit", () => {
    assert.equal(isTextWithinLimit("hello world", 5), false);
  });
});

describe("TtsCache", () => {
  it("returns undefined on a miss and the cached value on a hit", () => {
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 1024 });
    assert.equal(cache.get("missing"), undefined);
    const value = Buffer.from("audio-bytes");
    cache.set("key-1", value);
    assert.equal(cache.get("key-1"), value);
  });

  it("evicts the least-recently-used entry when the entry-count limit is exceeded", () => {
    const cache = new TtsCache({ maxEntries: 2, maxBytes: 1024 });
    cache.set("a", Buffer.from("a"));
    cache.set("b", Buffer.from("b"));
    cache.set("c", Buffer.from("c")); // over maxEntries: "a" is oldest, evicted
    assert.equal(cache.get("a"), undefined);
    assert.notEqual(cache.get("b"), undefined);
    assert.notEqual(cache.get("c"), undefined);
    assert.equal(cache.size, 2);
  });

  it("a cache hit refreshes recency, protecting the entry from the next eviction", () => {
    const cache = new TtsCache({ maxEntries: 2, maxBytes: 1024 });
    cache.set("a", Buffer.from("a"));
    cache.set("b", Buffer.from("b"));
    // Touch "a" so "b" becomes the least-recently-used entry instead.
    cache.get("a");
    cache.set("c", Buffer.from("c"));
    assert.notEqual(cache.get("a"), undefined, "a was refreshed and should survive");
    assert.equal(cache.get("b"), undefined, "b became LRU and should be evicted");
    assert.notEqual(cache.get("c"), undefined);
  });

  it("evicts least-recently-used entries to stay within the byte budget, even under the entry-count limit", () => {
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 10 });
    cache.set("a", Buffer.alloc(4));
    cache.set("b", Buffer.alloc(4));
    // Total would be 12 > maxBytes(10); "a" (oldest) is evicted to make room.
    cache.set("c", Buffer.alloc(4));
    assert.equal(cache.get("a"), undefined);
    assert.notEqual(cache.get("b"), undefined);
    assert.notEqual(cache.get("c"), undefined);
    assert.ok(cache.byteSize <= 10);
  });

  it("does not cache a single item larger than the whole byte budget", () => {
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 10 });
    cache.set("huge", Buffer.alloc(20));
    assert.equal(cache.get("huge"), undefined);
    assert.equal(cache.size, 0);
    assert.equal(cache.byteSize, 0);
  });

  it("does not disturb existing entries when an oversized item is rejected", () => {
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 10 });
    cache.set("a", Buffer.alloc(4));
    cache.set("huge", Buffer.alloc(20));
    assert.notEqual(cache.get("a"), undefined);
    assert.equal(cache.get("huge"), undefined);
  });

  it("re-setting an existing key updates its size accounting instead of double-counting", () => {
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 10 });
    cache.set("a", Buffer.alloc(4));
    cache.set("a", Buffer.alloc(6));
    assert.equal(cache.byteSize, 6);
    assert.equal(cache.size, 1);
  });
});

describe("TtsCache — oversized replacement of an existing key", () => {
  it("drops the stale value rather than keeping it when the new one is too big", () => {
    // set() early-returns for an oversized value; doing that before removing the existing
    // entry would keep serving audio the key no longer maps to.
    const cache = new TtsCache({ maxEntries: 10, maxBytes: 100 });
    cache.set("k", Buffer.alloc(50));
    assert.equal(cache.get("k")?.byteLength, 50);

    cache.set("k", Buffer.alloc(500));

    assert.equal(cache.get("k"), undefined, "the stale value is gone");
    assert.equal(cache.byteSize, 0, "and its bytes are no longer counted");
  });
});
