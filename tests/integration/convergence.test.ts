import { expect, test, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic, writeFileIn } from "../fixtures/build-fixtures.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-conv-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ledger-entry.md read/parse rules: "A malformed property drawer is a fatal
// ledger error; C2 does not append to a ledger it cannot read consistently."
test("a malformed property drawer is fatal: exit 2 and byte-untouched ledger", async () => {
  const malformed = [
    "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
    "",
    "* TODO [1 min] broken-record.mp3",
    "  :PROPERTIES:",
    "  :HASH:       aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "this line is not a property, a drawer open or :END:",
    "  :END:",
    "  :LOGBOOK:",
    "  - [2026-07-10 Fri 21:27] Auto-detected by Staging Worker.",
    "  :END:",
  ].join("\n") + "\n";
  await writeFile(ledger, malformed, "utf8");
  const before = await readFile(ledger);

  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(2);
  expect(result.stderr).toMatch(/malformed property drawer/i);
  expect((await readFile(ledger)).equals(before)).toBe(true);
});

test("an unterminated drawer is also fatal: exit 2 and byte-untouched ledger", async () => {
  const malformed = [
    "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
    "",
    "* TODO [1 min] unterminated.mp3",
    "  :PROPERTIES:",
    "  :HASH:       aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "  :CREATED:    2026-04-01",
  ].join("\n") + "\n";
  await writeFile(ledger, malformed, "utf8");
  const before = await readFile(ledger);
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(2);
  expect(result.stderr).toMatch(/unterminated drawer/i);
  expect((await readFile(ledger)).equals(before)).toBe(true);
});

// contracts/cli.md: --help prints usage and exits 0.
test("--help prints usage and exits 0 without touching the filesystem", async () => {
  const result = await runCli(["--help"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Usage: plaud-pipeline register");
  expect(result.stdout).toContain("--no-plaud");
  expect(existsSync(ledger)).toBe(false);
  const viaSubcommand = await runCli(["register", "--help"]);
  expect(viaSubcommand.code).toBe(0);
  expect(viaSubcommand.stdout).toContain("Usage: plaud-pipeline register");
});

test("an unknown subcommand prints usage on stderr and exits 2", async () => {
  const result = await runCli(["decide"]);
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("Usage: plaud-pipeline register");
});

// data-model.md SourceItem rule: basename must not contain control characters.
test("a basename containing a control character is one chyby entry with no record", async () => {
  writeFileIn(downloads, "bad\tname.txt", "control char in name\n");
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
    "nové: 3",
    "duplicity: 0",
    "mimo scope: 0",
    "chyby: 1",
  ]);
  const report = JSON.parse(
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
  expect(report.errors).toEqual([
    {
      path: join(downloads, "bad\tname.txt"),
      phase: "scan",
      reason: "basename contains control characters",
    },
  ]);
  const text = await readFile(ledger, "utf8");
  expect(text).not.toContain("bad\tname.txt");
});
