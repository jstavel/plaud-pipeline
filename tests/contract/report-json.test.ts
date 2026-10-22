import { expect, test } from "vitest";
import { renderJson } from "../../src/report/json.js";
import { buildReport } from "../../src/report/build.js";
import { reportSchema } from "../../src/domain/schemas.js";
import type { RunReport } from "../../src/domain/types.js";

function partsFixture(): Parameters<typeof buildReport>[0] {
  return {
    new: [
      { path: "/b.mp3", hash: "a".repeat(64) },
      { path: "/a.mp3", hash: "b".repeat(64) },
    ],
    duplicates: [
      { path: "/d.mp3", hash: "c".repeat(64) },
      { path: "/c.mp3", hash: "d".repeat(64), existingSource: "/old.mp3" },
    ],
    outOfScope: [
      { path: "/z/", reason: "directory" },
      { path: "/link", reason: "symlink" },
    ],
    errors: [
      { path: "/e.mp3", phase: "ffprobe", reason: "no audio stream and duration unavailable" },
    ],
  };
}

test("counts are derived from the arrays, never independent", () => {
  const report = buildReport(partsFixture());
  expect(report.counts).toEqual({ new: 2, duplicates: 2, outOfScope: 2, errors: 1 });
});

test("all arrays are sorted by path in code-unit order", () => {
  const report = buildReport(partsFixture());
  expect(report.new.map((i) => i.path)).toEqual(["/a.mp3", "/b.mp3"]);
  expect(report.duplicates.map((i) => i.path)).toEqual(["/c.mp3", "/d.mp3"]);
  expect(report.outOfScope.map((i) => i.path)).toEqual(["/link", "/z/"]);
});

test("JSON output validates against the contract schema and carries no prose", () => {
  const report = buildReport(partsFixture());
  const json = renderJson(report);
  const parsed = JSON.parse(json);
  expect(reportSchema.safeParse(parsed).success).toBe(true);
  expect(typeof json).toBe("string");
  expect(json.trim().startsWith("{")).toBe(true);
});

test("existingSource appears only when the matching ledger record has a SOURCE", () => {
  const report = buildReport(partsFixture());
  expect(report.duplicates.find((d) => d.path === "/c.mp3")?.existingSource).toBe("/old.mp3");
  expect(report.duplicates.find((d) => d.path === "/d.mp3")?.existingSource).toBeUndefined();
});

test("reason values are limited to the contract vocabulary", () => {
  const parsed = reportSchema.parse(JSON.parse(renderJson(buildReport(partsFixture()))));
  for (const item of parsed.outOfScope) {
    expect(["directory", "symlink", "fifo", "socket", "other-non-regular"]).toContain(item.reason);
  }
  for (const item of parsed.errors) {
    expect(["scan", "hash", "stat", "ffprobe", "plaud", "append"]).toContain(item.phase);
  }
});
