import { describe, expect, test } from "bun:test";
import { parseCsv, parseCsvRecords } from "./csv.ts";

describe("parseCsv", () => {
  test("plain fields and CRLF", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\r\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  test("quoted fields with commas, doubled quotes and newlines", () => {
    const csv = '"x","she said ""hi, there""","line1\nline2"\n';
    expect(parseCsv(csv)).toEqual([["x", 'she said "hi, there"', "line1\nline2"]]);
  });
  test("no trailing newline and empty fields", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([["a", "", "c"], ["", "", ""]]);
  });
  test("strips BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  test("records keyed by header", () => {
    expect(parseCsvRecords("Name,Age\nSam,3\n")).toEqual([{ Name: "Sam", Age: "3" }]);
  });
});
