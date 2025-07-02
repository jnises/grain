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

### Emulsion Layer Simulation

*   Grain is modeled at different depths within the emulsion.
*   Slight parallax effects are implemented for grains at different layers.
*   Subtle focus variations are added, where grain deeper in the emulsion appears softer.

### Development Process Effects

*   Grain bridging (grains connecting during development) is simulated.
*   Slight grain movement/clustering based on development chemistry is added.
*   Edge effects are implemented where grain density changes near high-contrast boundaries.

### Film Stock Characteristics

*   Profiles for different film stocks (e.g., Kodak, Fuji) are created, each with unique grain size distribution and pattern.
*   Color response curves specific to each emulsion type are included.

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

*   **Color Separation Approach:** Each RGB channel is processed as separate photographic layers with different grain patterns, sensitivity curves, and slight registration errors.
*   **Cross-Channel Coupling:** Grains developing strongly in one channel influence neighboring channels, simulating color developer interactions and dye cloud formation.

### 5. Density-to-Output Conversion

*   **From Grain Density to Pixel Values:** Developed grains block light transmission, and multiple overlapping grains create cumulative density. Grain density is converted back to RGB values using an inverse film curve.
*   **Compositing Multiple Grain Layers:** `final_pixel = base_color * (1 - grain_layer_1_density) * (1 - grain_layer_2_density) * ...`

### 6. Practical Implementation Flow

*   **Preprocessing:** Upsample image 2-4x, convert to LAB or XYZ color space, and apply film characteristic curve.
*   **Grain Generation:** Generate grain map, assign grain properties, and create irregular grain shape masks.
*   **Exposure Calculation:** Sample underlying image with grain-shaped kernel, apply random sensitivity variations, and calculate development probability/strength.
*   **Development Simulation:** Apply threshold function, calculate final grain opacity/density, and apply grain interaction effects.
*   **Final Compositing:** Combine all grain layers, apply color channel mixing, convert back to RGB, and downsample to final resolution.

### 7. Advanced Considerations

*   **Halation and Light Scattering:** Bright areas cause light to scatter in the emulsion, creating subtle halos and affecting grain development.
*   **Emulsion Thickness Effects:** Grains at different depths have different focus characteristics (front grains sharper, back grains softer).
*   **Chemical Development Variations:** Over-development increases grain contrast and bridging, while under-development creates more gray, less defined grains. Temperature and time also affect grain characteristics.

### 8. Coding instructions
1. Start by adding ui elements to upload, view, zoom and download an image
2. Add the algorithm described above. Do it using a worker to avoid blocking the main thread.