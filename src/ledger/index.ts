import { readFile } from "node:fs/promises";
import type { LedgerEntry } from "../domain/types.js";
import { knownHashes, parseLedger } from "./parse.js";
import { appendLedger, lockPathFor } from "./append.js";
import { serializeEntry, type LedgerEntryInput } from "./serialize.js";

export async function readLedger(ledgerPath: string): Promise<Buffer | null> {
  try {
    return await readFile(ledgerPath);
  } catch {
    return null;
  }
}

export { knownHashes, parseLedger, appendLedger, lockPathFor, serializeEntry };
export type { LedgerEntryInput, LedgerEntry };