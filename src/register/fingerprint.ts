import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export interface FileFingerprint {
  hash: string;
  sizeBytes: number;
}

export function hashFile(path: string): Promise<FileFingerprint> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let sizeBytes = 0;
    const stream = createReadStream(path);
    stream.on("data", (chunk: string | Buffer) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      hash.update(buffer);
      sizeBytes += buffer.length;
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve({ hash: hash.digest("hex"), sizeBytes });
    });
  });
}