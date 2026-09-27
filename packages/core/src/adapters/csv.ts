/**
 * Minimal RFC-4180 CSV parser.
 *
 * Handles quoted fields, doubled quotes ("") inside quoted fields, and
 * newlines inside quoted fields. Accepts \n and \r\n line endings.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  // Strip UTF-8 BOM if present.
  if (input.charCodeAt(0) === 0xfeff) i = 1;

  while (i < n) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Final field/row (file may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV with a header row into objects keyed by header name. */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input).filter((r) => !(r.length === 1 && r[0] === ""));
  const header = rows[0];
  if (!header) return [];
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h.trim()] = r[idx] ?? "";
    });
    return rec;
  });
}
