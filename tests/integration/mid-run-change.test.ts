import { expect, test, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { register } from "../../src/register/run.js";
import { writeFileIn } from "../fixtures/build-fixtures.js";
import type { FileFingerprint } from "../../src/register/fingerprint.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-midrun-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function fakeFingerprint(
  initial: Map<string, string>,
  recheck: Map<string, string | Error>,
): (path: string) => Promise<FileFingerprint> {
  const calls = new Map<string, number>();
  return async (path) => {
    const seen = calls.get(path) ?? 0;
    calls.set(path, seen + 1);
    const override = recheck.get(path);
    if (seen > 0 && override instanceof Error) {
      throw override;
    }
    if (seen > 0 && override !== undefined) {
      return { hash: override, sizeBytes: 999 };
    }
    const first = initial.get(path);
    if (first !== undefined) {
      return { hash: first, sizeBytes: 10 };
    }
    return { hash: "e".repeat(64), sizeBytes: 10 };
  };
}

// data-model.md SourceItem validation: "A file that changes during the run is
// an error, not a record." The observable outcome binds, not the port.
test("a file whose content changes between scan hash and recheck is rejected: per-file error, no record", async () => {
  writeFileIn(downloads, "changed.txt", "original\n");
  writeFileIn(downloads, "stable.txt", "stable\n");
  const target = join(downloads, "changed.txt");
  const hashA = "a".repeat(64);
  const hashB = "b".repeat(64);
  const report = await register({
    downloads,
    ledger,
    noPlaud: true,
    fingerprint: fakeFingerprint(
      new Map([
        [target, hashA],
        [join(downloads, "stable.txt"), "c".repeat(64)],
      ]),
      new Map([[target, hashB]]),
    ),
  });
  expect(report.errors).toContainEqual({
    path: target,
    phase: "hash",
    reason: "file changed during the run",
  });
  expect(report.counts.new).toBe(1);
  expect(report.new.map((i) => i.path)).toEqual([join(downloads, "stable.txt")]);
  const text = await readFile(ledger, "utf8");
  expect(text).not.toContain("changed.txt");
  expect(text).not.toContain(hashA);
  expect(text).not.toContain(hashB);
});

test("a file that disappears before the recheck is rejected: per-file error, no record", async () => {
  writeFileIn(downloads, "gone.txt", "vanishing\n");
  writeFileIn(downloads, "keeper.txt", "stays\n");
  const target = join(downloads, "gone.txt");
  const report = await register({
    downloads,
    ledger,
    noPlaud: true,
    fingerprint: fakeFingerprint(
      new Map([[target, "d".repeat(64)]]),
      new Map([[target, new Error("ENOENT: no such file or directory")]]),
    ),
  });
  expect(report.errors).toContainEqual({
    path: target,
    phase: "stat",
    reason: "file disappeared during the run",
  });
  expect(report.counts.new).toBe(1);
  expect(report.new.map((i) => i.path)).toEqual([join(downloads, "keeper.txt")]);
  const text = await readFile(ledger, "utf8");
  expect(text).not.toContain("gone.txt");
});

test("end-to-end without the port: a stable run records every file (no false positives from the recheck)", async () => {
  writeFileIn(downloads, "one.txt", "one\n");
  writeFileIn(downloads, "two.txt", "two\n");
  const before = await stat(downloads);
  const report = await register({ downloads, ledger, noPlaud: true });
  expect(report.errors).toEqual([]);
  expect(report.counts.new).toBe(2);
  void before;
});
