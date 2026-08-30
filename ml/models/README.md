# Model artifacts

Generated binary/model files are ignored by Git. Small metadata sidecars are
tracked so evaluation results and rejection decisions remain auditable. Training
creates two files:

- `soil_moisture_xgboost_v1.json` — XGBoost artifact
- `soil_moisture_xgboost_v1.metadata.json` — feature contract, metrics,
  training ranges, version, and artifact checksum

Store production artifacts in versioned object storage or a model registry.
Never deploy a model unless its metadata reports the validation metric and the
evaluation used real, held-out farms. Loading also verifies the artifact against
the SHA-256 checksum in its metadata and refuses modified or mismatched files.
