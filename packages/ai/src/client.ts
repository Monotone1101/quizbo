import { ApiError, GoogleGenAI } from "@google/genai";

/**
 * Every AI touchpoint defaults to the newest Gemini model with a free tier; override with
 * QUIZBO_GEMINI_MODEL. Free-tier prompts may be used by Google to improve its products.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export type AiFailureReason = "unconfigured" | "auth_error" | "refusal" | "invalid_output" | "rate_limited" | "api_error";

export type AiResult<T> = { ok: true; value: T; model: string } | { ok: false; reason: AiFailureReason; detail?: string };

export function geminiModel(): string {
  return process.env.QUIZBO_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function apiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

export function isAiConfigured(): boolean {
  return Boolean(apiKey());
}

let cached: { key: string; client: GoogleGenAI } | null = null;

export function gemini(): GoogleGenAI {
  const key = apiKey();
  if (!cached || cached.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  return cached.client;
}

export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.status >= 500);
}

export function describeError(error: unknown): { reason: AiFailureReason; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403 || (error.status === 400 && /api[_ ]?key/i.test(error.message))) {
      return { reason: "auth_error", detail: `Gemini rejected the API key (${error.status})` };
    }
    if (error.status === 429) return { reason: "rate_limited", detail: error.message };
    return { reason: "api_error", detail: `${error.status} ${error.message}` };
  }
  return { reason: "api_error", detail: error instanceof Error ? error.message : String(error) };
}
