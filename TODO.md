- [x] **Go through the repo and check if anything can be simplified** **Completed**: Successfully simplified the repository by:
  1. **Removed redundant documentation**: Deleted agent-generated analysis files (`ALGORITHM_IMPLEMENTATION_ANALYSIS.md`, `GRAIN_COMPOSITING_ANALYSIS.md`, `IMPLEMENTATION_SUMMARY.md`) that were no longer needed.
  2. **Moved temporary files**: Moved `test-random-injection.mjs` from root to `scripts/temp/` following proper organization guidelines.
  3. **Reduced verbose logging**: Streamlined console.log statements in `grain-generator.ts` and `grain-worker.ts` by removing debug/progress messages and keeping only essential error/summary logs.
  4. **Eliminated duplicate constants**: Consolidated repeated seed multiplier constants (`SENSITIVITY_VARIATION_SEED_MULTIPLIER`, `SHAPE_VARIATION_SEED_MULTIPLIER`) by moving them to file-level scope instead of having duplicates in multiple functions.
  
  All tests continue to pass after these simplifications, confirming the changes don't break functionality while making the codebase cleaner and more maintainable.

- [x] grain-visualizer.html now handles poission and fallback points correctly. but grain-debug.html still have them overlapping. **Completed**: Fixed `grain-debug.html` to pass the `minDistance` parameter to `generateFallbackGrains()` method, preventing overlap between Poisson and fallback points. Now both visualizer files handle grain point generation consistently.

## Partially Implemented Features (Complete these for better photographic accuracy)

- [x] **Enhance luminance-dependent grain response**: **Completed**: Enhanced the `calculateGrainStrength()` method with a new `calculateLuminanceBasedGrainStrength()` function that implements proper photographic-style grain response. The new implementation follows the algorithm design by defining distinct luminance zones (shadows, mid-tones, highlights) with appropriate strength multipliers. Grain is now most visible in mid-tones (peak at 0.5 luminance), strong in shadows, and properly reduced in highlights using exponential saturation reduction. This creates more film-like grain characteristics with proper emphasis on mid-tones and shadows while reducing grain visibility in blown highlights.
- [ ] **Improve color response variations**: Current channel weighting (R: 0.7, G: 0.9, B: 1.0) is simplified. Enhance to include proper film-like color shifts within grains and more sophisticated per-channel grain characteristics based on actual film behavior.
  - [ ] **Research and define film-specific color characteristics**: Investigate actual film behavior for Kodak, Fuji, and Ilford films regarding color sensitivity and grain response per channel
  - [ ] **Extend FILM_CHARACTERISTICS in constants.ts**: Add channel-specific sensitivity and color shift properties for each film type
  - [ ] **Create film-aware color response system**: Replace hardcoded channel weights (0.7, 0.9, 1.0) with dynamic film-specific calculations
  - [ ] **Implement color shift effects within grains**: Add subtle color temperature shifts and chromatic aberration effects for more realistic grain appearance
  - [ ] **Add comprehensive tests for color response**: Create tests that verify correct color response for different film types and lighting conditions
- [ ] **Implement proper exposure simulation**: Current `filmCurve()` and exposure calculation needs enhancement. Add logarithmic scaling for RGB to exposure conversion and proper kernel-based sampling for grain area instead of point sampling.
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
