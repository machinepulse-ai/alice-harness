# Agent Note: ACP 转发实时 assistant 流

Status: implemented

[English](2026-09-21-acp-live-assistant-stream.md) | 中文

## Problem

ACP 桥只从已提交的 `assistant/message` 事件投影 assistant 输出，客户端要等模型写完整条消息后才收到一个 `agent_message_chunk` 或 `agent_thought_chunk`。工具调用仍然逐步出现，但一段长文本回答在最后一个 token 之前完全不可见，驱动慢模型的客户端无法区分"正在生成"和"卡住"。Agent 本来就在 `agent/assistant-stream` 上发布每个模型增量，Web 会话控制器在消费它；桥没有。

## Decision

桥为它拥有的 Agent 订阅 `agent/assistant-stream`，把每个 `text-delta` 转发为 `agent_message_chunk`、每个 `reasoning-delta` 转发为 `agent_thought_chunk`，走与工具生命周期、用量相同的按会话有序更新链。其他块类型不进入协议。该尝试的消息提交时，`assistantUpdates` 跳过其尝试已经流式发出的文本与 thought 块——按轮次与步骤对照"已看到 `start` 帧、尚未看到 `end` 帧"的那次尝试识别——因此每个块恰好到达客户端一次；图片块与 `usage_update` 仍从已提交事件投影。实时块不带 `messageId`，因为消息 id 在提交时才存在。

## Alternatives considered

**缓冲增量、提交时一次刷出。** 完全保留旧协议但什么也没增加；改动的理由正是客户端需要在提交前拿到文本。

**撤回失败尝试的部分文本。** ACP 没有撤回已交付内容的更新，发明扩展会破坏本包的标准协议承诺。部分文本留在协议上，重试在其后再次流式输出；README 把它记为限制。

## Consequences

ACP 客户端按模型生成的节奏看到 assistant 文本与 thought，每个模型增量一条更新。假定每条消息只有一个块的客户端必须拼接；`dsh-subagent-acp` 已经这样做。失败或重试的尝试会留下已流式发出的前缀，显示文本的客户端要容忍重试时重复的开头。桥的测试描述了按增量的协议与保留的部分文本；录制的 ACP 快照已按新的更新序列刷新。
