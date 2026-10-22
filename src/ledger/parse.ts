import { FatalError, type LedgerEntry, type LedgerState } from "../domain/types.js";

const HEADING = /^\* (TODO|INGEST|REJECT|IGNORE|WAIVED)(?: (.+))?$/;
const ANY_HEADING = /^\* /;
const DRAWER_OPEN = /^  :([A-Za-z0-9-]+):\s*$/;
const DRAWER_END = /^  :END:\s*$/;
const PROPERTY = /^  :([A-Za-z0-9-]+):(.*)$/;
const HASH64 = /^[0-9a-f]{64}$/;

export function parseLedger(text: string): LedgerEntry[] {
  const lines = text.split("\n");
  const entries: LedgerEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const heading = HEADING.exec(line);
    if (!heading) {
      i += 1;
      continue;
    }

    const state = (heading[1] ?? "TODO") as LedgerState;
    const headline = heading[2] ?? "";
    const entry: LedgerEntry = {
      state,
      headline,
      hash: null,
      plaudId: "",
      created: "",
      duration: "",
      bitrate: "",
      filesize: "",
      source: "",
      synopsis: "",
      cleanup: "",
      kind: "",
      logbook: [],
    };
    i += 1;

    while (i < lines.length && !ANY_HEADING.test(lines[i] ?? "")) {
      const raw = lines[i] ?? "";
      const open = DRAWER_OPEN.exec(raw);
      if (!open) {
        i += 1;
        continue;
      }
      const drawer = open[1] ?? "";
      const start = i;
      i += 1;
      let closed = false;
      const body: Array<{ name: string; value: string }> = [];
      while (i < lines.length) {
        const inner = lines[i] ?? "";
        if (DRAWER_END.test(inner)) {
          closed = true;
          i += 1;
          break;
        }
        if (ANY_HEADING.test(inner)) {
          break;
        }
        if (drawer === "PROPERTIES") {
          const prop = PROPERTY.exec(inner);
          if (!prop) {
            throw new FatalError(
              "ledger",
              `malformed property drawer at line ${start + 1}: ${JSON.stringify(raw)}`,
            );
          }
          body.push({ name: prop[1] ?? "", value: (prop[2] ?? "").trim() });
        } else if (drawer === "LOGBOOK") {
          const bullet = inner.replace(/^ {2}/, "");
          if (bullet.startsWith("- ")) {
            entry.logbook.push(bullet);
          }
        }
        i += 1;
      }
      if (!closed) {
        throw new FatalError(
          "ledger",
          `unterminated drawer :${drawer}: opened at line ${start + 1}`,
        );
      }
      if (drawer === "PROPERTIES") {
        for (const { name, value } of body) {
          switch (name) {
            case "HASH":
              entry.hash = HASH64.test(value) ? value : null;
              break;
            case "PLAUD-ID":
              entry.plaudId = value;
              break;
            case "CREATED":
              entry.created = value;
              break;
            case "DURATION":
              entry.duration = value;
              break;
            case "BITRATE":
              entry.bitrate = value;
              break;
            case "FILESIZE":
              entry.filesize = value;
              break;
            case "SOURCE":
              entry.source = value;
              break;
            case "SYNOPSIS":
              entry.synopsis = value;
              break;
            case "CLEANUP":
              entry.cleanup = value;
              break;
            case "KIND":
              entry.kind = value;
              break;
            default:
              break;
          }
        }
      }
    }
    entries.push(entry);
  }

  return entries;
}

// Identity is the content hash alone; a hash counts regardless of the record's
// state or source path (OPEN-03 binding reading).
export function knownHashes(entries: LedgerEntry[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    if (entry.hash !== null) {
      set.add(entry.hash);
    }
  }
  return set;
}