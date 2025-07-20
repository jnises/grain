# Algorithm Design: Core Implementation Principles

## Critical Implementation Rule: Film Negative Behavior

**⚠️ CRITICAL: The algorithm simulates photographic negative development, NOT direct image processing.**

- **Input image** = light exposure on film emulsion
- **Developed grains** = opaque areas that block light 
- **Final output** = light passing through developed film onto photographic paper

**Implementation consequence**: Dense grains (high exposure) must produce LIGHTER final output, not darker.

```
finalGrayscale = 1.0 - lightTransmission  // Photographic paper darkens with light
```

Never use `finalGrayscale = lightTransmission` - this creates inverted results.

## Core Design Principles

### 1. Linear Color Space Requirement
**All internal calculations must use linear color space:**
- Convert from sRGB at input: `linearValue = sRGBToLinear(srgbValue)`
- Perform all grain processing in linear space
- Convert to sRGB only at final output: `srgbValue = linearToSRGB(linearValue)`

**Why**: Light physics, Beer-Lambert law, and grain density calculations are only accurate in linear space.

### 2. Iterative Development Process
Use iterative lightness compensation to match target image brightness:
1. Generate grains and calculate initial development
2. Measure resulting lightness vs target
3. Adjust exposure compensation if deviation > threshold
4. Repeat until convergence (typically 1-2 iterations)

### 3. Physically Accurate Grain Scaling
**Higher ISO** → Fewer, larger grains with greater total coverage
**Lower ISO** → More, smaller grains with less total coverage

```typescript
// Grain count decreases with ISO
grainCount = baseCount * (isoReference / iso)

// Grain size increases with ISO  
grainSize = baseSize * (iso / isoReference)
```

### 4. Beer-Lambert Light Transmission
Combine overlapping grain densities physically:
```typescript
lightTransmission = Math.exp(-totalDensity)
```

Where `totalDensity` accumulates all grain contributions at each pixel.

