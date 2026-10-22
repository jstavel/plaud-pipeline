export type EntryKind =
  | "Plaud-voice-record"
  | "audio-file"
  | "archive"
  | "other-file";

export const ENTRY_KINDS: readonly EntryKind[] = [
  "Plaud-voice-record",
  "audio-file",
  "archive",
  "other-file",
];

export type LedgerState = "TODO" | "INGEST" | "REJECT" | "IGNORE" | "WAIVED";

export const LEDGER_STATES: readonly LedgerState[] = [
  "TODO",
  "INGEST",
  "REJECT",
  "IGNORE",
  "WAIVED",
];

export type OutOfScopeReason =
  | "directory"
  | "symlink"
  | "fifo"
  | "socket"
  | "other-non-regular";

export const OUT_OF_SCOPE_REASONS: readonly OutOfScopeReason[] = [
  "directory",
  "symlink",
  "fifo",
  "socket",
  "other-non-regular",
];

export type ErrorPhase = "scan" | "hash" | "stat" | "ffprobe" | "plaud" | "append";

export const ERROR_PHASES: readonly ErrorPhase[] = [
  "scan",
  "hash",
  "stat",
  "ffprobe",
  "plaud",
  "append",
];

export type CreatedSource = "filename" | "mtime";

export interface SourceItem {
  path: string;
  basename: string;
  hash: string;
  sizeBytes: number;
  kind: EntryKind;
  created: string;
  createdSource: CreatedSource;
  durationSeconds: number | null;
  durationText: string;
  bitrateText: string;
  plaudId: string;
}

export interface FileMetadata {
  durationSeconds: number | null;
  bitrateBps: number | null;
  sizeBytes: number;
  kind: EntryKind;
}

export interface PlaudRecording {
  id: string;
  startAtUtc: string;
  localStartKey: string;
  name: string;
  durationMs: number | null;
}

export interface LedgerEntry {
  state: LedgerState;
  headline: string;
  hash: string | null;
  plaudId: string;
  created: string;
  duration: string;
  bitrate: string;
  filesize: string;
  source: string;
  synopsis: string;
  cleanup: string;
  kind: string;
  logbook: string[];
}

export interface OutOfScopeItem {
  path: string;
  reason: OutOfScopeReason;
}

export interface RunError {
  path: string;
  phase: ErrorPhase;
  reason: string;
  recoverable: boolean;
}

export interface ReportItemNew {
  path: string;
  hash: string;
}

export interface ReportItemDuplicate {
  path: string;
  hash: string;
  existingSource?: string;
}

export interface ReportItemOutOfScope {
  path: string;
  reason: OutOfScopeReason;
}

export interface ReportItemError {
  path: string;
  phase: ErrorPhase;
  reason: string;
}

export interface RunReport {
  counts: {
    new: number;
    duplicates: number;
    outOfScope: number;
    errors: number;
  };
  new: ReportItemNew[];
  duplicates: ReportItemDuplicate[];
  outOfScope: ReportItemOutOfScope[];
  errors: ReportItemError[];
}

export class FatalError extends Error {
  readonly phase: ErrorPhase | "usage" | "ledger" | "lock";

  constructor(phase: ErrorPhase | "usage" | "ledger" | "lock", reason: string) {
    super(reason);
    this.name = "FatalError";
    this.phase = phase;
  }
}
