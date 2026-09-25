import ExcelJS from "exceljs";
import { AppError } from "./errors";

/**
 * Read an uploaded CSV or XLSX into rows keyed by normalised header
 * ("Unit Number" → "unit_number"). Import endpoints validate rows themselves;
 * this only turns bytes into strings.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5_000;

export interface Table {
  headers: string[];
  rows: { line: number; values: Record<string, string> }[];
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export async function parseTable(format: "csv" | "xlsx", base64: string): Promise<Table> {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new AppError("BAD_REQUEST", "The file is empty.");
  if (buf.length > MAX_BYTES) throw new AppError("BAD_REQUEST", "The file is larger than 5 MB.");
  const grid = format === "csv" ? parseCsv(buf.toString("utf8").replace(/^﻿/, "")) : await parseXlsx(buf);
  const [head, ...body] = grid;
  if (!head) throw new AppError("BAD_REQUEST", "The file has no header row.");
  const headers = head.map(norm);
  const rows = body
    .map((cells, i) => ({ line: i + 2, values: Object.fromEntries(headers.map((h, j) => [h, (cells[j] ?? "").trim()])) }))
    .filter((r) => Object.values(r.values).some((v) => v !== ""));
  if (rows.length > MAX_ROWS) throw new AppError("BAD_REQUEST", `Import at most ${MAX_ROWS} rows at a time.`);
  return { headers, rows };
}

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new AppError("BAD_REQUEST", "That isn't a readable .xlsx file.");
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new AppError("BAD_REQUEST", "The workbook has no sheets.");
  const out: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    out.push(values.slice(1).map((v) => cellText(v)));
  });
  return out;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
  }
  return String(v);
}
