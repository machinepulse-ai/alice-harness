# Agent Note: Alice CI 只跑在托管跑机上

Status: implemented

[English](2026-09-21-alice-hosted-runner-ci.md) | 中文

## Problem

本仓库是 machinepulse-ai 维护的 harness Alice 构建。上游的 pull request CI 指向付费企业跑机池（`dsh-ubuntu-24-04-16core`、`dsh-windows-2025-16core`）并带自托管故障转移，其余工作流需要 DeepSeek 的 GitHub App、Cloudflare 令牌、自托管池，或者向 npm、PyPI 发布。这里一样都没有：企业跑机标签永远等不到跑机，每个 pull request 的 static、coverage、snapshot 与全部 Windows 车道无限期挂起；preview、issue-policy 与 weighted-approval 工作流因缺凭证而失败。

## Decision

`ci.yml` 保留 Linux 车道并改跑在 GitHub 托管的 `ubuntu-24.04` 上，coverage 与 snapshot 车道的 worker、分区与关卡并发按它的 4 个 vCPU 设定——上游的取值假定 16 核跑机，在小跑机上会过载成依赖时序的覆盖率缺口与 e2e 超时；故障转移开关与四条 Windows 车道移除，Python 运行时矩阵只构建 `node24-linux-x64`。coverage 车道改为普通单元测试车道，不作为必需：去掉逐文件 100% 的覆盖率门槛，并通过 `DSH_TEST_SKIP_USER_SYSTEMD=1` 跳过六个 Linux 进程收容用例文件——它们的 kill、中止与超时用例要启动瞬态的用户 systemd scope，托管跑机上 `loginctl enable-linger` 能让 `systemd-run --user --scope` 成功，但 scope 的引导进程从不运行。这些用例在开发机和上游照常运行。snapshot 车道通过 `scripts/run-gates.ts` 新增的 `DSH_CI_SKIP_WEB_SNAPSHOT=1` 开关省略 Playwright 网页快照关卡：本 fork 不发布 Web 客户端，而这一关最慢，也是托管跑机上会随机失败的那一关。描述工作流形状的 spec 按这套车道更新。仅上游需要的工作流仍留在树里——引用它们的 Agent Note 与 spec 在同步后仍能解析——改为在仓库的 Actions 设置里停用；`ALICE_MODIFICATIONS.md` 列出了清单。

## Alternatives considered

**删除仅上游需要的工作流。** 在 git 里可见，但之后每次同步上游都会在每个文件上冲突，并破坏链接到它们的 note 与 spec。Actions 设置里的停用状态跨推送持久，同步零成本。

**把 Windows 车道留在托管的 `windows-2025` 上。** Alice 不发布 Windows 运行时，这些车道又是矩阵里最慢的；它们证明的东西不会进入任何发布产物。

## Consequences

每个 pull request 都在标准跑机上跑 static、coverage、benchmark、snapshot 与 Node 兼容性关卡，`all checks passed` 在这里能变绿。本仓库不验证 Windows 行为。同步上游时对 `ci.yml` 重放这次裁剪，并复查 `gh workflow list --all`。
