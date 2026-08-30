# ESA/NASA Implementation — Week-by-Week Notebook Templates

This directory contains Jupyter notebook templates for each week of the ESA/NASA plan.

## Structure

```
notebooks/
├── 00_setup.ipynb                    ← Test region selection + GEE auth
├── 01_worldcereal_baseline.ipynb     ← ESA WorldCereal crop classification
├── 02_timeseries_collection.ipynb    ← Sentinel-1/2 + Weather download
├── 03_vegetation_indices.ipynb       ← NDVI/EVI calculation
├── 03_growth_stage.ipynb             ← Rule-based growth stage detection
├── 04_prepare_training_data.ipynb    ← Align satellite + probe data
├── 04_train_xgboost.ipynb            ← Train XGBoost model
└── 05_validation.ipynb               ← Test on new farms
```

## How to Use

### Setup
```bash
cd ml/notebooks
jupyter notebook
```

### Run Each Week
- **Week 1-2**: `00_setup.ipynb` + `01_worldcereal_baseline.ipynb` + `02_timeseries_collection.ipynb`
- **Week 3**: `03_vegetation_indices.ipynb` + `03_growth_stage.ipynb`
- **Week 4**: `04_prepare_training_data.ipynb` + `04_train_xgboost.ipynb`
- **Week 5**: `05_validation.ipynb`

## Requirements

```bash
pip install -r ../requirements_ml.txt
```

Includes: pandas, numpy, xgboost, earthengine-api, requests, scikit-learn

## Output Data

Each notebook saves data to `data/`:
- `data/test_farms.csv` — Test farms list
- `data/test_farm_boundaries.geojson` — Farm boundaries
- `data/worldcereal_baseline.csv` — ESA predictions
- `data/timeseries/*.csv` — Satellite + weather time series
- `data/soil_moisture_training_data.csv` — Training dataset for XGBoost
- `data/soil_probes/*.csv` — Soil moisture probe measurements

## Progress Tracking

After each notebook, update progress in main README:
```markdown
✅ Week 1: Test region selected, GEE auth working
✅ Week 2: 10 farms, S1/S2 downloaded, weather collected
✅ Week 3: NDVI calculated, growth stage detected, probes deployed
⏳ Week 4: Training data prepared, XGBoost training...
```

---

**Start with `00_setup.ipynb` on Week 1 Monday!**
