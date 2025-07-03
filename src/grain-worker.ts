// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import type {
  GrainSettings,
  LabColor,
  RgbEffect,
  GrainPoint,
  GrainLayer,
  GrainDensity,
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
              
              if (this.settings.useDensityModel) {
                // Density-based compositing
                const grainDensity = this.calculateGrainDensity(grainStrength, grain);
                totalGrainDensity.r += grainDensity * weight * 0.7;
                totalGrainDensity.g += grainDensity * weight * 0.9;
                totalGrainDensity.b += grainDensity * weight * 1.0;
              } else {
                // Legacy additive blending for backward compatibility
                const grainEffect = grainStrength * weight * this.settings.grainIntensity;
                totalGrainDensity.r += grainEffect * 0.7;
                totalGrainDensity.g += grainEffect * 0.9;
                totalGrainDensity.b += grainEffect * 1.0;
              }
              
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
          
          if (this.settings.useDensityModel || this.settings.useMultipleLayers) {
            // Use density-based compositing (physically accurate)
            finalColor = this.applySimpleDensityCompositing([r, g, b], totalGrainDensity);
          } else {
            // Legacy additive blending
            finalColor = [
              Math.max(0, Math.min(255, r + totalGrainDensity.r * 255)),
              Math.max(0, Math.min(255, g + totalGrainDensity.g * 255)),
              Math.max(0, Math.min(255, b + totalGrainDensity.b * 255))
            ];
          }
          
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
    console.log(`Processing mode: ${this.settings.useMultipleLayers ? 'Multiple Layers' : 'Single Layer'}, ${this.settings.useDensityModel ? 'Density Model' : 'Additive Model'}`);
    
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

  // Calculate grain density for density-based compositing
  private calculateGrainDensity(grainStrength: number, grain: GrainPoint, layerMultiplier: number = 1.0): number {
    // Convert grain strength to optical density
    const baseDensity = grainStrength * grain.sensitivity * layerMultiplier;
    
    // Apply film characteristic curve for density response
    const densityResponse = this.filmCurve(baseDensity);
    
    // Scale by grain intensity setting
    return densityResponse * this.settings.grainIntensity * 0.3; // Reduced multiplier for density model
  }

  // Apply density-based compositing using Beer-Lambert law
  private applyDensityCompositing(originalColor: [number, number, number], grainDensity: GrainDensity): [number, number, number] {
    const [r, g, b] = originalColor;
    
    // Calculate light transmission using Beer-Lambert law: I = I0 * exp(-density)
    const transmissionR = Math.exp(-grainDensity.r);
    const transmissionG = Math.exp(-grainDensity.g);
    const transmissionB = Math.exp(-grainDensity.b);
    
    return [
      r * transmissionR,
      g * transmissionG,
      b * transmissionB
    ];
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
