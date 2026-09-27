import { describe, expect, test } from "bun:test";
import { parseWhatsApp } from "./whatsapp.ts";
import { detectAdapter } from "./index.ts";

const ANDROID = `1/27/26, 4:41 PM - Messages and calls are end-to-end encrypted. Tap to learn more.
1/27/26, 5:10 PM - Sarah: hair looks so good bub!!
1/27/26, 5:11 PM - Kartik: Nice. Come home
before the rain.
1/27/26, 5:11 PM - Sarah: <Media omitted>
1/27/26, 5:12 PM - Sarah: love you, going on a drive
`;

const IOS = `‎[1/27/26, 5:10:03 PM] Sarah: hi hi
[1/27/26, 5:11:45 PM] Kartik: Hey.
‎[1/27/26, 5:11:50 PM] Sarah: ‎image omitted
[1/27/26, 5:12:00 PM] Sarah: love you, going on a drive
`;

describe("parseWhatsApp", () => {
  test("android export: senders, multi-line, skipped system + media", () => {
    const r = parseWhatsApp(ANDROID, { themName: "sarah" });
    expect(r.source).toBe("whatsapp");
    expect(r.messages.map((m) => m.sender)).toEqual(["them", "me", "them"]);
    expect(r.messages[1]!.text).toBe("Nice. Come home\nbefore the rain.");
    expect(r.skipped).toBe(2);
    const last = r.messages.at(-1)!;
    expect(last.text).toBe("love you, going on a drive");
    expect(last.timestamp).toMatch(/^2026-01-27T17:12:00[+-]\d{2}:\d{2}$/);
  });

  test("ios export with LRM and narrow no-break spaces", () => {
    const r = parseWhatsApp(IOS, { themName: "Sarah" });
    expect(r.messages.map((m) => m.text)).toEqual(["hi hi", "Hey.", "love you, going on a drive"]);
    expect(r.messages[0]!.timestamp).toMatch(/^2026-01-27T17:10:03/);
    expect(r.skipped).toBe(1);
  });

  test("dmy date order", () => {
    const r = parseWhatsApp("27/01/2026, 17:12 - Sarah: hey\n", { themName: "Sarah", dateOrder: "dmy" });
    expect(r.messages[0]!.timestamp).toMatch(/^2026-01-27T17:12:00/);
  });

  test("12 AM / 12 PM handling", () => {
    const r = parseWhatsApp("1/1/26, 12:01 AM - Sarah: a\n1/1/26, 12:30 PM - Sarah: b\n", { themName: "Sarah" });
    expect(r.messages[0]!.timestamp).toMatch(/T00:01:00/);
    expect(r.messages[1]!.timestamp).toMatch(/T12:30:00/);
  });

  test("detectAdapter sniffs whatsapp", () => {
    expect(detectAdapter("chat.txt", ANDROID)).toBe("whatsapp");
    expect(detectAdapter("chat.txt", IOS)).toBe("whatsapp");
    expect(detectAdapter("notes.txt", "just some notes")).toBeNull();
  });
});
