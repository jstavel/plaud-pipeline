export interface LedgerEntryInput {
  estimateMin: number | null;
  basename: string;
  properties: {
    hash: string;
    plaudId: string;
    created: string;
    duration: string;
    bitrate: string;
    filesize: number | string;
    source: string;
    synopsis: string;
    cleanup: string;
    kind: string;
  };
  logbook: {
    timestamp: string;
    message: string;
  };
}

// Property lines are padded to a 15-character prefix before the value
// (1-based column 16 including the two-space drawer indent; 0-based byte 15).
// :CLEANUP: carries no padding.
const PAD: Record<string, number> = {
  HASH: 7,
  "PLAUD-ID": 3,
  CREATED: 4,
  DURATION: 3,
  BITRATE: 4,
  FILESIZE: 3,
  SOURCE: 5,
  SYNOPSIS: 3,
  KIND: 7,
};

function propertyLine(tag: string, value: string): string {
  const pad = PAD[tag];
  if (pad === undefined) {
    throw new Error(`unknown ledger property tag: ${tag}`);
  }
  return `  :${tag}:${" ".repeat(pad)}${value}`;
}

export function serializeEntry(entry: LedgerEntryInput): string {
  const p = entry.properties;
  const heading =
    entry.estimateMin == null
      ? `* TODO ${entry.basename}`
      : `* TODO [${entry.estimateMin} min] ${entry.basename}`;
  const lines = [
    heading,
    "  :PROPERTIES:",
    propertyLine("HASH", p.hash),
    propertyLine("PLAUD-ID", p.plaudId),
    propertyLine("CREATED", p.created),
    propertyLine("DURATION", p.duration),
    propertyLine("BITRATE", p.bitrate),
    propertyLine("FILESIZE", String(p.filesize)),
    propertyLine("SOURCE", p.source),
    propertyLine("SYNOPSIS", p.synopsis),
    "  :CLEANUP:",
    propertyLine("KIND", p.kind),
    "  :END:",
    "  :LOGBOOK:",
    `  - [${entry.logbook.timestamp}] ${entry.logbook.message}`,
    "  :END:",
  ];
  return lines.join("\n");
}