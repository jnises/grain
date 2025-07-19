- [x] Describe the current algorithm. Write it to CURRENT_ALGORITHM_DESIGN.md
  **COMPLETED**: Created comprehensive documentation of the current grain processing algorithm in `CURRENT_ALGORITHM_DESIGN.md`. The document covers the complete processing pipeline (8 stages from input conversion to output), detailed component breakdowns (GrainGenerator, GrainDensityCalculator, spatial optimization), algorithm parameters, performance characteristics, data structures, and implementation details. Includes coverage of the two-phase grain processing system, kernel-based exposure sampling, film physics models (Beer-Lambert compositing, film characteristic curves), and the monochrome processing pipeline. Also documents testing methods, known limitations, and debug tools. This provides a complete technical reference for the current algorithm implementation.
- [x] Remove the eliptical grain functionality, make them all circular
  **COMPLETED**: Successfully removed all elliptical grain functionality and made all grains circular. Changes included:
  - Modified grain generation to always use shape=0.5 (circular) instead of random shape values
  - Simplified elliptical distortion calculations to always return 1.0 (no distortion)
  - Removed elliptical shape modulation from sampling kernel generation
  - Updated sampling functions to remove grainShape parameter
  - Fixed all test files to work with simplified circular-only grain system
  - Removed unused constants and imports related to elliptical functionality
  All tests pass and the grain system now only generates circular grains.
- [x] Remove the grain perlin noise. They should be circular.
  **COMPLETED**: Successfully removed all Perlin noise from grain rendering to ensure purely circular grains. Changes included:
  - Removed noise modulation from `calculatePixelGrainEffect` in grain-density.ts
  - Eliminated noise-based texture variation that created irregular grain boundaries
  - Removed unused noise constants and calculations
  - Deleted the now-unused noise.ts file containing Perlin noise implementation
  - Updated grain effects to use clean exponential falloff for circular shapes
  All tests pass (with one expected integration test change due to more consistent grain behavior) and grains now have perfectly circular falloff patterns.
- [ ] Make KernelGenerator accept a rng argument for deterministic testing. Same as GrainProcessor.
- [ ] Replace any call to Math.random in the code with a dependencyinjected rng, for deterministic testing. Pipe the rng through everywhere.
- [ ] Make sure the gaussian sample weighting used for the exposure calculation matches the weighting used in the pixel processing part of the pipeline. Grains should behave the same when developing as when they are printed to the output. Add tests where you check that a single grain with different sizes and exposures result in an expected output shape.
- [ ] Make sure the tests in grain-processor-integration.test.ts are not too lenient
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] The grain shapes, are those only used when generating the final image, or are they also considered when doing grain development?
- [ ] Go through the code and apply the rules around constants from the instructions
- [ ] Go through the code and check for types that can be made more descriptive. Either by creating a new class, or just us a type alias. For example things like `Map<GrainPoint, number>`. What does `number` represent there?
- [ ] Go through the code and make sure we are using idiomatic modern typescript. For example use ** instead of Math.pow. Update your instructions to make sure you use modern idiomatic typescript in the future.
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead. Or expose the underlying parameters?
- [ ] In the gui make the unprocessed image also show as grayscale. Apply the same rgb to grayscale operation as in the grain processing pipeline.
- [ ] Enable all skipped tests again. If they fail check if they are outdated and should be removed. If they are still applicable determine if the code or the test is wrong.
- [ ] Use something like a flamegraph to find the hotspots in the code and optimize those
- [ ] Create a separate assert util for slow checks that is only run when in dev mode.
- [ ] Update agent instructions on how to use the asserts.
- [ ] Update hot code to use the dev assert.
- [ ] Go through the testcases and make sure they are all enabled and makes sense
- [ ] Optimize the algorithm
- [ ] Clean up unused files and debug utils such as `public/grain-test.html`
- [ ] Clean up old agent-generated analysis and summary md files.
- [ ] Update dependencies.

## High Priority Missing Features (Major visual impact)

- [ ] **Implement 2D Perlin noise for grain shapes**: Replace current uniform grain shapes with organic, irregular boundaries using 2D Perlin noise. Add elliptical distortion to simulate crystal orientation and implement grain halos as subtle brightness variations around edges.
- [ ] **Add upsampling workflow for grain detail**: Implement 2x-4x upsampling before grain rendering, then downsample for final output. This will allow proper grain internal structure and edge softness instead of pixel-level noise.

## Medium Priority Missing Features (Enhanced realism)

- [ ] **Implement grain bridging and clustering effects**: Add simulation of grains connecting during development through clustering algorithms. This creates more realistic grain patterns that match actual film behavior.
- [ ] **Add edge effects near high-contrast boundaries**: Implement grain density changes near high-contrast image boundaries to simulate developer depletion and chemical diffusion effects.


- [ ] Is it possible to parallelize the algorithm? Or move parts of it to the gpu using webgpu?
- [ ] Go through the repo and clean up any unused files
- [ ] Go through the code looking for repeating patterns and refactor them into shared code if it makes sense.
- [ ] The html files in public shouldn't be included in the production build
- [ ] Go through the code and clean up any comments left by a coding agent to indicate what it has changed. Comments should typically describe "why" not "what. And while comments describing changes is useful when iteracting with an agent we don't want that in the final code.
