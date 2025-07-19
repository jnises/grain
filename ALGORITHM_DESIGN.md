# Algorithm Design Goals

## Design Philosophy

This grain simulation algorithm is designed around the fundamental principle that **the input image represents the light that exposed the film, not the final photograph**. The algorithm simulates the complete analog film processing workflow:

1. **Light Exposure**: The input image serves as the light that strikes the film emulsion
2. **Film Development**: Individual grains in the emulsion are developed based on their exposure
3. **Darkroom Printing**: The developed film is used to create the final photograph

## Analog Film Processing Analogy

### Camera Exposure Phase
When light enters a camera, it strikes photosensitive crystals (grains) distributed throughout the film emulsion. Each grain has:
- **Individual sensitivity** - some grains are more responsive to light than others
- **Development threshold** - the minimum exposure needed for the grain to become developable
- **Physical properties** - size, shape, and position within the emulsion

The input image in our algorithm represents this incoming light - it's the pattern of photons that would have struck the film.

### Film Development Phase
During chemical development, exposed grains undergo a transformation:
- Grains that received sufficient light exposure become **opaque** (high optical density)
- Grains below their development threshold remain **transparent** (low optical density)
- The development process is influenced by grain sensitivity, local chemistry effects, and random variations

Our algorithm simulates this by:
1. **Sampling the light exposure** at each grain location using the input image
2. **Comparing exposure to development thresholds** to determine which grains activate
3. **Calculating optical density** for each grain based on its properties and exposure

### Darkroom Printing Phase
The developed film negative is used in a darkroom to create the final photograph. Light passes through the film:
- **Dense grains** (heavily exposed) block more light, creating lighter areas in the print
- **Transparent grains** (unexposed) allow more light through, creating darker areas in the print
- Multiple grains can overlap, with their **optical densities combining** according to physics

Our algorithm simulates this by:
1. **Compositing grain densities** using Beer-Lambert law: `I = I₀ × e^(-density)`
2. **Accumulating the effects** of all nearby grains for each pixel
3. **Producing the final image** as if light had passed through the developed film

## Core Design Goals

### 1. Physical Accuracy
All processing operations should follow real-world physics:
- **Linear color space** for all internal calculations (light behaves linearly)
- **Beer-Lambert compositing** for optical density accumulation
- **Realistic grain properties** based on actual film characteristics
- **Physically-based development curves** that match real film response

### 2. Two-Stage Processing Architecture
The algorithm separates grain-dependent from position-dependent calculations:
- **Phase 1 (Development)**: Calculate intrinsic grain properties based only on exposure
- **Phase 2 (Printing)**: Apply grain effects to each pixel based on spatial relationships

This separation mirrors the physical process where development happens first, then printing.

### 3. Linear Color Space Operations
**All color operations must be performed in linear space** because:
- Light behaves linearly in the real world
- Grain density effects follow physical laws that assume linear light values
- Proper exposure calculations require linear luminance values
- Color blending and compositing are physically accurate only in linear space

**sRGB packing/unpacking is performed only at pipeline boundaries**:
- **Input**: Convert from sRGB to linear for processing
- **Output**: Convert from linear back to sRGB for display

### 4. Grain-Centric Processing
The algorithm treats grains as the fundamental processing units:
- Each grain is an independent entity with its own properties
- Grain development is determined by local image exposure
- Final image effects emerge from the collective behavior of many grains
- This approach naturally handles grain overlap, clustering, and spatial variation

### 5. Scalable Performance
The design should handle various image sizes and grain densities efficiently:
- Spatial optimization to avoid O(n²) grain-pixel calculations
- Caching of expensive operations like kernel generation
- Memory-efficient data structures for large grain populations
- Progressive quality options for interactive editing

## Implementation Principles

### Separation of Concerns
- **Grain generation** handles spatial distribution and individual grain properties
- **Exposure calculation** determines how much light each grain received
- **Development simulation** calculates grain activation and density
- **Optical compositing** combines grain effects into the final image

### Deterministic Results
- Use seeded random number generation for reproducible results
- Ensure consistent grain placement and properties across runs
- Enable comparison of different algorithm versions and parameters

### Extensibility
- Modular design allows enhancement of individual processing stages
- Support for different film types through parameterization
- Foundation for future features like color processing, grain bridging, etc.

## Quality Metrics

The algorithm should preserve the essential characteristics of the input while adding realistic grain:
- **Lightness preservation** - overall image brightness should remain consistent
- **Detail retention** - important image features should remain visible
- **Natural grain distribution** - avoid artificial patterns or clustering
- **Appropriate grain scale** - grain size should match the selected film characteristics

This design creates a foundation for realistic film grain simulation that respects both the physics of analog photography and the practical requirements of digital image processing.
