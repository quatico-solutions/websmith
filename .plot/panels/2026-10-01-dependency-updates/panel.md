<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: dependency-updates

- **Subject:** `docs/plans/2026-10-01-dependency-updates.md` (Draft, branch `idea/dependency-updates`, PR #133)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** build tooling, package consumer, supply-chain security
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`build-tooling.md`, `package-consumer.md`,
  `security.md`); the moderator changed nothing in them. All three files pass the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:**
  - *Build tooling* **read** `package.json`, `nx.json`, `eslint.config.js`, the workflows and the lockfile, and
    queried #108 / #110 with `gh api`. `npm view nx` failed (E401), so nx's current version and Node floor are
    unverified there.
  - *Package consumer* **executed** `npm view <pkg>@0.10.0 dependencies` against the registry for the published
    packages and `git grep` on `origin/develop`; it did not call the Dependabot API.
  - *Security* **executed** `gh api` against the live alerts and `gh pr view/diff` for #108, #110, #139; no build or
    install — what a bump resolves to is reasoned from lockfile ranges.
- **The moderator checked the one point where two jurors contradict each other** (see "Where they differ", 1):
  `packages/core/src/environment/browser-system.ts:9` imports `create-hash`, and `browser-system` is reached from
  production code (`environment/system.ts`, `PathWatcherRegistry.ts`, re-exported from `environment/index.ts`).

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| The ESLint premise is wrong: develop has ESLint 9 and typescript-eslint 8, not 8 / 7 | all three | `package.json:44-61`; lock `eslint@9.19.0`, `@typescript-eslint/parser@8.22.0` |
| nx-cloud is dead: remove `@nrwl/nx-cloud 18.0.1`; no `nxCloudId`, token or `NX_CLOUD` anywhere | all three | `package.json:42`; `nx.json` uses `nx/tasks-runners/default` |
| `sha.js` and `cipher-base` criticals ship to users through `create-hash@1.2.0`, a runtime dependency of `@quatico/websmith-core`; the plan files them under dev tooling | consumer, security | `packages/core/package.json:42`; lock `:7407` |
| Overrides do not reach consumers; the declared ranges do. A consumer-facing change (lodash floor `^4.18.1`, `create-hash`, `path`) needs a Release-Notes entry and a release | consumer, security | #110 diff raises `lodash` in core and node |
| Overrides must be range-scoped selectors (`minimatch@3`, `js-yaml@3`), never a flat pin across majors | build tooling, security | minimatch 3 / 5 / 9 / 10 in the lockfile |
| Regenerate the lockfile with pnpm 9, as CI does (`pnpm/action-setup@v3`, `version: 9`), or `--frozen-lockfile` may fail | build tooling, security | `pull-request.yml`, `release-and-publish.yml` |
| The Dependabot config is independent and should land first, not last | all three | — |
| Dependabot must not propose `typescript` bumps against the exact `5.7.3` pin and the TS 7 story | all three | `package.json` |

## Where they differ — named, not averaged

1. **Is `create-hash` used?** The consumer juror says "looks unused" (its `git grep createHash` found only
   `ts.sys.createHash`) and proposes dropping it. The security juror found the import in `browser-system.ts:9` and
   says "offer as a decision; check before removing". **The moderator verified the security juror's reading:** the
   package is imported and `browser-system` is on the production path. So the amendment is not "drop an unused
   dependency" but "replace `create-hash` in `browser-system.ts`" (e.g. with `node:crypto`, or a browser-safe hash if
   the browser target is real) — a code change with tests, not a manifest edit. The same check is owed for `path@0.12.7`
   before dropping it.
2. **What the nx slice is.** Build tooling says nx is only a script runner here (no `project.json`, no `@nx/jest`
   executors), so `nx migrate` finds almost nothing and the work is a lock-step bump in 10 manifests plus the
   deprecated `tasksRunnerOptions` / `cacheableOperations` keys. Security pins the target to the 22.x line because the
   nx alert's first patched version is 22.7.2. Not contradictory, but the plan must state both: target 22.x, and the
   `nx.json` legacy keys are the expected breakage.
3. **Success metric.** Only security says `pnpm audit --prod` is nearly blind to the target (83 of 85 alerts are
   `scope: development`) and that GitHub re-scans only the default branch, so a PR cannot show an "after" count.
   Undisputed; the metric must change.
4. **Why the backlog exists.** Security alone found that `claude-review` fails on every Dependabot PR (Dependabot
   workflows get no repository secrets) and that #108's `dist (24)` fails. If `claude-review` is required, no
   Dependabot PR can merge — which explains the backlog better than the missing config, and makes the config slice
   useless on its own. The others did not look at PR checks.
5. **Splitting the transitive slice.** Build tooling splits by mechanism (merge #108 / #110, then overrides);
   consumer splits by audience (dev-only overrides vs a new `fix/trim-runtime-dependencies`). These are different
   cuts; the audience cut is the one that maps to the Release-Notes obligation.

## Shared blind spot

All three lenses audited **what is installed**; none audited **what runs**. The plan's risk is not only stale
versions but install-time and CI execution: a major nx upgrade introduces new packages with lifecycle scripts and
native binaries, and the release workflow holds `id-token: write` for trusted publishing. Security touches this
(cooldown, SHA-pinned actions, `onlyBuiltDependencies`), but nobody asked for a lockfile-diff review step of new
`postinstall` packages as a gate, or whether `pnpm audit` / `osv-scanner` should run in CI at all so the next
pile-up is visible before it is 85 alerts.

A second, smaller: the alert counts drift daily (83 in the plan, 85 at panel time). The plan should state its target
as a rule ("no open critical or high on merge"), not as a count.

## Cross-plan conflicts

- **TS 6/7 story:** the Dependabot config must ignore or separately group `typescript` so it does not propose TS 6 / 7
  on its own timeline.
- **#134, #135, #136, #137** touch `packages/core`; the consumer-facing `create-hash` replacement in
  `environment/browser-system.ts` does not overlap their files, but its release-note entry joins the same
  `## [Unreleased]`.

## What the plan needs before approval

1. **Correct the ESLint premise** (9 / 8), rewrite that Motivation row and drop the open point.
2. **Close the nx open points:** target the 22.x line (patched 22.7.2); remove `@nrwl/nx-cloud`; name the
   `nx.json` legacy keys and a cache smoke check; diff the lockfile for new packages with install scripts.
3. **Add a consumer-facing slice:** replace `create-hash` in `browser-system.ts` (it is used), check and drop
   `path@0.12.7`, raise `lodash` to `^4.18.1` in core and node; verify with `pnpm pack` + scratch install; Release-Notes
   entry.
4. **State the remediation ladder:** lockfile refresh → parent bump → range-scoped override with a GHSA comment, last.
   Regenerate with pnpm 9. Name #139 (fast-uri).
5. **Replace the metric:** dev-inclusive audit (`pnpm audit --audit-level=high` or `osv-scanner`) in the PR; alert
   count re-checked after merge.
6. **Decide `claude-review` for Dependabot PRs** (skip for `dependabot[bot]` or add a Dependabot secret) and whether it
   is required.
7. **Complete the Dependabot config:** `directories: ["/", "/packages/*"]`, a security group
   (`applies-to: security-updates`), cooldown, labels, PR limit, commit prefix (Arlo), `typescript` ignored; land it
   first.

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
