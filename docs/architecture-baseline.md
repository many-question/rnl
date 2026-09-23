# Architecture baseline

**Status:** planning baseline, not an implemented system or frozen language contract. This summary records the agreed direction for this repository's initial layout.

## Project boundary

RNL is an independent monorepo. Analog Canvas is a read-only reference for the initial planning material; this project does not depend on its code, runtime, assets, or Git history. Native netlists remain the authority for electrical facts. RNL carries interpretation and presentation information, and its language is still under discussion.

## Planned module shape

- A Rust runtime will own RNL interpretation and document semantics. Separate SPICE and Spectre host adapters will provide dialect-specific netlist facts and writeback behavior.
- A shared Rust renderer will turn effective RNL descriptions into basic drawing primitives. The solver will be a separate Rust component that can produce precise RNL descriptions.
- Runtime and solver will have separate WASM entry points and TypeScript packages. A viewer must be usable without installing or invoking the solver when a document is already sufficiently precise.
- TypeScript viewer and editor cores will not depend on React. The web application will use React and Vite; a Tauri desktop shell will reuse the web frontend.
- Standard symbols are external library data, not mandatory assets embedded in the viewer.
- Cargo and pnpm workspaces, internal schemas, algorithms, syntax decisions, concurrency details, versioning, and release mechanics remain future work.

This list describes intended responsibilities only. Directory names do not assert that APIs, dependencies, or packages already exist.

## Source and specification status

The baseline is distilled from the read-only proposal `D:\repositories\analog-canvas\docs\standards\rnl-toolchain-architecture.md` (2026-09-23), with language context in `rich-netlist.md` and `RNL-Syntax-0.1-draft.2.md` in the same directory. The architecture document calls itself a proposal. The principles and syntax documents are drafts; the syntax file explicitly says it is not a published or frozen RNL standard.

The full drafts have not been moved into `spec/`. Before migrating them, decide ownership, confirm permission and licensing, reconcile their status and version labels, and record provenance in the imported copies. Until then, these paths are references for project planning, not normative specifications in this repository.
