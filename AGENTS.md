<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# AGENTS.md

websmith is a compiler frontend for the TypeScript compiler: a `tsc` drop-in CLI and a webpack loader that run
addons (generators, processors, transformers, result processors) during compilation.

- Package manager: pnpm (workspace), build orchestration: nx
- Stack: TypeScript (strict), Jest, ESLint + Prettier, MIT license with auto-injected headers

## Critical Rules (Non-Negotiable)

1. **CI Golden Rule** - No task is complete until `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm test:e2e` pass. CI runs exactly these on every PR.
2. **ALWAYS use pnpm** - `preinstall` enforces `only-allow pnpm`; npm/yarn break the workspace and lockfile.
3. **ALWAYS structure unit tests as assemble / act / assert** - one blank line between parts, NEVER comment the parts. See `docs/rules/testing.md`.
4. **ALWAYS name the object under test `testObj` and its outcome `actual`** - observed objects are `target`, meaningless API values are `whatever`.
5. **NEVER share `testObj` between tests** - each test creates its own instance; no `let testObj` + `beforeEach`.
6. **NEVER use `console` in production code** - ESLint errors on it; report through `ctx.getReporter().reportDiagnostic(...)`.
7. **MUST add the MIT license header to every new source file** - run `pnpm license:add`; `pnpm license:check` is not in CI and already lists older files, so NEVER add new ones to that list.
8. **MUST export an `activate(ctx: AddonContext)` function from every addon** - without it the registry only warns and silently ignores the addon.
9. **NEVER let generators modify source code** - only processors change content; generators produce side effects.
10. **NEVER import `@quatico/websmith-core` in addon code** - it is internal; addons depend on `@quatico/websmith-api` only.

## Essential Commands

```bash
pnpm install --frozen-lockfile   # Install (CI mode)
pnpm build                       # Build all packages (nx run-many)
pnpm lint                        # Lint (also runs in husky pre-commit)
pnpm test                        # Unit + integration tests
pnpm test:e2e                    # compiler-test / webpack-test end-to-end suites
pnpm dist                        # Full distribution build + e2e
pnpm license:add                 # Add missing license headers
```

## Quick Pre-Commit Checklist

- [ ] `pnpm lint && pnpm test && pnpm build && pnpm test:e2e` pass locally
- [ ] New files carry the license header (`pnpm license:check`)
- [ ] New unit tests follow assemble/act/assert with `testObj` / `actual`
- [ ] Public API changes live in `packages/api` and are reflected in `AddonContext`
- [ ] Commit message follows Arlo's notation (see `docs/rules/workflow.md`)

## Where to Find More

**When working on...**

- Packages, compilation pipeline, key files, performance -> `docs/rules/architecture.md`
- Addons (loading, registry, `AddonContext`, transformers, writing/debugging addons) -> `docs/rules/addons.md`
- `websmith.config.json`, profiles, compiler options, transpileOnly / addonEmitOnly -> `docs/rules/configuration.md`
- Unit tests, mocks, Jest setup, e2e suites -> `docs/rules/testing.md`
- Commands, CI, code style, license headers, commits -> `docs/rules/workflow.md`

**Reference material:**

- Domain vocabulary -> `docs/language-glossar.md`
- User-facing docs and CLI usage -> `README.md`, `packages/*/README.md`
- Addon examples -> `packages/example-addons/src/`

---

*This file follows AGENTS.md convention for cross-tool compatibility (Claude Code, Cursor, Windsurf, etc.)*

## Plot Config

- **Branch prefixes:** idea/, feature/, bug/, docs/, infra/
- **Plan directory:** docs/plans/
- **Active index:** docs/plans/active/
- **Delivered index:** docs/plans/delivered/
- **Story directory:** docs/stories/
- **Story index:** docs/stories/README.md
- **Definition of Done:** lint, test, build, test:e2e
- **Git host:** github
- **Main branch:** develop
- **Tracker:** github
- **CI:** github-actions
- **Worktree root:** .worktrees
- **Commit style:** arlo-no-colon — e.g. `R Fixes …`; see the `commit-notation` skill

<!-- Written by /plot-init.
     Definition of Done: confirmed
     Git host: the remote
     CI: confirmed
     Commit style: probe proposed arlo-colon (2 of 80 subjects); corrected to the no-colon majority, confirmed
-->

## Definition of Done

A PR is ready when:

- `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm test:e2e` pass (what `.github/workflows/pull-request.yml` runs).
- Every code change has unit tests (see `docs/rules/testing.md`). Behaviour visible through the CLI, the webpack
  loader or the addon API also gets an end-to-end case in `packages/compiler-test` or `packages/webpack-test`.
- User-visible changes add an entry under `## [Unreleased]` in `Release-Notes.md`. Changes to CLI flags, config
  keys or the addon API update `README.md` or the affected `packages/*/README.md`. No changesets.
- User-facing text is English.
- Commits follow Arlo's notation without a colon; the `commit-notation` skill owns the details. The host is GitHub,
  so PR operations use `gh` (see `handling-pull-requests`).

## Agentic Workflow

Four phases, each turning one durable artifact into the next.

| Phase | Produces | Commands and skills |
|-------|----------|---------------------|
| **Discovery** | a story (`docs/stories/`) or a ticket assessment | `triage-ticket` for an incoming issue · `story-tracking` for multi-session work |
| **Design** | an approved plan (`docs/plans/`) | `/plot-idea` → `challenge-the-plan` → `/plot-approve` |
| **Development** | merged branches | `/plot-implement` · `test-driven-development` · `commit-notation` · `handling-pull-requests` → `/plot-deliver` |
| **Endgame** | a verified release | `reality-check` before claiming done · `/plot-release rc` → verify the checklist → `/plot-release` |

Discovery is optional: small, well-understood work goes straight to Design.

**Plans vs. session logs.** A plan says what will be built and is frozen on approval. A session log says how it
was decided — including the alternatives that were rejected — stays amendable, and outlives the plan. If it must
be true *before* building starts, it belongs in the plan; if it answers "why not the other way?", it belongs in a
log.

## Session Wrap Up

Include the Plot context for this session in the log. Run `plot-context.sh` from the Plot plugin
(`skills/plot/scripts/plot-context.sh` inside the plugin; this repo does not vendor it).

It reports the governing plan, its phase, its wave, and its PRs as JSON. An empty `plan_slug` means the branch
belongs to no plan — say that rather than guessing, because a log attributed to the wrong plan outlives the
session that mis-attributed it.

Record decisions and their **rejected alternatives** here, not in the plan.
