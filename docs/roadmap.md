# Roadmap

This is the central TODO list. A checked box means work present in this repository, not a claim that a product feature works.

## Bootstrap

- [x] Create the independent directory map and documentation entry points.
- [x] Migrate the principles draft, syntax draft 0.1-draft.2, and toolchain architecture proposal from Analog Canvas with provenance ([decision 0001](decisions/0001-canonical-rnl-documents.md)).
- [x] Start the decision record log.
- [x] Confirm that the migrated documents belong to the maintainer's personal project and can be relicensed here.
- [x] Decide the licenses for code, specification text, and data ([decision 0002](decisions/0002-licenses.md)).
- [x] Reserve the npm organization scope `@rich-netlist` ([decision 0003](decisions/0003-npm-scope.md)).
- [x] Decide the contribution terms ([decision 0004](decisions/0004-contribution-terms.md), [CONTRIBUTING.md](../CONTRIBUTING.md)).
- [x] Add a Chinese introduction page for circuit designers ([`site/`](../site/README.md)). Its RNL snippets follow the ongoing 1.16 language discussion, which is not yet in `spec/`.
- [ ] Replace the Analog Canvas copies with pointers once this repository is public; until then they are marked migrated and frozen.

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
- [ ] Claim crate names with the first real crate release.
- [ ] Establish platform builds, performance baselines, documentation, and release checks.
