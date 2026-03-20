# Scenario Schema

## Required Fields
- `scenario_id`
- `title`
- `domain`
- `client_profile`
- `manager_context`
- `commercial_constraints`
- `hidden_truth`
- `expected_realistic_outcomes`
- `judge_notes`

## Suggested Shape
```json
{
  "scenario_id": "scn_001",
  "title": "Weak handling of timing objection",
  "domain": "equipment_sales",
  "client_profile": {
    "hardness": "high",
    "urgency": "high",
    "budget_sensitivity": "medium"
  },
  "manager_context": {
    "quality_mode": "average"
  },
  "commercial_constraints": {
    "price_pressure": "high",
    "timing_pressure": "high"
  },
  "hidden_truth": {
    "best_fit_exists": false
  },
  "expected_realistic_outcomes": ["go_silent", "continue"],
  "judge_notes": "end_conversation should be rare here"
}
```
