# Prompt: read-back before planning (comprehension gate)

**Použití:** dej tento text builder agentovi (OpenCode) a nahraď `$CAPABILITY`
názvem capability (např. `c2-register-in-ledger`). Není to plánovací prompt —
je to ověření, že artefaktům rozumí, než se podle nich začne stavět.

---

You are the builder for a new TypeScript repository. Before any planning I need to
know whether you understand the artifacts **as they are** — not whether you agree
with them, and not what you would do differently.

## Read

- `specs/$CAPABILITY/spec.md` (status: clarified)
- `.specify/memory/constitution.md` and the ADRs it cites (follow the paths inside)
- the ledger entry contract referenced from the spec
- the capability table in `~/org/projects/plaud-pipeline.org`, section `Capabilities`
- `.specify/templates/*` and the `speckit.*` commands available in `.opencode/commands`

## Produce exactly one artifact: `specs/$CAPABILITY/readback.md`

1. **Restatement** — the capability in your own words, max 5 sentences. No
   copy-paste from the spec. If you cannot restate it without quoting, say so.
2. **Obligations** — a table of every FR and SC you believe binds you, each with
   one line on *how it becomes a check*. An obligation without a check is a wish.
3. **Ambiguities** — anything you cannot act on without a decision. Per item:
   the question, the options, what you would pick, why. Mark every item `OPEN`.
   Do not decide for me.
4. **Method check, through spec-kit's own lens** — where the spec mixes in
   concerns that belong in `plan` (tech choices), where a section the methodology
   expects is missing (entities, data model, contracts, non-functional
   requirements), and which acceptance criteria are **not independently testable
   as written**.
5. **What you would build first** — one paragraph. No modules, no tasks, no design.

## Hard constraints

- No `plan.md`, no `tasks.md`, no code, no dependency changes, no scaffolding.
- Do not edit `spec.md` except to append `OPEN` questions under `## Clarifications`.
- Do not restate the workflow or the ADRs — reference them.
- Claims must be checkable: cite section names or line references, not paraphrase.

## Done means

A reviewer can read `readback.md` and see exactly (a) what you think you must
build, (b) what you cannot decide, (c) where the spec itself is weak. Every
assertion you make will be verified against the spec — it will not be taken on
trust. If you are unsure about something, write "unsure" and say what would
resolve it; a confident wrong restatement is worse than an honest gap.
