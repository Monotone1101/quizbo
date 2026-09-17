import { ThinkingLevel, type Content, type Part } from "@google/genai";
import { stripJsonFences } from "@quizbo/core";
import { z } from "zod";
import { describeError, gemini, geminiModel, isAiConfigured, isRetryable, type AiResult } from "./client";

export type Effort = "low" | "medium" | "high";

/** Provider-neutral conversation turn; converted to Gemini `Content` (roles "user" / "model"). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string | Part[];
}

export interface StructuredCall<S extends z.ZodType> {
  system: string;
  messages: ChatTurn[];
  schema: S;
  effort?: Effort;
  maxTokens?: number;
  signal?: AbortSignal;
}

const THINKING: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const BLOCKED_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

/** Zod → the JSON Schema subset Gemini accepts for `responseJsonSchema` (drops the `$schema` marker). */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  return jsonSchema;
}

/** Maps turns to Gemini contents, merging consecutive turns from the same side. */
export function toContents(messages: readonly ChatTurn[]): Content[] {
  const contents: Content[] = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const parts: Part[] = typeof message.content === "string" ? [{ text: message.content }] : message.content;
    const last = contents.at(-1);
    if (last && last.role === role) last.parts = [...(last.parts ?? []), ...parts];
    else contents.push({ role, parts });
  }
  return contents;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One narrowly scoped Gemini call that must return JSON matching `schema`. Never throws: every
 * failure (no key, rejected key, blocked content, truncated or unparseable output, API error) comes
 * back as `ok: false` so callers can fall back instead of crashing a battle screen or corrupting a plan.
 */
export async function callStructured<S extends z.ZodType>(
  call: StructuredCall<S>,
): Promise<AiResult<{ data: z.infer<S>; text: string }>> {
  if (!isAiConfigured()) return { ok: false, reason: "unconfigured" };
  const model = geminiModel();

  const request = () =>
    gemini().models.generateContent({
      model,
      contents: toContents(call.messages),
      config: {
        systemInstruction: call.system,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(call.schema),
        maxOutputTokens: call.maxTokens ?? 16_000,
        abortSignal: call.signal,
        ...(call.effort && model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: THINKING[call.effort] } } : {}),
      },
    });

  try {
    let response;
    try {
      response = await request();
    } catch (error) {
      if (!isRetryable(error) || call.signal?.aborted) throw error;
      await sleep(1_000);
      response = await request();
    }

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) return { ok: false, reason: "refusal", detail: String(blockReason) };
    const finish = String(response.candidates?.[0]?.finishReason ?? "");
    if (BLOCKED_FINISH.has(finish)) return { ok: false, reason: "refusal", detail: finish };
    if (finish === "MAX_TOKENS") return { ok: false, reason: "invalid_output", detail: "finishReason=MAX_TOKENS" };

    const text = (response.text ?? "").trim();
    let json: unknown;
    try {
      json = JSON.parse(stripJsonFences(text));
    } catch {
      return { ok: false, reason: "invalid_output", detail: "response was not JSON" };
    }
    const parsed = call.schema.safeParse(json);
    if (!parsed.success) return { ok: false, reason: "invalid_output", detail: parsed.error.issues[0]?.message };
    return { ok: true, value: { data: parsed.data as z.infer<S>, text }, model: response.modelVersion ?? model };
  } catch (error) {
    const { reason, detail } = describeError(error);
    return { ok: false, reason, detail };
  }
}
