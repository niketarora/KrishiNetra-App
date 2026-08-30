# ESA/NASA Plan — Quick Reference Guide

**For when you're deep in the notebooks and need quick answers**

---

## 🎯 The 9-Step Plan (At a Glance)

```
1. SELECT region & farms (Week 1)
2. GET field boundaries (Week 1)
3. RUN ESA WorldCereal (Week 2)
4. COLLECT S1/S2/weather time series (Week 2-3)
5. CALCULATE NDVI & growth stage (Week 3)
6. ADD NASA SMAP features (Week 3)
7. DEPLOY soil moisture probes (Week 3-4)
8. TRAIN XGBoost on probe data (Week 4)
9. DEPLOY real model (Week 5)
```

---

## 📊 Quick Data Reference

### Step 1: Test Region Selection
| What | Where | Format |
|------|-------|--------|
| Farms | Supabase `farms` table | ID, boundary, district, centroid |
| Output | `data/test_farms.csv` | CSV with 10-20 farms |
| Boundary | `data/test_farm_boundaries.geojson` | GeoJSON Polygon |

**Query**:
```sql
SELECT id, boundary, centroid_lat, centroid_lng, area_hectares
FROM farms
WHERE district = 'Pune'
LIMIT 20;
```

---

### Step 2: ESA WorldCereal Baseline
| Item | Value | Notes |
|------|-------|-------|
| Dataset | `ESA/WORLDCEREAL/2021/MAIN_CROP` | GEE image collection |
| Resolution | 100 meters | Coarse, use for baseline only |
| Output | `data/worldcereal_baseline.csv` | farm_id, crop, confidence |
| Crops | wheat, rice, maize, chickpea, cotton, sugarcane | ESA codes 10-60 |

**ESA Crop Codes**:
```
10: maize, 20: rice, 30: wheat
40: chickpea, 41: pigeonpea, 42: groundnut
50: sugarcane, 60: cotton
```

---

### Step 3: Sentinel-1 (SAR) Data
| Property | Value |
|----------|-------|
| **Satellite** | Copernicus Sentinel-1 |
| **GEE Dataset** | `COPERNICUS/S1_GRD` |
| **Resolution** | 10 meters |
| **Revisit** | 6-12 days |
| **Bands** | VV (vertical), VH (vertical-horizontal) |
| **Output** | `data/timeseries/s1_*.csv` |
| **Format** | date, VV, VH (dB values: -25 to -5) |
| **Samples** | ~20-30 per farm, 5-month season |

**SAR Physics**:
- High backscatter (VV/VH near 0) = Dense vegetation
- Low backscatter (VV/VH < -20) = Bare soil or water
- VH sensitive to soil moisture (key for our model!)

---

### Step 4: Sentinel-2 (Optical) Data
| Property | Value |
|----------|-------|
| **Satellite** | Copernicus Sentinel-2 |
| **GEE Dataset** | `COPERNICUS/S2_SR_HARMONIZED` |
| **Resolution** | 10-20 meters |
| **Revisit** | 5 days (India coverage) |
| **Key Bands** | B2 (Blue), B3 (Green), B4 (Red), B8 (NIR), B11 (SWIR) |
| **Cloud Filter** | `CLOUDY_PIXEL_PERCENTAGE < 20` |
| **Output** | `data/timeseries/s2_*.csv` |
| **Format** | date, B2, B3, B4, B8, B11 |
| **Samples** | ~30-40 per farm, 5-month season |

**Vegetation Indices**:
```
NDVI = (NIR - Red) / (NIR + Red)      # Most important
EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
NDBI = (SWIR - NIR) / (SWIR + NIR)    # Distinguishes vegetation
```

**NDVI Range**:
- < 0.2: Bare soil
- 0.2-0.4: Sparse/early vegetation
- 0.4-0.6: Vegetative growth
- 0.6-0.8: Dense vegetation / flowering
- > 0.8: Very dense / peak biomass

---

### Step 5: Weather Data
| Source | Dataset | Variables | Output |
|--------|---------|-----------|--------|
| **Open-Meteo** | Historical API (free) | Temp max, rainfall, humidity | `data/timeseries/weather_*.csv` |
| **Frequency** | Daily | Max temp, daily precip, max humidity | date, temp_max, rainfall_mm, humidity_max |
| **Coverage** | Global | No API key needed | Free, no limits |

**Query Weather** (Python):
```python
import requests
url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    'latitude': lat, 'longitude': lon,
    'start_date': '2024-10-01', 'end_date': '2025-03-31',
    'daily': 'temperature_2m_max,precipitation,relative_humidity_2m_max'
}
response = requests.get(url, params=params)
```

---

### Step 6: NDVI-Based Growth Stages
| Stage | NDVI Range | Crop | Duration |
|-------|-----------|------|----------|
| **Germination** | 0.0-0.3 | Wheat | 0-20 days |
| **Vegetative** | 0.3-0.6 | Wheat | 20-60 days |
| **Flowering** | 0.6-0.75 | Wheat | 60-100 days |
| **Grain Filling** | 0.75-0.85 | Wheat | 100-130 days |
| **Maturity** | Decreasing | Wheat | 130-150 days |

**Crop-Specific Ranges** (adjust per crop):
- **Wheat**: 150 days, NDVI: 0→0.8→0.5 (senescence)
- **Rice**: 130 days, NDVI: 0→0.75→0.4
- **Chickpea**: 120 days, NDVI: 0→0.65→0.4
- **Sugarcane**: 365 days, NDVI: 0→0.8 (stays high)

---

### Step 7: Soil Moisture Probes
| Aspect | Details |
|--------|---------|
| **Budget** | $50-200 per probe |
| **Recommended** | Watermark, Decagon TEROS, ISCO |
| **Installation Depth** | 20-30 cm (root zone) |
| **Measurements** | Soil moisture (%), temperature (°C) |
| **Frequency** | Daily (6 AM + 6 PM ideally) |
| **Duration** | 8-12 weeks minimum |
| **Fields to Deploy** | 5-10 diverse fields |
| **Data per Field** | ~50-100 measurements (daily × ~100 days) |

**Calibration**:
- Dry: 100% dry soil = 0% moisture
- Wet: Saturated soil = 100% moisture
- Linear interpolation between

---

### Step 8: XGBoost Training Data
| Property | Requirement |
|----------|-------------|
| **Samples** | Minimum 50, target 100-200 |
| **Features** | VV, VH, VV/VH ratio, NDVI, EVI, NDBI, Temp, Rain (past 7d), Humidity |
| **Label** | Soil moisture from probes (ground truth) |
| **Split** | 70% train, 30% test |
| **Model** | `XGBRegressor(max_depth=6, learning_rate=0.1)` |
| **Success** | Test MAE < 10% |

**Training Data Format** (`data/soil_moisture_training_data.csv`):
```csv
farm_id,date,vv,vh,vv_vh_ratio,ndvi,evi,ndbi,temperature_mean,rainfall_sum_7d,humidity_max,soil_moisture_measured
farm1,2024-10-15,-13.2,-19.4,0.69,0.52,0.48,0.12,28.5,5.0,65,62
farm1,2024-10-22,-12.8,-18.9,0.68,0.58,0.54,0.10,26.0,0.0,70,58
```

---

### Step 9: Model Deployment
| Item | Action |
|------|--------|
| **Save Model** | `model.save_model('models/soil_moisture_xgboost_v1.json')` |
| **Load Model** | `model = xgb.XGBRegressor(); model.load_model('...')` |
| **Prediction** | `moisture = model.predict([[vv, vh, ndvi, ...]])[0]` |
| **API Update** | Replace weather rules in `ml/predictor.py` |
| **Confidence** | Set to 0.85 (much higher than 0.50 prototype) |
| **Fallback** | Keep simple rules for error handling |

---

## 🔧 Common GEE Code Snippets

### Initialize GEE
```python
import ee
ee.Initialize()
```

### Fetch Sentinel-1
```python
s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
    .filterBounds(geometry) \
    .filterDate('2024-10-01', '2025-03-31') \
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
```

### Fetch Sentinel-2
```python
s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
    .filterBounds(geometry) \
    .filterDate('2024-10-01', '2025-03-31') \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
```

### Calculate NDVI
```python
ndvi = (s2.select('B8').subtract(s2.select('B4'))) \
       .divide(s2.select('B8').add(s2.select('B4')))
```

### Sample Region
```python
sample = image.sample(geometry, scale=10).getInfo()
```

---

## 📈 Expected Results by Week

| Week | Expected Outcome |
|------|-----------------|
| **1** | 10-20 farms selected, boundaries exported, GEE working |
| **2** | S1/S2/weather downloaded for all farms (100GB+) |
| **3** | NDVI/growth calculated, 5-10 probes deployed & logging |
| **4** | 50-200 training samples, XGBoost trained (MAE < 10%) |
| **5** | Real model deployed, farmers using predictions |

---

## ⚠️ Common Issues & Solutions

### GEE Download Slow?
- **Problem**: S1/S2 downloading takes hours
- **Solution**: Download to disk, split by farm, run in parallel
- **Alternative**: Use Sentinel Hub API (faster, paid)

### Probe Readings Noisy?
- **Problem**: Soil moisture jumping ±10% daily
- **Solution**: Average 3-5 probes per field, apply smoothing
- **Check**: Sensor working? Proper depth? Calibration correct?

### NDVI Doesn't Match Growth Stage?
- **Problem**: NDVI high but crop looks immature
- **Solution**: Cloud contamination in S2, use S1 instead
- **Check**: Check `CLOUDY_PIXEL_PERCENTAGE` during collection

### XGBoost MAE > 10%?
- **Problem**: Model not learning well
- **Solution**: 
  1. Collect more probe data (week 4.5)
  2. Add more features (soil type, fertilizer, etc.)
  3. Try different hyperparameters
  4. Use LSTM for time series (Phase 3.3)

### Model Predicts Outside 0-100% Range?
- **Problem**: XGBoost predicts 102% or -5% moisture
- **Solution**: Clip predictions: `np.clip(pred, 0, 100)`

---

## 📚 Papers to Reference

1. **WorldCereal**: ESA WorldCereal crop classification methodology
2. **Sentinel-1 & Soil Moisture**: "Synthetic Aperture Radar for Agriculture" — ESA
3. **NDVI Phenology**: "Crop Phenology from NDVI Time Series" — Nature Geoscience
4. **SMAP**: NASA SMAP Soil Moisture Retrieval Algorithm

Search: Google Scholar + ESA + NASA publications

---

## 🎯 Success Metrics

**By Week 5 End**:
- ✅ Crop predictions: 80-90% accuracy (WorldCereal baseline)
- ✅ Soil moisture: MAE < 10% on test set (XGBoost)
- ✅ Growth stage: Matches visual inspection (rule-based NDVI)
- ✅ Deployed: Live predictions for farmers
- ✅ Monitored: Logging predictions + ground truth

---

## 🚀 Quick Start Command

```bash
cd ml/notebooks
jupyter notebook 00_setup.ipynb
```

Then follow the checklist: `ESA_NASA_CHECKLIST.md`

---

**Questions? Check `ESA_NASA_PLAN.md` for full details.**

Good luck! 🌾
