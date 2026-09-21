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

## CI runs on GitHub-hosted runners only

- **What** — `.github/workflows/ci.yml`: the three Linux lanes run on
  `ubuntu-24.04` instead of the `dsh-ubuntu-24-04-16core` enterprise pool, the
  self-hosted failover switches (`DSH_CI_FAILOVER_*`) are gone, the four Windows
  lanes are removed, and the Python runtime matrix builds `node24-linux-x64` only.
  The spec files that described the old lane set follow
  (`scripts/ci-workflow.spec.ts`, `scripts/ci-compatible-selfhosted.spec.ts`,
  `scripts/tests/ci-master-platforms.spec.ts`).
  The upstream-only workflows are not deleted — deleting them would break the
  Agent Notes and specs that reference them on every sync — but are **disabled in
  this repository's Actions settings** (`gh workflow disable`), which persists
  across pushes: Build PR preview (Cloudflare), Issue lifecycle, Issue policy,
  weighted-approval (both), CI master, Sandbox, Deploy documentation, E2E (all
  three), Node Addon System (both), Release (dsh, vendor, publish ×2, Python).
- **Why** — none of that infrastructure exists in machinepulse-ai: the enterprise
  runner labels never get a runner, so every PR sat on "pending" forever; the
  other workflows need DeepSeek's GitHub App, a Cloudflare token, self-hosted
  pools, or publish to npm/PyPI, which this build must never do.
- **Upstreamable** — no. On an upstream sync, take upstream's `ci.yml` and
  re-apply this trim; check `gh workflow list --all` still shows the same set
  disabled.

## CI's bubblewrap pin follows the current Ubuntu package

- **What** — `scripts/prepare-ci-bubblewrap.sh` pins `bubblewrap_0.9.0-1ubuntu0.3`
  (sha256 `2461f1be…`) instead of `0.9.0-1ubuntu0.1`.
- **Why** — archive.ubuntu.com drops a superseded security build; the old pin
  returns 404, so the coverage and snapshot lanes died in their first step on
  every hosted run.
- **Upstreamable** — yes, the same rot hits upstream's hosted lanes. Drop this
  entry once upstream moves the pin.
