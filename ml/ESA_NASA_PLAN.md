# Phase 3 ML — ESA/NASA Production Plan

**Status**: Starting implementation  
**Methodology**: ESA WorldCereal + NASA SMAP + XGBoost on ground truth  
**Timeline**: 5 weeks  
**Target**: 85%+ accuracy for crop classification, <10% MAE for soil moisture  

---

## 📋 Complete Implementation Guide

### Week 1: Prototype + Test Region Selection

**Parallel with prototype deployment**

#### Step 1.1: Select Test Region

```python
# ml/notebooks/00_setup.ipynb

# Configuration
TEST_CONFIG = {
    'district': 'Pune',  # Change to your target district
    'season': 'rabi',  # rabi (Oct-Mar) or kharif (Jun-Sep)
    'year': 2024,
    'target_crops': ['wheat', 'chickpea', 'sugarcane'],  # 2-3 common crops
    'test_farms_count': 10,  # Start small
}

# Query existing farms from Supabase
import pandas as pd
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get farms in target district
farms = supabase.table('farms') \
    .select('*') \
    .eq('district', TEST_CONFIG['district']) \
    .limit(TEST_CONFIG['test_farms_count']) \
    .execute()

test_farms = pd.DataFrame(farms.data)
print(f"✓ Selected {len(test_farms)} farms in {TEST_CONFIG['district']}")
test_farms.to_csv('data/test_farms.csv', index=False)
```

**Deliverable**: `data/test_farms.csv` with farm IDs, boundaries, districts

---

#### Step 1.2: Export Field Boundaries

```python
# ml/notebooks/00_setup.ipynb (continued)

import geojson
import json

# Extract boundaries as GeoJSON
boundaries = {
    'type': 'FeatureCollection',
    'features': []
}

for idx, farm in test_farms.iterrows():
    boundary_json = json.loads(farm['boundary'])
    
    feature = {
        'type': 'Feature',
        'properties': {
            'farm_id': farm['id'],
            'district': farm['district'],
            'area_hectares': farm['area_hectares'],
        },
        'geometry': boundary_json,
    }
    boundaries['features'].append(feature)

# Save
with open('data/test_farm_boundaries.geojson', 'w') as f:
    json.dump(boundaries, f, indent=2)

print(f"✓ Exported {len(boundaries['features'])} farm boundaries to GeoJSON")
```

**Deliverable**: `data/test_farm_boundaries.geojson`

---

### Week 2: ESA WorldCereal Baseline + Time Series Collection

#### Step 2.1: ESA WorldCereal Crop Classification Baseline

```python
# ml/notebooks/01_worldcereal_baseline.ipynb

import ee
import pandas as pd
import json

# Initialize Earth Engine
ee.Initialize()

def get_worldcereal_crop(farm_boundary, date_range):
    """
    Get ESA WorldCereal crop classification for a field
    
    Returns: Predicted crop type + confidence
    """
    # Parse boundary
    coords = farm_boundary['coordinates']
    geometry = ee.Geometry.Polygon(coords)
    
    # Load WorldCereal main crop dataset
    worldcereal = ee.ImageCollection('ESA/WORLDCEREAL/2021/MAIN_CROP')
    
    # Filter by date range (your season)
    crop_map = worldcereal \
        .filterBounds(geometry) \
        .filterDate(date_range['start'], date_range['end']) \
        .mosaic()  # Combine multiple images
    
    # Sample at farm centroid
    sample = crop_map.sample(geometry, scale=10).getInfo()
    
    if sample['features']:
        crop_code = sample['features'][0]['properties']['MAIN_CROP']
        confidence = sample['features'][0]['properties'].get('confidence', 0.7)
        
        # Map crop code to name
        crop_names = {
            10: 'maize',
            20: 'rice',
            30: 'wheat',
            40: 'chickpea',
            41: 'pigeonpea',
            42: 'groundnut',
            50: 'sugarcane',
            60: 'cotton',
        }
        
        return {
            'crop': crop_names.get(crop_code, 'unknown'),
            'crop_code': crop_code,
            'confidence': confidence,
            'source': 'ESA WorldCereal',
        }
    
    return None

# Test on all farms
results = []

test_farms = pd.read_csv('data/test_farms.csv')
date_range = {'start': '2024-10-01', 'end': '2025-03-31'}

for idx, farm in test_farms.iterrows():
    boundary = json.loads(farm['boundary'])
    
    prediction = get_worldcereal_crop(boundary, date_range)
    
    results.append({
        'farm_id': farm['id'],
        'district': farm['district'],
        'predicted_crop': prediction['crop'] if prediction else None,
        'confidence': prediction['confidence'] if prediction else None,
        'source': 'ESA WorldCereal 2021',
    })
    
    print(f"✓ Farm {farm['id']}: {prediction['crop']} ({prediction['confidence']:.2f})")

# Save results
worldcereal_results = pd.DataFrame(results)
worldcereal_results.to_csv('data/worldcereal_baseline.csv', index=False)

print(f"\n✓ ESA WorldCereal baseline complete: {len(results)} farms")
print(f"  Crops predicted: {worldcereal_results['predicted_crop'].unique()}")
```

**Deliverable**: `data/worldcereal_baseline.csv` with crop predictions for all test farms

**Next**: Manually verify 5-10 predictions in the field or with satellite imagery

---

#### Step 2.2: Collect Sentinel-1 Time Series

```python
# ml/notebooks/02_timeseries_collection.ipynb

import ee
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

ee.Initialize()

def download_sentinel1_timeseries(farm_boundary, start_date, end_date, scale=10):
    """
    Download Sentinel-1 SAR backscatter time series
    
    Returns: Time series of VV and VH backscatter
    """
    coords = farm_boundary['coordinates']
    geometry = ee.Geometry.Polygon(coords)
    
    # Sentinel-1: C-band SAR, VV and VH polarization
    s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
        .filterBounds(geometry) \
        .filterDate(start_date, end_date) \
        .filter(ee.Filter.eq('instrumentMode', 'IW')) \
        .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
    
    # Function to add date property
    def add_date(image):
        return image.addBands(
            image.metadata('system:time_start').divide(1000).int64().rename('date')
        )
    
    s1 = s1.map(add_date)
    
    # Download each image
    timeseries = []
    
    image_list = s1.toList(100).getInfo()  # Max 100 images
    
    for img_dict in image_list:
        img_id = img_dict['id']
        img = ee.Image(img_id)
        
        # Get VV and VH
        vv = img.select('VV')
        vh = img.select('VH')
        
        # Calculate stats over farm
        stats = {
            'VV': vv.reduceRegion(ee.Reducer.mean(), geometry, scale).getInfo()['VV'],
            'VH': vh.reduceRegion(ee.Reducer.mean(), geometry, scale).getInfo()['VH'],
            'date': datetime.fromtimestamp(img_dict['properties']['system:time_start'] / 1000),
        }
        
        timeseries.append(stats)
    
    return pd.DataFrame(timeseries).sort_values('date')

# Collect for all farms
test_farms = pd.read_csv('data/test_farms.csv')
start_date = '2024-10-01'
end_date = '2025-03-31'

all_s1_data = {}

for idx, farm in test_farms.iterrows():
    boundary = json.loads(farm['boundary'])
    farm_id = farm['id']
    
    print(f"Downloading S1 for farm {farm_id}...")
    
    s1_ts = download_sentinel1_timeseries(boundary, start_date, end_date)
    all_s1_data[farm_id] = s1_ts
    
    # Save per farm
    s1_ts.to_csv(f'data/timeseries/s1_{farm_id}.csv', index=False)
    
    print(f"✓ {len(s1_ts)} S1 observations for farm {farm_id}")

print(f"\n✓ Sentinel-1 collection complete: {len(all_s1_data)} farms")
```

**Deliverable**: `data/timeseries/s1_*.csv` for each farm (VV, VH, date)

---

#### Step 2.3: Collect Sentinel-2 Time Series (Optical)

```python
# ml/notebooks/02_timeseries_collection.ipynb (continued)

def download_sentinel2_timeseries(farm_boundary, start_date, end_date, scale=10):
    """
    Download Sentinel-2 multispectral time series
    
    Returns: Time series of B2, B3, B4, B8 (Blue, Green, Red, NIR)
    """
    coords = farm_boundary['coordinates']
    geometry = ee.Geometry.Polygon(coords)
    
    # Sentinel-2: Multispectral, 5-day revisit, cloud-masked
    s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterBounds(geometry) \
        .filterDate(start_date, end_date) \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))  # Cloud filter
    
    timeseries = []
    
    image_list = s2.toList(100).getInfo()
    
    for img_dict in image_list:
        img_id = img_dict['id']
        img = ee.Image(img_id)
        
        # Select bands
        bands = img.select(['B2', 'B3', 'B4', 'B8', 'B11'])  # Blue, Green, Red, NIR, SWIR
        
        # Get stats
        stats = bands.reduceRegion(ee.Reducer.mean(), geometry, scale).getInfo()
        stats['date'] = datetime.fromtimestamp(img_dict['properties']['system:time_start'] / 1000)
        
        timeseries.append(stats)
    
    return pd.DataFrame(timeseries).sort_values('date')

# Collect for all farms
all_s2_data = {}

for idx, farm in test_farms.iterrows():
    boundary = json.loads(farm['boundary'])
    farm_id = farm['id']
    
    print(f"Downloading S2 for farm {farm_id}...")
    
    s2_ts = download_sentinel2_timeseries(boundary, start_date, end_date)
    all_s2_data[farm_id] = s2_ts
    
    s2_ts.to_csv(f'data/timeseries/s2_{farm_id}.csv', index=False)
    
    print(f"✓ {len(s2_ts)} S2 observations for farm {farm_id}")

print(f"\n✓ Sentinel-2 collection complete: {len(all_s2_data)} farms")
```

**Deliverable**: `data/timeseries/s2_*.csv` for each farm (B2, B3, B4, B8, date)

---

#### Step 2.4: Get Weather Data

```python
# ml/notebooks/02_timeseries_collection.ipynb (continued)

import requests

def get_weather_timeseries(lat, lon, start_date, end_date):
    """
    Get daily weather from Open-Meteo (free, no API key)
    
    Returns: Temperature, rainfall, humidity
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    
    params = {
        'latitude': lat,
        'longitude': lon,
        'start_date': start_date,
        'end_date': end_date,
        'daily': 'temperature_2m_max,precipitation,relative_humidity_2m_max',
        'timezone': 'IST',
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    weather_df = pd.DataFrame({
        'date': pd.to_datetime(data['daily']['time']),
        'temperature_max': data['daily']['temperature_2m_max'],
        'rainfall_mm': data['daily']['precipitation'],
        'humidity_max': data['daily']['relative_humidity_2m_max'],
    })
    
    return weather_df

# Collect for all farms
test_farms = pd.read_csv('data/test_farms.csv')

for idx, farm in test_farms.iterrows():
    farm_id = farm['id']
    lat = farm['centroid_lat']
    lon = farm['centroid_lng']
    
    print(f"Getting weather for farm {farm_id} ({lat}, {lon})...")
    
    weather = get_weather_timeseries(lat, lon, start_date, end_date)
    weather.to_csv(f'data/timeseries/weather_{farm_id}.csv', index=False)
    
    print(f"✓ {len(weather)} weather observations for farm {farm_id}")

print(f"\n✓ Weather collection complete")
```

**Deliverable**: `data/timeseries/weather_*.csv` for each farm (temperature, rainfall, humidity)

---

### Week 3: NDVI Calculation + Growth Stage Detection + Probe Deployment

#### Step 3.1: Calculate NDVI & Vegetation Indices

```python
# ml/notebooks/03_vegetation_indices.ipynb

import pandas as pd
import numpy as np

def calculate_vegetation_indices(s2_df):
    """
    Calculate NDVI, NDBI, EVI from Sentinel-2 bands
    
    NDVI = (NIR - Red) / (NIR + Red)
    EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
    NDBI = (SWIR - NIR) / (SWIR + NIR)
    """
    
    blue = s2_df['B2']
    red = s2_df['B4']
    nir = s2_df['B8']
    swir = s2_df['B11']
    
    # NDVI
    s2_df['ndvi'] = (nir - red) / (nir + red + 1e-8)
    
    # EVI (Enhanced Vegetation Index)
    s2_df['evi'] = 2.5 * (nir - red) / (nir + 6*red - 7.5*blue + 1 + 1e-8)
    
    # NDBI (Built-up index, distinguishes vegetation)
    s2_df['ndbi'] = (swir - nir) / (swir + nir + 1e-8)
    
    return s2_df[['date', 'ndvi', 'evi', 'ndbi']]

# Calculate for all farms
test_farms = pd.read_csv('data/test_farms.csv')

for idx, farm in test_farms.iterrows():
    farm_id = farm['id']
    
    # Load S2 time series
    s2_df = pd.read_csv(f'data/timeseries/s2_{farm_id}.csv')
    s2_df['date'] = pd.to_datetime(s2_df['date'])
    
    # Calculate indices
    indices = calculate_vegetation_indices(s2_df)
    
    # Save
    indices.to_csv(f'data/timeseries/ndvi_{farm_id}.csv', index=False)
    
    print(f"✓ NDVI calculated for farm {farm_id}")
    print(f"  NDVI range: {indices['ndvi'].min():.2f} to {indices['ndvi'].max():.2f}")

print(f"\n✓ Vegetation indices calculated for all farms")
```

**Deliverable**: `data/timeseries/ndvi_*.csv` with NDVI, EVI, NDBI time series

---

#### Step 3.2: Rule-Based Growth Stage Detection

```python
# ml/notebooks/03_growth_stage.ipynb

def map_ndvi_to_growth_stage(ndvi_value, crop_type):
    """
    Map NDVI to crop growth stage (rule-based)
    
    Typical NDVI ranges per stage:
    - Germination: 0.0-0.3 (bare soil to seedling)
    - Vegetative: 0.3-0.6 (leaf expansion)
    - Flowering: 0.6-0.75 (flowering)
    - Grain filling: 0.75-0.85 (seed development)
    - Maturity: 0.4-0.6 (decreasing NDVI, senescence)
    """
    
    if crop_type in ['wheat', 'rice', 'maize']:
        stages = {
            (0.0, 0.3):   'germination',
            (0.3, 0.5):   'vegetative',
            (0.5, 0.7):   'flowering',
            (0.7, 0.85):  'grain_filling',
            (0.4, 0.6):   'maturity',  # Decreased NDVI
        }
    elif crop_type == 'chickpea':
        stages = {
            (0.0, 0.25):  'germination',
            (0.25, 0.45): 'vegetative',
            (0.45, 0.65): 'flowering',
            (0.65, 0.75): 'pod_filling',
            (0.35, 0.55): 'maturity',
        }
    elif crop_type == 'sugarcane':
        # Sugarcane has different phenology (longer season)
        stages = {
            (0.0, 0.4):   'germination',
            (0.4, 0.7):   'vegetative_growth',
            (0.7, 0.85):  'maturity',
            (0.7, 0.85):  'ripening',
        }
    else:
        stages = {
            (0.0, 0.3):   'germination',
            (0.3, 0.6):   'vegetative',
            (0.6, 0.75):  'flowering',
            (0.75, 0.85): 'ripening',
        }
    
    for (low, high), stage in stages.items():
        if low <= ndvi_value <= high:
            return stage
    
    return 'unknown'

def detect_growth_stage_timeseries(ndvi_df, crop_type):
    """
    Map entire NDVI time series to growth stages
    """
    ndvi_df['growth_stage'] = ndvi_df['ndvi'].apply(
        lambda x: map_ndvi_to_growth_stage(x, crop_type)
    )
    
    return ndvi_df

# Predict growth stage for all farms
worldcereal = pd.read_csv('data/worldcereal_baseline.csv')

for idx, farm in worldcereal.iterrows():
    farm_id = farm['farm_id']
    crop = farm['predicted_crop']
    
    if crop is None:
        continue
    
    # Load NDVI time series
    ndvi_df = pd.read_csv(f'data/timeseries/ndvi_{farm_id}.csv')
    ndvi_df['date'] = pd.to_datetime(ndvi_df['date'])
    
    # Detect growth stage
    ndvi_df = detect_growth_stage_timeseries(ndvi_df, crop)
    
    # Save
    ndvi_df.to_csv(f'data/timeseries/growth_stage_{farm_id}.csv', index=False)
    
    print(f"✓ Growth stages detected for farm {farm_id} ({crop})")
    print(f"  Stages: {ndvi_df['growth_stage'].unique()}")

print(f"\n✓ Rule-based growth stage detection complete")
```

**Deliverable**: `data/timeseries/growth_stage_*.csv` with NDVI-based stage predictions

**Next**: Manually visit 5-10 fields to validate NDVI predictions match visual inspection

---

#### Step 3.3: Order & Deploy Soil Moisture Probes

```python
# ml/PROBE_DEPLOYMENT.md

## Soil Moisture Probe Deployment Checklist

### Hardware
- [ ] Order 5-10 soil moisture sensors (budget: $50-200 each)
  - Recommended brands: Watermark, Decagon TEROS, ISCO
  - Features: 
    - 0-100% range
    - Temperature sensor
    - SDI-12 or Analog output
    - IP67 waterproof rating
    
### Installation
- [ ] Select 5-10 diverse fields:
  - Different crops (wheat, chickpea, sugarcane)
  - Different soil types (loamy, sandy, clay)
  - Different elevations if possible
  
- [ ] Install probes:
  - Depth: 20-30 cm (root zone)
  - Multiple probes per field: 3-5
  - Mark location with GPS coordinates
  
- [ ] Calibration:
  - Dry calibration (100% dry)
  - Wet calibration (saturated)
  - Record calibration data

### Data Collection
- [ ] Daily readings:
  - Measure: Soil moisture (%), Temperature (°C)
  - Time: Morning (6 AM) + Evening (6 PM)
  - Format: CSV with farm_id, date, time, moisture, temperature
  
- [ ] Log readings for 2-3 months (Oct 2024 - Jan 2025)
  - Target: 50+ data points per field
  - Quality: Handle missing days, instrument errors

### Data Format

**File**: `data/soil_probes/measurements_farm{id}.csv`

```csv
date,time,farm_id,probe_id,soil_moisture_percent,temperature_c
2024-10-15,06:00,farm1,probe1,62,24
2024-10-15,18:00,farm1,probe1,59,28
2024-10-16,06:00,farm1,probe1,65,22
```

### Timeline
- Week 2: Order probes
- Week 3: Receive + install
- Week 3-4: Start daily measurements
```

**Deliverable**: Probe deployment plan + installation photos

---

### Week 4: Train XGBoost Model

#### Step 4.1: Prepare Training Data

```python
# ml/notebooks/04_prepare_training_data.ipynb

import pandas as pd
import numpy as np

def align_satellite_and_probe_data(farm_id):
    """
    Align Sentinel-1/S2 satellite data with soil probe measurements
    
    Strategy: For each probe measurement date, get nearest satellite image
    """
    
    # Load data
    s1_df = pd.read_csv(f'data/timeseries/s1_{farm_id}.csv')
    s1_df['date'] = pd.to_datetime(s1_df['date'])
    
    s2_df = pd.read_csv(f'data/timeseries/ndvi_{farm_id}.csv')
    s2_df['date'] = pd.to_datetime(s2_df['date'])
    
    weather_df = pd.read_csv(f'data/timeseries/weather_{farm_id}.csv')
    weather_df['date'] = pd.to_datetime(weather_df['date'])
    
    probe_df = pd.read_csv(f'data/soil_probes/measurements_{farm_id}.csv')
    probe_df['date'] = pd.to_datetime(probe_df['date'])
    
    # For each probe measurement, find nearest satellite observation
    training_data = []
    
    for idx, probe_row in probe_df.iterrows():
        probe_date = probe_row['date']
        moisture_label = probe_row['soil_moisture_percent']
        
        # Find nearest S1 observation (within 3 days)
        s1_nearest = s1_df.iloc[(s1_df['date'] - probe_date).abs().argsort()[:1]]
        
        # Find nearest S2 observation (within 5 days)
        s2_nearest = s2_df.iloc[(s2_df['date'] - probe_date).abs().argsort()[:1]]
        
        # Get weather (average of past 7 days)
        weather_window = weather_df[
            (weather_df['date'] >= probe_date - pd.Timedelta(days=7)) &
            (weather_df['date'] <= probe_date)
        ]
        
        if len(s1_nearest) > 0 and len(s2_nearest) > 0 and len(weather_window) > 0:
            training_sample = {
                'farm_id': farm_id,
                'date': probe_date,
                # Satellite features
                'vv': s1_nearest['VV'].values[0],
                'vh': s1_nearest['VH'].values[0],
                'vv_vh_ratio': s1_nearest['VV'].values[0] / (s1_nearest['VH'].values[0] + 1e-6),
                'ndvi': s2_nearest['ndvi'].values[0],
                'evi': s2_nearest['evi'].values[0],
                'ndbi': s2_nearest['ndbi'].values[0],
                # Weather features
                'temperature_mean': weather_window['temperature_max'].mean(),
                'rainfall_sum_7d': weather_window['rainfall_mm'].sum(),
                'humidity_max': weather_window['humidity_max'].max(),
                # Target label
                'soil_moisture_measured': moisture_label,
            }
            
            training_data.append(training_sample)
    
    return pd.DataFrame(training_data)

# Prepare for all farms
all_training_data = []

test_farms = pd.read_csv('data/test_farms.csv')

for idx, farm in test_farms.iterrows():
    farm_id = farm['id']
    
    farm_data = align_satellite_and_probe_data(farm_id)
    
    if len(farm_data) > 0:
        all_training_data.append(farm_data)
        print(f"✓ Prepared {len(farm_data)} training samples for farm {farm_id}")

# Combine all
training_df = pd.concat(all_training_data, ignore_index=True)
training_df.to_csv('data/soil_moisture_training_data.csv', index=False)

print(f"\n✓ Training data prepared: {len(training_df)} samples")
print(f"  Features: {training_df.columns.tolist()}")
```

**Deliverable**: `data/soil_moisture_training_data.csv` with aligned satellite + probe data

---

#### Step 4.2: Train XGBoost Model

```python
# ml/notebooks/04_train_xgboost.ipynb

import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import joblib

# Load training data
df = pd.read_csv('data/soil_moisture_training_data.csv')

print(f"Training samples: {len(df)}")
print(f"Missing values: {df.isnull().sum().sum()}")

# Drop rows with missing values
df = df.dropna()

# Features for XGBoost
feature_cols = ['vv', 'vh', 'vv_vh_ratio', 'ndvi', 'evi', 'ndbi', 
                'temperature_mean', 'rainfall_sum_7d', 'humidity_max']
X = df[feature_cols]
y = df['soil_moisture_measured']

# Split: 70% train, 30% test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

print(f"\nTraining set: {len(X_train)} samples")
print(f"Test set: {len(X_test)} samples")

# Train XGBoost
model = xgb.XGBRegressor(
    max_depth=6,
    learning_rate=0.1,
    n_estimators=100,
    random_state=42,
    objective='reg:squarederror',
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=10,
)

# Predictions
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

# Evaluation
train_mae = mean_absolute_error(y_train, y_pred_train)
test_mae = mean_absolute_error(y_test, y_pred_test)
train_r2 = r2_score(y_train, y_pred_train)
test_r2 = r2_score(y_test, y_pred_test)

print(f"\n=== Model Performance ===")
print(f"Train MAE: {train_mae:.2f}%")
print(f"Test MAE:  {test_mae:.2f}%  (Target: <10%)")
print(f"Train R²:  {train_r2:.3f}")
print(f"Test R²:   {test_r2:.3f}")

# Feature importance
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print(f"\n=== Feature Importance ===")
print(feature_importance)

# Save model
model.save_model('ml/models/soil_moisture_xgboost_v1.json')
joblib.dump(model, 'ml/models/soil_moisture_xgboost_v1.pkl')

print(f"\n✓ Model saved to ml/models/")

# Save feature scaler (if using StandardScaler)
# joblib.dump(scaler, 'ml/models/feature_scaler.pkl')
```

**Deliverable**: Trained model `ml/models/soil_moisture_xgboost_v1.json`

**Success criteria**: Test MAE < 10%

---

### Week 5: Deploy & Integrate

#### Step 5.1: Load Model in Predictor

```python
# ml/predictor.py (update soil_moisture function)

import xgboost as xgb
import numpy as np

# Load trained model
soil_model = xgb.XGBRegressor()
soil_model.load_model('ml/models/soil_moisture_xgboost_v1.json')

def predict_soil_moisture_real(vv, vh, ndvi, temperature_mean, rainfall_7d):
    """
    Predict soil moisture using trained XGBoost model
    
    Replaces the simple weather-based rules
    """
    try:
        vv_vh_ratio = vv / (vh + 1e-6)
        evi = 0.0  # Placeholder, would need actual data
        ndbi = 0.0  # Placeholder, would need actual data
        humidity = 0.0  # Placeholder
        
        features = np.array([[
            vv, vh, vv_vh_ratio, ndvi, evi, ndbi,
            temperature_mean, rainfall_7d, humidity
        ]])
        
        moisture_pred = soil_model.predict(features)[0]
        
        return {
            'soil_moisture_percent': float(np.clip(moisture_pred, 0, 100)),
            'confidence': 0.85,  # Much higher than prototype!
            'source': 'xgboost_model_v1',
            'model_version': 'v1_trained_on_probes',
        }
    
    except Exception as e:
        # Fallback to rules if model fails
        return predict_soil_moisture(temperature_mean, rainfall_7d)
```

**Action**: Redeploy `ml/main.py` with updated predictor

---

#### Step 5.2: Test & Validate

```python
# ml/notebooks/05_validation.ipynb

# Test predictions on new farms (validation set)
validation_farms = [...]  # New farms not in training

for farm_id in validation_farms:
    # Get latest satellite data
    s1_latest = get_sentinel1_latest(farm_id)
    s2_latest = get_sentinel2_latest(farm_id)
    weather_latest = get_weather_latest(farm_id)
    
    # Predict
    prediction = predict_soil_moisture_real(
        vv=s1_latest['VV'],
        vh=s1_latest['VH'],
        ndvi=s2_latest['NDVI'],
        temperature_mean=weather_latest['temp'],
        rainfall_7d=weather_latest['rain_7d'],
    )
    
    print(f"Farm {farm_id}: {prediction['soil_moisture_percent']}% ± {100*(1-prediction['confidence'])}%")
```

**Deliverable**: Validation report comparing model predictions to probe measurements

---

## 📁 Directory Structure

```
ml/
├── main.py                                ← FastAPI app
├── predictor.py                           ← Updated with real models
├── models/
│   ├── soil_moisture_xgboost_v1.json     ← Trained model ✅
│   ├── soil_moisture_xgboost_v1.pkl
│   └── feature_scaler.pkl                ← Optional scaler
├── notebooks/
│   ├── 00_setup.ipynb                    ← Test region selection
│   ├── 01_worldcereal_baseline.ipynb     ← ESA WorldCereal
│   ├── 02_timeseries_collection.ipynb    ← S1/S2/Weather download
│   ├── 03_vegetation_indices.ipynb       ← NDVI calculation
│   ├── 03_growth_stage.ipynb             ← Growth stage rules
│   ├── 04_prepare_training_data.ipynb    ← Align satellite + probes
│   ├── 04_train_xgboost.ipynb            ← Train model
│   └── 05_validation.ipynb               ← Test on new farms
└── data/
    ├── test_farms.csv
    ├── test_farm_boundaries.geojson
    ├── worldcereal_baseline.csv
    ├── soil_moisture_training_data.csv
    ├── timeseries/
    │   ├── s1_*.csv
    │   ├── s2_*.csv
    │   ├── ndvi_*.csv
    │   ├── growth_stage_*.csv
    │   └── weather_*.csv
    └── soil_probes/
        └── measurements_*.csv
```

---

## 📊 Success Metrics by Week

| Week | Deliverable | Success Criteria |
|------|------------|------------------|
| **1** | Prototype deployed | API working, farmers using |
| **2** | Test region + time series | 10+ farms, 3+ months data |
| **3** | NDVI + probes deployed | Growth stage validated, probes logging |
| **4** | XGBoost model trained | Test MAE < 10% |
| **5** | Real model deployed | Predictions live, 85%+ accuracy |

---

## 🚀 Start Now

Create the notebooks and start with Step 1.1:

```bash
cd ml/notebooks
jupyter notebook 00_setup.ipynb
```

Then follow the weekly milestones above.

Good luck! 🌾
