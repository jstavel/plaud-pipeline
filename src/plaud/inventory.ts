import { DateTime } from "luxon";
import type { PlaudRecording } from "../domain/types.js";
import { plaudRecordingItemSchema } from "../domain/schemas.js";
import {
  DEFAULT_MCP_CMD,
  backoffDelay,
  extractToolPayload,
  isRetryableError,
  sleep,
  withMcpSession,
  type RpcCall,
} from "./client.js";

export type PlaudInventoryResult =
  | { available: true; recordings: PlaudRecording[] }
  | { available: false; reason: string };

export interface PlaudInventoryPort {
  fetchAll(): Promise<PlaudInventoryResult>;
}

const PAGE_SIZE = 100;
const MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 30_000;

// start_at is treated as a UTC instant and converted to Europe/Prague; the join
// key matches the Plaud filename timestamp pattern (R10).
export function plaudLocalStartKey(startAtUtc: string): string {
  const instant = DateTime.fromISO(startAtUtc, { zone: "utc" });
  if (!instant.isValid) {
    throw new Error(`unparseable start_at: ${startAtUtc}`);
  }
  return instant.setZone("Europe/Prague").toFormat("yyyy-MM-dd HH_mm_ss");
}

function normalizeRecording(raw: unknown): PlaudRecording | null {
  const parsed = plaudRecordingItemSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const item = parsed.data;
  let localStartKey: string;
  try {
    localStartKey = plaudLocalStartKey(item.start_at);
  } catch {
    return null;
  }
  return {
    id: item.id,
    startAtUtc: item.start_at,
    localStartKey,
    name: item.name,
    durationMs: item.duration ?? null,
  };
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    for (const key of ["files", "items", "data"] as const) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }
  throw new Error("unrecognized inventory envelope");
}

export class McpPlaudInventory implements PlaudInventoryPort {
  private readonly env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
  }

  async fetchAll(): Promise<PlaudInventoryResult> {
    const cmd = this.env.PLAUD_MCP_CMD || DEFAULT_MCP_CMD;
    const timeoutMs = Number(this.env.PLAUD_MCP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(backoffDelay(attempt - 1));
      }
      try {
        const recordings = await withMcpSession(cmd, timeoutMs, this.env, async (call: RpcCall) => {
          const all: PlaudRecording[] = [];
          for (let page = 0; ; page += 1) {
            const payload = extractToolPayload(
              await call("tools/call", {
                name: "list_files",
                arguments: { page_size: PAGE_SIZE, page },
              }),
            );
            const items = extractItems(payload);
            for (const raw of items) {
              const recording = normalizeRecording(raw);
              if (recording !== null) {
                all.push(recording);
              }
            }
            if (items.length < PAGE_SIZE) {
              return all;
            }
          }
        });
        return { available: true, recordings };
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error)) {
          break;
        }
      }
    }
    return {
      available: false,
      reason: String((lastError as Error)?.message ?? lastError ?? "plaud inventory unavailable"),
    };
  }
}

// key -> ids; a key with more than one id is ambiguous and never joins (R10).
export function startAtMap(recordings: PlaudRecording[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const recording of recordings) {
    const ids = map.get(recording.localStartKey) ?? [];
    ids.push(recording.id);
    map.set(recording.localStartKey, ids);
  }
  return map;
}

export type JoinResult =
  | { id: string; ambiguous: false }
  | { id: null; ambiguous: false }
  | { id: null; ambiguous: true };

// The basename joins only when it starts with the exact local start key; the
// API name is never used for identity.
export function joinPlaudId(basename: string, map: Map<string, string[]>): JoinResult {
  for (const [key, ids] of map) {
    if (basename.startsWith(key)) {
      if (ids.length === 1) {
        const id = ids[0];
        if (id !== undefined) {
          return { id, ambiguous: false };
        }
      }
      return { id: null, ambiguous: true };
    }
  }
  return { id: null, ambiguous: false };
}