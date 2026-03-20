# Prompt Evolution Spec

## Baseline and Candidate
Each side has:
- `baseline`
- `candidate`

Candidate prompts are evaluated, not auto-shipped by default.

## Mutation Unit
Use small prompt patches, not full rewrites.

Examples:
- adjust tool boundary
- adjust patience threshold
- adjust tone hardness
- adjust objection sensitivity

## Optimization Rule
Only one side changes per cycle:
- optimize client against frozen managers
- optimize manager against frozen clients

## Candidate Evaluation
Every candidate must be tested on:
- train set
- validation set
- holdout set

## Rejection Rules
Reject candidate if:
- holdout is worse
- tool realism is worse
- variance grows sharply
- it improves only on a narrow cluster

## Promotion Rule
Promote only if:
- validation improves
- holdout is stable or better
- no severe regression appears in adversarial cases
