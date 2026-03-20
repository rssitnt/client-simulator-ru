# Prompt Candidate Schema

## Required Fields
- `candidate_id`
- `side`
- `base_version`
- `patch_summary`
- `prompt_text`
- `train_result`
- `validation_result`
- `holdout_result`
- `promotion_status`

## Suggested Shape
```json
{
  "candidate_id": "cand_001",
  "side": "client",
  "base_version": "client_v12",
  "patch_summary": "Reduce premature end_conversation on weak timing replies",
  "prompt_text": "...",
  "train_result": "better",
  "validation_result": "better",
  "holdout_result": "equal",
  "promotion_status": "pending_review"
}
```
