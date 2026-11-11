# Agent Note: ACP relays the live assistant stream

Status: implemented

English | [中文](2026-09-21-acp-live-assistant-stream.zh.md)

## Problem

The ACP bridge projected assistant output only from committed `assistant/message` events, so a client received a text or thought block as one `agent_message_chunk` or `agent_thought_chunk` after the model finished the whole message. Tool calls still appeared step by step, but a long text answer stayed invisible until its last token, and a client driving a slow model could not distinguish generation from a stall. The Agent already publishes every model delta on `agent/assistant-stream`, which the Web session controller consumes; the bridge did not.

## Decision

The bridge subscribes to `agent/assistant-stream` for the Agents it owns and relays each `text-delta` as an `agent_message_chunk` and each `reasoning-delta` as an `agent_thought_chunk`, on the same per-session ordered update chain that carries tool lifecycle and usage. Other chunk kinds stay off the wire. When the attempt's message commits, `assistantUpdates` skips the text and thought blocks of a message whose attempt streamed them, recognized by turn and step against the attempt whose `start` frame was seen and whose `end` frame has not, so every block reaches the client exactly once; image blocks and `usage_update` still project from the committed event. Live chunks carry no `messageId`, because the message id exists only at commit.

## Alternatives considered

**Buffer deltas and flush on commit.** Preserves the old wire exactly and adds nothing; the reason for the change is that clients need text before commit.

**Retract a failed attempt's partial text.** ACP has no update that withdraws delivered content, and inventing an extension breaks the standard-protocol commitment of this package. The partial text stays on the wire and a retry streams after it; the README records this as a limitation.

## Consequences

An ACP client sees assistant text and thoughts as the model produces them, one update per model delta. A client that assumed one chunk per message must concatenate; `dsh-subagent-acp` already does. A failed or retried attempt leaves its streamed prefix delivered, so a client that displays text must tolerate a retry's repeated opening. The bridge tests describe the per-delta wire and the retained partial text; the recorded ACP snapshots were refreshed for the new update sequence.
