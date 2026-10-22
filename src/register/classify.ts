import type { EntryKind } from "../domain/types.js";

const PLAUD_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}_\d{2}_\d{2}/;
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".wav",
  ".flac",
  ".ogg",
  ".aac",
  ".opus",
]);
const ARCHIVE_PATTERN = /\.(?:zip|tar|tgz|tar\.gz)$/;

// KIND is derived from the filename only (R7): a Plaud recording by its
// timestamp pattern, never by API results, so an outage cannot change KIND.
export function kindForBasename(basename: string): EntryKind {
  if (PLAUD_PATTERN.test(basename)) {
    return "Plaud-voice-record";
  }
  const lower = basename.toLowerCase();
  if (ARCHIVE_PATTERN.test(lower)) {
    return "archive";
  }
  const dot = lower.lastIndexOf(".");
  if (dot >= 0 && AUDIO_EXTENSIONS.has(lower.slice(dot))) {
    return "audio-file";
  }
  return "other-file";
}

export function estimateMin(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

export function durationText(durationSeconds: number): string {
  const total = Math.floor(durationSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function bitrateText(bitrateBps: number | null): string {
  if (bitrateBps === null) {
    return "";
  }
  return `${Math.floor(bitrateBps / 1000)}k`;
}