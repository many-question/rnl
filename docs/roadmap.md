# Roadmap

This is the central TODO list. A checked box means work present in this repository, not a claim that a product feature works.

## Bootstrap

- [x] Create the independent directory map and documentation entry points.
- [x] Record the architecture baseline and draft provenance without copying source material.
- [ ] Decide the independent project's license and contribution terms.
- [ ] Agree on ownership, provenance, and migration of the language drafts into `spec/`.

## Toolchain foundation

- [ ] Establish real Cargo and pnpm workspaces when the first implementable packages are ready.
- [ ] Define module APIs, package names, versioning, build targets, and meaningful CI gates.
- [ ] Define the supported draft language profile and assemble conformance and roundtrip corpora.

## Reading and rendering

- [ ] Implement the Rust runtime and SPICE/Spectre host adapters for an agreed structural subset.
- [ ] Implement the shared renderer and external standard symbol data.
- [ ] Add the CLI, runtime WASM binding, TypeScript runtime package, and framework independent viewer core.
- [ ] Add the React/Vite web application and Tauri desktop shell; measure startup and document loading.

## Solving and editing

- [ ] Define the precise RNL output contract, source metadata, and input fingerprint in the language draft.
- [ ] Implement the solver, separate solver WASM binding/package, and native/WASM consistency checks.
- [ ] Add viewer integration that requests solving only when needed or requested.
- [ ] Implement the framework independent editor core, transactions, and safe host writeback.

## Release

- [ ] Define package compatibility and publication policy after the first working end-to-end path.
- [ ] Establish platform builds, performance baselines, documentation, and release checks.
