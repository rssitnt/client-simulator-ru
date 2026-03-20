# Judge Result Schema

## Required Fields
- `client_realism_score`
- `manager_realism_score`
- `first_unrealistic_side`
- `first_unrealistic_turn`
- `failure_mode`
- `recommend_update`
- `confidence`

## Suggested Shape
```json
{
  "client_realism_score": 0.72,
  "manager_realism_score": 0.58,
  "first_unrealistic_side": "manager",
  "first_unrealistic_turn": 6,
  "failure_mode": "weak_objection_handling",
  "recommend_update": "manager",
  "confidence": 0.84,
  "explanation": "Manager gave generic pricing instead of a solution tied to the case."
}
```
