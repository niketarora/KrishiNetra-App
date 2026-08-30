from pathlib import Path
from krishinetra_ml import ExperimentalSoilMoistureModel, ExperimentalFeatures

def run_tests():
    model_path = Path('models/agriculture_baseline_xgboost_v1.json')
    model = ExperimentalSoilMoistureModel.load(model_path)
    print(f"Loaded model version: {model.metadata.get('model_version')}")
    print(f"Production ready: {model.metadata.get('production_ready')}")
    
    scenarios = [
        ("High Rain / High Humidity Rice", ExperimentalFeatures(
            ndvi=0.65, savi=0.55, temperature_c=25.0, humidity_percent=85.0,
            rainfall=120.0, wind_speed=2.5, soil_ph=6.8, organic_matter=3.5,
            leaf_area_index=3.2, water_flow=50.0, elevation=250.0,
            spatial_resolution=10.0, crop_growth_stage=3, crop_type='rice'
        )),
        ("Hot / Arid Drought Wheat", ExperimentalFeatures(
            ndvi=0.25, savi=0.20, temperature_c=42.0, humidity_percent=20.0,
            rainfall=0.0, wind_speed=15.0, soil_ph=8.0, organic_matter=0.8,
            leaf_area_index=0.8, water_flow=0.0, elevation=600.0,
            spatial_resolution=10.0, crop_growth_stage=1, crop_type='wheat'
        )),
        ("Moderate Temperate Maize", ExperimentalFeatures(
            ndvi=0.50, savi=0.42, temperature_c=30.0, humidity_percent=55.0,
            rainfall=30.0, wind_speed=5.0, soil_ph=7.0, organic_matter=2.0,
            leaf_area_index=2.0, water_flow=15.0, elevation=450.0,
            spatial_resolution=10.0, crop_growth_stage=2, crop_type='maize'
        ))
    ]
    
    for label, feat in scenarios:
        pred = model.predict(feat)
        print(f"\n--- {label} ---")
        print(f"  Soil Moisture: {pred.soil_moisture_percent:.2f}%")
        print(f"  Category: {pred.category}")
        print(f"  Experimental: {pred.experimental}")
        print(f"  Warning: {pred.warning}")
        print(f"  Recommendation: {pred.recommendation}")

if __name__ == '__main__':
    run_tests()
