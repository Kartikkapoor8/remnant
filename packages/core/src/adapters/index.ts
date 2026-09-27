export { parseWhatsApp, localIso, type WhatsAppOptions } from "./whatsapp.ts";
export { parseImazingCsv, IMAZING_HEADER, type ImazingOptions } from "./imessage-imazing.ts";
export { parseCsv, parseCsvRecords } from "./csv.ts";

export type AdapterId = "imessage-imazing" | "whatsapp";

const WHATSAPP_LINE = /^‎?\[?\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4},?\s+\d{1,2}:\d{2}/m;

/** Pick an adapter from the filename extension and a sniff of the content. */
export function detectAdapter(filename: string, content: string): AdapterId | null {
  const lower = filename.toLowerCase();
  const head = content.slice(0, 2000);
  if (lower.endsWith(".csv") || /"Chat Session","Message Date"/.test(head)) {
    return "imessage-imazing";
  }
  if (lower.endsWith(".txt") || WHATSAPP_LINE.test(head)) {
    return WHATSAPP_LINE.test(head) ? "whatsapp" : null;
  }
  return null;
}
