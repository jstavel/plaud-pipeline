import { execFile } from "node:child_process";

export interface ProbeResult {
  hasAudio: boolean;
  durationSeconds: number | null;
  bitrateBps: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  bit_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string; bit_rate?: string };
}

function execFfprobe(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          // ffprobe exits non-zero for files it cannot read as media; the
          // caller maps "no audio" to the contract error reason for audio-kind
          // files, so a failed probe degrades to hasAudio: false.
          resolve(null);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

export async function probeAudio(path: string): Promise<ProbeResult> {
  const stdout = await execFfprobe(path);
  if (stdout === null) {
    return { hasAudio: false, durationSeconds: null, bitrateBps: null };
  }
  let data: FfprobeOutput;
  try {
    data = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    return { hasAudio: false, durationSeconds: null, bitrateBps: null };
  }
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const audio = streams.find((s) => s.codec_type === "audio");
  if (!audio) {
    return { hasAudio: false, durationSeconds: null, bitrateBps: null };
  }
  const duration = data.format?.duration !== undefined ? Number.parseFloat(data.format.duration) : Number.NaN;
  const bitrateRaw = audio.bit_rate ?? data.format?.bit_rate;
  const bitrate = bitrateRaw !== undefined ? Number.parseInt(bitrateRaw, 10) : Number.NaN;
  return {
    hasAudio: true,
    durationSeconds: Number.isFinite(duration) ? duration : null,
    bitrateBps: Number.isFinite(bitrate) ? bitrate : null,
  };
}