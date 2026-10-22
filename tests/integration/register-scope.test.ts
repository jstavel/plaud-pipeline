import { expect, test, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildNested, buildNonRegular } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-scope-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("a nested directory is one out-of-scope item; its contents are never read", async () => {
  buildNested(downloads);
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
    "duplicity: 0",
    "mimo scope: 1",
    "chyby: 0",
  ]);
  // A run with nothing to append does not create the ledger file.
  expect(existsSync(ledger)).toBe(false);
});

test("symlink and fifo are out-of-scope with reasons; the symlink target is never read", async () => {
  buildNonRegular(downloads);
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  const outOfScope = JSON.parse(
    (
      await runCli([
        "register",
        "--downloads",
        downloads,
        "--ledger",
        ledger,
        "--no-plaud",
        "--json",
      ])
    ).stdout,
  );
  const reasons = new Map(
    outOfScope.outOfScope.map((o: { path: string; reason: string }) => [o.path, o.reason]),
  );
  expect(reasons.get(join(downloads, "link.lnk"))).toBe("symlink");
  expect(reasons.get(join(downloads, "pipe.fifo"))).toBe("fifo");
  expect(reasons.get(join(downloads, "targets") + "/")).toBe("directory");
  expect(outOfScope.counts.new).toBe(0);
  // Nothing was ever registered: no ledger file, so the target's content hash
  // cannot have entered the ledger.
  expect(existsSync(ledger)).toBe(false);
});
