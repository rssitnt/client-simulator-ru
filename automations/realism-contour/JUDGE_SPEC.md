# Judge Spec

## Judge Roles

### Client Realism Judge
Scores whether the AI client behaved like a real customer.

### Manager Realism Judge
Scores whether the AI manager behaved like a realistic sales operator.

### Attribution Judge
Answers:
- who first became unrealistic
- on which turn
- which side should be updated

## Required Outputs

### Client Judge
- realism score
- strongest failure mode
- tool choice realism
- confidence

### Manager Judge
- realism score
- strongest failure mode
- slop score
- specificity score
- confidence

### Attribution Judge
- first unrealistic side
- first unrealistic turn
- failure mode
- update recommendation
- confidence

## Important Rule
Judges must not optimize for politeness. They must optimize for realism.

## Decision Guidance
- weak but realistic is acceptable
- polished but artificial is a failure
- harsh client behavior can still be realistic
- silent dropout is often more realistic than explicit closure

## Abstain Rules
If transcript or synthetic trace is too ambiguous:
- return `ambiguous`
- do not recommend prompt mutation
