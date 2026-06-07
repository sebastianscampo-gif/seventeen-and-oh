// Minimal, dependency-free CSV reader/writer for the 17-0 data pipeline.
// Handles quoted fields, embedded commas/newlines, and "" escapes.
// Everything is treated as strings; callers coerce types via util.mjs helpers.

import fs from "node:fs";

/**
 * Parse CSV text into an array of row objects keyed by header name.
 * - Blank lines are skipped.
 * - Lines whose first non-empty cell starts with "#" are treated as comments.
 * - Header names are trimmed.
 */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === "") continue; // blank line
    if (cells[0] != null && cells[0].trim().startsWith("#")) continue; // comment
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (cells[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

/** Read + parse a CSV file. Returns [] if the file does not exist. */
export function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return parseCsv(fs.readFileSync(filePath, "utf8"));
}

/** Low-level tokenizer: CSV text -> array of arrays of raw string cells. */
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  // Normalize newlines so \r\n and \r behave like \n.
  const s = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row (file may not end in newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Quote a single value if it contains comma, quote, or newline. */
function quoteCell(value) {
  const v = value == null ? "" : String(value);
  if (/[",\n\r]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

/**
 * Serialize an array of row objects to CSV text.
 * `columns` fixes the column order; any keys not listed are appended.
 */
export function toCsv(rows, columns) {
  const cols = columns ? [...columns] : [];
  if (!columns) {
    const seen = new Set();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          seen.add(k);
          cols.push(k);
        }
      }
    }
  }
  const lines = [cols.map(quoteCell).join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => quoteCell(r[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

/** Serialize rows and write them to a file. */
export function writeCsv(filePath, rows, columns) {
  fs.writeFileSync(filePath, toCsv(rows, columns));
}
