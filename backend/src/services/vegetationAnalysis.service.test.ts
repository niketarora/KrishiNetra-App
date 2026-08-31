import { describe, expect, it } from '@jest/globals';
import {
  analyzeFieldVegetation,
  calculateVariFromRgb,
} from './vegetationAnalysis.service.js';

describe('vegetationAnalysis.service', () => {
  it('calculates VARI correctly from RGB components', () => {
    // VARI = (G - R) / (G + R - B)
    // R=50, G=150, B=50 -> (150-50) / (150+50-50) = 100 / 150 = 0.6667
    const vari = calculateVariFromRgb(50, 150, 50);
    expect(vari).toBeCloseTo(0.6667, 3);
  });

  it('handles denominator zero in VARI calculation safely', () => {
    const vari = calculateVariFromRgb(0, 0, 0);
    expect(vari).toBe(0);
  });

  it('derives calibrated vegetation indices from growth stage', () => {
    const vegetative = analyzeFieldVegetation({ cropType: 'wheat', growthStage: 2 });
    expect(vegetative.ndvi).toBe(0.58);
    expect(vegetative.savi).toBe(0.43);
    expect(vegetative.leaf_area_index).toBe(2.1);
    expect(vegetative.spatial_resolution).toBe(10.0);

    const flowering = analyzeFieldVegetation({ cropType: 'rice', growthStage: 3 });
    expect(flowering.ndvi).toBe(0.74);
    expect(flowering.leaf_area_index).toBeGreaterThan(vegetative.leaf_area_index);
  });

  it('derives vegetation indices from RGB image sample', () => {
    const result = analyzeFieldVegetation({
      cropType: 'maize',
      growthStage: 2,
      rgbSample: { r: 60, g: 140, b: 50 },
    });

    expect(result.method).toBe('field_image_vari');
    expect(result.ndvi).toBeGreaterThan(0.5);
    expect(result.savi).toBeGreaterThan(0.3);
    expect(result.leaf_area_index).toBeGreaterThan(1.0);
  });
});
