# Current Film Grain Algorithm Design

## Overview

The current film grain simulation algorithm is a physically-based, monochrome grain processing system that simulates analog film grain characteristics through a multi-stage pipeline. The algorithm operates entirely in linear color space and uses realistic film physics models.

## Architecture

### Processing Pipeline

The main processing flow occurs in `GrainProcessor.processImage()`:

1. **Input Conversion** - Convert sRGB ImageData to grayscale and linear float values
2. **Grain Generation** - Create grain structure with spatial distribution
3. **Spatial Optimization** - Build spatial grid for efficient pixel processing
4. **Exposure Calculation** - Calculate grain exposures using kernel-based sampling
5. **Density Pre-calculation** - Compute intrinsic grain densities (Phase 1)
6. **Pixel Processing** - Apply grain effects to each pixel (Phase 2)
7. **Lightness Preservation** - Maintain overall image brightness
8. **Output Conversion** - Convert back to sRGB ImageData format

### Key Components

#### 1. Grain Generation (`GrainGenerator`)

**Grain Structure Creation:**

- Uses adaptive Poisson disk sampling with fallback grid generation
- Generates grains with variable sizes based on ISO sensitivity
- Each grain has properties: position (x,y), size, sensitivity, shape, developmentThreshold

**Size Distribution:**

- Base grain size: `ISO / 200` (with minimum constraints)
- Variable sizes using seeded random with bias toward smaller grains
- Size range typically 0.5x to 3x base size

**Spatial Distribution:**

- Primary: Poisson disk sampling for natural distribution
- Fallback: Grid-based placement with randomization when Poisson fails
- Minimum distance between grains: `baseGrainSize * 1.8`

**Development Threshold System:**

- Each grain has individual development threshold (0.1 to 1.5 range)
- Based on grain size (larger = more sensitive) and film characteristics
- Includes random variation per grain for realistic heterogeneity

#### 2. Grain Density Calculation (`GrainDensityCalculator`)

**Two-Phase Processing:**

**Phase 1 - Intrinsic Density (grain-dependent only):**

- Calculates base grain activation using: `(exposure + random_sensitivity) > development_threshold`
- Applies sigmoid response for smooth density transition
- Modifies by grain sensitivity and shape properties
- Uses film characteristic curve for realistic density response

**Phase 2 - Pixel Effects (position-dependent):**

- Distance-based falloff: exponential decay from grain center
- Elliptical grain shape distortion based on orientation
- Multi-scale noise texture overlay (fine/medium/coarse)
- Grain influence radius: 2x grain size

#### 3. Exposure Calculation (`KernelGenerator` + sampling)

**Kernel-Based Sampling:**

- Adaptive sample count: 4 samples (small grains) to 16 samples (large grains)
- Gaussian-weighted sample points within grain area
- Shape-aware weighting for elliptical grain characteristics

**Grayscale Exposure Conversion:**

- Direct conversion from linear luminance to exposure using logarithmic scaling
- Zone system mapping (Ansel Adams inspired) with 10-zone range
- Middle gray (18% reflectance) as reference point

#### 4. Spatial Optimization

**Grid-Based Acceleration:**

- Divides image into grid cells (8px minimum, 2x max grain size)
- Each grain stored in cells it can influence (2x grain radius)
- 3x3 cell neighborhood search during pixel processing
- Reduces grain-pixel distance calculations from O(n²) to O(k) per pixel

#### 5. Film Physics Models

**Film Characteristic Curves:**

- Photographic S-curve with toe/shoulder compression
- Different curves per film type (Kodak/Fuji/Ilford)
- Gamma, toe strength, shoulder strength parameters
- Simulates real film response characteristics

**Beer-Lambert Compositing:**

- Physics-based optical density compositing: `I = I₀ * e^(-density)`
- Realistic light attenuation through grain particles
- Maintains physical accuracy in density accumulation

**Lightness Preservation:**

- Calculates overall image lightness change after grain processing
- Applies uniform scaling to maintain original image brightness
- Operates in linear space for physically correct luminance

## Data Structures

### Core Types

```typescript
interface GrainPoint {
  x: number; // Grain center X position
  y: number; // Grain center Y position
  size: number; // Grain radius in pixels
  sensitivity: number; // Individual grain sensitivity (0.4-1.2)
  shape: number; // Grain shape factor (0-1, affects elliptical distortion)
  developmentThreshold: number; // Activation threshold (0.1-1.5)
}

interface GrainSettings {
  iso: number; // Film ISO sensitivity (100-3200)
  filmType: 'kodak' | 'fuji' | 'ilford'; // Film characteristic type
}
```

### Processing Maps

- `Map<GrainPoint, number>` - Grain exposure values (kernel-sampled)
- `Map<GrainPoint, number>` - Intrinsic grain densities (Phase 1)
- `Map<string, GrainPoint[]>` - Spatial grid for acceleration

## Algorithm Parameters

### Film Type Characteristics

**Kodak:**

- Gamma: 2.2, moderate contrast
- Development threshold: 0.75 (more sensitive)
- Smooth grain characteristics

**Fuji:**

- Gamma: 1.8, lower contrast
- Development threshold: 0.80 (medium sensitivity)
- Fine grain structure

**Ilford:**

- Gamma: 2.6, high contrast
- Development threshold: 0.85 (less sensitive)
- Coarser grain structure

### Key Constants

- Minimum grain size: varies by ISO (typically 0.5-4.0 pixels)
- Grain density factor: `ISO / 80000` (grains per pixel)
- Influence radius: 2x grain size
- Sample counts: 4/8/16 based on grain size
- Grid acceleration: 8px minimum cell size

## Performance Characteristics

### Computational Complexity

- Grain generation: O(n) where n = target grain count
- Spatial grid: O(n) for n grains
- Pixel processing: O(m\*k) where m = pixels, k = average nearby grains
- Overall: O(m\*k + n) typically scaling well with image size

### Memory Usage

- Float32Array for linear image data (4x original ImageData size)
- Grain structure storage: ~64 bytes per grain
- Spatial grid: ~16 bytes per grid cell + grain references
- Kernel cache: ~100 cached patterns maximum

### Typical Processing Times

- 1MP image: ~100-500ms (depends on grain density)
- Grain generation: ~10% of total time
- Pixel processing: ~70% of total time
- Spatial optimization provides ~5-10x speedup vs brute force

## Color Space Handling

**Linear Processing:**

- All internal processing in linear RGB space
- sRGB → Linear conversion on input
- Linear → sRGB conversion on output
- Physically correct light calculations

**Monochrome Conversion:**

- RGB → Grayscale using ITU-R BT.709 weights (0.2126R + 0.7152G + 0.0722B)
- Duplicates grayscale values across RGB channels in output
- Maintains ImageData compatibility while being truly monochrome

## Testing and Quality Assurance

**Test Coverage:**

- 223+ unit tests covering all major components
- Integration tests for full processing pipeline
- Performance benchmarks for optimization validation
- Edge case handling (empty images, extreme ISO values)

**Validation Methods:**

- Lightness preservation validation (maintains overall image brightness)
- Grain distribution analysis (spatial uniformity checks)
- Processing consistency verification (deterministic results with same seed)
- Performance regression testing

## Known Limitations

1. **Grain Shapes:** Currently uses simple elliptical distortion; lacks organic irregularity
2. **Grain Detail:** No internal grain structure or texture detail
3. **Color Processing:** Monochrome only; no color-specific grain effects
4. **Bridging Effects:** No grain clustering or bridging simulation
5. **Edge Effects:** No developer depletion or chemical diffusion modeling

## Debug and Development Tools

**Visualization Tools:**

- `grain-debug.html` - Internal grain generation analysis
- `grain-visualizer.html` - Grain distribution testing
- Debug grain centers drawing option
- Performance tracking and benchmarking

**Debug Features:**

- Comprehensive console logging for all processing stages
- Performance metrics with pixel/second processing rates
- Grain coverage and effect statistics
- Processing mode identification and optimization reporting
