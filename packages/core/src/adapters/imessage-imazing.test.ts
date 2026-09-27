import { describe, expect, test } from "bun:test";
import { parseImazingCsv } from "./imessage-imazing.ts";
import { detectAdapter } from "./index.ts";

const CSV = `"Chat Session","Message Date","Delivered Date","Read Date","Edited Date","Service","Type","Sender ID","Sender Name","Status","Replying to","Subject","Text","Attachment","Attachment type"
"Sarah","2025-11-03 14:32:11","","","","iMessage","Incoming","+15551234567","Sarah","Read","","","hi hi
dani cancelled, ""shes sick""","",""
"Sarah","2025-11-03 14:35:02","2025-11-03 14:35:03","","","iMessage","Outgoing","me","Kartik","Delivered","","","Wild. Latte?","",""
"Sarah","2025-11-03 14:36:00","","","","iMessage","Incoming","+15551234567","Sarah","Read","","","","IMG_0042.HEIC","image/heic"
"Sarah","2025-11-03 14:36:30","","","","iMessage","Incoming","+15551234567","Sarah","Read","","","ya!! oat milk","",""
`;

describe("parseImazingCsv", () => {
  test("parses incoming/outgoing, multi-line quoted text, attachment-only skipped", () => {
    const r = parseImazingCsv(CSV);
    expect(r.source).toBe("imessage-imazing");
    expect(r.themName).toBe("Sarah");
    expect(r.messages).toHaveLength(3);
    expect(r.skipped).toBe(1);
    expect(r.messages[0]).toEqual({
      sender: "them",
      text: 'hi hi\ndani cancelled, "shes sick"',
      timestamp: expect.stringMatching(/^2025-11-03T14:32:11[+-]\d{2}:\d{2}$/),
    });
    expect(r.messages[1]!.sender).toBe("me");
    expect(r.messages[2]!.text).toBe("ya!! oat milk");
  });

  test("explicit themName wins", () => {
    expect(parseImazingCsv(CSV, { themName: "S" }).themName).toBe("S");
  });

  test("detectAdapter picks imazing by extension or header", () => {
    expect(detectAdapter("export.csv", CSV)).toBe("imessage-imazing");
    expect(detectAdapter("weird.dat", CSV)).toBe("imessage-imazing");
  });
});
