<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# <title>

> <one-line summary>

## Status

- **State:** Draft
- **Type:** feature | bug | docs | infra
- **Story:** <!-- optional, story slug (docs/stories/<slug>/) — the durable intent this plan serves -->
- **Sprint:** <!-- optional, filled when plan is added to a sprint — a time-boxed selection of planned work -->
- **Issue:** <!-- optional, tracker issue(s) this plan answers (`#228`, or `#226, #228`) — the board removes an issue from its inbox once a plan names it here -->
- **Review:** <!-- pr | in-session | ballot — how is this plan reviewed & approved? -->
- **Impl:** <!-- own branches | same branch | other repo | none — where does implementation happen? -->
- **Rounds:** <!-- optional, how many rounds of interrogation this plan has had. Written by /challenge-the-plan, and by hand for an interrogation run without it — the board shows a rounds badge from this field. Absent means nobody has questioned the plan; `0` says it was questioned and nothing came of it, so leave the line out rather than writing zero -->
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

<!-- Release note entry. Written during planning, refined during implementation. -->

- <user-facing change description>

## Motivation

<!-- Why does this matter? What problem does it solve? -->

## Design

### Approach

<!-- How will this be implemented? Key architectural decisions. -->

### Open Points

- [ ] ...

## Slices

<!-- Optional: define a tracer bullet (thin vertical slice) first. -->
<!-- See the tracer-bullets skill for guidance. -->
<!-- ### Tracer -->
<!-- - `feature/<slug>-tracer` — <thin slice description> -->
<!--   Layers: <layer> → <layer> → <layer> -->
<!--   Proves: <what this validates> -->
<!--   Status: Not started -->

<!-- When using ### Tracer, wrap remaining branches in ### Implementation: -->
<!-- ### Implementation -->

<!-- Waves: branches under one ### subheading may run concurrently. A wave is
     eligible once every non-deferred branch in every PRIOR wave is merged, so
     `### Tracer` proves the seam before `### Implementation` fans out. Add
     `### Wave 3`, `### Wave 4`, … for anything that must follow.
     No subheadings at all = one wave = every branch eligible at once (the
     pre-wave behaviour). Check state with /plot-pulse.
     Annotations (deferred:/claimed:/moved:/agent:) must sit on the SAME line
     as the backticked branch name — a wrapped continuation line is not read. -->

<!-- Agent: name which KIND of agent a slice needs, and a dispatch selects that
     charter with no operator present. Write it as an `agent:` annotation on the
     branch line — a slice reviewed rather than implemented annotates
     `agent: reviewer`, and the name is the stem of a file in .plot/charters/.
     Optional, and the default is what every slice does today: a slice naming no
     kind launches on the repo's own `Worker command`, unchanged.
     A charter this clone does not hold is REPORTED, never refused — a plan
     written where `reviewer` is declared stays dispatchable where it is not. -->

- `feature/<slug>` — <description>

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
