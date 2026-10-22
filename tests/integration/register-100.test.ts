import { expect, test, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildCounted } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
  }
});

test("100 distinct files produce 100 records with zero duplicate hashes and zero reported duplicates (OPEN-17, both parts)", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-100-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildCounted(downloads, 100);

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
    "nové: 100",
    "duplicity: 0",
    "mimo scope: 0",
    "chyby: 0",
  ]);

  const entries = parseLedger(await readFile(ledger, "utf8"));
  expect(entries).toHaveLength(100);
  const hashes = new Set(entries.map((e) => e.hash));
  expect(hashes.size).toBe(100);
  for (const entry of entries) {
    expect(entry.state).toBe("TODO");
    expect(entry.hash).toBe(
      createHash("sha256")
        .update(await readFile(join(downloads, entry.headline)))
        .digest("hex"),
    );
  }
});

test("second run over the 100-file fixture adds zero records (SC-002)", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-100-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildCounted(downloads, 100);

  await runCli(["register", "--downloads", downloads, "--ledger", ledger, "--no-plaud"]);
  const bytes = await readFile(ledger);
  const second = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(second.stdout).toContain("nové: 0");
  expect((await readFile(ledger)).equals(bytes)).toBe(true);
});
