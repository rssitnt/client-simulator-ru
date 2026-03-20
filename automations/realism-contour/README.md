# Realism Contour Planning Pack

## Purpose
This folder contains the planning artifacts for a separate project that will build a self-play realism contour for the AI client and AI manager.

The contour is intended to answer:
- who behaved less realistically in a synthetic dialogue
- on which turn realism first broke
- whether the AI client should have continued, gone silent, or ended the conversation
- which side's prompt should be updated next

## Non-Goals
- No implementation code lives here yet.
- No automatic prompt mutation should be shipped from this folder directly.
- No production wiring should happen before Phase 1 is accepted.

## Folder Map
- `IMPLEMENTATION_PLAN.md`: end-to-end rollout plan
- `ARCHITECTURE.md`: component model and runtime boundaries
- `PHASES.md`: phased roadmap with exit criteria
- `RISKS_AND_GUARDRAILS.md`: anti-drift and anti-co-adaptation rules
- `DATA_PIPELINE_SPEC.md`: ingestion plan for `crm_call_transcripts.csv`
- `JUDGE_SPEC.md`: judge contracts and attribution rules
- `PROMPT_EVOLUTION_SPEC.md`: baseline/candidate workflow and patching rules
- `REPORTING_SPEC.md`: batch reports and dashboards
- `SCHEMAS/`: text schemas for the core entities
- `EXAMPLES/`: small example artifacts for the first datasets
- `CHECKLISTS/`: operational checklists for phase gates

## Recommended Execution Order
1. Read `IMPLEMENTATION_PLAN.md`.
2. Lock `DATA_PIPELINE_SPEC.md` and `JUDGE_SPEC.md`.
3. Create Phase 1 datasets from `crm_call_transcripts.csv`.
4. Only after the datasets exist, build the self-play runner and judging loop.

## Key Principle
Do not optimize both sides in the same loop. Freeze one side, evaluate the other, and only then rotate.
