import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadSarahFixture, SARAH_FIXTURE_DIR } from "./fixtures.ts";
import { computeFingerprint } from "./stylometry/fingerprint.ts";

describe("Sarah fixture", () => {
  test("loads a realistic corpus with the canonical last message", async () => {
    const { profile, result } = await loadSarahFixture();
    expect(profile.slug).toBe("sarah");
    expect(profile.deceased).toBe(true);
    expect(result.source).toBe("fixture");
    expect(result.messages.length).toBeGreaterThanOrEqual(140);
    expect(result.skipped).toBeGreaterThanOrEqual(2);

    const last = result.messages.at(-1)!;
    expect(last.sender).toBe("them");
    expect(last.text).toBe("love you, going on a drive");
    expect(last.timestamp).toMatch(/^2026-01-27T17:12:00[+-]\d{2}:\d{2}$/);
    expect(last.timestamp).toBe(profile.lastMessageAt!.replace(/-08:00$/, last.timestamp.slice(-6)));

    const hiHi = result.messages.filter((m) => m.sender === "them" && m.text.startsWith("hi hi"));
    expect(hiHi.length).toBeGreaterThanOrEqual(8);

    for (const m of result.messages) {
      expect(m.text.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(m.timestamp))).toBe(false);
    }
    for (let i = 1; i < result.messages.length; i++) {
      expect(Date.parse(result.messages[i]!.timestamp)).toBeGreaterThanOrEqual(
        Date.parse(result.messages[i - 1]!.timestamp),
      );
    }
    const them = result.messages.filter((m) => m.sender === "them").length;
    const me = result.messages.length - them;
    expect(them).toBeGreaterThan(me);
    expect(me).toBeGreaterThan(50);
  });

  test("fingerprint.json is exactly what `bun run sarah` measures from the corpus", async () => {
    const { result } = await loadSarahFixture();
    const stored = await Bun.file(join(SARAH_FIXTURE_DIR, "fingerprint.json")).json();
    expect(stored).toEqual(JSON.parse(JSON.stringify(computeFingerprint(result.messages))));
  });
});
