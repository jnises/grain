- [x] Change the title of the page to be the name of the project.
- [x] Replace the vite favicon with a custom one for this project.
- [x] When looking a the image with grains added in the gui I can see jpeg artifacts, even though the source image was a png. Why is that? **Fixed**: The `imageDataToDataUrl()` function was forcing JPEG conversion with `canvas.toDataURL('image/jpeg', 0.9)`, which introduced compression artifacts regardless of the original image format. Changed to use PNG format (`canvas.toDataURL('image/png')`) for lossless output and updated the download filename to use `.png` extension.
- [ ] When adding grain in the gui I don't see any actual grains in the resulting image even if I set the grain intensity to max and set the iso to a high value. Just some blotchiness. I'm testing with iso: 1350, grain intensity: 200%. Here is the console log:
```
Successfully extracted image data: 400x300, 480000 bytes
grain-worker-manager.ts:64 Processing image: 400x300, ISO: 1350, filmType: kodak
grain-worker.ts:644 Worker processing image: 400x300, ISO: 1350
grain-worker.ts:102 Initializing GrainProcessor: 400x300, ISO: 1350
grain-generator.ts:582 Generating variable size grains: target=18000, maxAttempts=50000
grain-generator.ts:616 Variable grain generation progress: 729/18000 grains, 10000 attempts, 11 consecutive failures
grain-generator.ts:616 Variable grain generation progress: 848/18000 grains, 20000 attempts, 22 consecutive failures
grain-generator.ts:616 Variable grain generation progress: 926/18000 grains, 30000 attempts, 107 consecutive failures
grain-generator.ts:620 Variable grain generation completed: 936/18000 grains in 33740 attempts
grain-generator.ts:279 Generating fallback grains: 0 existing, 18000 target, minDistance=8.10
grain-generator.ts:313 Fallback grid: 155x117 cells, gridSize=2.58
grain-generator.ts:390 Fallback generation completed: 18000 total grains (18000 new)
grain-worker.ts:456 === Processing Summary ===
grain-worker.ts:457 Total pixels processed: 120000
grain-worker.ts:458 Pixels with grain effect: 120000
grain-worker.ts:459 Grain effect coverage: 100.00%
grain-worker.ts:460 Processing mode: Single Layer (Variable Sizes), Density Model
grain-worker.ts:71 
=== Performance Benchmarks ===
grain-worker.ts:73 Total Processing: 75420.00ms
grain-worker.ts:75   - 0.00M pixels/sec
grain-worker.ts:73 Grain Generation: 223.20ms
grain-worker.ts:73 Spatial Grid Creation: 29.40ms
grain-worker.ts:73 Pixel Processing: 75166.50ms
grain-worker.ts:75   - 0.00M pixels/sec
grain-worker.ts:73 Single Layer Processing: 75166.30ms
grain-worker.ts:471 
=== Performance Metrics ===
grain-worker.ts:472 Total processing speed: 0.00M pixels/sec
grain-worker.ts:473 Pixel processing speed: 0.00M pixels/sec
grain-worker.ts:474 Processing overhead: 0.3%
grain-worker.ts:477 Layer processing mode: Single Layer (Variable Sizes)
grain-worker.ts:478 Layer processing time: 75166.30ms
grain-worker.ts:479 Layer processing efficiency: 1.00x pixel processing speed
grain-worker-manager.ts:129 Image processing completed successfully
App.tsx:202 Converting image data to data URL: 400x300
App.tsx:227 Successfully converted to data URL: 103738 characters
App.tsx:264 Grain processing completed successfully
```
What could be the issue?
  

## Partially Implemented Features (Complete these for better photographic accuracy)

- [x] **Enhance luminance-dependent grain response**: **Completed**: Enhanced the `calculateGrainStrength()` method with a new `calculateLuminanceBasedGrainStrength()` function that implements proper photographic-style grain response. The new implementation follows the algorithm design by defining distinct luminance zones (shadows, mid-tones, highlights) with appropriate strength multipliers. Grain is now most visible in mid-tones (peak at 0.5 luminance), strong in shadows, and properly reduced in highlights using exponential saturation reduction. This creates more film-like grain characteristics with proper emphasis on mid-tones and shadows while reducing grain visibility in blown highlights.
- [x] **Improve color response variations**: **Completed**: Successfully enhanced the simplified channel weighting system to include proper film-like color shifts and sophisticated per-channel grain characteristics based on actual film behavior. The implementation now includes film-specific channel sensitivities, realistic color temperature variations within grains, and chromatic aberration effects for more photographic accuracy.
  - [x] **Research and define film-specific color characteristics**: **Completed**: Researched actual film behavior for Kodak (strong red sensitivity), Fuji (green-leaning response), and Ilford (strong blue sensitivity from B&W heritage). Defined realistic channel sensitivity values and color shift properties for each film type based on their historical characteristics.
  - [x] **Extend FILM_CHARACTERISTICS in constants.ts**: **Completed**: Extended the film characteristics configuration to include `channelSensitivity` (red, green, blue values) and `colorShift` properties for each film type, with values based on actual film behavior research.
  - [x] **Create film-aware color response system**: **Completed**: Replaced hardcoded channel weights (0.7, 0.9, 1.0) in `grain-worker.ts` with dynamic film-specific calculations using `FILM_CHARACTERISTICS[filmType].channelSensitivity` and applying color shifts for more realistic grain appearance.
  - [x] **Implement color shift effects within grains**: **Completed**: Implemented sophisticated color shift effects including position-dependent color temperature variations (warmer centers, cooler edges), chromatic aberration effects (subtle color separation based on distance from grain center), and per-grain color variation based on individual grain properties (shape and sensitivity). Added comprehensive tests to verify the temperature shift and chromatic aberration calculations work correctly.
  - [x] **Add comprehensive tests for color response**: **Completed**: Created `film-color-response.test.ts` with comprehensive tests verifying correct channel sensitivity configuration, color shift properties, expected film characteristics, and backward compatibility.
- [ ] **Implement proper exposure simulation**: Current `filmCurve()` and exposure calculation needs enhancement. Add logarithmic scaling for RGB to exposure conversion and proper kernel-based sampling for grain area instead of point sampling.
  - [x] **Replace linear LAB luminance with logarithmic exposure scaling**: **Completed**: Replaced current `lab.l / 100` luminance calculation with proper logarithmic RGB-to-exposure conversion that follows photographic principles. Added `EXPOSURE_CONVERSION` constants and `rgbToExposure()` method that uses ITU-R BT.709 luminance weights, logarithmic scaling, and proper normalization. Updated `calculateGrainStrength()` to use exposure instead of linear luminance, providing more realistic photographic behavior.
  - [ ] **Enhance filmCurve() with proper photographic S-curve**: Replace basic sigmoid with realistic film characteristic curve that properly maps digital values to photographic density
  - [ ] **Implement kernel-based grain area sampling**: Replace point sampling with proper kernel-based sampling that averages exposure over each grain's shape and size
  - [ ] **Add exposure unit conversion system**: Create proper conversion from RGB values to photographic exposure units using logarithmic scaling
- [ ] **Enhance development threshold system**: Current grain sensitivity is too simplified. Implement proper per-grain development thresholds based on local exposure level, base sensitivity, and development time simulation as designed.
- [ ] **Implement Beer-Lambert law compositing**: Current density compositing uses simplified model `final = original * (1 - density)`. Implement proper Beer-Lambert law: `final = original * exp(-density)` for more physically accurate results.

## High Priority Missing Features (Major visual impact)

- [ ] **Implement 2D Perlin noise for grain shapes**: Replace current uniform grain shapes with organic, irregular boundaries using 2D Perlin noise. Add elliptical distortion to simulate crystal orientation and implement grain halos as subtle brightness variations around edges.
- [ ] **Add upsampling workflow for grain detail**: Implement 2x-4x upsampling before grain rendering, then downsample for final output. This will allow proper grain internal structure and edge softness instead of pixel-level noise.

## Medium Priority Missing Features (Enhanced realism)

- [ ] **Implement grain bridging and clustering effects**: Add simulation of grains connecting during development through clustering algorithms. This creates more realistic grain patterns that match actual film behavior.
- [ ] **Add edge effects near high-contrast boundaries**: Implement grain density changes near high-contrast image boundaries to simulate developer depletion and chemical diffusion effects.

- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense.
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead.
- [ ] The current algorithm iterates each pixel and checks which grain it is close to. Wouldn't it make more sense to iterate the grains and check its nearby pixels? Will we have move pixels or grains?
- [ ] Use something like a flamegraph to find the hotspots in the code and optimize those
- [ ] Create a separate assert util for slow checks that is only run when in dev mode.
- [ ] Update agent instructions on how to use the asserts.
- [ ] Update hot code to use the dev assert.
- [ ] Add option for monochrome grains
- [ ] Go through the testcases and make sure they are all enabled and makes sense
- [ ] Optimize the algorithm
- [ ] Clean up unused files and debug utils such as `public/grain-test.html`
- [ ] Clean up old agent-generated analysis and summary md files.
- [ ] Update dependencies.
- [ ] Is it possible to parallelize the algorithm? Or move parts of it to the gpu using webgpu?
- [ ] Go through the repo and clean up any unused files
- [ ] Go through the code looking for repeating patterns and refactor them into shared code if it makes sense.
- [ ] Go through the code and clean up any comments left by a coding agent to indicate what it has changed. Comments should typically describe "why" not "what. And while comments describing changes is useful when iteracting with an agent we don't want that in the final code.
