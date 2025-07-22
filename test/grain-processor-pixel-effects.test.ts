import { GrainProcessor } from '../src/grain-processor';
import { GrainSettings, GrainPoint } from '../src/types';
import { SpatialLookupGrid } from '../src/spatial-lookup-grid';
import {
  GrainIntrinsicDensityMap,
  createGrainIntrinsicDensity,
} from '../src/types';

// Helper function to create test settings
const createTestSettings = (iso: number): GrainSettings => ({
  iso,
  filmType: 'kodak',
});

// Test subclass to access protected processPixelEffects method
class TestableGrainProcessor extends GrainProcessor {
  public testProcessPixelEffects(
    grainGrid: SpatialLookupGrid,
    grainIntrinsicDensityMap: GrainIntrinsicDensityMap,
    outputWidth: number,
    outputHeight: number
  ) {
    return this.processPixelEffects(
      grainGrid,
      grainIntrinsicDensityMap,
      outputWidth,
      outputHeight
    );
  }
}

describe('GrainProcessor processPixelEffects', () => {
  describe('Uniform grain distribution tests', () => {
    it('should produce uniform output with uniform dense grid grains without anisotropic effects', () => {
      const width = 64;
      const height = 64;
      const settings: GrainSettings = createTestSettings(100);

      // Create uniform grains on a dense grid (every 4 pixels)
      const uniformGrains: GrainPoint[] = [];
      const grainSpacing = 4;
      const uniformSize = 2.0;
      const uniformSensitivity = 0.5;
      const uniformThreshold = 0.1;

      for (let y = grainSpacing; y < height; y += grainSpacing) {
        for (let x = grainSpacing; x < width; x += grainSpacing) {
          uniformGrains.push({
            x,
            y,
            size: uniformSize,
            sensitivity: uniformSensitivity,
            developmentThreshold: uniformThreshold,
          });
        }
      }

      // Create spatial lookup grid
      const grainGrid = new SpatialLookupGrid(width, height, uniformGrains);

      // Create uniform grain density map
      const grainIntrinsicDensityMap: GrainIntrinsicDensityMap = new Map();
      const uniformDensity = 0.5; // Moderate density
      for (const grain of uniformGrains) {
        grainIntrinsicDensityMap.set(
          grain,
          createGrainIntrinsicDensity(uniformDensity)
        );
      }

      // Create processor and test the protected method
      const processor = new TestableGrainProcessor(width, height, settings);
      const result = processor.testProcessPixelEffects(
        grainGrid,
        grainIntrinsicDensityMap,
        width,
        height
      );

      // Analyze the output for uniformity and anisotropic effects
      const outputData = result.resultFloatData;
      const pixelValues: number[] = [];

      // Collect all pixel values (R channel, since RGB are identical)
      for (let i = 0; i < outputData.length; i += 4) {
        pixelValues.push(outputData[i]);
      }

      // Calculate basic statistics
      const mean =
        pixelValues.reduce((sum, val) => sum + val, 0) / pixelValues.length;
      const variance =
        pixelValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
        pixelValues.length;
      const stdDev = Math.sqrt(variance);

      // Find min and max values
      let minValue = pixelValues[0];
      let maxValue = pixelValues[0];
      for (let i = 1; i < pixelValues.length; i++) {
        if (pixelValues[i] < minValue) minValue = pixelValues[i];
        if (pixelValues[i] > maxValue) maxValue = pixelValues[i];
      }

      console.log(
        `Uniformity Analysis - Mean: ${mean.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}, Min: ${minValue.toFixed(4)}, Max: ${maxValue.toFixed(4)}`
      );

      // Test for reasonable uniformity
      // With uniform grains and densities, output should be relatively uniform
      expect(stdDev).toBeLessThan(0.2); // Standard deviation should be reasonably low

      // Test for anisotropic effects (stripes) by analyzing horizontal and vertical patterns
      const horizontalVariations = analyzeHorizontalVariations(
        outputData,
        width,
        height
      );
      const verticalVariations = analyzeVerticalVariations(
        outputData,
        width,
        height
      );

      console.log(
        `Anisotropy Analysis - Horizontal variation: ${horizontalVariations.toFixed(4)}, Vertical variation: ${verticalVariations.toFixed(4)}`
      );

      // Both horizontal and vertical variations should be similar (no strong directional bias)
      const anisotropyRatio =
        Math.max(horizontalVariations, verticalVariations) /
        Math.min(horizontalVariations, verticalVariations);
      expect(anisotropyRatio).toBeLessThan(2.0); // Ratio should not exceed 2:1

      // Test that grains actually affected the output
      expect(result.grainEffectCount).toBeGreaterThan(0);
      expect(result.processedPixels).toBe(width * height);
    });

    it('should handle empty grain density map gracefully', () => {
      const width = 32;
      const height = 32;
      const settings: GrainSettings = createTestSettings(100);

      // Create empty grain arrays
      const emptyGrains: GrainPoint[] = [];
      const grainGrid = new SpatialLookupGrid(width, height, emptyGrains);
      const emptyDensityMap: GrainIntrinsicDensityMap = new Map();

      const processor = new TestableGrainProcessor(width, height, settings);
      const result = processor.testProcessPixelEffects(
        grainGrid,
        emptyDensityMap,
        width,
        height
      );

      // With no grains, film is completely transparent, resulting in maximum light transmission
      // which causes maximum paper exposure, resulting in black output (darkroom printing behavior)
      const outputData = result.resultFloatData;

      // Check that all pixels are black (0.0) due to clear film behavior
      for (let i = 0; i < outputData.length; i += 4) {
        expect(outputData[i]).toBeCloseTo(0.0, 6); // R
        expect(outputData[i + 1]).toBeCloseTo(0.0, 6); // G
        expect(outputData[i + 2]).toBeCloseTo(0.0, 6); // B
        expect(outputData[i + 3]).toBeCloseTo(1.0, 6); // A (alpha should remain 1.0)
      }

      expect(result.grainEffectCount).toBe(0);
      expect(result.processedPixels).toBe(width * height);
    });

    it('should handle varying grain densities appropriately', () => {
      const width = 32;
      const height = 32;
      const settings: GrainSettings = createTestSettings(100);

      // Create grains with varying densities
      const grains: GrainPoint[] = [
        { x: 8, y: 8, size: 2.0, sensitivity: 0.5, developmentThreshold: 0.1 },
        { x: 24, y: 8, size: 2.0, sensitivity: 0.5, developmentThreshold: 0.1 },
        { x: 8, y: 24, size: 2.0, sensitivity: 0.5, developmentThreshold: 0.1 },
        {
          x: 24,
          y: 24,
          size: 2.0,
          sensitivity: 0.5,
          developmentThreshold: 0.1,
        },
      ];

      const grainGrid = new SpatialLookupGrid(width, height, grains);
      const densityMap: GrainIntrinsicDensityMap = new Map();

      // Assign different densities to grains
      densityMap.set(grains[0], createGrainIntrinsicDensity(0.1)); // Low density
      densityMap.set(grains[1], createGrainIntrinsicDensity(0.5)); // Medium density
      densityMap.set(grains[2], createGrainIntrinsicDensity(0.9)); // High density
      densityMap.set(grains[3], createGrainIntrinsicDensity(0.5)); // Medium density

      const processor = new TestableGrainProcessor(width, height, settings);
      const result = processor.testProcessPixelEffects(
        grainGrid,
        densityMap,
        width,
        height
      );

      // Should have some grain effects
      expect(result.grainEffectCount).toBeGreaterThan(0);
      expect(result.processedPixels).toBe(width * height);

      // Output should vary based on grain density differences
      const outputData = result.resultFloatData;
      const pixelValues: number[] = [];
      for (let i = 0; i < outputData.length; i += 4) {
        pixelValues.push(outputData[i]);
      }

      const uniqueValues = new Set(
        pixelValues.map((v) => Math.round(v * 1000) / 1000)
      );
      expect(uniqueValues.size).toBeGreaterThan(1); // Should have variation due to different grain densities
    });
  });
});

/**
 * Analyze horizontal variations to detect stripe patterns
 * Calculates the average variation between adjacent rows
 */
function analyzeHorizontalVariations(
  data: Float32Array,
  width: number,
  height: number
): number {
  let totalVariation = 0;
  let comparisons = 0;

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const currentPixel = data[(y * width + x) * 4]; // R channel
      const nextRowPixel = data[((y + 1) * width + x) * 4]; // R channel of pixel below
      totalVariation += Math.abs(currentPixel - nextRowPixel);
      comparisons++;
    }
  }

  return comparisons > 0 ? totalVariation / comparisons : 0;
}

/**
 * Analyze vertical variations to detect stripe patterns
 * Calculates the average variation between adjacent columns
 */
function analyzeVerticalVariations(
  data: Float32Array,
  width: number,
  height: number
): number {
  let totalVariation = 0;
  let comparisons = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const currentPixel = data[(y * width + x) * 4]; // R channel
      const nextColPixel = data[(y * width + (x + 1)) * 4]; // R channel of pixel to the right
      totalVariation += Math.abs(currentPixel - nextColPixel);
      comparisons++;
    }
  }

  return comparisons > 0 ? totalVariation / comparisons : 0;
}
