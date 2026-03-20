# Risks and Guardrails

## Main Risks

### Co-Adaptation
The client and manager can become realistic only for each other, not for real humans.

### Noisy Transcript Over-Trust
Bad ASR can create false patterns of rudeness, silence, or weak objection handling.

### Prompt Drift
Candidate prompts can get better on one narrow cluster and worse globally.

### Tool Choice Collapse
The client can overuse one tool:
- too much `go_silent`
- too much `end_conversation`
- too much continued dialogue

### Judge Leakage
If the judges learn the same quirks as the dialogue actors, they stop being useful.

## Guardrails

### Freeze Assets
Freeze:
- benchmark scenarios
- holdout set
- judge prompts
- opponent pools

### One-Side Optimization
Update only one side per cycle.

### Confidence Weighting
Real-call examples with low transcript confidence must have low weight or be excluded.

### Small Prompt Deltas
Prefer tiny edits over full prompt rewrites.

### Promotion Gates
Reject candidate prompts if:
- holdout is worse
- tool realism degrades
- variance increases too much
- adversarial stability falls

### Human Review on Ambiguous Cases
If attribution confidence is low, do not use the dialogue for auto-evolution.
