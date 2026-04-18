# Plan: MVP Phase 4 — File Transfer

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Depends on: [Phase 3 — Remote Shell](./2026-04-19-mvp-phase-3-remote-shell.md)

## Goal

An operator uploads a file to and downloads a file from an online agent
through a dedicated WebRTC capability channel. Files up to 1 GB transfer
intact (sha256 verified) and saturate available bandwidth. Cancellation
works cleanly mid-transfer.

## Non-Goals

- No directory browsing (single-path upload/download only)
- No transfer **resume** (failed transfers must be restarted from zero)
- No streaming compression
- No client-side encryption beyond DTLS (already provided by WebRTC)

## Approach

Add a second capability kind, `kind: "file"`, on top of the channel
abstraction from Phase 3. Reuse the same `channelMachine` and backpressure
helpers; the only new code is the file-specific protocol frames and the
disk I/O paths on each side.

### Wire protocol additions (`packages/core/src/protocol/`)

- Extend `OpenChannel` with
  `{ kind: "file", direction: "upload" | "download", path, size, sha256 }`.
- New frames: `FileChunk { seq, data }`, `FileChecksum { sha256 }`,
  `FileError { code, message }`.
- Frames sequenced; receiver verifies monotonic `seq` and rejects gaps.

### Backend (`projects/backend`)

- No file bytes traverse the backend (P2P over DataChannel).
- Records transfer metadata (path, size, sha256, status) in the `Session`
  row for audit.

### Agent (`projects/agent`)

- Upload: receives `FileChunk` frames, streams to a temp file, on
  `FileChecksum` verifies sha256, then atomically renames to target path.
- Download: streams chunks from disk respecting backpressure; sends
  `FileChecksum` at the end.
- Path validation: reject paths outside an allow-list configured at
  enrollment (default: agent user's home directory). Capability
  authorization is checked once on `OpenChannel`.

### Frontend (`projects/frontend`)

- Drag-drop upload zone on the agent detail page.
- "Download" action with target path input.
- Progress bar driven by acked-byte count; ETA computed in core.
- Cancel button → `ChannelClose`; both sides clean up partial files.

### Backpressure & integrity

- Reuses the Phase 3 backpressure helper from `packages/core`.
- Sender chunks at 64 KiB by default (tunable). Receiver verifies
  cumulative sha256 streaming, not all-at-end (for early failure
  detection).

## Steps

- [ ] Extend protocol schemas with file frames; bump `PROTOCOL_VERSION`
- [ ] Path-allowlist enforcement on the agent
- [ ] Agent: upload receiver → temp → atomic rename
- [ ] Agent: download sender with streaming sha256
- [ ] Frontend: drag-drop upload + progress + cancel
- [ ] Frontend: download action + progress + cancel
- [ ] Backend: persist transfer metadata for audit
- [ ] Load test: 1 GB upload and 1 GB download, sha256 verified
- [ ] Cancellation test: cancel mid-transfer; both sides leave no temp
      files
- [ ] Throughput test: transfer saturates a 1 Gbit link in CI fixture
      (within 80% of `iperf` baseline)
- [ ] Update [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)
      with the file capability frame layout

## Acceptance Criteria

- [ ] 1 GB file uploads with matching sha256
- [ ] 1 GB file downloads with matching sha256
- [ ] Mid-transfer cancel leaves no orphan temp files on the agent
- [ ] Throughput ≥ 80% of raw `iperf` between the two test endpoints
- [ ] Path-traversal attempt (`../../etc/passwd`) is rejected with a
      logged `FileError`
- [ ] Demo: drop a 500 MB file in the dashboard upload zone, see progress
      to 100%, verify `sha256sum` on the agent matches the source file

## Risks & Open Questions

- **Disk full on agent.** Mitigation: pre-check free space against
  `OpenChannel.size`; reject early.
- **DataChannel max message size** varies by browser. Mitigation: chunk
  size is small enough to be safe everywhere; document the limit.
- **CPU cost of streaming sha256** at line rate. Mitigation: use the
  runtime's native crypto; if it bottlenecks, fall back to verifying at
  end with documented trade-off.

## Decisions Log

- 2026-04-19: P2P only — file bytes never go through the backend. The
  whole point of the WebRTC architecture is to keep the control plane out
  of the data path.
- 2026-04-19: No resume in MVP. Resume requires a content-addressed chunk
  store and meaningful protocol surface; defer until users actually ask
  for it.
- 2026-04-19: Streaming sha256 verification, not end-only. Detecting
  corruption after a 1 GB transfer wastes user time.
