import { expect, test, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { writeFileIn } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-dedupe-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// OPEN-03 binding reading (FR-002): any hash already present ANYWHERE in the
// ledger — regardless of that record's state — suppresses the new record.
test("a top-level file matching a WAIVED record's hash registers nothing", async () => {
  // The suppressed file's hash must equal the WAIVED record's hash, so the
  // ledger is built dynamically from the file's real content hash.
  const matching = await writeFileIn(downloads, "suppressed.bin", "suppressed bytes\n");
  const hash = createHash("sha256").update(await readFile(matching)).digest("hex");
  await writeFile(
    ledger,
    [
      "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
      "",
      "* WAIVED [2 min] once-out-of-scope.bin",
      "  :PROPERTIES:",
      `  :HASH:       ${hash}`,
      "  :PLAUD-ID:   ",
      "  :CREATED:    2026-05-12",
      "  :DURATION:   02:00",
      "  :BITRATE:    32k",
      "  :FILESIZE:   18",
      "  :SOURCE:     /home/jstavel/Downloads/zaloha/once-out-of-scope.bin",
      "  :SYNOPSIS:   ",
      "  :CLEANUP:",
      "  :KIND:       other-file",
      "  :END:",
      "  :LOGBOOK:",
      "  - [2026-07-10 Fri 21:28] Auto-detected by Staging Worker.",
      "  :END:",
    ].join("\n") + "\n",
    "utf8",
  );
  const before = await readFile(ledger);
  writeFileIn(downloads, "other-new.txt", "unrelated content\n");

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
    "nové: 1",
    "duplicity: 1",
    "mimo scope: 0",
    "chyby: 0",
  ]);
  const after = await readFile(ledger);
  expect(after.subarray(0, before.length).equals(before)).toBe(true);
  const entries = parseLedger(after.toString("utf8"));
  expect(entries.filter((e) => e.state === "WAIVED")).toHaveLength(1);
  expect(entries.filter((e) => e.hash === hash)).toHaveLength(1);
});

test("an INGEST record's hash also suppresses a duplicate file", async () => {
  const matching = await writeFileIn(downloads, "dup-of-ingest.bin", "decided bytes\n");
  const hash = createHash("sha256").update(await readFile(matching)).digest("hex");
  await writeFile(
    ledger,
    [
      "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
      "",
      "* INGEST decided.bin",
      "  :PROPERTIES:",
      `  :HASH:       ${hash}`,
      "  :PLAUD-ID:   ",
      "  :CREATED:    2026-05-12",
      "  :DURATION:   ",
      "  :BITRATE:    ",
      "  :FILESIZE:   13",
      "  :SOURCE:     /home/jstavel/Downloads/decided.bin",
      "  :SYNOPSIS:   ",
      "  :CLEANUP:",
      "  :KIND:       other-file",
      "  :END:",
      "  :LOGBOOK:",
      "  - [2026-07-10 Fri 21:28] Auto-detected by Staging Worker.",
      "  :END:",
    ].join("\n") + "\n",
    "utf8",
  );
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
    "nové: 0",
    "duplicity: 1",
    "mimo scope: 0",
    "chyby: 0",
  ]);
});
