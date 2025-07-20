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
- **Physical properties** - size, and position within the emulsion

The input image in our algorithm represents this incoming light - it's the pattern of photons that would have struck the film.

### Film Development Phase
During chemical development, exposed grains undergo a transformation:
- Grains that received sufficient light exposure become **opaque** (high optical density)
- Grains below their development threshold remain **transparent** (low optical density)
- The development process is influenced by grain sensitivity, local chemistry effects, and random variations

Our algorithm simulates this using an **iterative development approach** that more accurately reflects real darkroom physics:

#### Iterative Lightness Compensation
The algorithm performs development in multiple iterations to achieve target lightness:

1. **Initial Exposure Assessment**: Sample light exposure at each grain location using the input image
2. **Development Iteration Loop**:
   - Calculate grain optical densities based on current exposure levels
   - Apply Beer-Lambert law to simulate light transmission through developed grains
   - Measure overall image lightness compared to target
   - Adjust exposure compensation factor if lightness deviation exceeds threshold
   - Repeat until convergence (typically 1-2 iterations) or maximum iterations reached
3. **Final Grain State**: Use converged grain densities for the printing phase

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

### 1. Physical Accuracy and Iterative Development
All processing operations should follow real-world physics:
- **Linear color space** for all internal calculations (light behaves linearly)
- **Beer-Lambert compositing** for optical density accumulation: `transmission = exp(-density)`
- **Iterative lightness compensation** that mimics real darkroom exposure adjustments
- **Realistic grain properties** based on actual film characteristics
- **Physically-based development curves** that match real film response

The iterative development process ensures:
- Proper exposure compensation through multiple development cycles
- Convergence to target lightness within 1-2 iterations typically

### 2. Linear Color Space Operations
**All color operations must be performed in linear space** because:
- Light behaves linearly in the real world
- Grain density effects follow physical laws that assume linear light values
- Proper exposure calculations require linear luminance values
- Color blending and compositing are physically accurate only in linear space

**sRGB packing/unpacking is performed only at pipeline boundaries**:
- **Input**: Convert from sRGB to linear for processing
- **Output**: Convert from linear back to sRGB for display

### 3. Grain-Centric Processing
The algorithm treats grains as the fundamental processing units:
- Each grain is an independent entity with its own properties
- Grain development is determined by local image exposure
- Final image effects emerge from the collective behavior of many grains
- This approach naturally handles grain overlap, clustering, and spatial variation

