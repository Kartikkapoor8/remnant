import type { ImportResult, Message, Sender } from "../types.ts";

export interface WhatsAppOptions {
  /** Display name of the person being reflected, as it appears in the export. */
  themName: string;
  /** Date component order. WhatsApp exports follow the phone's locale. */
  dateOrder?: "mdy" | "dmy";
}

/**
 * Android: `1/27/26, 5:12 PM - Sarah: text`
 * iOS:     `[1/27/26, 5:12:03 PM] Sarah: text`
 * Both may carry U+200E (LRM) and U+202F / U+00A0 spaces around the time.
 */
const LINE_RE =
  /^‎?\[?(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\]?\s*(?:-\s*)?(.*)$/;

const ATTACHMENT_RE =
  /^‎?\s*(<Media omitted>|<attached:[^>]*>|(?:image|video|audio|sticker|GIF|document|Contact card) omitted)\s*$/i;

function normalise(line: string): string {
  return line.replace(/[‎‏]/g, "").replace(/[  ]/g, " ");
}

function toIso(
  a: number,
  b: number,
  yy: number,
  h: number,
  m: number,
  s: number,
  ampm: string | undefined,
  order: "mdy" | "dmy",
): string {
  const year = yy < 100 ? 2000 + yy : yy;
  const month = order === "mdy" ? a : b;
  const day = order === "mdy" ? b : a;
  let hour = h;
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const d = new Date(year, month - 1, day, hour, m, s);
  return localIso(d);
}

/** ISO-8601 with the machine's local offset preserved (e.g. 2026-01-27T17:12:00-08:00). */
export function localIso(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function parseWhatsApp(text: string, opts: WhatsAppOptions): ImportResult {
  const order = opts.dateOrder ?? "mdy";
  const them = opts.themName.trim().toLowerCase();
  const messages: Message[] = [];
  let skipped = 0;
  let current: (Message & { raw: string }) | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.text.trim();
    if (body.length === 0 || ATTACHMENT_RE.test(body)) {
      skipped++;
    } else {
      messages.push({ sender: current.sender, text: body, timestamp: current.timestamp });
    }
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalise(rawLine);
    const m = LINE_RE.exec(line);
    if (m) {
      const rest = m[8] ?? "";
      const colon = rest.indexOf(": ");
      if (colon === -1) {
        // System line (encryption notice, group events, "You deleted this message").
        flush();
        skipped++;
        continue;
      }
      flush();
      const name = rest.slice(0, colon).trim();
      const body = rest.slice(colon + 2);
      const sender: Sender = name.toLowerCase() === them ? "them" : "me";
      current = {
        sender,
        text: body,
        timestamp: toIso(
          Number(m[1]),
          Number(m[2]),
          Number(m[3]),
          Number(m[4]),
          Number(m[5]),
          Number(m[6] ?? 0),
          m[7],
          order,
        ),
        raw: rawLine,
      };
      continue;
    }
    if (current) {
      // Continuation of a multi-line message.
      current.text += "\n" + rawLine;
    } else if (line.trim().length > 0) {
      skipped++;
    }
  }
  flush();

  return { source: "whatsapp", themName: opts.themName, messages, skipped };
}
