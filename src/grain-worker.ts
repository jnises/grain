// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import type {
  GrainSettings,
  LabColor,
  RgbEffect,
  GrainPoint,
  ProcessMessage,
  ProgressMessage,
  ResultMessage
} from './types';

// Utility functions for grain generation
class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;

  constructor(width: number, height: number, settings: GrainSettings) {
    this.width = width;
    this.height = height;
    this.settings = settings;
    this.grainGenerator = new GrainGenerator(width, height, settings);
  }

  // Generate pseudorandom number with seed
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 2D Perlin noise implementation
  private noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const a = this.seededRandom(X + Y * 256);
    const b = this.seededRandom(X + 1 + Y * 256);
    const c = this.seededRandom(X + (Y + 1) * 256);
    const d = this.seededRandom(X + 1 + (Y + 1) * 256);
    
    const u = x * x * (3 - 2 * x);
    const v = y * y * (3 - 2 * y);
    
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  // Convert RGB to LAB color space
  private rgbToLab(r: number, g: number, b: number): LabColor {
    // Normalize RGB values
    r /= 255;
    g /= 255;
    b /= 255;

    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ
    let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    // Normalize for D65 illuminant
    x /= 0.95047;
    y /= 1.00000;
    z /= 1.08883;

    // Convert to LAB
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

    return {
      l: 116 * y - 16,
      a: 500 * (x - y),
      b: 200 * (y - z)
    };
  }

  // Film characteristic curve (S-curve)
  private filmCurve(input: number): number {
    // Sigmoid-based film response curve
    const contrast = 1.2;
    const midpoint = 0.5;
    return 1 / (1 + Math.exp(-contrast * (input - midpoint)));
  }

  // Generate grain structure
  private generateGrainStructure(): GrainPoint[] {
    return this.grainGenerator.generateGrainStructure();
  }

  // Create spatial grid for grain acceleration
  private createGrainGrid(grains: GrainPoint[]): Map<string, GrainPoint[]> {
    return this.grainGenerator.createGrainGrid(grains);
  }

  // Apply grain to image
  public async processImage(imageData: ImageData): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data);
    const result = new ImageData(data, this.width, this.height);
    
    // Step 1: Generate grain structure
    postMessage({ type: 'progress', progress: 10, stage: 'Generating grain structure...' } as ProgressMessage);
    const grains = this.generateGrainStructure();
    
    // Step 2: Create spatial acceleration grid
    postMessage({ type: 'progress', progress: 20, stage: 'Creating spatial grid...' } as ProgressMessage);
    const grainGrid = this.createGrainGrid(grains);
    const maxGrainSize = Math.max(...grains.map(g => g.size));
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
        
        // Calculate grain effect for this pixel
        let grainEffect: RgbEffect = { r: 0, g: 0, b: 0 };
        let totalWeight = 0;
        
        // Get grains from nearby grid cells only
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
        
        // Debug: Sample a few pixels to see grain processing
        const shouldDebug = (x === 100 && y === 100) || (x === 200 && y === 150) || (x === 300 && y === 200);
        if (shouldDebug) {
          console.log(`Pixel (${x},${y}): Found ${nearbyGrains.length} nearby grains in grid (${pixelGridX},${pixelGridY})`);
        }
        
        // Process only nearby grains
        for (const grain of nearbyGrains) {
          const distance = Math.sqrt(
            Math.pow(x - grain.x, 2) + Math.pow(y - grain.y, 2)
          );
          
          if (distance < grain.size * 2) {
            // Calculate grain influence based on distance and grain properties
            const weight = Math.exp(-distance / grain.size);
            const grainStrength = this.calculateGrainStrength(luminance, grain, x, y);
            
            // Apply different grain characteristics per channel
            grainEffect.r += grainStrength * weight * 0.7; // Red channel less affected
            grainEffect.g += grainStrength * weight * 0.9; // Green channel moderate
            grainEffect.b += grainStrength * weight * 1.0; // Blue channel most affected
            
            totalWeight += weight;
            
            if (shouldDebug) {
              console.log(`  Grain at (${grain.x.toFixed(1)},${grain.y.toFixed(1)}): dist=${distance.toFixed(2)}, size=${grain.size.toFixed(2)}, strength=${grainStrength.toFixed(4)}, weight=${weight.toFixed(4)}`);
            }
          }
        }
        
        if (totalWeight > 0) {
          grainEffectCount++;
          grainEffect.r /= totalWeight;
          grainEffect.g /= totalWeight;
          grainEffect.b /= totalWeight;
          
          // Apply grain intensity setting
          const intensity = this.settings.grainIntensity;
          grainEffect.r *= intensity;
          grainEffect.g *= intensity;
          grainEffect.b *= intensity;
          
          // Blend grain effect with original pixel
          result.data[pixelIndex] = Math.max(0, Math.min(255, r + grainEffect.r * 255));
          result.data[pixelIndex + 1] = Math.max(0, Math.min(255, g + grainEffect.g * 255));
          result.data[pixelIndex + 2] = Math.max(0, Math.min(255, b + grainEffect.b * 255));
          result.data[pixelIndex + 3] = a;
          
          if (shouldDebug) {
            console.log(`  Final effect: r=${grainEffect.r.toFixed(4)}, g=${grainEffect.g.toFixed(4)}, b=${grainEffect.b.toFixed(4)}`);
          }
        } else if (shouldDebug) {
          console.log(`  No grain effect applied`);
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
    
    postMessage({ type: 'progress', progress: 100, stage: 'Complete!' } as ProgressMessage);
    return result;
  }

  // Calculate grain strength based on luminance and grain properties
  private calculateGrainStrength(luminance: number, grain: GrainPoint, x: number, y: number): number {
    // Grain is most visible in mid-tones and shadows
    const luminanceResponse = luminance < 0.5 
      ? 1.2 - luminance * 0.6  // Stronger in shadows
      : 0.6 + (1.0 - luminance) * 0.8; // Moderate in highlights
    
    // Add noise for grain texture with multiple octaves
    const noiseValue = this.noise(x * 0.15, y * 0.15) * 0.6 + 
                      this.noise(x * 0.08, y * 0.08) * 0.3 + 
                      this.noise(x * 0.03, y * 0.03) * 0.1;
    
    // Film characteristic curve
    const filmResponse = this.filmCurve(luminance);
    
    // Combine all factors
    const baseStrength = grain.sensitivity * luminanceResponse * filmResponse;
    const finalStrength = baseStrength * (0.3 + Math.abs(noiseValue) * 0.7);
    
    // Apply grain shape variation
    const shapeModifier = 0.7 + grain.shape * 0.6;
    
    return finalStrength * shapeModifier * 0.5; // Increased multiplier for better visibility
  }
}

// Worker message handler
self.onmessage = async function(e: MessageEvent<ProcessMessage>) {
  const { type, imageData, settings } = e.data;
  
  if (type === 'process') {
    try {
      const processor = new GrainProcessor(imageData.width, imageData.height, settings);
      const result = await processor.processImage(imageData);
      
      postMessage({ type: 'result', imageData: result } as ResultMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      postMessage({ type: 'error', error: errorMessage });
    }
  }
};

export {};
