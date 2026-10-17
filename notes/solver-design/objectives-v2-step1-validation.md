# Step1 acceptance record (pending)

Validation owner: validation_prepare. Base `41d6b7d68544601f7a206af69c5b91286a2ed7c9`. No complete Step1 gate has been executed by this owner. Wait for production fixes, a stable review candidate, and root's unique Cargo token before execution. Existing targeted checks belong to A/B/C and are recorded in their handoffs/logs.

## Required gate queue

Run from repository root unless noted. Every Cargo or indirectly Cargo-starting command must have CARGO_BUILD_JOBS=4, no cargo/rustc at two checks five seconds apart, and >=8 GB available; wait at most 20 minutes. No native --release. Existing dedicated --profile wasm is permitted. The prepared target/objectives-v2-validation/run-step1-gated.ps1 writes per-command resource checks, log, exit and elapsed JSON; it is inert until invoked. Do not parallelize the queue. Freeze source state and save source hashes before starting; after fixes rerun invalidated checks.

| ID | Exact command | State |
| --- | --- | --- |
| N1 | cargo fmt --all --check | pending |
| N2 | cargo clippy --workspace --all-targets -- -D warnings | pending |
| N3 | cargo test --workspace | pending |
| W1 | cargo build --target wasm32-unknown-unknown -p rnl-runtime -p rnl-render -p rnl-host-spice -p rnl-host-spectre -p rnl-view -p rnl-edit -p rnl-solver -p rnl-runtime-wasm | pending |
| W2 | node bindings/runtime-wasm/build.mjs | pending |
| W3 | node bindings/runtime-wasm/build.mjs --features test-panic --out target/wasm-test | pending |
| W4 | node bindings/runtime-wasm/tests/core.mjs target/wasm-test | pending |
| E0 | cargo build -p rnl-cli | pending |
| E1 | node bindings/runtime-wasm/tests/equality.mjs --rnl target/debug/rnl.exe | pending |
| E2 | node bindings/runtime-wasm/tests/equality.mjs --rnl target/debug/rnl.exe --view --primitives --request '{"primitives":true}' | pending |
| E3 | node bindings/runtime-wasm/tests/equality.mjs --rnl target/debug/rnl.exe --snapshot | pending |
| S1 | cargo build -p rnl-runtime-wasm --features test-solver --example solver-smoke | pending |
| S2 | node bindings/runtime-wasm/build.mjs --features test-solver --out target/wasm-solver-test | pending |
| S3 | node bindings/runtime-wasm/tests/solver.mjs | pending |
| F1 | python scripts/fonts.py web | passed; F1-fonts-web-02, 115 slices × 2 weights; original raw download timed out, official API returned identical pinned blobs |
| F2 | python scripts/fonts.py metrics --check | passed; current 8536-byte metrics |
| D1 | cargo fmt --manifest-path apps/desktop/Cargo.toml --check | pending |
| D2 | cargo clippy --manifest-path apps/desktop/Cargo.toml --all-targets -- -D warnings | pending |
| D3 | cargo test --manifest-path apps/desktop/Cargo.toml | pending |
| D4 | node apps/desktop/tests/smoke.mjs | pending |
| P1 | npx playwright test --project chromium --project webkit --workers 2 (cwd tests/viewer) | pending |
| P2 | npx playwright test --project long --no-deps --workers 1 (cwd tests/viewer) | pending |
| C1 | Verify config/** occurs in push and pull_request filters of rust/viewer/desktop workflows, with no PR base filter | passed; check-ci-paths.py assertions and workflow SHA256 in step1-gates/C1-ci-paths.json |

Playwright local Chromium must use installed Google Chrome, never Edge; WebKit cache revision2359 matches installed Playwright1.63.0 browsers.json. tests/viewer and apps/desktop npm ci --ignore-scripts already completed by C. Font generation and metrics verification are complete. Keep Cargo token throughout Playwright setup/web-server builds. Read-only inspection of installed Playwright1.63 runner confirms plugin/webServer setup completes before globalSetup, so the web wasm build finishes before the CLI fixture build; full test execution remains pending. Explicit separate long command avoids its Firefox dependencies. Node argument arrays are preferable for E2 JSON on Windows.

Targeted Settings evidence: candidate02 initially passed14/14; candidate03-ui added two boundary regressions and passed18/18 (Chrome9 + WebKit9), 143.7313697 seconds, exact total in P0-settings-r4-02-ui03.json. This targeted spec does not replace P1/P2 full viewer gates. Native candidate02 CLI/source/config hashes remain in step1-candidate02-451c871a/freeze.json; UI03 is separately frozen at review-candidate-03-ui. Performance diagnosis caused an intentional pause after16 complete native raw cases (all14 T solve0 plus two expected legacy-name bench solve1). The incomplete02-folded case and two unfinished driver tests are explicitly interrupted in pause-for-performance.json, not called pass/fail. Routing performance changes require a new source/CLI freeze and final benchmarks; partial02 results remain before evidence.

Performance risk remains open. A's isolated full T6 comparison reported old02 wall337.82s/CPU307.80s versus integer-cost candidate wall267.626s/CPU250.109s, with byte-identical solved RNL SHA256. This is approximately1.26x end-to-end, and must not be replaced by the approximately10x improvement of one controlled hard-layout routing seam. Source/output paths and hashes will be attached from A's exact measurement ledger. A continues profile and fixed-layout score investigation; no full-gate or final benchmark acceptance follows from this partial optimization. Candidate02 representative T6 geometry may be reused only with the recorded identical-RNL-byte proof and unchanged runtime/render/config inputs; actual final SVG identity/render verification remains pending. Prepared four SVG copies and provenance are in comparisons/t6-performance-before.

Attached evidence now exists in comparisons/t6-performance-before/integer-proof-and-exact-scores.json and exact-score-comparison.md. The isolated comparison input/config hashes match, candidate02 and integer solved RNL both hashbb59c4ea8920c1bc100b9f9300e31e23b118cb726f43e710e3e669eebb7ccc43, and the saved partial02 T6 record has the same hash. A's three existing fixed-score outputs (main/candidate02/integer) all have complete coverage without missing state; candidate02/integer exact score JSON hashes are identical. The current configuration's first decisive level is index5: weighted wire_turns33 in old main versus59 in new, tolerance0; levels0–4 tie. Thus old main's geometry scores better under the current configuration. Lower-priority area improvement does not explain or justify this loss. Quality/search risk stays explicitly open while A investigates. No new native scoring or rendering was invoked to attach these already-produced JSON/RNL files.

## Baseline and comparison inventory

Immutable main binary: target/objectives-v2-validation/baseline-main-41d6b7d/bin/rnl-main.exe, SHA256 fdab9f30fe8fb6258e855fecacc43b3a3168a863c066cf7e2e4816482b6d6cdd. Never overwrite main artifacts.

| Inputs | Main complete | Step1 | Measurement |
| --- | --- | --- | --- |
| Seven original T0.2 including T2b | 7/7 all six steps exit0 | pending | Each nonempty level, unchanged legacy metrics plus separate exact new scoring |
| Seven T0.3 extracted from09f32d2, T3/T4 MIRRORED rename | 7/7 all six steps exit0 | pending | Same input SHA256s, deliberate snapshots, T2b explicit |
| Raw20bench | 20 outputs, 14 expected solve1 from legacy MIRROR_PAIR only | pending | Preserve raw diagnostic comparison; no auto CURRENT |
| Compatible20bench, only52 MIRROR_PAIR→MIRRORED replacements | 20/20 all six steps exit0, 26 levels | pending | Same compatible input SHA256/positions map, geometry/time/new-scoring split |

Raw main results: target/objectives-v2-validation/baseline-main-41d6b7d/results, 34 records/44 geometry levels, total solve460.5887065s. Compatible main results: results-compatible, 20 records/26 levels, solve739.2765838s. Both have completion.json, full stdout/stderr, command/exit/elapsed, SVG and view JSON. Provenance is manifest.json, manifest-compatible.json and compatibility-map.json. Reference legacy metrics.py is unchanged and hash recorded. A new branch CLI must be copied to a distinct immutable bin with SHA256 plus source-state manifest before native benchmark execution.

New comparison must be per input and level and retain legacy bends/crossings/length/overlaps/pin hits/through-symbol count/box overlaps/extent, separate configured score kind/parameters/raw/weight/level/total/tolerance/estimated/inactive, solve time and report provenance. Do not call a definition change a geometry improvement. Explain changed images with expected v2 removal of type/name guesses, configured priority behavior, fallback routing and explicit CURRENT; unknown changes go to A/B rather than being blessed.

Some raw and compatible inputs are byte-identical: reuse is allowed only after proving equal input bytes, effective options/config and binary hashes, with explicit alias mapping. Otherwise run both. Do not reuse old executable output as new executable output. Preserve all original reports and figures.

## Snapshot plan and ownership

Seven original working-tree solved snapshots are preserved byte-for-byte with hashes in target/objectives-v2-validation/snapshots-before-step1; no RNL_BLESS has run. A confirmed validation owns copying the seven fixed 0.3 inputs into tests/integration/solver/0.3; A owns extending CLI solve/snapshot tests to that directory. The seven fixture copies are complete and byte-verified against the frozen baseline; source/original/copied hashes are in objectives-v2-step1-fixtures.json. No solved snapshots were copied or blessed. Source fixture provenance remains09f32d297377aca02267399dabf6598fe65fbeae plus recorded rename only.

After production P1 fixes and A confirms changes are intended v2 behavior, deliberately run RNL_BLESS=1 cargo test -p rnl-cli --test solve (same token/guard), archive new snapshots and per-file diff/reason, then rerun without RNL_BLESS. Never bless unknown failures. Preserve independent 0.2 compatibility tests and 0.3 snapshots; old0.2 solve output may upgrade to0.3 as specified. Report any newly unreadable/unsolvable0.2 file.

## Scope boundary

Step1 validates resolver errors/precedence, explicit config/default/builtin source and desktop resource mapping with the minimal settings migration. Complete installed-package/portable/development/builtin four-state distribution smoke is Step3 and remains scheduled there; do not claim it completed in Step1. GNU desktop portable checks require WebView2Loader.dll beside exe. Native MSVC single-exe distribution is separately verified by CI.

Fresh adversarial review is independent; this verifier does not review or fix production source. Send minimal test failure, exact command/log and source state to A/B and root. All background runners must be fully polled to completion and checked before this agent ends a verification task.

## Coordination state during performance investigation

Root reports the isolated stage profile identified repeated full estimates in search as the main remaining cost. A and the independent reviewer are considering a narrow geometry-sharing optimization with unchanged values/order; A retains the sole Cargo/performance token. Validation is limited to light documentation and existing-file evidence until a new grant; no implementation or CPU-heavy validation runs are authorized during that window.

Root also relayed the user's authorization to use a reset card when the authorized usage allowance is close to exhaustion. At root's latest actual query, usage was41% and three reset cards were available; none had been used. The currently exposed tools provide a usage query but no reset invocation. If no usable reset entry is available when needed, root will state that limitation. This is a recorded coordination decision and reported account snapshot, not a reset action or an independent account query by validation.

## Post-freeze execution order and provisional duration

No command in this section has been started. A currently owns the sole Cargo/performance token while implementing the independently approved single-View shared exact-geometry optimization. Start only after A declares a stable source checkpoint and root grants validation the token. Preserve the new source manifest, immutable CLI and effective configuration hashes; do not relabel candidate02 partial results as final.

| Order | Work and acceptance boundary | Planning range, excluding failure repair and resource waits |
| --- | --- | --- |
| 1 | Capture freeze; newly compile the test binary. First run the four corrected driver diagnostics (T3 output junction, bounded T3 exits, drawings/T5 explicit-object grouping, T6 fixed neighbours), plus route/current/strict-record-coverage and the new shared-geometry equivalence regressions supplied by A. Confirm exact full ordered reports and candidate order, not only totals. | 10–30 minutes for freeze/build/short targeted subset |
| 2 | Execute all14 migrated driver cases, specifically finish the previously interrupted tiny-budget and corpus-grounding cases. Preserve per-test results and reject any unexpected new exception. Static delta02 approval already exists; execution must use newly compiled current source. | 20–90 minutes, low-confidence because the two longest cases never completed in the prior interrupted run |
| 3 | Required N1–N3, W1–W4, E0–E3, S1–S3, D1–D4, P1/P2 and refresh C1 evidence in the table above. Preserve font/R4 evidence only if its relevant source/input hashes match; R4's18/18 is targeted evidence, not a substitute for the full browser gates. Deliberately bless only A-confirmed snapshot changes after archiving old/new bytes and reasons, then rerun without blessing. | 1–3 hours, provisional; no full local measured run is available for this candidate |
| 4 | Use the final saved native CLI for all34 raw inputs and compatible20, with explicit byte/options/binary proof for any duplicate alias. Keep the main/02 records unchanged. Recompute strict fixed-layout scoring for old/new solved records without search/routing; invalid raw inputs are N/A with reasons, valid compatible inputs require complete coverage. | 1–4 hours initially; main's two complete solve totals sum to about20 minutes, whereas partial02 was substantially slower. Recalibrate after the final candidate's first heavy case; this is not a claimed upper bound. |
| 5 | Complete case/level input/config/binary/source, all-term and legacy-metric traceability; inspect changed SVG pairs and ask A for each unexplained ordered-objective tradeoff. Retain explicit unknown/defect status rather than assuming every difference is expected. | 1–2 hours for preparation/representative inspection; unresolved case diagnosis can extend this |

Total elapsed planning range is roughly4–10 hours without repair; the ranges overlap in lightweight documentation only and are not a delivery commitment. Each Cargo-capable command still has the mandatory two process checks five seconds apart,8GiB free-memory floor, jobs4 and at most20-minute resource wait. Repeated guard waits or a new failure are reported separately rather than hidden in solve time.

Read-only hash checks, existing JSON/CSV/Markdown aggregation, provenance links, and preparing existing SVG pairs can run alongside a native benchmark without substantial CPU use. A browser/frontend test may coexist only with an unmeasured exploratory native job and explicit scheduling; it cannot coexist with performance-timed native runs in this acceptance queue. Browser rendering, new fixed-score native execution, multithreaded tests and fonts are separate CPU phases during measured runs. Cargo, Node build scripts, Playwright setup/web-server builds and default desktop smoke are always serialized under the token. The full benchmark phases retain process ownership/logs until the runner is terminal and every record is checked.

## Candidate-ranking evidence boundary

Root relayed the independent reviewer's profile-candidate code/report check: the10 placed-estimate candidates have matching order; the four routed candidates order as[8,9,0,1], and chosen candidate8 is correct. The beam candidates with35/36 wire turns each have symbol_overlaps4/wire_overlaps4 in their first level, while the selected P0 has both0. Thus the observed final ranking is consistent with the ordered objective on that supplied candidate set. This does not establish why the old main layout, which scores better under the current fixed-layout configuration, failed to enter that candidate set. It neither closes the T6 quality/search risk nor proves global search optimality. This entry is attributed review evidence; validation has not independently rerun the profile or introduced another scoring run during A's isolated performance window.

Candidate07 review-manifest.json was read-only hash-verified as6c7b9b8a7a60f4857afbe1f2096600f292b3864b011a53b77a2d8e3278f0387c. It is an eight-file review delta, not a full production-source manifest. Subsequent independent review found a P2 change in overlap behavior for a zero-width/zero-height bbox contained by a larger box. Root declared07 ineligible for the final freeze while A repairs it and adds oracle coverage. No validation command was started against07. The next accepted freeze must include that degenerate-bbox regression before full gates; final CLI provenance must capture the entire current production tree rather than treating the review delta as a full source snapshot.

Root subsequently accepted independent review's narrowly justified reuse of07 evidence for this T6:102 appended fixed facts and18 original facts retained,544 actual eight-orientation traces,10 placed/four routed candidate ordering and work. This case had every complete score level equal to the old oracle and symbol_overlaps alone in its own level, so the later degenerate-box correction does not require another07 full-oracle run. A owns08's new degenerate-box/common-cache oracle checks, compilation and one final raw-T6 CLI controlled timing with input/config/output/work hashes. Validation will consume those results after explicit handoff rather than repeating the337-second old CLI or07 oracle. New source changes or a failed reuse condition invalidate that reuse; v3's required ordinary full gates are still run on final source.

## Final08 execution checkpoint

Root explicitly granted validation the token after A completed and released its final controlled run. A reports final raw0.2 T6 wall179.946s/CPU172.203s, outputSHA bb59c4ea8920c1bc100b9f9300e31e23b118cb726f43e710e3e669eebb7ccc43, work2993/8943/71/177821 unchanged. The independent reviewer accepted the diagnosed T6 geometry loss as the declared Step1 top-two orientation/fixed-sketch limitation: five old MY roots rank7 and never enter the retained two choices. This closes that case's final-ranking bug allegation; it does not promise Step2 recovery or justify every other corpus difference. Relative to the main baseline, substantial performance regression remains explicit.

Validation independently verified all159 entries of A's build-input manifest65b6ccc2a805ad12f54980ff7f635779bf523fcaf1b0590d32fd8f6def491062 and saved the unchanged CLI97f5ae8745f7c0b8246b0175d39f5525efebf067efb050827a1adbf60efa5c1d. Full repository613-file source manifest780063500d8decbb9ccdcff7d92ece4494c856475278dd035a62a0f149f622f1 and ZIP feaf3264e289e52c3b4ddde5c5fe15041b9ae98fa0cb3345ae41313554da6969 are under step1-final08-97f5ae87. Capture time2026-10-17T19:05:55Z. Missing tracked files are the three intentionally relocated test modules; one generated Python cache is explicitly excluded. The snapshot is independent of the eight-file review delta and preserves uncommitted source bytes before A's logical commits.

First final08 driver command T-driver-final08-corrections-01 passed3/4 in14.42s after1.37s compile, with cargo/rustc0 at both checks and free10.80/10.88GiB. Junction, drawings and T6 neighbours pass. The strict exit test now reaches T3's ota5t sublayer and fails at M1:s, exit(0,-1), actual first segment(-8,-7) to(-4,-7), retained62/62facts, P0,107 expansions. The existing exception remains restricted to the approved two main-layer pins; no new exception has been applied. A/root/reviewer received exact diagnostics for a same-Layout/bbox decision. The saved new test executable and source certificate are driver-final08-01. The two previously interrupted tests are being run independently as T-driver-final08-interrupted-01; full required gates have not started while this fresh migration failure is unresolved.
