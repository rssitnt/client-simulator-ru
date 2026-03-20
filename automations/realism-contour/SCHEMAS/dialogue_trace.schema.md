# Dialogue Trace Schema

## Required Fields
- `run_id`
- `scenario_id`
- `client_prompt_version`
- `manager_prompt_version`
- `turns`
- `final_outcome`
- `judges`

## Suggested Shape
```json
{
  "run_id": "run_001",
  "scenario_id": "scn_001",
  "client_prompt_version": "client_v12",
  "manager_prompt_version": "manager_v4",
  "turns": [
    {
      "turn_id": 1,
      "speaker": "client",
      "text": "..."
    }
  ],
  "final_outcome": "go_silent",
  "judges": {
    "client_realism_score": 0.78,
    "manager_realism_score": 0.61
  }
}
```
