# Architecture

## Core Components

### 1. Real-Calls Data Pipeline
Transforms `crm_call_transcripts.csv` into:
- normalized calls
- annotated calls
- derived realism artifacts

### 2. Scenario Bank
Stores structured synthetic cases distilled from real behavior patterns:
- client profile
- commercial context
- pressure factors
- expected realistic outcome range

### 3. Prompt Registry
Maintains:
- baseline prompts
- candidate prompts
- version metadata
- evaluation history

### 4. Self-Play Runner
Runs:
- AI client vs AI manager
- one scenario at a time
- fixed max turns
- full trace logging

### 5. Judge Layer
Independent evaluators:
- `client_realism_judge`
- `manager_realism_judge`
- `attribution_judge`

### 6. Reporting Layer
Produces:
- per-dialogue trace reports
- batch summaries
- failure mode histograms
- baseline vs candidate comparisons

### 7. Prompt Evolution Layer
Generates:
- small candidate patches
- baseline vs candidate experiments
- promotion recommendations

## Runtime Boundary Rules
- real calls are never treated as literal ground truth dialogue text
- synthetic self-play is the controlled experiment
- judges must be separate from the dialogue actors
- only one side is updated per optimization cycle

## Data Flow
1. ingest noisy real calls
2. normalize and annotate
3. derive scenario bank and judge examples
4. run self-play on scenario bank
5. evaluate traces with judges
6. identify failure side and failure mode
7. generate prompt patches for one side
8. validate candidate against frozen pools

## Storage Model
Recommended future storage buckets:
- raw source data
- normalized data
- annotated data
- derived benchmark data
- prompt versions
- trace outputs
- summary reports

## Frozen Assets
The following must be frozen per evaluation batch:
- benchmark scenarios
- holdout scenarios
- frozen opponent pool
- judge prompt versions

## Anti-Co-Adaptation Design
- optimize client against frozen manager pool
- optimize manager against frozen client pool
- never let both change from the same experiment batch
