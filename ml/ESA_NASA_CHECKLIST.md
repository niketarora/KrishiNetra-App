# ESA/NASA Plan Implementation Checklist

**Start Date**: 2026-08-29  
**Target Completion**: 5 weeks  
**Status**: ⏳ Starting

---

## ✅ Week 1: Prototype + Test Region Selection

**Parallel**: Prototype deployment (simple rules) + Real ML planning

- [ ] **Mon**: Push simple prototype to production
  - [ ] `ml/main.py` running locally
  - [ ] Swagger UI accessible
  - [ ] 3 endpoints working
  
- [ ] **Mon-Tue**: ESA/NASA plan kickoff
  - [ ] Read ESA_NASA_PLAN.md
  - [ ] Identify target district (recommend: Pune)
  - [ ] List 10-20 test farms from Phase 1 data
  - [ ] Get contact info for farmers (for probe visits)
  
- [ ] **Wed**: Prepare test data
  - [ ] Query farms from Supabase by district
  - [ ] Export field boundaries as GeoJSON
  - [ ] Create `data/test_farms.csv`
  - [ ] Create `data/test_farm_boundaries.geojson`
  
- [ ] **Thu-Fri**: GEE Setup
  - [ ] Create Google Cloud project
  - [ ] Enable Earth Engine API
  - [ ] Authenticate locally: `earthengine authenticate`
  - [ ] Test connection: `ee.Initialize()`

**Deliverables**:
- ✅ Prototype deployed
- ✅ Test region selected (10-20 farms)
- ✅ Field boundaries exported
- ✅ GEE authentication working

---

## ✅ Week 2: WorldCereal + Time Series Collection

**Full-time ML development**

- [ ] **Mon-Tue**: ESA WorldCereal Baseline
  - [ ] Create `notebooks/01_worldcereal_baseline.ipynb`
  - [ ] Run on all test farms
  - [ ] Save results: `data/worldcereal_baseline.csv`
  - [ ] **Manual validation**: Visit 5-10 fields, check predictions
  
- [ ] **Tue-Wed**: Sentinel-1 (SAR) Collection
  - [ ] Create `notebooks/02_timeseries_collection.ipynb`
  - [ ] Download S1 for all test farms (Oct 2024 - Mar 2025)
  - [ ] Save: `data/timeseries/s1_*.csv`
  - [ ] Check: ~20-30 observations per farm
  
- [ ] **Wed-Thu**: Sentinel-2 (Optical) Collection
  - [ ] Download S2 for all test farms
  - [ ] Filter clouds: `CLOUDY_PIXEL_PERCENTAGE < 20`
  - [ ] Save: `data/timeseries/s2_*.csv`
  - [ ] Check: ~30-40 observations per farm
  
- [ ] **Thu-Fri**: Weather Data Collection
  - [ ] Download from Open-Meteo (free API)
  - [ ] Temp, rainfall, humidity daily
  - [ ] Save: `data/timeseries/weather_*.csv`
  - [ ] Check: Complete 5-month time series

**Deliverables**:
- ✅ WorldCereal baseline validation
- ✅ S1/S2 time series for all farms
- ✅ Weather data for all farms
- ✅ Total ~300 GB satellite imagery? (may download to disk)

**Action Items**:
- [ ] Place probe order (Watermark, Decagon, etc.)
- [ ] Identify 5-10 fields for probe installation
- [ ] Get farmer consent for probe installation

---

## ✅ Week 3: NDVI + Growth Stage + Probe Deployment

**Continue ML + Field Work**

- [ ] **Mon-Tue**: NDVI Calculation
  - [ ] Create `notebooks/03_vegetation_indices.ipynb`
  - [ ] Calculate NDVI, EVI, NDBI from S2
  - [ ] Save: `data/timeseries/ndvi_*.csv`
  - [ ] Visualize: NDVI progression over season
  
- [ ] **Tue-Wed**: Rule-Based Growth Stage
  - [ ] Create `notebooks/03_growth_stage.ipynb`
  - [ ] Map NDVI to growth stages (germination → maturity)
  - [ ] Save: `data/timeseries/growth_stage_*.csv`
  - [ ] **Manual validation**: Visit 5-10 fields, compare NDVI to visual inspection
  
- [ ] **Wed-Thu**: Soil Probe Deployment
  - [ ] Receive probes from supplier
  - [ ] Install in 5-10 selected fields
  - [ ] Install at 20-30 cm depth (root zone)
  - [ ] GPS coordinates + calibration
  - [ ] Set up daily reading schedule
  - [ ] Start daily measurements (6 AM + 6 PM)
  
- [ ] **Thu-Fri**: Data Management Setup
  - [ ] Create `data/soil_probes/` directory
  - [ ] Create Excel/CSV template for probe readings
  - [ ] Train farmer/technician on measurements
  - [ ] First week of probe data collection

**Deliverables**:
- ✅ NDVI/EVI/NDBI time series
- ✅ Growth stage predictions (rule-based)
- ✅ Probes installed and logging
- ✅ First 7 days of probe measurements

**Validation**:
- [ ] Manually verify 5 NDVI predictions in field
- [ ] Take photos of each probe installation
- [ ] Verify probe readings make sense (increasing with rain, decreasing with heat)

---

## ✅ Week 4: Train XGBoost Model

**Intensive ML development**

- [ ] **Mon**: Collect all probe data
  - [ ] Gather all readings from past week
  - [ ] Create master CSV: `data/soil_probes/measurements_*.csv`
  - [ ] Quality check: No missing days, handle errors
  - [ ] Total: ~50-70 data points per field
  
- [ ] **Tue-Wed**: Prepare Training Data
  - [ ] Create `notebooks/04_prepare_training_data.ipynb`
  - [ ] Align satellite + probe measurements
  - [ ] For each probe reading, get nearest S1/S2 image
  - [ ] Feature engineering: VV, VH, NDVI, weather
  - [ ] Save: `data/soil_moisture_training_data.csv`
  - [ ] Check: 50-200+ training samples
  
- [ ] **Wed-Thu**: Train XGBoost
  - [ ] Create `notebooks/04_train_xgboost.ipynb`
  - [ ] Split: 70% train, 30% test
  - [ ] Hyperparameters: `max_depth=6, learning_rate=0.1`
  - [ ] Evaluate: MAE, R², feature importance
  - [ ] **Success criteria**: Test MAE < 10%
  - [ ] Save model: `ml/models/soil_moisture_xgboost_v1.json`
  
- [ ] **Fri**: Validation
  - [ ] Create `notebooks/05_validation.ipynb`
  - [ ] Test predictions on validation set
  - [ ] Compare to probe measurements
  - [ ] Document results

**Deliverables**:
- ✅ Training data CSV with 50-200+ samples
- ✅ Trained XGBoost model
- ✅ Validation report (MAE < 10%)
- ✅ Feature importance analysis

**If MAE > 10%**:
- [ ] Collect more probe data (continue Week 4.5)
- [ ] Adjust features (add/remove)
- [ ] Try different hyperparameters

---

## ✅ Week 5: Deploy & Integrate

**Final integration**

- [ ] **Mon**: Load Model in Predictor
  - [ ] Update `ml/predictor.py`
  - [ ] Replace weather-based rules with XGBoost
  - [ ] Test locally: `python main.py`
  - [ ] Verify predictions are reasonable
  
- [ ] **Tue**: Update Backend Integration
  - [ ] Add route to `backend/src/routes/satellite.ts`
  - [ ] Call `/predict/soil-moisture` from backend
  - [ ] Handle errors gracefully
  - [ ] Test: `curl http://localhost:8000/predict/...`
  
- [ ] **Wed**: Mobile Integration
  - [ ] Update `mobile/src/services/satellite.ts`
  - [ ] Fetch predictions from backend
  - [ ] Display on home screen
  - [ ] Test in Expo
  
- [ ] **Thu**: Deploy to Production
  - [ ] Push to GitHub (ml/ + backend + mobile)
  - [ ] Deploy ML service to Render
  - [ ] Deploy backend
  - [ ] Deploy mobile (Expo)
  
- [ ] **Fri**: Launch & Monitor
  - [ ] Live testing with real farmers
  - [ ] Monitor predictions + accuracy
  - [ ] Collect feedback
  - [ ] Document results

**Deliverables**:
- ✅ Real model deployed
- ✅ End-to-end working (mobile → backend → ML)
- ✅ Farmers using predictions
- ✅ Performance metrics documented

---

## 📋 Data Collection During Weeks 2-4

**Ongoing**: Probe measurements every day

- [ ] **Daily** (6 AM + 6 PM):
  - [ ] Measure soil moisture (%)
  - [ ] Measure temperature (°C)
  - [ ] Record in CSV
  - [ ] Note any issues (sensor error, rain, etc.)

- [ ] **Weekly**:
  - [ ] Compile all probe data
  - [ ] Backup to cloud (Google Drive, Dropbox)
  - [ ] Check for data quality
  - [ ] Troubleshoot any problems

- [ ] **By Week 4 End**:
  - [ ] Total: 50-100 measurements per field
  - [ ] 5-10 fields × 50-100 = 250-1000 samples
  - [ ] Ready for XGBoost training

---

## 🔧 Technical Setup

### GEE Authentication
```bash
earthengine authenticate
# Follow browser login
# Credentials saved to ~/.config/earthengine/
```

### Jupyter Notebooks
```bash
cd ml/notebooks
jupyter notebook
```

### Package Dependencies
```bash
pip install -r ../requirements_ml.txt
# Includes: pandas, numpy, xgboost, earthengine-api, requests, etc.
```

---

## 📞 Support & Troubleshooting

### No Sentinel Images Found
- [ ] Check date range (need cloud-free imagery)
- [ ] Lower cloud threshold: `CLOUDY_PIXEL_PERCENTAGE < 30`
- [ ] Expand date range by 1 month

### Probe Readings Unrealistic
- [ ] Check sensor calibration
- [ ] Verify sensor depth (should be 20-30 cm)
- [ ] Check for water logging / drainage issues
- [ ] Restart data collection

### XGBoost MAE > 10%
- [ ] Collect more probe data (wait until Week 4.5)
- [ ] Add more features (historical data, soil type, etc.)
- [ ] Adjust hyperparameters
- [ ] Verify training data quality

### Model Not Improving
- [ ] Get ground truth samples from more farms
- [ ] Use different crops (diversify training set)
- [ ] Consider ensemble methods
- [ ] Move to LSTM for time series (Phase 3.3)

---

## 📊 Weekly Status Report Template

**Week: [Number]**  
**Date: [Start] - [End]**

### Completed ✅
- [ ] ...
- [ ] ...

### In Progress 🔄
- [ ] ...
- [ ] ...

### Blockers ⚠️
- [ ] ...
- [ ] ...

### Next Week 🎯
- [ ] ...
- [ ] ...

**Metrics**:
- Farms: ___ (target: 10-20)
- Satellite observations: ___ (target: 20-40 per farm)
- Probe measurements: ___ (target: 50+ by week 4)
- Model MAE: ___ (target: <10% by week 5)

---

## 🎉 Phase 3.0 (MVP) Complete!

**When all boxes ✅ are checked**:
1. Farmers have real predictions
2. Accuracy: 80-85%+
3. Confidence scores documented
4. Deployed to production
5. Monitoring in place

**Next Phase (3.2)**:
- Fine-tune with more farms
- Add crop classification model
- Explore Presto/Prithvi (advanced)

---

Start with **Week 1 Monday**! 🚀
