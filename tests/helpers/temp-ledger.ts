import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeTempRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempRoot(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function writeLedgerFile(
  dir: string,
  name: string,
  content: string,
): Promise<string> {
  const p = join(dir, name);
  await writeFile(p, content, "utf8");
  return p;
}

export async function readLedgerBytes(path: string): Promise<Buffer> {
  return readFile(path);
}