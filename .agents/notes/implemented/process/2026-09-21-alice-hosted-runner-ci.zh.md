# Agent Note: Alice CI 只跑在托管跑机上

Status: implemented

[English](2026-09-21-alice-hosted-runner-ci.md) | 中文

## Problem

本仓库是 machinepulse-ai 维护的 harness Alice 构建，CI 跑在公司自己的资源上。上游的 pull request CI 指向付费企业跑机池（`dsh-ubuntu-24-04-16core`、`dsh-windows-2025-16core`）并带自托管故障转移，其余工作流需要 DeepSeek 的 GitHub App、Cloudflare 令牌、自托管池，或者向 npm、PyPI 发布。这里一样都没有：企业跑机标签永远等不到跑机，每个 pull request 的 static、coverage、snapshot 与全部 Windows 车道无限期挂起；preview、issue-policy 与 weighted-approval 工作流因缺凭证而失败。这套矩阵验证的也是本构建不发布的东西：Windows、三个 Node 版本、npm 发布、Python SDK 与 Web 客户端。

## Decision

Pull request 跑 `alice-ci.yml`，在 GitHub 托管的 `ubuntu-24.04` 上两个 job。一个 job 构建（同时对两个编译面做 typecheck）、lint、回放 `snapshots/` 下运行时的录制会话，再用发布所用的同一命令构建 linux-x64 单文件可执行程序。另一个跑不带逐文件 100% 覆盖率门槛的单元测试，受 `vitest.config.ts` 两个开关约束：`DSH_TEST_SKIP_UNSHIPPED=1` 跳过本构建不发布的部分（原型、Web 客户端及其应用、编辑器钩子桥、E2B、webhook、test-support、仓库工具）的用例，`DSH_TEST_SKIP_USER_SYSTEMD=1` 跳过六个 Linux 进程收容用例文件——它们的 kill、中止与超时用例要启动瞬态的用户 systemd scope，托管跑机上 `loginctl enable-linger` 能让 `systemd-run --user --scope` 成功，但 scope 的引导进程从不运行。上游的 `ci.yml` 与其余上游工作流原样留在树里，同步不冲突、引用它们的 Agent Note 与 spec 仍能解析，并在仓库的 Actions 设置里停用；`ALICE_MODIFICATIONS.md` 列出了清单。

## Alternatives considered

**就地裁剪上游的 `ci.yml`。** 先试过：把 Linux 车道改到托管跑机、删掉 Windows 车道是可行的，但再往下每一刀都要和描述工作流形状的 spec 以及车道并发里写死的 16 核假设较劲，每次同步还要再来一遍。单独一个工作流让上游文件原封不动。

**删除仅上游需要的工作流。** 在 git 里可见，但之后每次同步上游都会在每个文件上冲突，并破坏链接到它们的 note 与 spec。Actions 设置里的停用状态跨推送持久，同步零成本。

**保留覆盖率门槛并让进程收容用例通过。** 用户 systemd scope 的失败在测试层之下，在托管跑机如何完成瞬态 scope 这一层；解决它是上游的跑机工作而非 fork 的事，而那道门槛保护的是本构建不需要的发布质量。

## Consequences

一个 pull request 花两个托管 job 而不是十二个，`all checks passed` 在这里能变绿。文档关卡手动跑，不进 CI。本仓库不验证 Windows、Node 22 与 26、benchmark、npm 发布 lint、Python SDK 与 Web 客户端。同步上游时复查 `gh workflow list --all` 以及 `alice-ci.yml` 调用的脚本名。
