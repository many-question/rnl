# 0004. Contributions are licensed under the path's license, without sign-off or CLA

- Date: 2026-09-24
- Status: accepted

## Context

The repository uses three licenses by path ([0002](0002-licenses.md)). GitHub's terms license a contribution under the repository's license, but that does not say which of the three applies to a given change. The common options were an explicit inbound-equals-outbound rule, a Developer Certificate of Origin sign-off on every commit, or a contributor license agreement.

## Decision

- A contribution is licensed under the license of the path it changes, as recorded in `REUSE.toml`. Contributors keep their copyright and confirm that they have the right to license the contribution this way.
- No Developer Certificate of Origin sign-off and no contributor license agreement are required.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) states these terms.

## Consequences

- MIT, CC-BY-4.0, and CC0-1.0 already let the project use contributions in any context, commercial use included, provided notices are kept. A contributor agreement would add little.
- Because contributors keep their copyright, the project cannot remove their notices or grant rights it does not hold, such as an exclusive license; that would need their consent. This is accepted.
- A sign-off requirement can be added later by a superseding record, for example once outside contributions become regular.
