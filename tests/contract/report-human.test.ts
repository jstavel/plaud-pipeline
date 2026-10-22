import { expect, test } from "vitest";
import { renderHuman } from "../../src/report/human.js";
import type { RunReport } from "../../src/domain/types.js";

function reportFixture(): RunReport {
  return {
    counts: { new: 2, duplicates: 1, outOfScope: 1, errors: 0 },
    new: [
      { path: "/home/jstavel/Downloads/a.mp3", hash: "b".repeat(64) },
      { path: "/home/jstavel/Downloads/b.mp3", hash: "a".repeat(64) },
    ],
    duplicates: [
      {
        path: "/home/jstavel/Downloads/c.mp3",
        hash: "c".repeat(64),
        existingSource: "/home/jstavel/Downloads/old-c.mp3",
      },
    ],
    outOfScope: [
      { path: "/home/jstavel/Downloads/zaloha/", reason: "directory" },
    ],
    errors: [],
  };
}

test("the first four lines use the exact labels in the exact order", () => {
  const out = renderHuman(reportFixture());
  const lines = out.split("\n");
  expect(lines.slice(0, 4)).toEqual([
    "nové: 2",
    "duplicity: 1",
    "mimo scope: 1",
    "chyby: 0",
  ]);
});

test("a zero count still prints the label and 0; its section is omitted", () => {
  const out = renderHuman(reportFixture());
  expect(out).toContain("\nchyby: 0\n");
  expect(out).not.toMatch(/chyby:\n- /);
  expect(out).not.toMatch(/\nchyby: \n/);
});

test("path sections list only non-empty categories, sorted by path, separated by blank lines", () => {
  const out = renderHuman(reportFixture());
  expect(out).toBe(
    [
      "nové: 2",
      "duplicity: 1",
      "mimo scope: 1",
      "chyby: 0",
      "",
      "nové cesty:",
      "- /home/jstavel/Downloads/a.mp3",
      "- /home/jstavel/Downloads/b.mp3",
      "",
      "duplicity:",
      "- /home/jstavel/Downloads/c.mp3",
      "",
      "mimo scope:",
      "- /home/jstavel/Downloads/zaloha/",
    ].join("\n") + "\n",
  );
});

test("errors section shows path and stable reason", () => {
  const report = reportFixture();
  report.errors.push({
    path: "/home/jstavel/Downloads/broken.mp3",
    phase: "ffprobe",
    reason: "no audio stream and duration unavailable",
  });
  report.counts.errors = 1;
  const out = renderHuman(report);
  expect(out).toContain("chyby: 1");
  expect(out).toContain(
    "- /home/jstavel/Downloads/broken.mp3: no audio stream and duration unavailable",
  );
});
