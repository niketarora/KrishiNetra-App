# KrishiNetra 2.0 — ML Model 1 Implementation Plan

## Wheat Mandi Price Prediction

This document defines the complete implementation plan for **ML Model 1** of KrishiNetra 2.0.

The model will be developed **only inside the `ml/` folder**.

> **Important:** This implementation is NOT being integrated with the React Native app, Node.js backend, Supabase, or AI Avatar yet.

The only objective at this stage is to build, evaluate, optimize, save, and test the standalone price prediction model.

---

# 1. Objective

Build a machine learning system that predicts the future **modal mandi price of wheat** for:

- **+1 day**
- **+3 days**
- **+7 days**

The model should predict the price for a specific:

- Mandi
- Wheat variety
- Grade

using historical market data and other available information.

The final system should produce predictions such as:

```text
Wheat
Mandi: Alwar
Variety: Dara
Grade: Average

Current Modal Price: ₹2,100

Predicted:
+1 day  → ₹2,115
+3 days → ₹2,145
+7 days → ₹2,190
```

---

# 2. Dataset

The dataset is already available inside the project at:

```text
ml/datasets/krishinetra_mandi_rajasthan.csv
```

Do not move, rename, overwrite, or modify the original dataset.

Create cleaned/processed datasets separately under `ml/data/processed/` if required.

## Dataset characteristics

Current dataset:

```text
Rows: 58,432
Columns: 18
Crop: Wheat
State: Rajasthan
Period: 2021–2025
```

The dataset contains multiple mandis, varieties, and grades.

## Columns

```text
date
state
district
mandi
crop
variety
grade
min_price
max_price
modal_price
arrivals_tonnes
temperature_c
rainfall_mm
humidity_pct
demand_score
msp
month
day_of_week
```

---

# 3. Dataset Quality

Observed missing values:

```text
min_price          → 883
max_price          → 883
arrivals_tonnes    → 2,692
modal_price        → 0
```

Other columns currently have no missing values.

There are no known duplicate rows in the supplied dataset.

## Important

The dataset filename indicates that it is **synthetic**:

```text
krishinetra_wheat_mandi_synthetic_rajasthan.csv
```

Therefore:

- Use it to build and validate the ML pipeline.
- Do not claim that its accuracy represents real-world agricultural accuracy.
- Do not use synthetic-model performance as the final SIH real-world performance claim.
- The pipeline should later support replacement with real AGMARKNET/mandi data without architectural changes.

---

# 4. Prediction Target

The main target is:

```text
future_modal_price
```

We will create three direct forecasting targets:

```text
target_1d
target_3d
target_7d
```

For a row at date `t`:

```text
target_1d = modal_price at t+1
target_3d = modal_price at t+3
target_7d = modal_price at t+7
```

The model should use a **direct multi-horizon forecasting strategy**.

That means:

```text
Model 1 → predicts t+1
Model 2 → predicts t+3
Model 3 → predicts t+7
```

Do NOT initially use recursive forecasting where the +1 prediction is repeatedly fed back into the model to obtain +3/+7 predictions. Direct models generally avoid error accumulation.

---

# 5. Critical Requirement — Prevent Data Leakage

This is one of the most important requirements.

When predicting the price at time `t+h`, the model must only use information that would genuinely be available at prediction time `t`.

For example:

```text
Prediction date: 2025-01-15

Allowed:
- Historical modal prices up to 2025-01-15
- Current modal price
- Historical arrivals
- Current/previous weather observations
- Historical demand
- Current MSP
- Calendar information
```

Not allowed:

```text
- Future modal price
- Future arrivals
- Future demand
- Future observed rainfall
- Future observed temperature
- Any feature calculated using future rows
```

This rule must be enforced during feature engineering.

---

# 6. Forecasting Granularity

The primary forecasting entity is:

```text
mandi + variety + grade
```

Example:

```text
Alwar + Dara + Average
```

This is preferable to building one completely aggregated model because price behavior can differ between:

- Mandis
- Varieties
- Grades

The model may still use:

```text
mandi
district
variety
grade
```

as categorical features.

---

# 7. Data Processing Pipeline

The complete pipeline should be:

```text
Raw CSV
   ↓
Schema Validation
   ↓
Date Parsing
   ↓
Duplicate Check
   ↓
Sorting
   ↓
Missing Value Handling
   ↓
Data Quality Checks
   ↓
Target Creation
   ↓
Time-Series Feature Engineering
   ↓
Chronological Train/Validation/Test Split
   ↓
Feature Encoding
   ↓
Model Training
   ↓
Hyperparameter Optimization
   ↓
Walk-Forward Validation
   ↓
Final Model Training
   ↓
Test Evaluation
   ↓
Error Analysis
   ↓
Model Saving
   ↓
Inference Script
```

---

# 8. Data Cleaning

## 8.1 Date

Convert:

```text
date
```

to a proper datetime type.

Sort by:

```text
mandi
variety
grade
date
```

Do not randomly shuffle the dataset.

---

## 8.2 Numeric Columns

Expected numeric columns:

```text
min_price
max_price
modal_price
arrivals_tonnes
temperature_c
rainfall_mm
humidity_pct
demand_score
msp
month
```

Convert them to numeric safely.

Invalid numeric values should become missing values and be handled explicitly.

---

# 9. Missing Value Strategy

## min_price / max_price

Do NOT use future values to fill missing observations.

Preferred approach:

1. Sort chronologically.
2. For each `mandi + variety + grade`, use historical values only.
3. Use past rolling/group statistics where possible.
4. If no historical value exists, fall back to a training-set median.

For example:

```text
historical median of min_price
for the same mandi + variety + grade
```

The fallback statistics must be fitted using the training data only.

---

## arrivals_tonnes

Use a similar historical-only strategy.

Possible features:

```text
past arrivals
7-day historical median
14-day historical median
28-day historical median
```

For the raw missing value, either:

- leave it as NaN if the selected model handles missing values safely, or
- impute using historical-only statistics.

Do not use future arrivals.

---

# 10. Feature Engineering

Feature engineering is expected to provide a major accuracy improvement.

Do not rely only on the original 18 columns.

Create time-series features separately for each:

```text
mandi + variety + grade
```

---

# 11. Price Lag Features

Create lagged modal prices:

```text
modal_lag_1
modal_lag_2
modal_lag_3
modal_lag_4
modal_lag_5
modal_lag_7
modal_lag_14
modal_lag_21
modal_lag_28
```

These represent:

```text
price yesterday
price 2 days ago
price 3 days ago
...
price 28 days ago
```

For a prediction at time `t`, these must never contain data after `t`.

---

# 12. Price Rolling Features

Use shifted historical prices so the current/future target cannot leak.

Recommended windows:

```text
3
7
14
21
28
```

Features:

```text
price_roll_mean_3
price_roll_mean_7
price_roll_mean_14
price_roll_mean_21
price_roll_mean_28

price_roll_std_7
price_roll_std_14
price_roll_std_28

price_roll_min_7
price_roll_max_7
price_roll_min_28
price_roll_max_28
```

Conceptually:

```text
rolling_feature(t)
=
rolling statistics of prices before or at t
```

Never include the target horizon in the rolling calculation.

---

# 13. Price Momentum Features

Create:

```text
price_change_1d
price_change_3d
price_change_7d
price_change_14d

price_pct_change_1d
price_pct_change_3d
price_pct_change_7d
price_pct_change_14d
```

Examples:

```text
current price - price 7 days ago

(current price / price 7 days ago) - 1
```

These help the model understand whether prices are:

- Rising
- Falling
- Stable
- Volatile

---

# 14. Min/Max/Modal Relationship Features

Create:

```text
price_range
price_range_pct
modal_vs_min
max_vs_modal
modal_vs_max
```

Examples:

```text
price_range = max_price - min_price

modal_vs_min = modal_price - min_price

max_vs_modal = max_price - modal_price
```

These may capture market dispersion and quality/market conditions.

---

# 15. Arrival Features

Create historical arrival features:

```text
arrivals_lag_1
arrivals_lag_3
arrivals_lag_7
arrivals_lag_14
arrivals_lag_28
```

Rolling features:

```text
arrivals_roll_mean_7
arrivals_roll_mean_14
arrivals_roll_mean_28

arrivals_roll_std_7
arrivals_roll_std_28
```

Momentum:

```text
arrivals_change_7d
arrivals_pct_change_7d
```

This is important because increased arrivals can influence market price.

---

# 16. Demand Features

Use historical demand information.

Create:

```text
demand_lag_1
demand_lag_3
demand_lag_7
demand_lag_14
demand_lag_28

demand_roll_mean_7
demand_roll_mean_14
demand_roll_mean_28

demand_roll_std_7
demand_roll_std_28
```

Also:

```text
demand_change_7d
demand_pct_change_7d
```

---

# 17. Weather Features

Available weather columns:

```text
temperature_c
rainfall_mm
humidity_pct
```

For strict leakage prevention, use current/past observations unless a genuine weather forecast dataset is later available.

Create:

```text
temperature_lag_1
temperature_lag_3
temperature_lag_7

rainfall_lag_1
rainfall_lag_3
rainfall_lag_7

humidity_lag_1
humidity_lag_3
humidity_lag_7
```

Rolling weather features:

```text
temperature_roll_mean_7
temperature_roll_mean_14

rainfall_roll_sum_7
rainfall_roll_sum_14

humidity_roll_mean_7
humidity_roll_mean_14
```

Do not use future observed weather values for a historical prediction experiment.

---

# 18. MSP Features

The dataset contains:

```text
msp
```

Create:

```text
modal_minus_msp
modal_vs_msp_pct
```

Examples:

```text
modal_minus_msp = modal_price - msp

modal_vs_msp_pct =
(modal_price / msp) - 1
```

This can help the model understand price positioning relative to MSP.

---

# 19. Seasonal Features

Do not rely only on:

```text
month
day_of_week
```

Create cyclical encodings.

For month:

```text
month_sin
month_cos
```

For day of week:

```text
dow_sin
dow_cos
```

Also create:

```text
day_of_year
day_of_year_sin
day_of_year_cos
```

This allows the model to learn that December and January are close in the annual cycle.

---

# 20. Trend Features

Create longer-term trend indicators:

```text
price_mean_7_vs_28
price_mean_14_vs_28
price_slope_7d
price_slope_14d
price_slope_28d
```

These should be calculated only from historical values.

For slope:

- Fit a simple linear trend to the historical window.
- Use the resulting slope as a feature.

---

# 21. Categorical Features

Categorical fields:

```text
state
district
mandi
crop
variety
grade
```

Because this dataset is currently:

```text
Wheat
Rajasthan
```

some columns may have little/no predictive variation.

Do not force useless constant columns into the model.

Keep:

```text
mandi
variety
grade
district
```

where useful.

---

# 22. Target Creation

For each forecasting group:

```text
groupby(
    mandi,
    variety,
    grade
)
```

create:

```text
target_1d = modal_price.shift(-1)
target_3d = modal_price.shift(-3)
target_7d = modal_price.shift(-7)
```

Rows without a future target should not be used for that horizon's training/evaluation.

---

# 23. Important Data Frequency Consideration

Before creating lag features, inspect whether every:

```text
mandi + variety + grade
```

has observations for every calendar day.

If observations are missing for some dates, distinguish between:

```text
previous calendar day
```

and:

```text
previous available market observation
```

Do not blindly assume that `shift(1)` always means exactly one calendar day.

The preprocessing script should report:

- Number of groups.
- Number of observations per group.
- Date gaps.
- Minimum/maximum dates.
- Missing-date counts.

If the dataset is truly daily for each group, standard lag features can be used directly.

---

# 24. Train / Validation / Test Strategy

Do NOT use:

```text
train_test_split(..., shuffle=True)
```

for the final evaluation.

This is a time-series forecasting problem.

Use chronological splitting.

Recommended initial split:

```text
2021–2023 → Training
2024       → Validation
2025       → Final Test
```

This simulates:

```text
Past → learn
Recent past → tune
Future unseen period → evaluate
```

Do not allow 2025 information into model selection.

---

# 25. Walk-Forward Validation

After initial validation, use walk-forward validation to improve confidence.

Example:

```text
Fold 1:
Train 2021
Validate early 2022

Fold 2:
Train 2021–2022
Validate 2023

Fold 3:
Train 2021–2023
Validate 2024
```

The exact folds should be generated based on the actual date range.

Walk-forward validation should be used for:

- Hyperparameter tuning.
- Model comparison.
- Robustness checking.

The final untouched test period should remain isolated.

---

# 26. Baseline Models

Before using advanced ML, establish baselines.

At minimum:

## Baseline 1 — Naive

```text
predicted price = current modal_price
```

## Baseline 2 — Previous 7-Day Mean

```text
predicted price =
mean of previous 7 modal prices
```

## Baseline 3 — Seasonal/rolling baseline

Where sufficient historical data exists, compare against a relevant rolling/seasonal baseline.

The ML model must beat these baselines.

---

# 27. Recommended ML Models

Start with:

### Model A

**XGBoost Regressor**

Advantages:

- Strong nonlinear modeling.
- Works well with tabular data.
- Handles missing values.
- Good with engineered lag features.
- Strong baseline for this dataset size.

### Model B

**LightGBM Regressor**

Advantages:

- Fast.
- Strong tabular performance.
- Efficient for many engineered features.

### Optional Model C

A tree ensemble such as:

```text
Random Forest / Extra Trees
```

can be used as an additional benchmark.

Do not assume one algorithm will automatically be best.

---

# 28. Accuracy Optimization Strategy

The goal is to maximize generalization accuracy, not simply training accuracy.

Use:

```text
Feature engineering
+
Leakage prevention
+
Time-series validation
+
Hyperparameter tuning
+
Model comparison
+
Error analysis
+
Ensembling where justified
```

Do not optimize only against the final test set.

---

# 29. Hyperparameter Tuning

Tune at least:

### XGBoost

Potential parameters:

```text
n_estimators
max_depth
learning_rate
subsample
colsample_bytree
min_child_weight
gamma
reg_alpha
reg_lambda
```

Use a reasonable search space.

Do not run an unnecessarily huge search.

Prefer:

```text
RandomizedSearchCV
```

or a time-series-aware custom validation loop.

Do not use standard shuffled CV.

---

# 30. LightGBM Tuning

Potential parameters:

```text
n_estimators
learning_rate
num_leaves
max_depth
min_child_samples
subsample
colsample_bytree
reg_alpha
reg_lambda
```

Again, use chronological/walk-forward validation.

---

# 31. Early Stopping

Where supported, use early stopping with a chronological validation set.

This helps prevent:

- Overfitting.
- Excessive tree growth.
- Unnecessary computation.

---

# 32. Possible Ensemble

After independently evaluating XGBoost and LightGBM, test whether an ensemble improves validation performance.

Example:

```text
final_prediction =
0.6 × XGBoost_prediction
+
0.4 × LightGBM_prediction
```

Do NOT hard-code these weights without validation.

Search for a simple blend using the validation period only.

The ensemble should be accepted only if it consistently improves walk-forward validation and the final test result.

---

# 33. Evaluation Metrics

Use multiple metrics.

## MAE

```text
Mean Absolute Error
```

Easy to interpret in rupees.

Example:

```text
MAE = ₹42
```

means the average absolute prediction error is approximately ₹42.

## RMSE

Penalizes large errors.

Useful for identifying unstable predictions.

## MAPE

Useful as a percentage metric, but interpret carefully.

If prices are ever close to zero, use a protected implementation or prefer another percentage metric.

## sMAPE

Consider adding:

```text
sMAPE
```

because it can be more stable for comparison.

---

# 34. Metrics to Report

For each horizon:

```text
+1 day:
MAE
RMSE
MAPE
sMAPE

+3 days:
MAE
RMSE
MAPE
sMAPE

+7 days:
MAE
RMSE
MAPE
sMAPE
```

Also report baseline performance.

Example:

```text
Model              Horizon    MAE    RMSE    MAPE
Naive              1 day      ...
XGBoost             1 day      ...
LightGBM            1 day      ...
Ensemble            1 day      ...
```

---

# 35. Evaluation by Mandi

Overall accuracy is not enough.

Report performance separately for each mandi.

Example:

```text
Alwar
Bharatpur
Jaipur
...
```

For each:

```text
MAE
RMSE
MAPE
```

This identifies mandis where the model performs poorly.

---

# 36. Evaluation by Variety and Grade

Also report performance by:

```text
variety
grade
```

This helps identify whether the model generalizes across wheat types and quality grades.

---

# 37. Error Analysis

After evaluation, inspect:

- Largest prediction errors.
- Error by season.
- Error by mandi.
- Error by variety.
- Error by grade.
- Error during rapid price changes.
- Error during high-arrival periods.
- Error during unusual weather.

Create diagnostic reports.

The objective is to understand **why** the model fails rather than simply reporting a score.

---

# 38. Feature Importance

Generate:

- XGBoost feature importance.
- LightGBM feature importance.
- Preferably SHAP analysis for the final selected model.

The goal is to understand whether predictions are driven by sensible features such as:

```text
recent modal price
7-day price trend
28-day rolling price
arrivals
demand
MSP
seasonality
```

Be careful not to interpret feature importance as causal relationships.

---

# 39. Model Selection Criteria

Choose the final model based on:

1. Best validation performance.
2. Stable walk-forward performance.
3. Strong final unseen test performance.
4. Performance across mandis.
5. Performance across varieties/grades.
6. Reasonable inference speed.
7. Reasonable model size.
8. Robustness to missing values.
9. Absence of leakage.

Do not select a model solely because it has the lowest training error.

---

# 40. Final Training

After model and hyperparameters are selected:

```text
Training + Validation data
        ↓
Final model training
        ↓
Untouched Test data
        ↓
Final evaluation
```

Do not retrain on the final test set before reporting final test metrics.

After the final evaluation is recorded, a production model may be retrained using all historical data if desired, but that should be a separate final artifact.

---

# 41. Model Artifacts

Save:

```text
model_1d
model_3d
model_7d
feature_schema
preprocessing_config
training_metadata
metrics
feature_importance
```

Suggested directory:

```text
ml/models/
```

Example:

```text
ml/models/
├── wheat_price_1d.pkl
├── wheat_price_3d.pkl
├── wheat_price_7d.pkl
├── feature_schema.json
└── metadata.json
```

If the chosen model requires a different native format, use that format instead.

---

# 42. Recommended ML Folder Structure

The final structure should be approximately:

```text
ml/
│
├── datasets/
│   └── krishinetra_mandi_rajasthan.csv
│
├── data/
│   ├── processed/
│   └── reports/
│
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_model_experiments.ipynb
│   └── 04_error_analysis.ipynb
│
├── src/
│   ├── config.py
│   ├── data_loader.py
│   ├── validation.py
│   ├── preprocessing.py
│   ├── features.py
│   ├── targets.py
│   ├── split.py
│   ├── baselines.py
│   ├── train.py
│   ├── tune.py
│   ├── evaluate.py
│   ├── error_analysis.py
│   ├── explain.py
│   └── predict.py
│
├── models/
│
├── reports/
│   ├── metrics/
│   ├── plots/
│   └── feature_importance/
│
├── requirements.txt
└── README.md
```

---

# 43. Required Python Libraries

Start with:

```text
pandas
numpy
scikit-learn
xgboost
lightgbm
matplotlib
seaborn
joblib
shap
```

Optional:

```text
optuna
```

Optuna can be used for more efficient hyperparameter optimization after the baseline pipeline works.

---

# 44. Reproducibility

Set random seeds where applicable.

Example:

```text
RANDOM_STATE = 42
```

Record:

- Dataset path.
- Dataset hash/version if practical.
- Feature list.
- Model parameters.
- Training date.
- Validation period.
- Test period.
- Metrics.
- Model version.

This allows experiments to be reproduced.

---

# 45. Data Leakage Checks

Implement explicit checks for:

```text
Future target leakage
Future price leakage
Future arrival leakage
Future weather leakage
Future demand leakage
Global preprocessing leakage
Global target encoding leakage
Random train/test leakage
```

Any rolling feature should be reviewed carefully.

The code should make it obvious that feature calculations are historical-only.

---

# 46. Important Improvement — Known vs Unknown Future Inputs

For the first model, assume the following are known at prediction time:

```text
Historical prices
Current price
Historical/current arrivals
Historical weather
Current MSP
Calendar
```

Do NOT assume future observed weather is available.

Later, when real weather forecasts are integrated, future weather forecast values can be introduced as separate features:

```text
forecast_temperature
forecast_rainfall
forecast_humidity
```

These should be explicitly distinguished from observed weather.

---

# 47. Important Improvement — Missing Market Days

If a mandi does not report data every calendar day:

- Do not automatically forward-fill modal prices as actual market prices.
- Preserve the distinction between no observation and an observed price.
- Consider adding:

```text
days_since_last_observation
```

- Validate whether the prediction horizon should mean:
  - next calendar day, or
  - next available mandi observation.

For the first version, document the chosen interpretation clearly.

---

# 48. Prediction Confidence

The initial model does not need a scientifically perfect confidence interval.

However, produce useful uncertainty information if possible.

Potential approaches:

- Prediction intervals using quantile models.
- Ensemble spread.
- Conformal prediction in a later iteration.

For the first implementation, it is acceptable to output:

```text
prediction
```

and evaluate uncertainty separately.

Do NOT call an arbitrary score "confidence" unless its meaning is clearly defined.

---

# 49. Inference Interface

Even though this model will NOT be integrated into the application yet, create a standalone inference interface.

Example:

```bash
python -m src.predict \
  --date 2025-01-15 \
  --mandi Alwar \
  --variety Dara \
  --grade Average
```

Output:

```json
{
  "crop": "Wheat",
  "state": "Rajasthan",
  "mandi": "Alwar",
  "variety": "Dara",
  "grade": "Average",
  "prediction": {
    "1d": 0,
    "3d": 0,
    "7d": 0
  }
}
```

The exact CLI implementation can be adjusted based on the final model pipeline.

---

# 50. No API Integration Yet

Do NOT build:

```text
FastAPI
Node.js integration
React Native integration
Supabase integration
AI Agent integration
```

at this stage.

The ML folder should be independently runnable.

The future integration point will be:

```text
ML Model
→ Python API
→ Node.js Backend
```

but that belongs to a later phase.

---

# 51. Experiment Tracking

Every experiment should record:

```text
experiment_id
model
horizon
features
train_period
validation_period
test_period
hyperparameters
MAE
RMSE
MAPE
sMAPE
```

Example:

```text
exp_001
XGBoost
1d
baseline features
...
```

This prevents selecting a model based on memory or guesswork.

---

# 52. Recommended Experiment Sequence

Do not immediately jump into complex tuning.

Follow this order:

## Experiment 1

Naive baseline.

## Experiment 2

XGBoost with original features.

## Experiment 3

XGBoost + lag features.

## Experiment 4

XGBoost + rolling statistics.

## Experiment 5

XGBoost + momentum + arrivals + demand + weather features.

## Experiment 6

LightGBM with the same feature set.

## Experiment 7

Hyperparameter tuning.

## Experiment 8

Walk-forward validation.

## Experiment 9

Feature importance / SHAP.

## Experiment 10

Optional ensemble.

This makes it possible to understand which improvements actually increase accuracy.

---

# 53. Accuracy Maximization Checklist

To maximize real predictive performance:

```text
[ ] Correctly parse dates
[ ] Sort chronologically
[ ] Remove duplicates
[ ] Validate numerical ranges
[ ] Handle missing values safely
[ ] Create direct 1/3/7-day targets
[ ] Build historical lag features
[ ] Build rolling statistics
[ ] Build price momentum
[ ] Build arrival trends
[ ] Build demand trends
[ ] Build weather history
[ ] Build MSP relationship features
[ ] Build cyclical seasonal features
[ ] Avoid future information
[ ] Use chronological validation
[ ] Use walk-forward validation
[ ] Establish naive baselines
[ ] Compare XGBoost
[ ] Compare LightGBM
[ ] Tune hyperparameters
[ ] Analyze errors by mandi
[ ] Analyze errors by variety
[ ] Analyze seasonal errors
[ ] Test ensemble only if justified
[ ] Preserve an untouched test period
[ ] Save reproducible model artifacts
```

---

# 54. Expected Deliverables

At the end of ML Model 1 development, the `ml/` folder should contain:

### Data

```text
ml/datasets/krishinetra_mandi_rajasthan.csv
```

### Code

```text
ml/src/
```

### Experiments

```text
ml/notebooks/
```

### Models

```text
ml/models/
```

### Reports

```text
ml/reports/
```

### Documentation

```text
ml/README.md
```

### Metrics

A final report containing:

```text
1-day performance
3-day performance
7-day performance
baseline comparison
mandi-wise performance
variety-wise performance
error analysis
selected model
selected hyperparameters
```

---

# 55. Final Success Criteria

ML Model 1 is considered complete when:

```text
[ ] Dataset loads successfully
[ ] Dataset schema is validated
[ ] Data quality report generated
[ ] Missing values handled
[ ] Targets generated correctly
[ ] Leakage checks pass
[ ] Historical features generated
[ ] Chronological split implemented
[ ] Baseline implemented
[ ] XGBoost trained
[ ] LightGBM trained
[ ] Hyperparameter tuning completed
[ ] Walk-forward validation completed
[ ] Final test evaluation completed
[ ] MAE/RMSE/MAPE/sMAPE reported
[ ] Mandi-wise errors analyzed
[ ] Feature importance analyzed
[ ] Best model selected
[ ] 1d model saved
[ ] 3d model saved
[ ] 7d model saved
[ ] Standalone prediction script works
[ ] No Node.js integration exists yet
[ ] No React Native integration exists yet
[ ] No AI integration exists yet
```

---

# 56. Final Expected Architecture

```text
                RAW DATASET
                     │
                     ▼
             DATA VALIDATION
                     │
                     ▼
              DATA CLEANING
                     │
                     ▼
           TARGET GENERATION
                     │
                     ▼
          FEATURE ENGINEERING
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Baselines            ML Models
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                 XGBoost             LightGBM
                    │                   │
                    └─────────┬─────────┘
                              ▼
                       MODEL SELECTION
                              │
                              ▼
                   WALK-FORWARD TESTING
                              │
                              ▼
                       FINAL EVALUATION
                              │
                              ▼
                    SAVED 1/3/7D MODELS
                              │
                              ▼
                     STANDALONE PREDICT
```

---

# 57. Important Final Instruction

This document is specifically for **ML Model 1 only**.

The implementation must remain inside:

```text
ml/
```

The dataset must be read from:

```text
ml/datasets/krishinetra_mandi_rajasthan.csv
```

Do not integrate the model with:

- React Native
- Node.js
- Supabase
- AI Agent
- AI Avatar

yet.

The immediate objective is to produce the **highest-quality, leakage-free, well-evaluated Wheat Mandi Price Prediction model possible from the supplied dataset**, with separate predictions for **1, 3, and 7 days ahead**.

Because the supplied dataset is synthetic, all accuracy results must be labeled as results on the synthetic dataset and must not be presented as validated real-world agricultural performance.
