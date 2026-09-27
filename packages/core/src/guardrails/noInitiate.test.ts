import { describe, expect, test } from "bun:test";
import { canPersonaSpeak, createSession, recordTurn } from "./noInitiate.ts";

describe("noInitiate", () => {
  test("persona cannot open a session", () => {
    const s = createSession("s1", "2026-09-27T20:00:00Z");
    const r = canPersonaSpeak(s);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/never opens/);
  });
  test("persona may reply after the user writes", () => {
    const s = createSession("s1");
    recordTurn(s, "user", "2026-09-27T20:00:00Z");
    expect(canPersonaSpeak(s)).toEqual({ allowed: true });
  });
  test("persona cannot double-send", () => {
    const s = createSession("s1");
    recordTurn(s, "user");
    recordTurn(s, "persona");
    const r = canPersonaSpeak(s);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/already replied/);
  });
  test("alternation resumes after the next user turn", () => {
    const s = createSession("s1");
    recordTurn(s, "user");
    recordTurn(s, "persona");
    recordTurn(s, "user");
    expect(canPersonaSpeak(s).allowed).toBe(true);
    expect(s.messages).toHaveLength(3);
  });
  test("recordTurn stamps a time", () => {
    const s = createSession("s1");
    recordTurn(s, "user");
    expect(Number.isNaN(Date.parse(s.messages[0]!.at))).toBe(false);
  });
});
