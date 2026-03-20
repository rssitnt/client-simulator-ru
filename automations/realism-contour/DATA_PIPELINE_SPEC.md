# Data Pipeline Spec

## Source
Primary source:
- `C:\projects\sites\client-simulator\crm_call_transcripts.csv`

This source is noisy and should be treated as weak supervision.

## Pipeline Stages

### Stage 1: Audit
Questions to answer:
- what columns exist
- how speakers are encoded
- whether one row is one turn or one call
- whether timestamps exist
- whether call identifiers exist

### Stage 2: Normalization
Target output per call:
- `call_id`
- `source_row_ids`
- `raw_turns`
- `normalized_turns`
- `speaker_mapping_confidence`
- `transcript_confidence`

### Stage 3: Cleaning
Apply:
- whitespace cleanup
- obvious ASR artifact cleanup
- repeated fragment cleanup
- call boundary validation

Do not rewrite meaning aggressively.

### Stage 4: Anonymization
Mask:
- names
- phones
- emails
- company identifiers
- object addresses
- contract references

Keep:
- business pressure
- product category
- price/time/service signals

### Stage 5: Annotation
Annotate weak labels:
- client hardness
- urgency
- budget sensitivity
- manager realism hint
- client realism hint
- likely outcome type
- likely trigger category
- salvageability

### Stage 6: Derivation
Produce:
- scenario bank
- judge examples
- realism pattern summaries
- holdout benchmark

## Confidence Model

### Call-Level Confidence
- `high`
- `medium`
- `low`

### Turn-Level Confidence
- `high`
- `medium`
- `low`

Rules:
- low-confidence calls should not become strict benchmark cases
- medium-confidence calls are good for scenario mining
- high-confidence calls can be used for holdout and judge calibration

## Target Derived Datasets
- `calls_normalized.jsonl`
- `calls_annotated.jsonl`
- `scenario_bank.jsonl`
- `judge_examples.jsonl`
- `realism_patterns.json`
