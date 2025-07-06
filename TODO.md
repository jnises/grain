- [x] Remove hard to implement features of `ALGORITHM_DESIGN.md` such as parallax.
- [x] Check to make sure the `Compositing Multiple Grain Layers` section of `ALGORITHM_DESIGN.md` makes sense.
- [x] Remove the legacy algorithm
- [x] Go through the code and make sure it follows the instructions in `copilot-instructions.md`
- [x] Add instruction for agent to assert any assumption it makes.
- [x] Create custom assert function what does narrowing and such.
- [x] Go through the code and make sure assertions are added where it makes sense.
- [x] Ask why all the custom assertion functions are needed.
- [x] The algorithm is much slower when using `multiple grain layers` feature. Figure out why that is. **Fixed**: The issue was O(n²) complexity in grain layer processing. Each pixel was doing `layer.grains.filter(grain => nearbyGrains.includes(grain))` which searched through all grains for each layer. Optimized by creating a grain-to-layer map for O(1) layer lookup instead. **Benchmarked**: Added comprehensive performance tests showing multiple layers now perform 1.2-1.6x faster than single layer mode, confirming the optimization works.
- [x] Add debug page that can visualize separate parts of the algorithm, such as raw grains before they are combined with the image. This page should only be available in dev mode. **Implemented**: Created `/public/grain-debug.html` with comprehensive algorithm visualization including raw Poisson/fallback grain points, multiple layer visualization, size distribution analysis, and spatial grid visualization. Added development-only link in main app header that only appears when `import.meta.env.DEV` is true.
- [x] Go through `ALGORITHM_DESIGN.md` and compare against the current implementation. Describe what has been implemented and what hasn't any why. **Completed**: Created comprehensive analysis in `ALGORITHM_IMPLEMENTATION_ANALYSIS.md`. Found that ~70% of the designed algorithm is implemented including multi-layer grain system, density-based compositing, spatial distribution, and multi-channel processing. Major gaps are in grain shape generation (no Perlin noise/halos), upsampling for detail, and advanced photographic effects like grain bridging.
- [ ] Adjust benchmark code to focus on how the performance changes over time, rather than comparing single/multi layers.
- [ ] Use something like a flamegraph to find the hotspots in the code and optimize those

## Partially Implemented Features (Complete these for better photographic accuracy)

- [ ] **Enhance luminance-dependent grain response**: Current implementation in `calculateLuminanceBasedGrainStrength()` is basic. Need to add proper mid-tone/shadow emphasis and highlight saturation reduction as described in `ALGORITHM_DESIGN.md`. The grain should be most visible in mid-tones and shadows, with reduced visibility in highlights.
- [ ] **Improve color response variations**: Current channel weighting (R: 0.7, G: 0.9, B: 1.0) is simplified. Enhance to include proper film-like color shifts within grains and more sophisticated per-channel grain characteristics based on actual film behavior.
- [ ] **Implement proper exposure simulation**: Current `filmCurve()` and exposure calculation needs enhancement. Add logarithmic scaling for RGB to exposure conversion and proper kernel-based sampling for grain area instead of point sampling.
- [ ] **Enhance development threshold system**: Current grain sensitivity is too simplified. Implement proper per-grain development thresholds based on local exposure level, base sensitivity, and development time simulation as designed.
- [ ] **Implement Beer-Lambert law compositing**: Current density compositing uses simplified model `final = original * (1 - density)`. Implement proper Beer-Lambert law: `final = original * exp(-density)` for more physically accurate results.

## High Priority Missing Features (Major visual impact)

- [ ] **Implement 2D Perlin noise for grain shapes**: Replace current uniform grain shapes with organic, irregular boundaries using 2D Perlin noise. Add elliptical distortion to simulate crystal orientation and implement grain halos as subtle brightness variations around edges.
- [ ] **Add upsampling workflow for grain detail**: Implement 2x-4x upsampling before grain rendering, then downsample for final output. This will allow proper grain internal structure and edge softness instead of pixel-level noise.

## Medium Priority Missing Features (Enhanced realism)

- [ ] **Implement grain bridging and clustering effects**: Add simulation of grains connecting during development through clustering algorithms. This creates more realistic grain patterns that match actual film behavior.
- [ ] **Add edge effects near high-contrast boundaries**: Implement grain density changes near high-contrast image boundaries to simulate developer depletion and chemical diffusion effects.

- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense.
- [ ] Create a separate assert util for slow checks that is only run when in dev mode.
- [ ] Update agent instructions on how to use the asserts.
- [ ] Update hot code to use the dev assert.
- [ ] Add option for monochrome grains
- [ ] Optimize the algorithm
- [ ] Clean up unused files and debug utils such as `public/grain-test.html`
- [ ] Clean up old agent-generated analysis and summary md files.
- [ ] Update dependencies.
- [ ] Is it possible to parallelize the algorithm? Or move parts of it to the gpu using webgpu?
