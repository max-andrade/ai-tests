# CIAO Repo-Native Delivery Engine

This builder is a **repo-native control system** for the CIAO hackathon POC.
It is intentionally implemented with:

- Markdown instructions/templates
- JSON state files
- Bash scripts
- Git branch/worktree lane isolation

It is **not** a standalone software app.

## Objectives

1. Bootstrap a persistent multi-stage delivery loop
2. Execute CIAO POC work through isolated parallel lanes
3. Enforce deterministic script-based verification gates
4. Persist durable state for pause/resume/iteration

## Stage Model

- Stage 0: Builder bootstrap
- Stage 1: Product design + architecture baseline
- Stage 2: Lane decomposition + task slicing
- Stage 3: Parallel lane execution
- Stage 4: Verification and integration
- Stage 5: Review incorporation + iteration

## Persistent Loop

For every task:

1. Plan
2. Execute
3. Verify (script only)
4. On failure: diagnose → fix → retry
5. Mark complete only when scripts return exit code 0

## Core Commands

```bash
./builder/scripts/init_state.sh
./builder/scripts/create_lane.sh lane-auth "Implement authentication module" docs/auth.md
./builder/scripts/set_stage.sh 2 "Lane decomposition"
./builder/scripts/update_lane_status.sh lane-auth in_progress
./builder/scripts/verify_builder.sh
```

## Verification Policy

Completion requires:

- `verify_builder.sh` exits 0
- lane-specific verify scripts exit 0
- integration verify script exits 0

No visual-only review counts as done.
