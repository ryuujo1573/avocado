# Design Docs Index

Catalogue of all design documents. Add an entry here whenever a new design doc is created.

| Document                             | Status    | Summary                                                                                 |
| ------------------------------------ | --------- | --------------------------------------------------------------------------------------- |
| [core-beliefs.md](./core-beliefs.md) | ✅ Active | Foundational operating principles — 6 constraints that drive all architecture decisions |
| [connectivity.md](./connectivity.md) | ✅ Active | Control channel (WebSocket) + data channel (WebRTC P2P/TURN) design                     |
| [ota-plugins.md](./ota-plugins.md)   | ✅ Active | OTA plugin bundle format, WASM sandbox model, signing, and registry                     |

## How to Add a Design Doc

1. Create `docs/design-docs/<slug>.md`
2. Add an entry to this index with status and one-line summary
3. Link from [AGENTS.md](../../AGENTS.md) if it is a primary reference
