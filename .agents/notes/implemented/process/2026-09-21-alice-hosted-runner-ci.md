# Agent Note: Alice CI runs on hosted runners only

Status: implemented

English | [中文](2026-09-21-alice-hosted-runner-ci.zh.md)

## Problem

This repository is the Alice build of the harness, owned by machinepulse-ai. Upstream's pull-request CI targets paid enterprise runner pools (`dsh-ubuntu-24-04-16core`, `dsh-windows-2025-16core`) with a self-hosted failover, and its other workflows need DeepSeek's GitHub App, a Cloudflare token, self-hosted pools, or publish to npm and PyPI. None of that exists here: the enterprise labels never receive a runner, so the static, coverage, snapshot and every Windows lane of each pull request waited forever, and the preview, issue-policy and weighted-approval workflows failed on missing credentials.

## Decision

`ci.yml` keeps the Linux lanes and runs them on GitHub-hosted `ubuntu-24.04`; the failover switches and the four Windows lanes are removed, and the Python runtime matrix builds `node24-linux-x64` only. The workflow-shape specs describe this lane set. The upstream-only workflows stay in the tree, so the Agent Notes and specs that reference them keep resolving across syncs, and are disabled in the repository's Actions settings instead; `ALICE_MODIFICATIONS.md` lists them.

## Alternatives considered

**Delete the upstream-only workflows.** Visible in git, but every upstream sync then conflicts on each file and breaks the notes and specs that link to them. The Actions-settings switch persists across pushes and costs nothing on sync.

**Keep the Windows lanes on hosted `windows-2025`.** Alice does not publish a Windows runtime, and the lanes are the slowest in the matrix; nothing they prove reaches a shipped build.

## Consequences

Every pull request gets the static, coverage, benchmark, snapshot and Node-compatibility gates on standard runners, so `all checks passed` can go green here. Windows behavior is unverified in this repository. An upstream sync re-applies this trim to `ci.yml` and re-checks `gh workflow list --all`.
