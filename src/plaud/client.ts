import { spawn } from "node:child_process";
import readline from "node:readline";

export const DEFAULT_MCP_CMD = "npx -y @plaud-ai/mcp@latest";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1_000;
const THROTTLE_MS = 1_000;
// Retryable: 429, 5xx, timeout or DNS-style failures (contract).
const RETRYABLE = /429|rate.?limit|timed?\s?out|dns|enotfound|econn/i;

export class RpcError extends Error {
  readonly code?: number;
  readonly retryable: boolean;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.retryable =
      code === 429 || (code !== undefined && code >= 500 && code < 600) || RETRYABLE.test(message);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function backoffDelay(attempt: number): number {
  return BACKOFF_BASE_MS * 2 ** attempt;
}

export interface RpcCall {
  (method: string, params: unknown): Promise<unknown>;
}

export async function withMcpSession<T>(
  cmd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
  fn: (call: RpcCall) => Promise<T>,
): Promise<T> {
  const child = spawn(cmd, [], {
    shell: true,
    stdio: ["pipe", "pipe", "ignore"],
    env: { ...process.env, ...env },
  });
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  let nextId = 1;
  let lastSend = 0;

  rl.on("line", (line) => {
    let msg: { id?: number | null; error?: { code?: number; message?: string }; result?: unknown };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg && typeof msg.id === "number" && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) {
        p.reject(new RpcError(msg.error.message ?? "rpc error", msg.error.code));
      } else {
        p.resolve(msg.result);
      }
    }
  });

  // A missing server command or a server that exits before answering is a
  // config/process failure, not one of the retryable conditions (429, 5xx,
  // timeout, DNS); reject pending requests immediately instead of waiting for
  // the per-request timeout.
  const failPending = (message: string) => {
    for (const [id, p] of pending) {
      pending.delete(id);
      clearTimeout(p.timer);
      p.reject(new RpcError(message, undefined));
    }
  };
  // When the server dies before reading, the next write raises EPIPE on the
  // pipe; swallow it here — failPending already rejects the waiters.
  child.stdin?.on("error", () => {});
  child.on("error", (error) => {
    failPending(`server command failed: ${error.message}`);
  });
  child.on("close", (code) => {
    failPending(`server command failed: exited with code ${code ?? "unknown"}`);
  });

  const call: RpcCall = async (method, params) => {
    const gap = lastSend + THROTTLE_MS - Date.now();
    if (gap > 0) {
      await sleep(gap);
    }
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new RpcError(`request timed out after ${timeoutMs}ms`, undefined));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      lastSend = Date.now();
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  };

  try {
    await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "plaud-pipeline-c2", version: "0.1.0" },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    return await fn(call);
  } finally {
    rl.close();
    child.kill("SIGKILL");
  }
}

export function extractToolPayload(result: unknown): unknown {
  if (result && typeof result === "object") {
    const obj = result as { isError?: boolean; content?: unknown };
    if (obj.isError === true) {
      const text = firstText(obj.content);
      throw new RpcError(text ?? "tool call failed", undefined);
    }
    const text = firstText(obj.content);
    if (text !== null) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
  return result;
}

function firstText(content: unknown): string | null {
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

export function isRetryableError(error: unknown): boolean {
  return error instanceof RpcError && error.retryable;
}

// Calls one MCP tool with up to five attempts (exponential backoff on
// 429/5xx/timeout/DNS). Each attempt runs in a fresh session.
export async function callMcpTool(
  cmd: string,
  tool: string,
  args: Record<string, unknown>,
  opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(backoffDelay(attempt - 1));
    }
    try {
      return await withMcpSession(cmd, timeoutMs, opts.env ?? {}, async (call) =>
        extractToolPayload(await call("tools/call", { name: tool, arguments: args })),
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}