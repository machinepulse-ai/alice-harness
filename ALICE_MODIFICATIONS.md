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

## Pull-request CI is the Alice workflow, not upstream's

- **What** — `.github/workflows/alice-ci.yml` runs on every pull request as two
  hosted jobs plus an aggregate. `build, lint, snapshots, runtime`: `pnpm run
  build` (tsc for both faces, so it is the typecheck), `lint:contracts-ready`,
  the recorded-session replay of `snapshots/` (acp, sdk, session — the Web
  client's snapshots under `apps/web/tests` need Chromium and are left out),
  then the linux-x64 single-executable build with the exact command
  alice-ultra's `scripts/build-harness.sh` runs. `unit tests`: `vitest run` with
  20 s per test and no per-file 100% coverage bar, under two `vitest.config.ts`
  switches: `DSH_TEST_SKIP_USER_SYSTEMD=1` excludes the six Linux
  process-containment suites and the real-shell terminal suite
  (`terminal-bash/tests/local.spec.ts`, whose pwsh motd arrives empty on a
  loaded 4-vCPU runner); the containment cases' kill, abort and timeout paths launch
  transient user-systemd scopes, and on the hosted runner the scope starts but
  its bootstrap never runs, even after `loginctl enable-linger` made
  `systemd-run --user --scope` succeed), and `DSH_TEST_SKIP_UNSHIPPED=1`
  excludes what this build does not ship (`packages/experimental`, `client`,
  `hooks`, `e2b`, `webhook`, `test-support`, `apps/`, `scripts/`). Both sets
  still run on developer machines and upstream. The documentation gates
  (`pnpm run test:docs`) are not in CI; run them by hand when touching docs.
  Upstream's `ci.yml` and every other upstream workflow are unchanged in the
  tree — deleting them would conflict on every sync and break the Agent Notes
  and specs that link to them — and are **disabled in this repository's
  Actions settings** (`gh workflow disable`; persists across pushes):
  CI, CI master, Expected filenames, Build PR preview (Cloudflare), Issue
  lifecycle, Issue policy, weighted-approval (both), Sandbox, Deploy
  documentation, E2E (all three), Node Addon System (both), Release (dsh,
  vendor, publish ×2, Python).
- **Why** — this CI runs on company resources for a runtime that ships one
  ACP profile. Upstream's matrix (enterprise 16-core pools that never get a
  runner here, four Windows lanes, three Node versions, benchmarks, npm
  publishing lint, Python SDK tests, a 10-minute Playwright web-client lane)
  proves things this build does not ship, and its runner pools, GitHub App,
  Cloudflare token and npm/PyPI publishing do not exist in machinepulse-ai.
- **Upstreamable** — no. An upstream sync leaves `alice-ci.yml` untouched; if
  upstream renames a script this workflow calls (`typecheck`,
  `lint:contracts-ready`, `test:docs`, `check:ci:snapshot`,
  `build:native-system`), follow the rename here, and check
  `gh workflow list --all` still shows the upstream set disabled.

## CI's bubblewrap pin follows the current Ubuntu package

- **What** — `scripts/prepare-ci-bubblewrap.sh` pins `bubblewrap_0.9.0-1ubuntu0.3`
  (sha256 `2461f1be…`) instead of `0.9.0-1ubuntu0.1`.
- **Why** — archive.ubuntu.com drops a superseded security build; the old pin
  returns 404, so the coverage and snapshot lanes died in their first step on
  every hosted run.
- **Upstreamable** — yes, the same rot hits upstream's hosted lanes. Drop this
  entry once upstream moves the pin.

## The ACP bridge streams assistant text and thoughts as the model produces them

- **What** — `packages/acp/acp` subscribes to `agent/assistant-stream` for the
  Agents it owns and relays each `text-delta` as an `agent_message_chunk` and each
  `reasoning-delta` as an `agent_thought_chunk`, on the same ordered per-session
  chain as tool lifecycle and usage. When the message commits, the blocks that
  already streamed are skipped, so a client sees each block exactly once.
  Recorded ACP snapshots refreshed; README pair and an Agent Note
  (`.agents/notes/implemented/feature/2026-09-21-acp-live-assistant-stream.md`)
  describe it.
- **Why** — Alice drives this runtime over ACP and shows the answer in a chat. The
  bridge only projected committed messages, so a long text answer stayed invisible
  until its last token, indistinguishable from a stall.
- **Upstreamable** — yes: a pure addition to the bridge. The one behavior upstream
  may not want is that a model attempt failing after it streamed leaves its partial
  text on the wire; ACP has no update that retracts delivered text.
