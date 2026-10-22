import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { FatalError, type OutOfScopeItem } from "../domain/types.js";

export interface CandidatePath {
  path: string;
  basename: string;
}

export interface ScanResult {
  candidates: CandidatePath[];
  outOfScope: OutOfScopeItem[];
}

function codeUnitCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export async function scanDownloads(root: string): Promise<ScanResult> {
  let dirents;
  try {
    dirents = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new FatalError("scan", `cannot scan ${root}: ${String(error)}`);
  }
  const candidates: CandidatePath[] = [];
  const outOfScope: OutOfScopeItem[] = [];
  for (const dirent of dirents) {
    const path = join(root, dirent.name);
    if (dirent.isSymbolicLink()) {
      outOfScope.push({ path, reason: "symlink" });
    } else if (dirent.isDirectory()) {
      // Directory paths carry a trailing slash (contracts/run-report.md).
      outOfScope.push({ path: path + "/", reason: "directory" });
    } else if (dirent.isFile()) {
      candidates.push({ path, basename: dirent.name });
    } else if (dirent.isFIFO()) {
      outOfScope.push({ path, reason: "fifo" });
    } else if (dirent.isSocket()) {
      outOfScope.push({ path, reason: "socket" });
    } else {
      outOfScope.push({ path, reason: "other-non-regular" });
    }
  }
  candidates.sort((a, b) => codeUnitCompare(a.basename, b.basename));
  outOfScope.sort((a, b) => codeUnitCompare(a.path, b.path));
  return { candidates, outOfScope };
}

export { codeUnitCompare };