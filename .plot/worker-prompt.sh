#!/usr/bin/env bash
# Worker prompt: the `claude -p` invocation plot-worker-loop.sh runs each
# iteration. The loop SOURCES this file, so $PLOT_BRANCH, $PLOT_WORKTREE and
# the session variables expand at runtime and `claude` runs in the agent's
# worktree.
#
# THIS FILE IS THE PROJECT'S. Plot ships it as a starting point and reads
# nothing back out of it: what the agent is TOLD is the project's to write, and
# the wording below is deliberately short because a real project's is not.
# Replace the instructions with this project's own — the repo's gates, its
# commit and PR conventions, whatever an agent here must know.
#
# TWO LINES ARE PLOT'S, AND THEY ARE THE SESSION HANDLING BELOW. Keep them when
# you rewrite the rest. They are the half of the contract Plot exports and
# cannot write, and the paragraphs that follow say what each one costs to get
# wrong.
#
# THE FLAG IS THE LOOP'S DECISION, NOT THIS FILE'S. plot-dispatch.sh mints a
# session id and the loop exports it as PLOT_SESSION_ID, together with
# PLOT_SESSION_FLAG — `--session-id` on an agent's first prompt and `--resume`
# on every one after. The loop decides which by probing whether a transcript
# already exists under that id. This file interpolates the answer and states no
# rule of its own.
#
# THAT SPLIT IS WHY THE RULE IS NOT HERE. A prompt file that hardcodes
# `--session-id` works once: the id does not change when an agent hops to a
# second slice, so the runtime is asked to CREATE a session it already holds,
# answers `Session ID … is already in use`, and the prompt exits in under a
# second. Measured 2026-09-05, three agents failed that way simultaneously,
# every exit code zero and every board row reading `running`. Every project
# rewrites this file, so a rule written here is a rule that gets rewritten; an
# interpolated flag cannot be.
#
# THE DEFAULT IS `--session-id`, for a loop older than the export or a hand
# run. Asserting an id that turns out to be taken fails loudly in one second,
# where a bare `--resume` opens an interactive picker in a `-p` run with no
# terminal and hangs — that flag is optional-valued, so it does not refuse a
# blank value.
#
# AN ABSENT ID IS NOT AN EMPTY ONE. Run by hand, or by any caller that is not
# dispatch, this file has no PLOT_SESSION_ID, and `--session-id ""` is a
# malformed argument rather than a missing one. So the pair is built as an
# array that stays EMPTY when the variable is unset or blank: the run proceeds,
# its transcript is unattributable, and that is the honest answer.
#
# THE `${a[@]+"${a[@]}"}` FORM IS FOR BASH 3.2, WHICH IS `/bin/bash` ON MACOS.
# There, a plain `"${session_args[@]}"` on an EMPTY array expands to one empty
# argument — the exact malformed argument the guard exists to avoid — and under
# `set -u` it aborts with `session_args[@]: unbound variable` instead. Bash 5
# does neither. The loop sources this file through `bash -c`, which resolves on
# PATH, so the version is not knowable here and the portable form is the only
# correct one.
session_args=()
[ -n "${PLOT_SESSION_ID:-}" ] && session_args=("${PLOT_SESSION_FLAG:---session-id}" "$PLOT_SESSION_ID")

# WHAT THIS AGENT MAY TOUCH — the capability names its charter declared.
#
# Plot exports the NAMES and this file owns the SPELLING, the same division the
# session flag above follows. A capability is whatever this project decided it
# means; the harness's flag for it is this file's business, because the flag
# differs per harness and Plot must learn none of them.
#
# THE DENY FORM, AND IT IS A MEASUREMENT RATHER THAN A PREFERENCE. Measured
# 2026-09-12 against the installed CLI: `--allowedTools "Read" "Grep"` left the
# agent's tool list FULL — `Write`, `Edit` and a shell all present — with and
# without `--permission-mode bypassPermissions`. That flag shapes permission to
# call a tool, and the last line of this file grants that permission anyway. Only
# `--disallowedTools` removes a tool from the list, and it survives the bypass.
# An allow-list here would ship a gate that does not gate.
#
# EDIT THE MAPPING BELOW. It is an EXAMPLE and the names are this project's to
# choose — `read-only` is not a word Plot knows. Add an arm per capability the
# charters in `.plot/charters/` declare.
#
# <<<CAPABILITY_MAPPING>>>
#
# AN UNMAPPED CAPABILITY IS SAID OUT LOUD, NEVER SWALLOWED. An agent whose
# charter declares a bound this file does not implement runs UNBOUNDED, and
# that is the honest failure — Plot invents no fallback scope, because a scope
# nobody wrote is a scope nobody agreed to. What it must not do is happen
# quietly, so it is named on stderr where the launch log keeps it.
# THE EXAMPLE MAPPING'S DENY LIST, and it names an EXECUTION surface rather
# than a pair of write tools. Measured 2026-09-12: with Write, Edit, Bash and
# NotebookEdit all denied under bypassPermissions, a sandbox agent overwrote
# the target file anyway, through an MCP plugin's Python REPL — `open(p, "w")`
# is a filesystem write like any other. Disabling a named write tool removes
# one interface to the filesystem; it does not remove the filesystem.
#
# DELEGATION IS DENIED FOR THE SAME REASON: a subagent inherits no bound, so an
# agent that may spawn one is not bounded at all.
#
# It is a DEFAULT a project overrides, not a rule — the mapping lives in this
# file, which every project rewrites, and Plot has no opinion about what a
# capability means here.
: "${PLOT_READ_ONLY_DENY:=Write,Edit,NotebookEdit,Bash,Agent,Task}"

cap_args=()
if [ -n "${PLOT_CAPABILITIES:-}" ]; then
  while IFS= read -r capability; do
    [ -n "$capability" ] || continue
    case "$capability" in
      read-only) cap_args+=(--disallowedTools "${PLOT_READ_ONLY_DENY}") ;;
      *)
        echo "worker-prompt: charter capability '$capability' has no mapping here — the agent runs UNBOUNDED for it" >&2
        echo "  Add a case arm in .plot/worker-prompt.sh, or remove it from the charter." >&2
        ;;
    esac
  done <<EOF
$PLOT_CAPABILITIES
EOF
fi

# WHAT THIS AGENT RUNS ON — the harness, model and effort its charter declared.
#
# THE SAME DIVISION AS THE TWO BLOCKS ABOVE: Plot exports the NAMES and this
# file owns the SPELLING. `--model` and the effort flag are this harness's
# spelling of two names Plot knows nothing about; another harness spells them
# differently, and Plot must learn none of them.
#
# THE HARNESS IS THE COMMAND, so it is substituted rather than passed. A charter
# naming none runs `claude`, which is every dispatch on an estate with no
# charter and is what this file did before the charter existed.
#
# `[ -n ... ]` AND NOT `${VAR+set}`, AND THE TWO ARE NOT INTERCHANGEABLE HERE.
# `plot-dispatch.sh` exports these three UNCONDITIONALLY — `resolve_launch`
# initialises all three to '' and the launch exports them whatever they hold —
# so a charter-less dispatch hands this file three variables that are SET AND
# EMPTY. `${PLOT_MODEL+set}` is true for all of them, and testing it would pass
# `--model ""` on every dispatch that has no charter, which is a malformed
# argument rather than a missing one.
#
# `PLOT_CAPABILITIES` ABOVE IS THE OPPOSITE CASE and keeps the opposite idiom:
# dispatch exports it CONDITIONALLY, so unset means unstated and the array form
# `${cap_args[@]+...}` guards an array that may not exist. The two idioms guard
# two different absences; unifying them would break one.
harness="${PLOT_HARNESS:-claude}"

model_args=()
[ -n "${PLOT_MODEL:-}" ] && model_args=(--model "$PLOT_MODEL")

# THE EFFORT FLAG IS THIS HARNESS'S NAME FOR IT. Change the flag, not the
# variable, when a project runs something that spells it another way.
effort_args=()
[ -n "${PLOT_EFFORT:-}" ] && effort_args=(--reasoning-effort "$PLOT_EFFORT")

# WHAT IT BUILT, ON REQUEST — a debug hook, and deliberately not a contract.
#
# THE CHAIN IS OTHERWISE UNOBSERVABLE. A worker launches detached, Plot never
# composes the command line, and reading a live process is timing-sensitive and
# costs a real agent run. So the one honest way to prove a charter reached the
# launch is to ask the file that assembled it.
#
# IT PRINTS AND EXITS 0 WITHOUT LAUNCHING, immediately before the invocation, so
# what is printed is the argv that would have run rather than a second
# assembly of it — a reconstruction here would pass while the real line stayed
# wrong, which is the failure this probe exists to catch.
#
# NOTHING IN PLOT READS IT and nothing branches on it. A prompt file that drops
# this block simply cannot be probed this way; no caller breaks.
if [ -n "${PLOT_PRINT_INVOCATION:-}" ]; then
  printf '%s\n' "$harness" \
    ${model_args[@]+"${model_args[@]}"} \
    ${effort_args[@]+"${effort_args[@]}"} \
    ${cap_args[@]+"${cap_args[@]}"} \
    ${session_args[@]+"${session_args[@]}"}
  exit 0
fi

"$harness" ${model_args[@]+"${model_args[@]}"} ${effort_args[@]+"${effort_args[@]}"} ${cap_args[@]+"${cap_args[@]}"} -p "You are implementing the branch $PLOT_BRANCH in this worktree, alone. Read .plot/briefs/${PLOT_BRANCH##*/}.md first — it is the specification: do not re-derive its decisions and do not widen its scope. If you find something it did not anticipate, implement what you can and report the discovery rather than improvising. If you must stop and ask a person something, write the question into a file named PLOT-BLOCKED.md at the root of this worktree before you exit, starting the first line with PLOT-BLOCKED: — the fleet scan looks for that FILE, not for the marker inside your log, so without it a stopped worker is restarted into the same question. Delete the file once it is answered. Follow this project's contributor guide: install dependencies if they are missing, run the repo's gates, and never skip a failing test. Run every test in the FOREGROUND: you are a \`-p\` run with no next turn, so a background job's completion never reaches you and the work is stranded uncommitted. COMMIT AND PUSH BEFORE YOU VERIFY — push your first real commit as soon as it exists, and again after any rebase; work that is committed survives a stall and work that is only written does not. Open the pull request with \`skills/plot/scripts/plot-open-pr.sh\` when the branch is done — it takes the title from the plan's wave heading rather than from your last commit subject, and refuses a branch a PR already carries. End your run with a report: the PR, the judgement calls you made, and anything the brief did not anticipate." ${session_args[@]+"${session_args[@]}"} ${cap_args[@]+"${cap_args[@]}"} --permission-mode bypassPermissions
