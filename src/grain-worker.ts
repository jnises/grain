// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

interface GrainSettings {
  iso: number;
  filmType: 'kodak' | 'fuji' | 'ilford';
  grainIntensity: number;
  upscaleFactor: number;
}

interface Point2D {
  x: number;
  y: number;
}

interface LabColor {
  l: number;
  a: number;
  b: number;
}

interface RgbEffect {
  r: number;
  g: number;
  b: number;
}

interface GrainPoint {
  x: number;
  y: number;
  size: number;
  sensitivity: number;
  shape: number;
}

interface ProcessMessage {
  type: 'process';
  imageData: ImageData;
  settings: GrainSettings;
}

interface ProgressMessage {
  type: 'progress';
  progress: number;
  stage: string;
}

interface ResultMessage {
  type: 'result';
  imageData: ImageData;
}

// Utility functions for grain generation
class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;

  constructor(width: number, height: number, settings: GrainSettings) {
    this.width = width;
    this.height = height;
    this.settings = settings;
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

  // Generate Poisson disk sampling for grain placement
  private generatePoissonDiskSampling(minDistance: number, maxSamples: number): Point2D[] {
    const points: Point2D[] = [];
    const cellSize = minDistance / Math.sqrt(2);
    const gridWidth = Math.ceil(this.width / cellSize);
    const gridHeight = Math.ceil(this.height / cellSize);
    const grid: Array<Array<Point2D | null>> = Array(gridWidth).fill(null).map(() => Array(gridHeight).fill(null));
    
    // Start with random point
    const initialPoint = {
      x: Math.random() * this.width,
      y: Math.random() * this.height
    };
    points.push(initialPoint);
    
    const activeList = [initialPoint];
    grid[Math.floor(initialPoint.x / cellSize)][Math.floor(initialPoint.y / cellSize)] = initialPoint;
    
    while (activeList.length > 0 && points.length < maxSamples) {
      const randomIndex = Math.floor(Math.random() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;
      
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = minDistance + Math.random() * minDistance;
        const newPoint = {
          x: point.x + Math.cos(angle) * radius,
          y: point.y + Math.sin(angle) * radius
        };
        
        if (newPoint.x >= 0 && newPoint.x < this.width && 
            newPoint.y >= 0 && newPoint.y < this.height) {
          
          const gridX = Math.floor(newPoint.x / cellSize);
          const gridY = Math.floor(newPoint.y / cellSize);
          
          let valid = true;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const checkX = gridX + dx;
              const checkY = gridY + dy;
              if (checkX >= 0 && checkX < gridWidth && 
                  checkY >= 0 && checkY < gridHeight && 
                  grid[checkX][checkY]) {
                const existingPoint = grid[checkX][checkY]!;
                const distance = Math.sqrt(
                  Math.pow(newPoint.x - existingPoint.x, 2) + 
                  Math.pow(newPoint.y - existingPoint.y, 2)
                );
                if (distance < minDistance) {
                  valid = false;
                  break;
                }
              }
            }
            if (!valid) break;
          }
          
          if (valid) {
            points.push(newPoint);
            activeList.push(newPoint);
            grid[gridX][gridY] = newPoint;
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        activeList.splice(randomIndex, 1);
      }
    }
    
    return points;
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
    const baseGrainSize = Math.max(1, this.settings.iso / 100);
    const grainDensity = Math.min(10000, this.settings.iso * 2);
    const minDistance = baseGrainSize * 0.5;
    
    const grainPoints = this.generatePoissonDiskSampling(minDistance, grainDensity);
    
    return grainPoints.map((point, index) => {
      const sizeVariation = this.seededRandom(index * 123.456);
      const sensitivityVariation = this.seededRandom(index * 789.012);
      const shapeVariation = this.seededRandom(index * 345.678);
      
      return {
        x: point.x,
        y: point.y,
        size: baseGrainSize * (0.5 + sizeVariation * 1.5),
        sensitivity: 0.8 + sensitivityVariation * 0.4,
        shape: shapeVariation
      };
    });
  }

  // Apply grain to image
  public async processImage(imageData: ImageData): Promise<ImageData> {
    const data = new Uint8ClampedArray(imageData.data);
    const result = new ImageData(data, this.width, this.height);
    
    // Step 1: Generate grain structure
    postMessage({ type: 'progress', progress: 10, stage: 'Generating grain structure...' } as ProgressMessage);
    const grains = this.generateGrainStructure();
    
    // Step 2: Process each pixel
    postMessage({ type: 'progress', progress: 30, stage: 'Processing pixels...' } as ProgressMessage);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIndex = (y * this.width + x) * 4;
        
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
        
        // Find nearby grains and calculate their influence
        for (const grain of grains) {
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
          }
        }
        
        if (totalWeight > 0) {
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
    
    return finalStrength * shapeModifier * 0.25; // Increased multiplier for visibility
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
