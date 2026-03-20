# Reporting Spec

## Per-Dialogue Report
Required fields:
- run id
- scenario id
- client prompt version
- manager prompt version
- outcome
- client realism score
- manager realism score
- first unrealistic side
- first unrealistic turn
- failure mode
- update recommendation

## Batch Report
Required sections:
- overall win/loss between baselines and candidates
- failure mode distribution
- tool choice distribution
- holdout summary
- regressions
- ambiguous cases

## Leaderboard
Track:
- prompt version
- total realism score
- tool realism score
- stability score
- holdout score

## Regression Report
Show:
- what got worse
- in which scenarios
- by how much
- whether the regression is acceptable
