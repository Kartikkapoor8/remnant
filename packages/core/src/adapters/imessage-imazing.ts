import type { ImportResult, Message } from "../types.ts";
import { parseCsvRecords } from "./csv.ts";
import { localIso } from "./whatsapp.ts";

export interface ImazingOptions {
  themName?: string;
}

export const IMAZING_HEADER = [
  "Chat Session",
  "Message Date",
  "Delivered Date",
  "Read Date",
  "Edited Date",
  "Service",
  "Type",
  "Sender ID",
  "Sender Name",
  "Status",
  "Replying to",
  "Subject",
  "Text",
  "Attachment",
  "Attachment type",
];

/** `2025-11-03 14:32:11` (local time in the export) → ISO with local offset. */
function imazingDateToIso(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
  );
  if (Number.isNaN(d.getTime())) return null;
  return localIso(d);
}

export function parseImazingCsv(csv: string, opts: ImazingOptions = {}): ImportResult {
  const records = parseCsvRecords(csv);
  const messages: Message[] = [];
  let skipped = 0;
  let themName = opts.themName;

  for (const rec of records) {
    const type = (rec["Type"] ?? "").trim().toLowerCase();
    const text = (rec["Text"] ?? "").trim();
    const attachment = (rec["Attachment"] ?? "").trim();
    const timestamp = imazingDateToIso(rec["Message Date"] ?? "");

    if (type !== "incoming" && type !== "outgoing") {
      skipped++;
      continue;
    }
    if (!timestamp) {
      skipped++;
      continue;
    }
    if (text.length === 0) {
      // Attachment-only (or empty) rows carry no text to learn from.
      if (attachment.length > 0 || true) skipped++;
      continue;
    }
    const sender = type === "incoming" ? "them" : "me";
    if (sender === "them" && !themName) {
      const name = (rec["Sender Name"] ?? "").trim();
      if (name) themName = name;
    }
    messages.push({ sender, text, timestamp });
  }

  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { source: "imessage-imazing", themName, messages, skipped };
}
