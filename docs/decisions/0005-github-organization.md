# 0005. The repository lives in the rich-netlist GitHub organization

- Date: 2026-09-29
- Status: accepted

## Context

The repository was created under the maintainer's personal GitHub account as `many-question/rnl`, and the introduction page was published at `many-question.github.io/rnl/`. The npm packages already use the `@rich-netlist` scope ([decision 0003](0003-npm-scope.md)), so the project had one name on npm and another on GitHub. The name `rich-netlist` was still free on GitHub.

## Decision

- The maintainer created the GitHub organization `rich-netlist` and transferred this repository to it as `rich-netlist/rnl`. The introduction page is published at `https://rich-netlist.github.io/rnl/`.
- The organization is administered by the maintainer. It changes where the project is hosted, not who holds the copyright: the copyright notices and the terms of [decision 0002](0002-licenses.md) and [decision 0004](0004-contribution-terms.md) stay as they are.
- The private research repository that holds the prototypes and experiments stays under the maintainer's personal account and is not part of this project. Its results enter this repository as separate contributions, under the licenses of the paths they go into.

## Consequences

- GitHub redirects the old repository URL and existing Git remotes to `rich-netlist/rnl`. The old page address `many-question.github.io/rnl/` stops working; GitHub Pages does not redirect it.
- Links written into this repository, including those in the introduction page and its build script, use `rich-netlist/rnl` and `rich-netlist.github.io/rnl/`.
- The organization's root address `rich-netlist.github.io` and a custom domain are not set up. Either can be added later without moving the repository again.
