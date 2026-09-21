# Agent Note: Alice CI runs on hosted runners only

Status: implemented

English | [中文](2026-09-21-alice-hosted-runner-ci.zh.md)

## Problem

This repository is the Alice build of the harness, owned by machinepulse-ai, and its CI runs on that company's resources. Upstream's pull-request CI targets paid enterprise runner pools (`dsh-ubuntu-24-04-16core`, `dsh-windows-2025-16core`) with a self-hosted failover, and its other workflows need DeepSeek's GitHub App, a Cloudflare token, self-hosted pools, or publish to npm and PyPI. None of that exists here: the enterprise labels never receive a runner, so the static, coverage, snapshot and every Windows lane of each pull request waited forever, and the preview, issue-policy and weighted-approval workflows failed on missing credentials. The matrix also proves things this build does not ship: Windows, three Node versions, npm publishing, the Python SDK, and the Web client.

## Decision

Pull requests run `alice-ci.yml`, two jobs on GitHub-hosted `ubuntu-24.04`. One job builds (which typechecks both compiler faces), lints, replays the runtime's recorded sessions under `snapshots/`, and builds the linux-x64 single executable with the release's own command. The other runs the unit suite without the per-file 100% coverage bar, under two `vitest.config.ts` switches: `DSH_TEST_SKIP_UNSHIPPED=1` excludes the suites of what this build does not ship (prototypes, the Web client and its apps, the editor hook bridges, E2B, webhooks, test-support, repository tooling), and `DSH_TEST_SKIP_USER_SYSTEMD=1` excludes the six Linux process-containment suites, whose kill, abort and timeout cases launch transient user-systemd scopes that the hosted runner cannot complete — `loginctl enable-linger` makes `systemd-run --user --scope` succeed there, yet the scope's bootstrap never runs. Upstream's `ci.yml` and the other upstream workflows stay in the tree unchanged, so syncs do not conflict and the Agent Notes and specs that reference them keep resolving, and are disabled in the repository's Actions settings; `ALICE_MODIFICATIONS.md` lists them.

## Alternatives considered

**Trim upstream's `ci.yml` in place.** It was tried first: retargeting the Linux lanes to hosted runners and removing the Windows lanes worked, but every further cut fought the workflow-shape specs and the 16-core assumptions baked into the lane concurrency, and each sync would reopen the fight. A separate workflow leaves upstream's file untouched.

**Delete the upstream-only workflows.** Visible in git, but every upstream sync then conflicts on each file and breaks the notes and specs that link to them. The Actions-settings switch persists across pushes and costs nothing on sync.

**Keep the coverage bar and make the containment suites pass.** The user-systemd scope failure sits below the test layer, in how the hosted runner completes a transient scope; solving it is upstream runner work, not a fork concern, and the bar protects publishing quality this build does not need.

## Consequences

A pull request costs two hosted jobs instead of twelve, and `all checks passed` can go green here. The documentation gates run by hand, not in CI. Windows, Node 22 and 26, benchmarks, npm publishing lint, the Python SDK and the Web client are unverified in this repository. An upstream sync re-checks `gh workflow list --all` and the script names `alice-ci.yml` calls.
