# Lane Task Card

## Lane Metadata
- Lane ID: `<lane-id>`
- Branch/Worktree: `<branch-or-worktree>`
- Owner Role: `Builder Lane`
- Stage: `<stage-number-and-name>`

## Scope Boundary (Required)
- Allowed files/modules:
  - `<path-1>`
  - `<path-2>`
- Forbidden files/modules:
  - `<path-a>`

## Objective
`<single measurable outcome>`

## Plan
1. `<step>`
2. `<step>`
3. `<step>`

## Verification (Script-Only)
- Command 1: `<command>`
- Command 2: `<command>`
- Expected: all commands exit code 0

## Failure Loop
- On failure: capture error output
- Add fix task
- Re-run same verification commands
- Repeat until pass

## Artifacts Produced
- `<artifact path>`
- `<artifact path>`
