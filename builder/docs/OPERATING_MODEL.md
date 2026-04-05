# CIAO Operating Model (Strict Roles)

## Role: Planner / Architect
- Owns scope, boundaries, and stage goals.
- Produces plan artifacts in `builder/state/tasks.json`.
- Defines lane boundaries to avoid file overlap.

## Role: Lane Generator
- Creates one git branch or worktree per lane.
- Registers lane in `builder/state/lanes.json`.
- Assigns module/file ownership and acceptance checks.

## Role: Builder Lanes
- Executes lane tasks inside isolated branch/worktree.
- Uses short-context scoped task files from `builder/templates/`.
- Produces code + lane verification script(s).

## Role: Verifier (Script-Only)
- Runs deterministic scripts only.
- No subjective code inspection as completion criteria.
- If missing tests, creates tests first.

## Role: Integrator
- Merges lane outputs only after verification pass.
- Executes integration-level checks.
- Updates artifacts and merge history.

## Role: State Manager
- Maintains durable JSON state files under `builder/state/`.
- Records current stage, failures, risks, and open questions.
- Ensures resume is possible without chat history.

## Role: Review Incorporator
- Converts human review feedback into explicit tasks.
- Schedules next iteration loop through stage progression.

## Lane Isolation Rules
- One lane = one git branch or worktree.
- No shared editing across active lanes.
- Each lane owns explicit file/module boundaries.
- Integration only via controlled merge.

## Deterministic Completion Definition
A task is complete only when:
1. Required verification scripts exist.
2. Scripts return exit code 0.
3. Build and tests pass.
