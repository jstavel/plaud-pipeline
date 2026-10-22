import { expect, test, beforeEach, afterEach } from "vitest";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic } from "../fixtures/build-fixtures.js";
import { copyFile } from "node:fs/promises";
import { lockPathFor } from "../../src/ledger/append.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-appendfail-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, mode: 0o700 });
});

// ledger-entry.md append protocol: "If the write fails, the lock is removed
// and the original file is left untouched as far as the filesystem allows; a
// partial write is reported as fatal."
test("an append that cannot open the ledger is fatal: exit 2, bytes untouched, lock removed", async () => {
  const fixtureLedger = join(__dirname, "..", "fixtures", "ledger", "existing.org");
  await copyFile(fixtureLedger, ledger);
  const before = await readFile(ledger);
  await chmod(ledger, 0o400); // read-only file: open(ledger, "a") fails with EACCES
  const lock = lockPathFor(ledger);

  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(2);
  expect(result.stderr).toMatch(/fatal \(append\)/i);
  expect((await readFile(ledger)).equals(before)).toBe(true);
  expect(existsSync(lock)).toBe(false);
});
