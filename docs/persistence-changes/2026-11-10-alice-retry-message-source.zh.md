---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-10-alice-retry-message-source

[English](2026-11-10-alice-retry-message-source.md) | 中文

## 概述

在 Session 类型历史中登记 Alice 网关重试纠正消息已有的 llm-retry 来源。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-10-alice-retry-message-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "8e84923f26ea9611bd7b9e0857a15977c567651557c696f9daea5403cb40f87c"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "d5ccbf7a2588b390c9f1835d5c5c85be10e91abf8e4660692db07f6371949bed"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "95d84cabfd2ac4e42a837c01e370aa88b2fa9092051efad69aed696dd6fc892d"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "d913aaafaf93295ec37a34742159563c3c477d3ebf6a660146a1e6d30b4060fc"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

现有来源分支和事件信封保持不变，新版读取器按原语义回放旧记录。未包含重试纠正功能的读取器接受非空的外部来源 kind 并保留其 JSON 元数据，仍会把已记录的纠正内容作为普通用户消息回放。该来源不会引入回放或授权要求。Session 格式仍为 V4。

<a id="verification"></a>
## 验证

native-source-admission.spec.ts 与 pi-ai-gateway-recovery.spec.ts 共通过 35 项 Vitest 检查。前者验证没有来源插件时读写模式都会保留未知来源，后者验证纠正消息会被记录并随重试发送。

<a id="dev-note"></a>
## 开发备注

无。
