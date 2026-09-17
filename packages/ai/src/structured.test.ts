import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toContents, toGeminiSchema } from "./structured";

describe("toContents", () => {
  it("maps assistant turns to Gemini's model role and merges consecutive turns", () => {
    expect(
      toContents([
        { role: "user", content: "first" },
        { role: "user", content: "second" },
        { role: "assistant", content: "reply" },
        { role: "user", content: [{ text: "with parts" }] },
      ]),
    ).toEqual([
      { role: "user", parts: [{ text: "first" }, { text: "second" }] },
      { role: "model", parts: [{ text: "reply" }] },
      { role: "user", parts: [{ text: "with parts" }] },
    ]);
  });
});

describe("toGeminiSchema", () => {
  it("produces a plain JSON Schema object without the $schema dialect marker", () => {
    const schema = toGeminiSchema(z.object({ subject: z.string(), exam_date: z.string().nullable(), topics: z.array(z.string()) }));
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).toMatchObject({ type: "object", required: ["subject", "exam_date", "topics"] });
  });
});
