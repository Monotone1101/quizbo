import { describe, expect, it } from "vitest";
import { describeExtraction, parseExtraction, stripJsonFences } from "./extraction";

const payload = {
  exams: [
    {
      subject: "Physics",
      exam_name: "Term 2",
      exam_date: "2026-10-18",
      date_confidence: "explicit",
      date_phrase: "the 18th",
      topics: ["Optics", "optics", " Wave optics "],
      priority: "High",
    },
    {
      subject: "Maths",
      exam_name: "Unit test",
      exam_date: "2026-10-02",
      date_confidence: "inferred",
      date_phrase: "next Friday",
      topics: ["Inequalities", "Quadratics"],
      priority: null,
    },
  ],
  ambiguities: [],
};

describe("parseExtraction", () => {
  it("strips markdown fences before parsing", () => {
    const result = parseExtraction("```json\n" + JSON.stringify(payload) + "\n```");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.exams[0]).toMatchObject({ subject: "Physics", priority: "high", topics: ["Optics", "Wave optics"] });
    expect(result.value.exams[1]?.date_confidence).toBe("inferred");
  });

  it("tolerates prose around a single JSON object", () => {
    expect(parseExtraction(`Here you go: ${JSON.stringify(payload)} Hope that helps`).ok).toBe(true);
    expect(stripJsonFences("```\n{}\n```")).toBe("{}");
  });

  it("fails on non-JSON or the wrong shape instead of guessing", () => {
    expect(parseExtraction("I think your exam is on Friday")).toEqual({ ok: false, error: "not_json" });
    expect(parseExtraction('{"exam": "Physics"}')).toEqual({ ok: false, error: "missing_exams_array" });
    expect(parseExtraction('{"exams": [{"exam_date": "2026-10-18"}]}')).toEqual({ ok: false, error: "exam_0_missing_subject" });
    expect(parseExtraction("")).toEqual({ ok: false, error: "not_json" });
  });

  it("never lets a date through without a confidence the student must check", () => {
    const result = parseExtraction({
      exams: [
        { subject: "Chemistry", exam_date: "2026-11-02", topics: [] },
        { subject: "Biology", exam_date: "Oct 5", date_confidence: "explicit", topics: [] },
      ],
      ambiguities: ["Biology date unclear"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.exams[0]?.date_confidence).toBe("inferred");
    expect(result.value.exams[1]).toMatchObject({ exam_date: null, date_confidence: "missing" });
  });
});

describe("describeExtraction", () => {
  it("summarises exams and flags inferred dates", () => {
    const result = parseExtraction(payload);
    if (!result.ok) throw new Error("expected ok");
    const lines = describeExtraction(result.value);
    expect(lines[0]).toBe(
      "Two exams found. Physics — Term 2, 18 Oct, two topics. Maths — Unit test, two topics, and I read “next Friday” as 2 Oct.",
    );
    expect(lines[1]).toMatch(/confirm it on the card before I save anything/);
  });

  it("asks for details when nothing was found", () => {
    expect(describeExtraction({ exams: [], ambiguities: [] })[0]).toMatch(/couldn't find an exam/);
  });
});
