import { describe, expect, it } from "vitest";
import { matchTopic, resolveTopics, type TopicRef } from "./topics";

const existing: TopicRef[] = [
  { id: "t1", name: "Reflection at plane surfaces", unit: "Optics" },
  { id: "t2", name: "Refraction at plane surfaces", unit: "Optics" },
  { id: "t3", name: "Refraction at curved surfaces", unit: "Optics" },
  { id: "t4", name: "Total internal reflection", unit: "Optics" },
  { id: "t5", name: "Lens formula", unit: "Optics" },
  { id: "t6", name: "Wave optics — interference", unit: "Optics" },
  { id: "t7", name: "Inequalities", unit: "Algebra" },
];

const ids = (match: ReturnType<typeof matchTopic>) =>
  match.kind === "topic" ? [match.topic.id] : match.kind === "group" ? match.topics.map((t) => t.id) : [];

describe("matchTopic", () => {
  it("resolves a chapter name, in any case, to all of its topics", () => {
    expect(matchTopic("Optics", existing).kind).toBe("group");
    expect(ids(matchTopic("  OPTICS ", existing))).toHaveLength(6);
    expect(ids(matchTopic("light", existing))).toHaveLength(6);
  });

  it("matches singular/plural and aliases to an existing topic", () => {
    expect(ids(matchTopic("inequality", existing))).toEqual(["t7"]);
    expect(ids(matchTopic("Lenses", existing))).toEqual(["t5"]);
    expect(ids(matchTopic("wave optics", existing))).toEqual(["t6"]);
  });

  it("groups every topic a shorter name could mean", () => {
    expect(ids(matchTopic("Refraction", existing))).toEqual(["t3", "t2"]);
  });

  it("tolerates small spelling differences", () => {
    expect(ids(matchTopic("Total internal reflexion", existing))).toEqual(["t4"]);
  });

  it("only proposes a new topic when nothing is close", () => {
    expect(matchTopic("Thermodynamics", existing).kind).toBe("new");
  });
});

describe("resolveTopics", () => {
  it("de-duplicates ids and new names", () => {
    const result = resolveTopics(["Optics", "optics", "Thermodynamics", "thermodynamics"], existing);
    expect(result.topicIds).toHaveLength(6);
    expect(result.newNames).toEqual(["Thermodynamics"]);
  });
});
