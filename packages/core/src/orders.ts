/** Randomness helpers for battles: seeded RNG, shuffles, per-player question orders and room codes. */
export type Rng = () => number;

/** Small, fast seeded PRNG so orders are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Sattolo's algorithm: a uniformly random single n-cycle, so no index maps to itself (n ≥ 2). */
function randomCycle(n: number, rng: Rng): number[] {
  const sigma = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * i);
    const tmp = sigma[i] as number;
    sigma[i] = sigma[j] as number;
    sigma[j] = tmp;
  }
  return sigma;
}

/**
 * Two independent orders over the same pool of `n` questions. The second is the first composed
 * with a derangement, so the players never face the same question in the same round (n ≥ 2).
 */
export function independentOrders(n: number, rng: Rng = Math.random): [number[], number[]] {
  const first = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );
  if (n < 2) return [first, first.slice()];
  const sigma = randomCycle(n, rng);
  const second = sigma.map((k) => first[k] as number);
  return [first, second];
}

/** No I, O, 0 or 1 — codes get read aloud across a classroom. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(rng: Rng = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch)) ? code : null;
}
