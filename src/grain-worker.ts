// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import type {
  GrainSettings,
  LabColor,
  GrainPoint,
  GrainLayer,
  GrainDensity,
  ProcessMessage,
  ProgressMessage,
  ResultMessage
} from './types';
import { 
  assertPositiveInteger, 
  assertObject, 
  assertImageData, 
  assertInRange,
  assert
} from './utils';

// File-level constants shared across methods
const RGB_MAX_VALUE = 255;

// Utility functions for grain generation
class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;

  constructor(width: number, height: number, settings: GrainSettings) {
    // Validate input parameters with custom assertions that provide type narrowing
    assertPositiveInteger(width, 'width');
    assertPositiveInteger(height, 'height');
    assertObject(settings, 'settings');

    // Type guard for settings object using custom assertion
    assert(
      this.isValidGrainSettings(settings),
      'Invalid grain settings provided',
      { settings, requiredProperties: ['iso', 'filmType', 'grainIntensity', 'upscaleFactor'] }
    );

    console.log(`Initializing GrainProcessor: ${width}x${height}, ISO: ${settings.iso}`);

    this.width = width;
    this.height = height;
    this.settings = settings;
    this.grainGenerator = new GrainGenerator(width, height, settings);
  }

  // Type guard for GrainSettings
  private isValidGrainSettings(settings: any): settings is GrainSettings {
    return settings &&
           typeof settings.iso === 'number' && settings.iso > 0 &&
           typeof settings.filmType === 'string' &&
           ['kodak', 'fuji', 'ilford'].includes(settings.filmType) &&
           typeof settings.grainIntensity === 'number' && settings.grainIntensity >= 0 &&
           typeof settings.upscaleFactor === 'number' && settings.upscaleFactor > 0;
  }

  // 2D Perlin noise implementation
  private noise(x: number, y: number): number {
    // Noise generation constants
    const NOISE_GRID_MASK = 255;
    const PERLIN_FADE_COEFFICIENT_A = 3;
    const PERLIN_FADE_COEFFICIENT_B = 2;
    
    const X = Math.floor(x) & NOISE_GRID_MASK;
    const Y = Math.floor(y) & NOISE_GRID_MASK;
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const a = this.grainGenerator.seededRandom(X + Y * 256);
    const b = this.grainGenerator.seededRandom(X + 1 + Y * 256);
    const c = this.grainGenerator.seededRandom(X + (Y + 1) * 256);
    const d = this.grainGenerator.seededRandom(X + 1 + (Y + 1) * 256);
    
    const u = x * x * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * x);
    const v = y * y * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * y);
    
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  // Convert RGB to LAB color space
  private rgbToLab(r: number, g: number, b: number): LabColor {
    // Validate input parameters with custom assertions
    assertInRange(r, 0, 255, 'r');
    assertInRange(g, 0, 255, 'g');
    assertInRange(b, 0, 255, 'b');

    // Color space conversion constants
    const RGB_GAMMA_THRESHOLD = 0.04045;
    const RGB_GAMMA_LINEAR_DIVISOR = 12.92;
    const RGB_GAMMA_POWER = 2.4;
    const RGB_GAMMA_OFFSET = 0.055;
    const RGB_GAMMA_MULTIPLIER = 1.055;

    const RGB_TO_XYZ_MATRIX = {
      x: { r: 0.4124564, g: 0.3575761, b: 0.1804375 },
      y: { r: 0.2126729, g: 0.7151522, b: 0.0721750 },
      z: { r: 0.0193339, g: 0.1191920, b: 0.9503041 }
    } as const;

    const D65_ILLUMINANT = {
      x: 0.95047,
      y: 1.00000,
      z: 1.08883
    } as const;

    const LAB_EPSILON = 0.008856;
    const LAB_KAPPA = 7.787;
    const LAB_DELTA = 16 / 116;
    const LAB_L_MULTIPLIER = 116;
    const LAB_L_OFFSET = 16;
    const LAB_A_MULTIPLIER = 500;
    const LAB_B_MULTIPLIER = 200;

    // Normalize RGB values
    r /= RGB_MAX_VALUE;
    g /= RGB_MAX_VALUE;
    b /= RGB_MAX_VALUE;

    // Apply gamma correction
    r = r > RGB_GAMMA_THRESHOLD ? Math.pow((r + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER, RGB_GAMMA_POWER) : r / RGB_GAMMA_LINEAR_DIVISOR;
    g = g > RGB_GAMMA_THRESHOLD ? Math.pow((g + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER, RGB_GAMMA_POWER) : g / RGB_GAMMA_LINEAR_DIVISOR;
    b = b > RGB_GAMMA_THRESHOLD ? Math.pow((b + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER, RGB_GAMMA_POWER) : b / RGB_GAMMA_LINEAR_DIVISOR;

    // Convert to XYZ
    let x = r * RGB_TO_XYZ_MATRIX.x.r + g * RGB_TO_XYZ_MATRIX.x.g + b * RGB_TO_XYZ_MATRIX.x.b;
    let y = r * RGB_TO_XYZ_MATRIX.y.r + g * RGB_TO_XYZ_MATRIX.y.g + b * RGB_TO_XYZ_MATRIX.y.b;
    let z = r * RGB_TO_XYZ_MATRIX.z.r + g * RGB_TO_XYZ_MATRIX.z.g + b * RGB_TO_XYZ_MATRIX.z.b;

    // Normalize for D65 illuminant
    x /= D65_ILLUMINANT.x;
    y /= D65_ILLUMINANT.y;
    z /= D65_ILLUMINANT.z;

    // Validate XYZ values with custom assertion
    assert(
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
      'Color space conversion produced invalid XYZ values',
      { 
        xyz: { x, y, z }, 
        originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
        finite: { x: Number.isFinite(x), y: Number.isFinite(y), z: Number.isFinite(z) }
      }
    );

    // Convert to LAB
    x = x > LAB_EPSILON ? Math.pow(x, 1/3) : (LAB_KAPPA * x + LAB_DELTA);
    y = y > LAB_EPSILON ? Math.pow(y, 1/3) : (LAB_KAPPA * y + LAB_DELTA);
    z = z > LAB_EPSILON ? Math.pow(z, 1/3) : (LAB_KAPPA * z + LAB_DELTA);

    const labResult = {
      l: LAB_L_MULTIPLIER * y - LAB_L_OFFSET,
      a: LAB_A_MULTIPLIER * (x - y),
      b: LAB_B_MULTIPLIER * (y - z)
    };

    // Validate LAB result with custom assertion
    assert(
      Number.isFinite(labResult.l) && Number.isFinite(labResult.a) && Number.isFinite(labResult.b),
      'Color space conversion produced invalid LAB values',
      { 
        lab: labResult, 
        originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
        finite: { 
          l: Number.isFinite(labResult.l), 
          a: Number.isFinite(labResult.a), 
          b: Number.isFinite(labResult.b) 
        }
      }
    );

    return labResult;
  }

  // Film characteristic curve (S-curve)
  private filmCurve(input: number): number {
    // Film curve constants
    const FILM_CURVE_CONTRAST = 1.2;
    const FILM_CURVE_MIDPOINT = 0.5;
    
    // Sigmoid-based film response curve
    return 1 / (1 + Math.exp(-FILM_CURVE_CONTRAST * (input - FILM_CURVE_MIDPOINT)));
  }

  // Generate grain structure
  private generateGrainStructure(): GrainPoint[] | GrainLayer[] {
    if (this.settings.useMultipleLayers) {
      return this.grainGenerator.generateMultipleGrainLayers();
    } else {
      return this.grainGenerator.generateGrainStructure();
    }
  }

  // Create spatial grid for grain acceleration (works with both single grains and layers)
  private createGrainGrid(grains: GrainPoint[] | GrainLayer[]): Map<string, GrainPoint[]> {
    if (Array.isArray(grains) && grains.length > 0 && 'layerType' in grains[0]) {
      // Multiple layers - flatten all grains
      const allGrains: GrainPoint[] = [];
      for (const layer of grains as GrainLayer[]) {
        allGrains.push(...layer.grains);
      }
      return this.grainGenerator.createGrainGrid(allGrains);
    } else {
      // Single layer
      return this.grainGenerator.createGrainGrid(grains as GrainPoint[]);
    }
  }

  // Apply grain to image
  public async processImage(imageData: ImageData): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data);
    const result = new ImageData(data, this.width, this.height);
    
    // Step 1: Generate grain structure
    postMessage({ type: 'progress', progress: 10, stage: 'Generating grain structure...' } as ProgressMessage);
    const grainStructure = this.generateGrainStructure();
    
    // Step 2: Create spatial acceleration grid
    postMessage({ type: 'progress', progress: 20, stage: 'Creating spatial grid...' } as ProgressMessage);
    const grainGrid = this.createGrainGrid(grainStructure);
    
    // Determine grid size for spatial lookup
    let maxGrainSize = 1;
    if (Array.isArray(grainStructure) && grainStructure.length > 0) {
      if ('layerType' in grainStructure[0]) {
        // Multiple layers
        const layers = grainStructure as GrainLayer[];
        maxGrainSize = Math.max(...layers.flatMap(layer => layer.grains.map(g => g.size)));
      } else {
        // Single layer
        const grains = grainStructure as GrainPoint[];
        maxGrainSize = Math.max(...grains.map(g => g.size));
      }
    }
    const gridSize = Math.max(8, Math.floor(maxGrainSize * 2));
    
    // Step 3: Process each pixel
    postMessage({ type: 'progress', progress: 30, stage: 'Processing pixels...' } as ProgressMessage);
    
    let grainEffectCount = 0;
    let totalPixels = 0;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIndex = (y * this.width + x) * 4;
        totalPixels++;
        
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        
        // Convert to LAB for better color processing
        const lab = this.rgbToLab(r, g, b);
        const luminance = lab.l / 100;
        
        // Initialize grain density
        let totalGrainDensity: GrainDensity = { r: 0, g: 0, b: 0 };
        let totalWeight = 0;
        
        // Get grains from nearby grid cells
        const pixelGridX = Math.floor(x / gridSize);
        const pixelGridY = Math.floor(y / gridSize);
        const nearbyGrains: GrainPoint[] = [];
        
        // Check surrounding grid cells (3x3 neighborhood)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const gridKey = `${pixelGridX + dx},${pixelGridY + dy}`;
            const cellGrains = grainGrid.get(gridKey);
            if (cellGrains) {
              nearbyGrains.push(...cellGrains);
            }
          }
        }
        
        // Process grain effects
        if (this.settings.useMultipleLayers && Array.isArray(grainStructure) && 'layerType' in grainStructure[0]) {
          // Multiple layers processing
          const layers = grainStructure as GrainLayer[];
          for (const layer of layers) {
            const layerGrains = layer.grains.filter(grain => nearbyGrains.includes(grain));
            for (const grain of layerGrains) {
              const distance = Math.sqrt(Math.pow(x - grain.x, 2) + Math.pow(y - grain.y, 2));
              
              if (distance < grain.size * 2) {
                const weight = Math.exp(-distance / grain.size);
                const grainStrength = this.calculateGrainStrength(luminance, grain, x, y);
                const grainDensity = this.calculateGrainDensity(grainStrength, grain, layer.intensityMultiplier);
                
                // Apply different grain characteristics per channel
                totalGrainDensity.r += grainDensity * weight * 0.7; // Red channel less affected
                totalGrainDensity.g += grainDensity * weight * 0.9; // Green channel moderate
                totalGrainDensity.b += grainDensity * weight * 1.0; // Blue channel most affected
                
                totalWeight += weight;
              }
            }
          }
        } else {
          // Single layer processing (backward compatibility)
          for (const grain of nearbyGrains) {
            const distance = Math.sqrt(Math.pow(x - grain.x, 2) + Math.pow(y - grain.y, 2));
            
            if (distance < grain.size * 2) {
              const weight = Math.exp(-distance / grain.size);
              const grainStrength = this.calculateGrainStrength(luminance, grain, x, y);
              
              // Density-based compositing
              const grainDensity = this.calculateGrainDensity(grainStrength, grain);
              totalGrainDensity.r += grainDensity * weight * 0.7;
              totalGrainDensity.g += grainDensity * weight * 0.9;
              totalGrainDensity.b += grainDensity * weight * 1.0;
              
              totalWeight += weight;
            }
          }
        }
        
        // Apply final compositing
        if (totalWeight > 0) {
          grainEffectCount++;
          
          // Normalize by total weight
          totalGrainDensity.r /= totalWeight;
          totalGrainDensity.g /= totalWeight;
          totalGrainDensity.b /= totalWeight;
          
          let finalColor: [number, number, number];
          
          // Use density-based compositing (physically accurate)
          finalColor = this.applySimpleDensityCompositing([r, g, b], totalGrainDensity);
          
          result.data[pixelIndex] = finalColor[0];
          result.data[pixelIndex + 1] = finalColor[1];
          result.data[pixelIndex + 2] = finalColor[2];
          result.data[pixelIndex + 3] = a;
        }
      }
      
      // Update progress periodically
      if (y % Math.floor(this.height / 10) === 0) {
        const progress = 30 + (y / this.height) * 60;
        postMessage({ 
          type: 'progress', 
          progress, 
          stage: `Processing pixels... ${Math.floor(progress)}%` 
        } as ProgressMessage);
      }
    }
    
    console.log(`=== Processing Summary ===`);
    console.log(`Total pixels processed: ${totalPixels}`);
    console.log(`Pixels with grain effect: ${grainEffectCount}`);
    console.log(`Grain effect coverage: ${(grainEffectCount / totalPixels * 100).toFixed(2)}%`);
    console.log(`Processing mode: ${this.settings.useMultipleLayers ? 'Multiple Layers' : 'Single Layer'}, Density Model`);
    
    postMessage({ type: 'progress', progress: 100, stage: 'Complete!' } as ProgressMessage);
    return result;
  }

  // Calculate grain strength based on luminance and grain properties
  private calculateGrainStrength(luminance: number, grain: GrainPoint, x: number, y: number): number {
    // Grain strength calculation constants
    const SHADOW_LUMINANCE_THRESHOLD = 0.5;
    const SHADOW_STRENGTH_BASE = 1.2;
    const SHADOW_STRENGTH_MULTIPLIER = 0.6;
    const HIGHLIGHT_STRENGTH_BASE = 0.6;
    const HIGHLIGHT_STRENGTH_MULTIPLIER = 0.8;

    // Noise texture generation constants
    const NOISE_SCALE_FINE = 0.15;
    const NOISE_SCALE_MEDIUM = 0.08;
    const NOISE_SCALE_COARSE = 0.03;
    const NOISE_WEIGHT_FINE = 0.6;
    const NOISE_WEIGHT_MEDIUM = 0.3;
    const NOISE_WEIGHT_COARSE = 0.1;

    // Grain is most visible in mid-tones and shadows
    const luminanceResponse = luminance < SHADOW_LUMINANCE_THRESHOLD 
      ? SHADOW_STRENGTH_BASE - luminance * SHADOW_STRENGTH_MULTIPLIER  // Stronger in shadows
      : HIGHLIGHT_STRENGTH_BASE + (1.0 - luminance) * HIGHLIGHT_STRENGTH_MULTIPLIER; // Moderate in highlights
    
    // Add noise for grain texture with multiple octaves
    const noiseValue = this.noise(x * NOISE_SCALE_FINE, y * NOISE_SCALE_FINE) * NOISE_WEIGHT_FINE + 
                      this.noise(x * NOISE_SCALE_MEDIUM, y * NOISE_SCALE_MEDIUM) * NOISE_WEIGHT_MEDIUM + 
                      this.noise(x * NOISE_SCALE_COARSE, y * NOISE_SCALE_COARSE) * NOISE_WEIGHT_COARSE;
    
    // Film characteristic curve
    const filmResponse = this.filmCurve(luminance);
    
    // Combine all factors
    const baseStrength = grain.sensitivity * luminanceResponse * filmResponse;
    const finalStrength = baseStrength * (0.3 + Math.abs(noiseValue) * 0.7);
    
    // Apply grain shape variation
    const shapeModifier = 0.7 + grain.shape * 0.6;
    
    return finalStrength * shapeModifier * 0.5; // Increased multiplier for better visibility
  }

  // Calculate grain density for density-based compositing
  private calculateGrainDensity(grainStrength: number, grain: GrainPoint, layerMultiplier: number = 1.0): number {
    // Convert grain strength to optical density
    const baseDensity = grainStrength * grain.sensitivity * layerMultiplier;
    
    // Apply film characteristic curve for density response
    const densityResponse = this.filmCurve(baseDensity);
    
    // Scale by grain intensity setting
    return densityResponse * this.settings.grainIntensity * 0.3; // Reduced multiplier for density model
  }

  // Apply simplified multiplicative compositing
  private applySimpleDensityCompositing(originalColor: [number, number, number], grainDensity: GrainDensity): [number, number, number] {
    const [r, g, b] = originalColor;
    
    // Simplified model: final = original * (1 - density)
    return [
      r * (1 - Math.min(0.8, grainDensity.r)), // Clamp density to prevent full black
      g * (1 - Math.min(0.8, grainDensity.g)),
      b * (1 - Math.min(0.8, grainDensity.b))
    ];
  }
}

// Worker message handler
self.onmessage = async function(e: MessageEvent<ProcessMessage>) {
  try {
    // Validate message structure with custom assertion
    assertObject(e.data, 'worker message data');

    const { type, imageData, settings } = e.data;
    
    // Validate message type
    assert(
      type === 'process',
      'Worker received unknown message type',
      { type, expectedType: 'process' }
    );

    // Validate imageData and settings with custom assertions
    assertImageData(imageData, 'worker imageData');
    assertObject(settings, 'worker settings');

    console.log(`Worker processing image: ${imageData.width}x${imageData.height}, ISO: ${settings.iso}`);

    const processor = new GrainProcessor(imageData.width, imageData.height, settings);
    const result = await processor.processImage(imageData);
    
    // Validate result with custom assertion
    assertImageData(result, 'processing result');

    postMessage({ type: 'result', imageData: result } as ResultMessage);
  } catch (error) {
    console.error('Worker processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during processing';
    
    // Log additional error context for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    postMessage({ type: 'error', error: errorMessage });
  }
};

export {};
