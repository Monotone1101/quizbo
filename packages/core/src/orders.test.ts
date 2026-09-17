import { describe, expect, it } from "vitest";
import { generateRoomCode, independentOrders, mulberry32, normalizeRoomCode, ROOM_CODE_ALPHABET } from "./orders";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("independentOrders", () => {
  it("gives each player a full permutation and never the same question in the same position", () => {
    for (const n of [2, 3, 5, 15]) {
      for (let seed = 1; seed <= 300; seed++) {
        const [first, second] = independentOrders(n, mulberry32(seed));
        expect([...first].sort((a, b) => a - b)).toEqual(range(n));
        expect([...second].sort((a, b) => a - b)).toEqual(range(n));
        expect(first.some((question, round) => second[round] === question)).toBe(false);
      }
    }
  });

  it("is reproducible with the same seed", () => {
    expect(independentOrders(15, mulberry32(42))).toEqual(independentOrders(15, mulberry32(42)));
  });
});

describe("room codes", () => {
  it("generates five unambiguous characters", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(rng);
      expect(code).toHaveLength(5);
      expect([...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it("normalises typed codes and rejects impossible ones", () => {
    expect(normalizeRoomCode(" ab3xq ")).toBe("AB3XQ");
    expect(normalizeRoomCode("4k9-qx")).toBe("4K9QX");
    expect(normalizeRoomCode("AB0XQ")).toBeNull();
    expect(normalizeRoomCode("ABCD")).toBeNull();
  });
});
