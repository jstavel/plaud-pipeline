import { expect, test } from "vitest";
import {
  bitrateText,
  durationText,
  estimateMin,
  kindForBasename,
} from "../../src/register/classify.js";
import {
  createdFor,
  formatLogTimestamp,
  logbookMessage,
  pragueDate,
} from "../../src/metadata/created.js";
import { probeAudio } from "../../src/metadata/ffprobe.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "downloads",
  "basic",
);

test("KIND follows the deterministic filename/extension rule (R7)", () => {
  expect(kindForBasename("2026-04-01 10_37_45.mp3")).toBe("Plaud-voice-record");
  expect(kindForBasename("song.mp3")).toBe("audio-file");
  expect(kindForBasename("backup.zip")).toBe("archive");
  expect(kindForBasename("notes.txt")).toBe("other-file");
  expect(kindForBasename("2026-04-01 10_37_45.MP3")).toBe("Plaud-voice-record");
});

test("estimate is ceil of minutes, minimum 1 (contract rule)", () => {
  expect(estimateMin(0.2)).toBe(1);
  expect(estimateMin(60)).toBe(1);
  expect(estimateMin(60.01)).toBe(2);
  expect(estimateMin(631)).toBe(11);
  expect(estimateMin(5292)).toBe(89);
});

test("duration text floors seconds into MM:SS with total minutes", () => {
  expect(durationText(631)).toBe("10:31");
  expect(durationText(5292)).toBe("88:12");
  expect(durationText(1)).toBe("0:01");
});

test("bitrate text truncates to kilobits with a k suffix", () => {
  expect(bitrateText(32000)).toBe("32k");
  expect(bitrateText(38693)).toBe("38k");
  expect(bitrateText(null)).toBe("");
});

test("CREATED comes from the first valid YYYY-MM-DD token, else mtime in Europe/Prague", () => {
  const mtime = new Date("2026-10-22T06:30:00Z"); // 08:30 CEST
  expect(createdFor("2026-04-01 10_37_45.mp3", mtime)).toEqual({
    date: "2026-04-01",
    source: "filename",
  });
  expect(createdFor("recording-2026-03-05-x.mp3", mtime)).toEqual({
    date: "2026-03-05",
    source: "filename",
  });
  expect(createdFor("voice-memo.mp3", mtime)).toEqual({
    date: "2026-10-22",
    source: "mtime",
  });
  expect(createdFor("bad-date-2026-13-99.mp3", mtime)).toEqual({
    date: "2026-10-22",
    source: "mtime",
  });
});

test("Prague conversion handles DST (winter CET, summer CEST)", () => {
  expect(pragueDate(new Date("2026-01-10T23:30:00Z"))).toBe("2026-01-11");
  expect(pragueDate(new Date("2026-07-10T21:27:00Z"))).toBe("2026-07-10");
  expect(formatLogTimestamp(new Date("2026-07-10T21:27:00Z"))).toBe(
    "2026-07-10 Fri 23:27",
  );
});

test("LOGBOOK message names the provenance source", () => {
  expect(logbookMessage("filename")).toBe(
    "Registered by C2 (created from filename).",
  );
  expect(logbookMessage("mtime")).toBe("Registered by C2 (created from mtime).");
});

test("ffprobe reads duration and stream bitrate from a real mp3", async () => {
  const probe = await probeAudio(join(fixtures, "2026-04-01 10_37_45.mp3"));
  expect(probe.hasAudio).toBe(true);
  expect(probe.durationSeconds).toBeCloseTo(1.0, 1);
  expect(probe.bitrateBps).toBe(32000);
});

test("ffprobe reports no audio stream for a non-audio file", async () => {
  const probe = await probeAudio(
    join(fixtures, "..", "..", "ledger", "existing.org"),
  );
  expect(probe.hasAudio).toBe(false);
  expect(probe.durationSeconds).toBeNull();
  expect(probe.bitrateBps).toBeNull();
});
