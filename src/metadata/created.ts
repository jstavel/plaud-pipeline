import { DateTime } from "luxon";
import type { CreatedSource } from "../domain/types.js";

const DATE_TOKEN = /(\d{4}-\d{2}-\d{2})/;

export function pragueDate(date: Date): string {
  return DateTime.fromJSDate(date).setZone("Europe/Prague").toFormat("yyyy-MM-dd");
}

export function formatLogTimestamp(date: Date): string {
  return DateTime.fromJSDate(date)
    .setZone("Europe/Prague")
    .toFormat("yyyy-MM-dd EEE HH:mm");
}

export interface CreatedValue {
  date: string;
  source: CreatedSource;
}

// The first valid YYYY-MM-DD token in the basename wins; otherwise the file's
// mtime date in Europe/Prague. The provenance goes into the LOGBOOK line.
export function createdFor(basename: string, mtime: Date): CreatedValue {
  const match = DATE_TOKEN.exec(basename);
  if (match) {
    const token = match[1] ?? "";
    const parsed = DateTime.fromFormat(token, "yyyy-MM-dd", { zone: "utc" });
    if (parsed.isValid) {
      return { date: token, source: "filename" };
    }
  }
  return { date: pragueDate(mtime), source: "mtime" };
}

export function logbookMessage(source: CreatedSource): string {
  return source === "filename"
    ? "Registered by C2 (created from filename)."
    : "Registered by C2 (created from mtime).";
}