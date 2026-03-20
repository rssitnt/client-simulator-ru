# Detailed Implementation Plan

## Objective
Build a realistic self-play and judging contour for:
- AI client realism
- AI manager realism
- tool selection realism: `continue`, `go_silent`, `end_conversation`

The system must use real call transcripts as a noisy realism source and synthetic dialogues as the controlled evaluation environment.

## Workstreams
- data ingestion and normalization
- weak annotation from real calls
- scenario bank construction
- self-play runner
- judging layer
- reporting
- prompt evolution
- release gates

## Phase 0: Planning Lock
### Goal
Freeze contracts before writing implementation code.

### Deliverables
- agreed schemas
- agreed phase gates
- agreed holdout policy
- agreed prompt update policy

### Exit Criteria
- all files in this folder are reviewed and accepted
- the team agrees which fields are mandatory vs optional

## Phase 1: Real-Calls Ingestion and Judging Harness
### Goal
Create a reliable evaluation harness without any automatic prompt changes.

### Deliverables
- normalized call dataset
- confidence labels for transcripts
- first scenario bank
- judge examples
- holdout benchmark
- self-play runner that logs full traces
- judges that score client realism, manager realism, and attribution
- batch report

### Required Inputs
- `crm_call_transcripts.csv`
- current client prompt baseline
- current manager prompt baseline

### Output Artifacts
- normalized calls
- annotated calls
- scenario bank
- judge examples
- dialogue traces
- aggregate report

### Exit Criteria
- at least 30 good scenarios
- at least 50 reviewed judge examples
- stable judge output format
- ability to identify first unrealistic side in most dialogues

## Phase 2: Semi-Automatic Prompt Evolution
### Goal
Generate candidate prompt patches, but keep promotion manual.

### Deliverables
- patch proposal generator
- baseline vs candidate comparison runs
- validation and holdout reports

### Rules
- update only one side at a time
- prefer small prompt deltas over full rewrites
- reject any candidate that improves train but hurts holdout

### Exit Criteria
- prompt patches are explainable
- regressions are visible in reports
- manual approval is enough to trust candidate promotion

## Phase 3: Controlled Auto-Promotion
### Goal
Allow automated promotion of prompt candidates under strict gates.

### Deliverables
- automated acceptance gate
- version registry for prompts
- promotion log

### Hard Gates
- holdout not worse
- no severe regression in tool realism
- no rise in prompt instability
- no co-adaptation signal

### Exit Criteria
- repeated stable promotions without major regressions

## Phase 4: Adversarial and Population-Based Evaluation
### Goal
Make the contour robust against narrow overfitting.

### Deliverables
- multiple manager archetypes
- multiple client hardness profiles
- adversarial scenarios
- league-style evaluation reports

### Exit Criteria
- prompt versions remain stable across diverse opponent pools

## Phase 5: Production Support Loop
### Goal
Use real production failures to seed future scenarios and judge examples.

### Deliverables
- issue-to-scenario workflow
- prompt regression tracking
- release notes for prompt changes

## Implementation Order Recommendation
1. dataset contracts
2. normalized and annotated real-calls dataset
3. scenario bank
4. judges
5. self-play runner
6. reports
7. candidate prompt patches
8. acceptance gate

## Success Definition
The system is successful when:
- it reliably distinguishes weak but realistic dialogue from unrealistic dialogue
- it blames the correct side often enough to guide prompt updates
- it improves prompt realism without teaching the client and manager to overfit each other
