# Phases and Exit Criteria

## Phase 1
### Scope
- ingest real calls
- build initial scenario bank
- implement judges
- implement self-play traces
- no automatic prompt mutation

### Exit Criteria
- schemas are stable
- calls are normalized
- confidence labels exist
- reports identify realistic vs unrealistic behavior

## Phase 2
### Scope
- propose candidate prompt patches
- compare baseline vs candidate
- keep approval manual

### Exit Criteria
- candidate selection is explainable
- validation reports are stable
- regressions are easy to spot

## Phase 3
### Scope
- controlled auto-promotion under gates

### Exit Criteria
- multiple safe promotions
- no holdout regression
- no drift across adversarial pools

## Phase 4
### Scope
- population-based evaluation
- adversarial scenario expansion
- richer manager/client archetype sets

### Exit Criteria
- prompt quality remains robust across diverse conditions
