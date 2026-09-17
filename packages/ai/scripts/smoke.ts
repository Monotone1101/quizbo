/**
 * Live smoke test for the Gemini touchpoints (makes a few real API calls):
 *   npm run smoke -w @quizbo/ai
 * Prints ok / failure reason for extraction, weak-spot analysis and blind validation.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"));
} catch {
  // rely on the real environment
}

const { extractExams, geminiModel, isAiConfigured, validateQuestion, weakSpotAnalysis } = await import("../src/index");

if (!isAiConfigured()) {
  console.info("SKIPPED — no Gemini key found, so no calls were made.");
  console.info("  1. Get a free key: https://aistudio.google.com/apikey");
  console.info('  2. Add it to .env at the repo root:  GEMINI_API_KEY="AIza..."');
  console.info("  3. Re-run: npm run smoke -w @quizbo/ai");
  process.exit(0);
}
console.info(`model: ${geminiModel()}`);

const extraction = await extractExams({
  message: "Physics term 2 is on the 18th, optics and wave optics mostly. Also a maths unit test next Friday on inequalities.",
  today: "2026-09-11",
  timezone: "Asia/Kolkata",
  knownSubjects: ["Physics (Class 12)", "Maths (Class 12)"],
});
console.info("\n[extraction]", JSON.stringify(extraction, null, 2));

const analysis = await weakSpotAnalysis({
  tone: "direct",
  subjectName: "Physics",
  topicName: "Refraction at curved surfaces",
  correct: 1,
  total: 4,
  misses: [
    {
      question: "An object in air is 30 cm from a concave glass surface (n = 1.5) of radius 30 cm, facing the light. Where is the image?",
      chosen: "+30 cm, real, inside the glass",
      correct: "−30 cm, virtual, on the object's side",
      timeTakenMs: 3_100,
      timedOut: false,
    },
    {
      question: "In the Cartesian sign convention, a concave surface facing the incoming light has a radius of curvature that is:",
      chosen: "Positive",
      correct: "Negative",
      timeTakenMs: 2_400,
      timedOut: false,
    },
  ],
});
console.info("\n[analysis]", JSON.stringify(analysis, null, 2));

const validation = await validateQuestion({
  subject: "Physics",
  level: "Class 12",
  topic: "Total internal reflection",
  text: "What is the critical angle, in air, for a material of refractive index √2?",
  options: ["30°", "45°", "60°", "90°"],
  correctIndex: 1,
  difficulty: "MEDIUM",
});
console.info("\n[validation]", JSON.stringify(validation, null, 2));
