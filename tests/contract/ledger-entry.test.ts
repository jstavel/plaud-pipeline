// Byte-exact contract test for the ledger entry layout (constitution I).
// Expected sample is verbatim from the real ledger ~/org/ingest-ledger.org
// (first TODO record, 1-based lines 4-24), with the legacy :DECISION: drawer
// (record-relative lines 14-18) removed, because no v2-shaped record exists in
// the real ledger yet (all 171 records carry it). Only values are normalized in
// the layout-independence test; the whitespace layout itself is asserted
// byte-for-byte. serializeEntry returns the entry without its trailing newline;
// the append protocol adds separators (join "\n\n" + final "\n").

import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeEntry } from "../../src/ledger/serialize.ts";
import {
  CANONICAL_HEADER,
  appendLedger,
  lockPathFor,
} from "../../src/ledger/append.ts";

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(
  join(here, "..", "fixtures", "ledger", "verbatim-entry.org"),
  "utf8",
);

const sampleEntry = {
  estimateMin: 7,
  basename: "2026-04-01 10_37_45.mp3",
  properties: {
    hash: "a514cb6aa759992495a06dd976d5aaffecbba6fbe06c8a71cfe960c0ddaf906c",
    plaudId: "",
    created: "2026-04-01",
    duration: "06:48",
    bitrate: "32k",
    filesize: 1633472,
    source: "/home/jstavel/Downloads/2026-04-01 10_37_45.mp3",
    synopsis: "",
    cleanup: "",
    kind: "Plaud-voice-record",
  },
  logbook: {
    timestamp: "2026-07-10 Fri 21:27",
    message: "Auto-detected by Staging Worker.",
  },
};

// Replaces only value substrings; every run of whitespace is preserved, so any
// padding or indentation difference survives the comparison.
function normalizeValues(text) {
  return text
    .replace(/^(\* TODO \[)\d+( min\] ).*$/m, "$1<N>$2<basename>")
    .replace(/^  (:HASH: +)[0-9a-f]{64}$/m, "$1<hash>")
    .replace(/^  (:PLAUD-ID: +)(of_[0-9a-z]+)?$/m, "$1<plaud-id>")
    .replace(/^  (:CREATED: +)(\d{4}-\d{2}-\d{2}|N\/A)?$/m, "$1<created>")
    .replace(/^  (:DURATION: +)(\d+:\d{2})?$/m, "$1<duration>")
    .replace(/^  (:BITRATE: +)(\d+k)?$/m, "$1<bitrate>")
    .replace(/^  (:FILESIZE: +)\d+$/m, "$1<filesize>")
    .replace(/^  (:SOURCE: +)\/.*$/m, "$1<source>")
    .replace(/^  (:KIND: +)[A-Za-z-]+$/m, "$1<kind>")
    .replace(/^(  - \[)[^\]]*(\] ).*$/m, "$1<log-ts>$2<log>");
}

const properties = new Set([
  "HASH",
  "PLAUD-ID",
  "CREATED",
  "DURATION",
  "BITRATE",
  "FILESIZE",
  "SOURCE",
  "SYNOPSIS",
  "CLEANUP",
  "KIND",
]);

test("serialized entry is byte-identical to the verbatim ledger sample", () => {
  assert.equal(serializeEntry(sampleEntry) + "\n", sample);
});

test("whitespace layout does not depend on values (only values normalized)", () => {
  const other = {
    estimateMin: 128,
    basename: "note 2027-12-31 10_00_00.xlsm",
    properties: {
      hash: "f".repeat(64),
      plaudId: "of_ffffffffffffffffffffffffffffffff",
      created: "2027-12-31",
      duration: "88:12",
      bitrate: "1411k",
      filesize: 999999999999,
      source:
        "/mnt/very/deep/nested/path with spaces/name 2027-12-31 10_00_00.mp3",
      synopsis: "",
      cleanup: "",
      kind: "other-file",
    },
    logbook: {
      timestamp: "2027-12-31 Fri 10:00",
      message: "Registered by C2 (created from mtime).",
    },
  };
  assert.equal(normalizeValues(serializeEntry(other) + "\n"), normalizeValues(sample));
});

test("pinned layout: value field starts at 1-based column 16 on every padded property line", () => {
  const out = serializeEntry(sampleEntry) + "\n";
  assert.ok(!out.includes(":DECISION:"), "no :DECISION: drawer is written");
  assert.ok(out.endsWith("\n") && !out.endsWith("\n\n"), "entry ends with one newline");
  assert.ok(!out.includes("\r"), "no CR bytes");
  for (const line of out.split("\n")) {
    const m = line.match(/^  :([A-Z-]+):(.*)$/);
    if (!m || !properties.has(m[1])) continue;
    const tag = m[1];
    const tail = m[2];
    const prefixLen = 2 + tag.length + 2;
    const pad = tail.match(/^ */)[0].length;
    if (tag === "CLEANUP") {
      assert.equal(line, "  :CLEANUP:", ":CLEANUP: has no padding");
      continue;
    }
    if (tail.length === pad) {
      assert.equal(
        line.length,
        15,
        `empty value of :${tag}: ends at 1-based column 16 (line length 15)`,
      );
    } else {
      assert.equal(
        prefixLen + pad,
        15,
        `value of :${tag}: starts at 0-based index 15 = 1-based column 16`,
      );
    }
  }
});

const headerLine = CANONICAL_HEADER;

test("append to a missing ledger writes the canonical header verbatim, one blank line, then entries", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    const text = readFileSync(ledger, "utf8");
    assert.ok(text.startsWith(headerLine + "\n\n"), "canonical header + blank line");
    assert.equal(text, headerLine + "\n\n" + serializeEntry(sampleEntry) + "\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("append to an empty ledger behaves like a missing ledger", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    writeFileSync(ledger, "", "utf8");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    const text = readFileSync(ledger, "utf8");
    assert.equal(text, headerLine + "\n\n" + serializeEntry(sampleEntry) + "\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("append preserves existing bytes as an exact prefix and separates with one blank line", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const old = headerLine + "\n\nold content line\n";
    writeFileSync(ledger, old, "utf8");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    const text = readFileSync(ledger, "utf8");
    assert.ok(text.startsWith(old), "existing bytes are an exact prefix");
    assert.equal(
      text,
      old + "\n" + serializeEntry(sampleEntry) + "\n",
      "one blank line between existing content and the new entry",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("append to a ledger not ending in a newline terminates it with one blank line", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const old = headerLine + "\n\nunterminated tail";
    writeFileSync(ledger, old, "utf8");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    const text = readFileSync(ledger, "utf8");
    assert.equal(text, old + "\n\n" + serializeEntry(sampleEntry) + "\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two appended entries are separated by exactly one blank line", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const second = { ...sampleEntry, basename: "second.mp3" };
    await appendLedger(ledger, [serializeEntry(sampleEntry), serializeEntry(second)]);
    const text = readFileSync(ledger, "utf8");
    assert.equal(
      text,
      headerLine +
        "\n\n" +
        serializeEntry(sampleEntry) +
        "\n\n" +
        serializeEntry(second) +
        "\n",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lock file lives outside the tracked tree, named by a sha256 path digest", () => {
  const p = lockPathFor("/home/jstavel/org/ingest-ledger.org");
  const runtimeDir = process.env.XDG_RUNTIME_DIR || tmpdir();
  assert.ok(p.startsWith(runtimeDir + "/"), "lock is under the runtime dir");
  assert.ok(
    /^plaud-pipeline-[0-9a-f]{16}\.lock$/.test(p.split("/").pop()),
    "lock name embeds the 16-char digest",
  );
  assert.ok(!p.includes("/org/"), "lock is outside the tracked ~/org tree");
});

test("a stale lock (dead pid) is removed once and the append proceeds", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const lock = lockPathFor(ledger);
    writeFileSync(lock, JSON.stringify({ pid: 2_147_400_000, startedAt: new Date().toISOString() }), "utf8");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    const text = readFileSync(ledger, "utf8");
    assert.ok(text.startsWith(headerLine));
    assert.ok(!existsSync(lock), "lock removed after the run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale lock (old startedAt) is removed once and the append proceeds", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const lock = lockPathFor(ledger);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: old }), "utf8");
    await appendLedger(ledger, [serializeEntry(sampleEntry)]);
    assert.ok(readFileSync(ledger, "utf8").startsWith(headerLine));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("append refuses a non-TODO entry at the write boundary (FR-004)", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const notTodo = sample.replace("* TODO ", "* WAIVED ");
    await assert.rejects(
      () => appendLedger(ledger, [notTodo]),
      /non-TODO/,
    );
    assert.ok(!existsSync(ledger));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a live lock fails the run (exit-2 semantics)", async () => {
  const dir = join(tmpdir(), `c2-contract-${Date.now()}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  try {
    const ledger = join(dir, "ledger.org");
    const lock = lockPathFor(ledger);
    writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
    await assert.rejects(
      () => appendLedger(ledger, [serializeEntry(sampleEntry)]),
      /lock/,
    );
    assert.ok(!existsSync(ledger), "ledger untouched");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
