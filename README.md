# Rich Netlist (RNL)

RNL is a proposed way to attach circuit meaning and presentation information to native netlists. This independent repository is intended to grow into a portable RNL runtime, solver, viewer, editor, and standard symbol library.

**Status:** This first commit contains only a directory and documentation skeleton. It has no parser, solver, renderer, application, build configuration, or released package. The RNL language specification is still a draft and has not been moved here.

## Repository map

| Path | Intended responsibility |
| --- | --- |
| [`spec/`](spec/README.md) | Language drafts and versioned specification work, once migrated. |
| [`crates/`](crates/README.md) | Future Rust runtime, host adapters, shared renderer, solver, and CLI. |
| [`bindings/`](bindings/README.md) | Separate runtime and solver WASM entry points. |
| [`packages/`](packages/README.md) | TypeScript SDKs and framework independent viewer/editor cores. |
| [`apps/`](apps/README.md) | Web application and desktop shell. |
| [`libraries/`](libraries/README.md) | External data libraries, starting with standard symbols. |
| [`tests/`](tests/README.md) | Future conformance, roundtrip, and integration corpora. |
| [`examples/`](examples/README.md) | Future example documents. |
| [`scripts/`](scripts/README.md) | Future project maintenance scripts. |
| [`.github/workflows/`](.github/workflows/README.md) | Future CI workflow location. |
| [`docs/`](docs/README.md) | Current architecture baseline and roadmap. |

Start with the [documentation map](docs/README.md), [architecture baseline](docs/architecture-baseline.md), and [roadmap](docs/roadmap.md). Each component directory contains a short README describing its planned role.

## Next step

Settle ownership and migration of the existing draft specification, then establish real Cargo and pnpm workspaces as implementation begins. The [roadmap](docs/roadmap.md) tracks this work without presenting it as complete.

## Contribution and licensing status

Please discuss language or module boundary changes in an issue or pull request and keep documentation status explicit. The independent project's license has not been selected. Do not assume that the draft materials in Analog Canvas have been relicensed for this repository.
