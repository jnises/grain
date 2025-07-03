# Algorithm for Physically Plausible Analog Film Grain

This algorithm aims to add analog film grain to a digital image in a physically plausible way, ensuring that zoomed-in grains resemble actual analog film grains. The core idea is to model the structure and behavior of silver halide crystals in photographic emulsion.

## Core Algorithm Structure

### 1. Grain Generation Based on Photographic Principles

Individual silver halide crystals are modeled as irregular, overlapping shapes rather than simple noise. This involves:

*   Using Voronoi diagrams or Poisson disk sampling for non-uniform grain distribution.
*   Varying grain size based on film speed (ISO): higher ISO results in larger, more visible grains.
*   Implementing grain density inversely related to exposure, meaning shadows have more visible grain.

### 2. Multi-Scale Grain Structure

Grain is generated at multiple scales:

*   **Primary grains:** Largest and most visible.
*   **Secondary grains:** Medium-sized clusters.
*   **Micro-grain texture:** Fine detail.
*   **Clumping patterns:** Simulating natural grain clustering in real film.

### 3. Luminance-Dependent Grain Response

Real film grain visibility is modeled as follows:

*   Most visible in mid-tones and shadows.
*   Reduced in highlights due to saturation.
*   Different behavior in each color channel (grain is often more visible in blue/green).

## Implementation Details

### Grain Shape Generation

*   2D Perlin noise is used to create organic, irregular grain boundaries.
*   Slight elliptical distortion simulates crystal orientation.
*   Grain "halos" are implemented as subtle brightness variations around grain edges.

### Color Response

*   Each RGB channel is modeled separately with different grain characteristics.
*   The blue channel typically shows the most grain, and red the least.
*   Slight color shifts within grains are added, as grain is not perfectly neutral.

### Spatial Distribution

*   Blue noise or Poisson sampling is used for grain placement to avoid artificial regular patterns.
*   Grain "rivers" are implemented to simulate slight tendencies for grains to align.

### Upsampling Considerations

Upsampling is beneficial for realistic grain rendering:

*   2x-4x upsampling allows individual grains to have proper internal structure.
*   Grain is rendered at the higher resolution, then downsampled for the final output, preventing it from appearing as simple pixel noise.
*   This allows for proper grain edge softness and internal texture variations.

An alternative approach is to render grain as vector shapes or distance fields, which naturally scale to any resolution.

## Advanced Realism Features

### Development Process Effects

*   Basic grain bridging (grains connecting during development) can be simulated through simple clustering.
*   Edge effects where grain density changes near high-contrast boundaries provide visual realism.

### Film Stock Characteristics

*   Basic profiles for different film characteristics can be implemented through grain size and density parameters.
*   Simple color response variations between RGB channels provide film-like character.

## Conversion Process: Digital Image to Grains

The conversion process models how photographic exposure and development translate image data into grain patterns.

### 1. Exposure Simulation

*   **Light-to-Grain Activation Mapping:** RGB values are converted to exposure units, simulating how much light hits each grain. Logarithmic scaling is used, and a film characteristic curve (S-curve) maps digital values to photographic density.
*   **Per-Grain Exposure Calculation:** For each grain location, the underlying image is sampled with a kernel matching the grain's shape and size. Larger grains integrate light over a bigger area (slight blur effect), and random sensitivity variations are added per grain.

### 2. Development Threshold System

*   **Individual Grain Development:** Each grain has its own development threshold based on base sensitivity (varying by grain size and type), local exposure level, development time/chemistry simulation, and random variation.
*   **Grain State Calculation:** `grain_activation = (local_exposure + random_sensitivity) > development_threshold` and `grain_density = sigmoid_function(activation_strength - threshold)`.

### 3. Grain Pattern Generation Process

*   **Step 1: Generate Grain Map:** Voronoi cells or Poisson disk sampling are used for grain locations. Each grain is assigned a size, shape, and sensitivity value. Higher ISO films have larger grains and more spacing variation.
*   **Step 2: Sample Image Through Grain Structure:** For each grain, the average exposure in its area is calculated, weighted by the grain's shape. Slight positional jitter is added.
*   **Step 3: Apply Development Model:** Each grain develops based on its total light exposure. Partially developed grains create gray values, and neighboring grain influence (developer depletion, chemical diffusion) is simulated.

### 4. Multi-Channel Processing

*   **Color Separation Approach:** Each RGB channel is processed with different grain sensitivity parameters to simulate the characteristic differences between color layers in film.
*   **Simple Channel Variations:** Different grain visibility and size distributions per channel create realistic color grain characteristics.

### 5. Density-to-Output Conversion

*   **From Grain Density to Pixel Values:** The implementation supports two compositing models to balance physical accuracy with computational efficiency:

*   **Density-Based Compositing (Physical Model):** 
    - **Beer-Lambert Law:** `final_pixel = base_color * exp(-grain_density_total)` where grain_density_total is the sum of all grain layer densities
    - **Simplified Physical Model:** `final_pixel = base_color * (1 - grain_density)` with density clamped to prevent complete blackness
    - **Multi-Layer Support:** Each grain layer contributes density independently: `total_density = sum(layer_density * layer_weight)`
    - **Channel-Specific Response:** Different density calculations for R, G, B channels (blue most affected, red least)

*   **Additive Compositing (Legacy Model):**
    - **Direct Addition:** `final_pixel = base_color + grain_effect` for computational efficiency
    - **Backward Compatibility:** Maintains compatibility with existing presets and workflows
    - **Faster Processing:** Reduces computational overhead for real-time applications

*   **Implementation Control:**
    - **`useDensityModel` Setting:** Toggles between density-based (physical) and additive (legacy) compositing
    - **`useMultipleLayers` Setting:** Enables generation of Primary, Secondary, and Micro grain layers
    - **Automatic Mode Selection:** Density model automatically enabled when multiple layers are active
    - **Per-Channel Weighting:** RGB channels receive different grain influence (R: 0.7, G: 0.9, B: 1.0)

**Technical Implementation:** The grain strength is converted to optical density using `calculateGrainDensity()`, which applies film characteristic curves and sensitivity variations. The final compositing method is selected based on user settings, allowing for both physically accurate simulation and faster processing modes.

### 6. Practical Implementation Flow

*   **Preprocessing:** Upsample image 2-4x, convert to LAB or XYZ color space, and apply film characteristic curve.
*   **Grain Generation:** Generate grain map, assign grain properties, and create irregular grain shape masks.
*   **Exposure Calculation:** Sample underlying image with grain-shaped kernel, apply random sensitivity variations, and calculate development probability/strength.
*   **Development Simulation:** Apply threshold function, calculate final grain opacity/density, and apply grain interaction effects.
*   **Final Compositing:** Combine all grain layers, apply color channel mixing, convert back to RGB, and downsample to final resolution.

### 7. Practical Considerations

*   **Simplified Processing:** Focus on core grain generation and density mapping rather than complex chemical simulation.
*   **Efficient Implementation:** Use lookup tables and simplified models to achieve realistic results with reasonable computational cost.
*   **Parameter Control:** Provide intuitive controls for grain size, density, and visibility that map to understandable photographic concepts.
