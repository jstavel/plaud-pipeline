import { expect, test, beforeEach, afterEach } from "vitest";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic, writeFileIn } from "../fixtures/build-fixtures.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-rewrite-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// US3 / FR-005 / SC-004: existing records are never rewritten or moved; the
// old bytes must be an exact prefix of the new bytes.
test("a WAIVED record and all pre-existing bytes survive a run byte-identically", async () => {
  const fixtureLedger = join(__dirname, "..", "fixtures", "ledger", "waived.org");
  await copyFile(fixtureLedger, ledger);
  const before = await readFile(ledger);
  writeFileIn(downloads, "fresh-file.txt", "content not in the ledger\n");

  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);

  const after = await readFile(ledger);
  expect(after.length).toBeGreaterThan(before.length);
  expect(after.subarray(0, before.length).equals(before)).toBe(true);

  const beforeText = before.toString("utf8");
  const afterText = after.toString("utf8");
  // The WAIVED record's region is untouched: same heading, same log lines.
  expect(afterText).toContain(beforeText.split("\n")[2]);
  const entries = (await import("../../src/ledger/parse.js")).parseLedger(afterText);
  expect(entries.filter((e) => e.state === "WAIVED")).toHaveLength(1);
  expect(entries.filter((e) => e.state === "TODO")).toHaveLength(4);
});

test("multiple pre-existing states (WAIVED, TODO, legacy :DECISION:) all survive unchanged", async () => {
  const fixtureLedger = join(__dirname, "..", "fixtures", "ledger", "existing.org");
  await copyFile(fixtureLedger, ledger);
  const before = await readFile(ledger);
  writeFileIn(downloads, "fresh-file.txt", "content not in the ledger\n");
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  const after = await readFile(ledger);
  expect(after.subarray(0, before.length).equals(before)).toBe(true);
});
