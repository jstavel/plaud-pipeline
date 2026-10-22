import { z } from "zod";
import { ENTRY_KINDS, ERROR_PHASES, OUT_OF_SCOPE_REASONS } from "./types.js";

export const cliOptionsSchema = z.object({
  downloads: z.string(),
  ledger: z.string(),
  json: z.boolean(),
  noPlaud: z.boolean(),
});

export type CliOptions = z.infer<typeof cliOptionsSchema>;

export const plaudRecordingItemSchema = z.object({
  id: z.string().min(1),
  start_at: z.string().min(1),
  name: z.string().default(""),
  duration: z.number().nullable().optional(),
});

export type PlaudRecordingItem = z.infer<typeof plaudRecordingItemSchema>;

const HASH_REGEX = /^[0-9a-f]{64}$/;

export const hashSchema = z.string().regex(HASH_REGEX);

export const reportSchema = z.object({
  counts: z.object({
    new: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    outOfScope: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  }),
  new: z.array(
    z.object({
      path: z.string(),
      hash: hashSchema,
    }),
  ),
  duplicates: z.array(
    z.object({
      path: z.string(),
      hash: hashSchema,
      existingSource: z.string().optional(),
    }),
  ),
  outOfScope: z.array(
    z.object({
      path: z.string(),
      reason: z.enum(OUT_OF_SCOPE_REASONS as unknown as [string, ...string[]]),
    }),
  ),
  errors: z.array(
    z.object({
      path: z.string(),
      phase: z.enum(ERROR_PHASES as unknown as [string, ...string[]]),
      reason: z.string(),
    }),
  ),
});

export const entryKindSchema = z.enum(ENTRY_KINDS as unknown as [string, ...string[]]);
