# workflows

CI workflows.

| Workflow | Purpose |
| --- | --- |
| [`pages.yml`](pages.yml) | Builds the introduction page in [`site/`](../../site/README.md) in both languages. On pull requests that touch `site/` it only checks the build, which fails when a text lacks one of its languages; on `main` it also publishes the page to GitHub Pages. Pages must use "GitHub Actions" as its source. |

See the [roadmap](../../docs/roadmap.md) for planned work.
