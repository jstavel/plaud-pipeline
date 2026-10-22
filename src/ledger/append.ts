import { createHash } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FatalError } from "../domain/types.js";

export const CANONICAL_HEADER =
  "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)";

const LOCK_TTL_MS = 60 * 60 * 1000;

export function lockPathFor(ledgerPath: string): string {
  const abs = path.resolve(ledgerPath);
  const digest = createHash("sha256").update(abs).digest("hex").slice(0, 16);
  const runtimeDir = process.env.XDG_RUNTIME_DIR || tmpdir();
  return path.join(runtimeDir, `plaud-pipeline-${digest}.lock`);
}

interface LockContents {
  pid?: number;
  startedAt?: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isStale(lockPath: string): Promise<boolean> {
  let text: string;
  try {
    text = await readFile(lockPath, "utf8");
  } catch {
    // The lock vanished between the failed create and this read; treat the
    // holder as gone so the retry can proceed.
    return true;
  }
  let contents: LockContents;
  try {
    contents = JSON.parse(text) as LockContents;
  } catch {
    return true;
  }
  if (typeof contents.pid !== "number") {
    return true;
  }
  if (!isProcessAlive(contents.pid)) {
    return true;
  }
  if (typeof contents.startedAt !== "string") {
    return true;
  }
  const startedAt = Date.parse(contents.startedAt);
  if (Number.isNaN(startedAt)) {
    return true;
  }
  return Date.now() - startedAt > LOCK_TTL_MS;
}

async function acquireLock(lockPath: string): Promise<void> {
  const contents = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle;
    try {
      handle = await open(lockPath, "wx");
    } catch {
      if (attempt === 0 && (await isStale(lockPath))) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
      throw new FatalError(
        "lock",
        `another plaud-pipeline run holds the lock ${lockPath}`,
      );
    }
    try {
      await handle.writeFile(contents, "utf8");
    } finally {
      await handle.close();
    }
    return;
  }
  throw new FatalError("lock", `could not acquire lock ${lockPath}`);
}

function buildPayload(old: Buffer | null, entries: string[]): string {
  const joined = entries.join("\n\n");
  if (old === null || old.length === 0) {
    return CANONICAL_HEADER + "\n\n" + joined + "\n";
  }
  const separator = old.toString("utf8").endsWith("\n") ? "\n" : "\n\n";
  return separator + joined + "\n";
}

export async function appendLedger(
  ledgerPath: string,
  entries: string[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  // The machine only ever creates TODO (FR-004); refuse anything else at the
  // write boundary.
  for (const entry of entries) {
    const heading = entry.split("\n", 1)[0] ?? "";
    if (!heading.startsWith("* TODO")) {
      throw new FatalError(
        "append",
        `refusing to append a non-TODO entry: ${JSON.stringify(heading)}`,
      );
    }
  }
  const lockPath = lockPathFor(ledgerPath);
  await acquireLock(lockPath);
  try {
    let old: Buffer | null;
    try {
      old = await readFile(ledgerPath);
    } catch {
      old = null;
    }
    const payload = Buffer.from(buildPayload(old, entries), "utf8");
    let handle;
    try {
      handle = await open(ledgerPath, "a");
    } catch (error) {
      throw new FatalError(
        "append",
        `cannot open ledger for append: ${String(error)}`,
      );
    }
    try {
      await handle.writeFile(payload);
    } catch (error) {
      throw new FatalError("append", `append failed: ${String(error)}`);
    } finally {
      await handle.close();
    }
  } finally {
    await unlink(lockPath).catch(() => {});
  }
}