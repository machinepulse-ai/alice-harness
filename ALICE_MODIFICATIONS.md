# Alice modifications

Changes this fork carries on top of the upstream tag it is pinned at. Alice's own
configuration lives in a dsh profile patch (`cmd/alice-agent/internal/cli/harness.go`
in machinepulse-ai/alice-ultra) and never lands here; only what a patch cannot
express does.

## The harness identity says Alice Harness

- **What** — the `harness:identity` prompt section, the first line of every
  system prompt this harness assembles, reads
  `You are an AI agent powered by Alice Harness.` The sentence is a literal in
  `packages/core/system-prompt/src/index.ts`; every test, snapshot and README
  that quotes it is updated with it, which is the whole diff:
  `s/powered by DeepSeek Harness/powered by Alice Harness/`.
- **Why** — Alice ships this runtime as Alice Harness, and an agent asked what it
  runs on answered DeepSeek, because that is what its own system prompt told it.
  `includeHarnessIdentity: false` would drop the identity slot rather than
  correct it, and a profile patch cannot reach a hardcoded string.
- **Upstreamable** — no, this one is ours by definition. Upstream would take the
  sentence as a config field instead; if it ever does, this fork drops the rename
  and Alice sets the field from its patch.
- **Re-applying after an upstream sync** — the conflicts are the quoted copies,
  not the logic. Take upstream's side everywhere, then re-run the substitution
  above over the tree and rebuild.
