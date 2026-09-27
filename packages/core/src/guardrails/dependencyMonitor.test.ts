import { describe, expect, test } from "bun:test";
import { DEFAULT_THRESHOLDS, DependencyMonitor, fallbackNudgeLine } from "./dependencyMonitor.ts";

const T0 = Date.parse("2026-09-27T20:00:00Z");
const iso = (offsetMin: number) => new Date(T0 + offsetMin * 60000).toISOString();

function monitorAt(nowMin: number) {
  return new DependencyMonitor(DEFAULT_THRESHOLDS, () => new Date(T0 + nowMin * 60000));
}

describe("DependencyMonitor", () => {
  test("fresh session is ok", () => {
    const m = monitorAt(1);
    m.record({ sessionId: "a", at: iso(0), role: "user" });
    m.record({ sessionId: "a", at: iso(0.5), role: "persona" });
    const a = m.assess("a");
    expect(a.level).toBe("ok");
    expect(a.stats.sessionsToday).toBe(1);
    expect(m.nudgeDirective("a", "Sarah", ["maya"])).toBeNull();
  });

  test("too many messages in one session -> nudge", () => {
    const m = monitorAt(10);
    for (let i = 0; i < 40; i++) {
      m.record({ sessionId: "a", at: iso(i * 0.2), role: "user" });
      m.record({ sessionId: "a", at: iso(i * 0.2 + 0.1), role: "persona" });
    }
    const a = m.assess("a");
    expect(a.level).toBe("nudge");
    expect(a.reasons[0]).toMatch(/40 messages/);
    const d = m.nudgeDirective("a", "Sarah", ["maya"]);
    expect(d).toContain("maya");
    expect(d).toContain("gently");
  });

  test("long session AND long day -> strong", () => {
    const m = monitorAt(70);
    m.record({ sessionId: "a", at: iso(0), role: "user" });
    m.record({ sessionId: "a", at: iso(65), role: "user" });
    const a = m.assess("a");
    expect(a.level).toBe("strong");
    expect(a.reasons).toHaveLength(2);
    const d = m.nudgeDirective("a", "Sarah", []);
    expect(d).toContain("directly");
    expect(d).toContain("someone who is actually around");
  });

  test("many sessions today counts, sessions older than 24h drop out", () => {
    const m = monitorAt(0);
    for (const [id, min] of [["old1", -30 * 60], ["old2", -25 * 60], ["b", -600], ["c", -300], ["d", -100], ["e", -5]] as const) {
      m.record({ sessionId: id, at: iso(min), role: "user" });
    }
    const a = m.assess("e");
    expect(a.stats.sessionsToday).toBe(4);
    expect(a.level).toBe("nudge");
    expect(a.reasons[0]).toMatch(/4 sessions/);
  });

  test("session minutes measured from first to last event", () => {
    const m = monitorAt(31);
    m.record({ sessionId: "a", at: iso(0), role: "user" });
    m.record({ sessionId: "a", at: iso(30), role: "persona" });
    const a = m.assess("a");
    expect(Math.round(a.stats.sessionMinutes)).toBe(30);
    expect(a.level).toBe("nudge");
  });
});

describe("fallbackNudgeLine", () => {
  test("levels and people", () => {
    expect(fallbackNudgeLine("ok", ["maya"])).toBe("");
    expect(fallbackNudgeLine("nudge", ["maya"])).toBe("have you talked to maya lately");
    expect(fallbackNudgeLine("strong", ["maya"])).toBe("you should call maya. im serious");
    expect(fallbackNudgeLine("strong", [])).toMatch(/someone real/);
  });
});
