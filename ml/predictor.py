"""
Simple rule-based predictors (no ML models needed for prototype)
"""

from datetime import date


def predict_crop_by_district(district: str) -> dict:
    """
    Predict crop based on district
    
    This is a simple rule-based approach for MVP.
    Later: replace with actual ML model.
    """
    crops_by_district = {
        # Maharashtra
        'Pune': 'wheat',
        'Nashik': 'grapes',
        'Aurangabad': 'cotton',
        'Solapur': 'sugarcane',
        'Sangli': 'onion',
        # Add more as needed
    }
    
    crop = crops_by_district.get(district, 'wheat')
    
    return {
        'crop': crop,
        'confidence': 0.55,  # Honest: we're guessing from district
        'source': 'district_rule',
        'note': 'Prototype: Based on location. Real predictions coming in Phase 3.2'
    }


def predict_soil_moisture(temperature_c: float, rainfall_mm_7d: float) -> dict:
    """
    Predict soil moisture based on weather
    
    Simple rule-based logic:
    - Recent rain → high moisture
    - High temp → low moisture
    - Else → moderate
    """
    
    if rainfall_mm_7d > 50:
        moisture = 75
        category = 'wet'
        recommendation = 'wait_5_7_days'
    elif rainfall_mm_7d > 20:
        moisture = 60
        category = 'good'
        recommendation = 'check_in_2_3_days'
    elif temperature_c > 35:
        moisture = 35
        category = 'dry'
        recommendation = 'irrigate_soon'
    elif temperature_c > 28:
        moisture = 50
        category = 'moderate'
        recommendation = 'monitor'
    else:
        moisture = 65
        category = 'good'
        recommendation = 'wait_3_5_days'
    
    return {
        'soil_moisture_percent': moisture,
        'category': category,
        'irrigation_recommendation': recommendation,
        'confidence': 0.50,  # Honest: weather-based guess
        'source': 'weather_rules',
        'note': 'Prototype: Based on temperature + rainfall. Real SAR data coming later.'
    }


def predict_growth_stage(crop: str, sown_on_date: date) -> dict:
    """
    Predict growth stage from days since sowing
    
    Typical crop durations (days):
    - Wheat: 150
    - Rice: 130
    - Cotton: 180
    - Maize: 140
    """
    
    days_since_sow = (date.today() - sown_on_date).days
    
    crop_durations = {
        'wheat': 150,
        'rice': 130,
        'maize': 140,
        'cotton': 180,
        'sugarcane': 365,
        'grapes': 365,
        'onion': 120,
    }
    
    total_duration = crop_durations.get(crop.lower(), 150)
    
    # Stages as % of total duration
    if days_since_sow < total_duration * 0.15:
        stage = 'germination'
        days_to_harvest = total_duration - days_since_sow
    elif days_since_sow < total_duration * 0.4:
        stage = 'vegetative'
        days_to_harvest = total_duration - days_since_sow
    elif days_since_sow < total_duration * 0.7:
        stage = 'flowering'
        days_to_harvest = total_duration - days_since_sow
    elif days_since_sow < total_duration * 0.9:
        stage = 'grain_filling'
        days_to_harvest = total_duration - days_since_sow
    else:
        stage = 'maturity'
        days_to_harvest = max(0, total_duration - days_since_sow)
    
    return {
        'growth_stage': stage,
        'days_since_sowing': days_since_sow,
        'estimated_days_to_harvest': max(0, days_to_harvest),
        'crop': crop,
        'confidence': 0.65,  # Honest: depends on actual variety
        'source': 'days_based_rule',
        'note': f'Prototype: Assuming {total_duration}-day duration for {crop}. Real phenology model coming later.'
    }


# Example usage
if __name__ == '__main__':
    # Test crop prediction
    crop_pred = predict_crop_by_district('Pune')
    print("Crop:", crop_pred)
    
    # Test soil moisture
    soil_pred = predict_soil_moisture(temperature_c=32, rainfall_mm_7d=10)
    print("Soil:", soil_pred)
    
    # Test growth stage
    growth_pred = predict_growth_stage('wheat', date(2024, 10, 1))
    print("Growth:", growth_pred)
