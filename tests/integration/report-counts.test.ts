import { expect, test, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildDuplicates, buildNested, writeFileIn } from "../fixtures/build-fixtures.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-counts-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// US2 AC1 (OPEN-02 reading): "mimo scope" counts a top-level directory as one
// item; its contents are never read.
test("2 new, 1 duplicate, 1 directory prints the exact counts and exits 0", async () => {
  buildDuplicates(downloads);
  buildNested(downloads);
  writeFileIn(downloads, "third-new.txt", "another new file\n");
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  expect(result.stdout.split("\n").slice(0, 4)).toEqual([
    "nové: 2",
    "duplicity: 1",
    "mimo scope: 1",
    "chyby: 0",
  ]);
  // Duplicates and out-of-scope paths are listed.
  expect(result.stdout).toContain("duplicity:");
  expect(result.stdout).toContain(join(downloads, "backup-copy.mp3"));
  expect(result.stdout).toContain(`mimo scope:`);
  expect(result.stdout).toContain(join(downloads, "zaloha") + "/");
});

test("human report goes to stderr and JSON to stdout with --json", async () => {
  buildDuplicates(downloads);
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
    "--json",
  ]);
  expect(result.code).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.counts.new).toBe(1);
  expect(result.stderr).toContain("nové: 1");
});
