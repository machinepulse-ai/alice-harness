---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-10-alice-retry-message-source

English | [中文](2026-11-10-alice-retry-message-source.zh.md)

## Summary

Record the Alice gateway retry correction's existing llm-retry message attribution in the Session type history.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

Existing source alternatives and event envelopes remain unchanged, so the new reader replays older records with their original meaning. Readers without the retry correction accept a nonempty external source kind and retain its JSON metadata; they still replay the recorded correction as ordinary user-message content. The kind adds no replay or authorization requirement. Session format V4 remains unchanged.

<a id="verification"></a>
## Verification

Vitest passed 35 checks in native-source-admission.spec.ts and pi-ai-gateway-recovery.spec.ts. The first preserves unknown attribution without the producing plugin in read and write modes, and the second exercises recording the correction and sending it on retry.

<a id="dev-note"></a>
## Dev Note

None.
