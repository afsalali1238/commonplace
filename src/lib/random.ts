/**
 * Small, dependency-free deterministic randomness helpers.
 *
 * Used wherever an order must be stable across renders - and identical on the
 * server and the client, so SSR markup hydrates cleanly - but must not be the
 * same for every item: feed sequencing (lib/feed.ts) and quiz option order
 * (components/Quiz.tsx). Never use Math.random() for anything that renders.
 */

/** mulberry32 - tiny 32-bit seeded PRNG, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit - turns a short id like "A1" into a well-spread seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A permutation of [0, n) that is a pure function of (key, salt).
 * Same key + salt -> same order, every time, on every runtime.
 */
export function seededPermutation(n: number, key: string, salt = 0): number[] {
  const seed = (hashString(key) ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  const rand = mulberry32(seed || 1);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Fisher-Yates shuffle - unbiased, O(n). Mutates a copy, never the input.
 * Pass a custom rng for deterministic shuffles (seeded); defaults to Math.random.
 */
export function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
