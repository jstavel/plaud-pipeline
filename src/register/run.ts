import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ReportItemDuplicate,
  ReportItemError,
  ReportItemNew,
  ReportItemOutOfScope,
  RunReport,
} from "../domain/types.js";
import { readLedger, parseLedger, knownHashes } from "../ledger/index.js";
import { appendLedger, serializeEntry } from "../ledger/index.js";
import { scanDownloads } from "./scan.js";
import { hashFile } from "./fingerprint.js";
import { bitrateText, durationText, estimateMin, kindForBasename } from "./classify.js";
import { createdFor, formatLogTimestamp, logbookMessage } from "../metadata/created.js";
import { probeAudio } from "../metadata/ffprobe.js";
import {
  joinPlaudId,
  McpPlaudInventory,
  startAtMap,
  type PlaudInventoryPort,
} from "../plaud/inventory.js";
import { buildReport } from "../report/build.js";

export interface RegisterInput {
  downloads: string;
  ledger: string;
  noPlaud: boolean;
  plaud?: PlaudInventoryPort | null;
  now?: Date;
}

interface SelectedItem {
  path: string;
  basename: string;
  hash: string;
  sizeBytes: number;
  kind: string;
  created: string;
  createdSource: "filename" | "mtime";
  durationSeconds: number | null;
  bitrateBps: number | null;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export async function register(input: RegisterInput): Promise<RunReport> {
  const now = input.now ?? new Date();
  const errors: ReportItemError[] = [];
  const duplicates: ReportItemDuplicate[] = [];
  const outOfScope: ReportItemOutOfScope[] = [];
  const newItems: ReportItemNew[] = [];

  const ledgerBuffer = await readLedger(input.ledger);
  const ledgerText = ledgerBuffer === null ? null : ledgerBuffer.toString("utf8");
  const ledgerEntries = ledgerText === null ? [] : parseLedger(ledgerText);
  const known = knownHashes(ledgerEntries);
  const existingSourceByHash = new Map<string, string>();
  for (const entry of ledgerEntries) {
    if (entry.hash !== null && entry.source !== "") {
      existingSourceByHash.set(entry.hash, entry.source);
    }
  }

  const scan = await scanDownloads(input.downloads);
  outOfScope.push(...scan.outOfScope);

  const seenInRun = new Set<string>(known);
  const selected: SelectedItem[] = [];

  for (const candidate of scan.candidates) {
    if (CONTROL_CHARS.test(candidate.basename)) {
      errors.push({
        path: candidate.path,
        phase: "scan",
        reason: "basename contains control characters",
      });
      continue;
    }
    let hash: string;
    let sizeBytes: number;
    try {
      const fingerprint = await hashFile(candidate.path);
      hash = fingerprint.hash;
      sizeBytes = fingerprint.sizeBytes;
    } catch (error) {
      errors.push({ path: candidate.path, phase: "hash", reason: String(error) });
      continue;
    }
    // Identity is the hash alone, in any state, anywhere in the ledger
    // (FR-002 / OPEN-03); the first path in sorted order wins within a run.
    if (seenInRun.has(hash)) {
      const duplicate: ReportItemDuplicate = { path: candidate.path, hash };
      const existingSource = existingSourceByHash.get(hash);
      if (existingSource !== undefined) {
        duplicate.existingSource = existingSource;
      }
      duplicates.push(duplicate);
      continue;
    }
    seenInRun.add(hash);

    const kind = kindForBasename(candidate.basename);
    let durationSeconds: number | null = null;
    let bitrateBps: number | null = null;
    if (kind === "Plaud-voice-record" || kind === "audio-file") {
      try {
        const probe = await probeAudio(candidate.path);
        if (!probe.hasAudio || probe.durationSeconds === null) {
          errors.push({
            path: candidate.path,
            phase: "ffprobe",
            reason: "no audio stream and duration unavailable",
          });
          continue;
        }
        durationSeconds = probe.durationSeconds;
        bitrateBps = probe.bitrateBps;
      } catch (error) {
        errors.push({ path: candidate.path, phase: "ffprobe", reason: String(error) });
        continue;
      }
    }

    let statMtime: Date;
    try {
      statMtime = (await stat(candidate.path)).mtime;
    } catch (error) {
      errors.push({ path: candidate.path, phase: "stat", reason: String(error) });
      continue;
    }
    const created = createdFor(candidate.basename, statMtime);
    selected.push({
      path: candidate.path,
      basename: candidate.basename,
      hash,
      sizeBytes,
      kind,
      created: created.date,
      createdSource: created.source,
      durationSeconds,
      bitrateBps,
    });
  }

  let startKeyMap = new Map<string, string[]>();
  if (!input.noPlaud) {
    const port = input.plaud ?? new McpPlaudInventory();
    const result = await port.fetchAll();
    if (result.available) {
      startKeyMap = startAtMap(result.recordings);
    } else {
      errors.push({ path: "plaud-inventory", phase: "plaud", reason: result.reason });
    }
  }

  const logTimestamp = formatLogTimestamp(now);
  const serialized: string[] = [];
  for (const item of selected) {
    let plaudId = "";
    if (startKeyMap.size > 0) {
      const join = joinPlaudId(item.basename, startKeyMap);
      if (join.ambiguous) {
        errors.push({
          path: item.path,
          phase: "plaud",
          reason: "ambiguous start_at join",
        });
      } else if (join.id !== null) {
        plaudId = join.id;
      }
    }
    // Re-verify only the candidates selected for writing (data-model rule):
    // a file that changed or disappeared during the run is an error, not a record.
    try {
      const recheck = await hashFile(item.path);
      if (recheck.hash !== item.hash) {
        errors.push({
          path: item.path,
          phase: "hash",
          reason: "file changed during the run",
        });
        continue;
      }
    } catch {
      errors.push({
        path: item.path,
        phase: "stat",
        reason: "file disappeared during the run",
      });
      continue;
    }
    serialized.push(
      serializeEntry({
        estimateMin:
          item.durationSeconds === null ? null : estimateMin(item.durationSeconds),
        basename: item.basename,
        properties: {
          hash: item.hash,
          plaudId,
          created: item.created,
          duration:
            item.durationSeconds === null ? "" : durationText(item.durationSeconds),
          bitrate: bitrateText(item.bitrateBps),
          filesize: item.sizeBytes,
          source: item.path,
          synopsis: "",
          cleanup: "",
          kind: item.kind,
        },
        logbook: {
          timestamp: logTimestamp,
          message: logbookMessage(item.createdSource),
        },
      }),
    );
    newItems.push({ path: item.path, hash: item.hash });
  }

  if (serialized.length > 0) {
    await mkdir(dirname(input.ledger), { recursive: true });
    await appendLedger(input.ledger, serialized);
  }

  return buildReport({ new: newItems, duplicates, outOfScope, errors });
}