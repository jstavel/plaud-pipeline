import { expect, test, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic, buildNonRegular } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-guard-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// US3 AC2 (OPEN-16 binding reading): every record CREATED BY THIS RUN is TODO,
// and no other state appears among them; pre-existing records are covered by
// the no-rewrite tests.
test("all new headings are TODO and no :DECISION: drawer is written", async () => {
  buildBasic(downloads);
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
  const text = await readFile(ledger, "utf8");
  const entries = parseLedger(text);
  expect(entries.length).toBeGreaterThanOrEqual(3);
  for (const entry of entries) {
    expect(entry.state).toBe("TODO");
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("* ")) {
      expect(line.startsWith("* TODO")).toBe(true);
    }
  }
  expect(text).not.toContain(":DECISION:");
});
