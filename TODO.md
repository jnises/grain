- [x] When checking surrounding cells in processImage, are we sure a 3x3 neighborhood is large enough to fit the largest size grains?
  **COMPLETED**: Analyzed the `createGrainGrid` function in `src/grain-generator.ts` and the `processPixelEffects` function in `src/grain-worker.ts`. The `gridSize` is calculated based on `maxGrainSize`, and `createGrainGrid` correctly assigns grains to all grid cells they can influence based on their `influenceRadius`. The 3x3 neighborhood check in `processPixelEffects` is therefore sufficient to find all relevant grains for a given pixel. The logic is sound.
- [x] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense. Specifically test GrainProcessor.processImage using some kind of test pattern.
  **COMPLETED**: Created comprehensive integration tests in `test/grain-processor-integration.test.ts` that verify the complete grain processing algorithm works correctly. Tests cover: 1) Pattern processing (solid gray, gradient, checkerboard, radial), 2) Film type differences (kodak, fuji, ilford), 3) ISO sensitivity effects (100 vs 1600), 4) Grain intensity effects (0.2 vs 2.0), 5) Edge cases (1x1 images, extreme brightness values), 6) Performance testing (200x150 images processed within 5 seconds). All 10 tests pass successfully, confirming the algorithm produces sensible results across various test patterns and parameter combinations.
- [x] Add test to grain-processor.test.ts that checks that at low iso the resulting image is mostly the same as the original image.
  **COMPLETED**: Created comprehensive tests that verify low ISO processing produces minimal changes to the original image. The test suite includes: 1) Testing at ISO 100 with various brightness levels (64, 128, 192) to ensure average pixel differences stay under 50 units and brightness preservation within 20 units, 2) Testing at very low ISO (50) to ensure 85% of pixels remain nearly identical (within 5 units), 3) Testing structure preservation with a two-tone pattern to ensure basic image structure is maintained. **Tests have been moved to `test/grain-processor-integration.test.ts` as a "Low ISO Processing" test section.**
- [x] Make sure GrainProcessor is created with a deterministic rng whenever it is used in tests.
  **COMPLETED**: Modified GrainProcessor constructor to accept an optional RandomNumberGenerator parameter and updated all test files to use deterministic seeded RNG. Added a `createTestGrainProcessor` utility function that creates GrainProcessor instances with a SeededRandomNumberGenerator (seed=12345) for consistent, reproducible test results. Updated test files: grain-processor-integration.test.ts, grain-processor.test.ts, grain-two-phase-verification.test.ts, and exposure-lightness-preservation.test.ts. All tests now pass with deterministic behavior, as evidenced by consistent grain generation attempts (e.g., 400 grains in 928 attempts consistently).
- [ ] Convert the algorithm to only be monochrome. Convert any color incoming images to grayscale.
  - [x] Add grayscale conversion function to convert input ImageData to grayscale
  - [ ] Update GrainProcessor.processImage to convert input to grayscale at the start
  - [ ] Modify grain compositing logic to work with single grayscale channel instead of RGB
  - [ ] Remove color-specific film characteristics (channelSensitivity, colorShift, chromaticAberration)
  - [ ] Update grain density calculations to work with grayscale values
  - [ ] Update lightness calculation functions to work with grayscale
  - [ ] Update output generation to duplicate grayscale to RGB channels or keep as grayscale
  - [ ] Update all tests to work with grayscale processing expectations
- [ ] Describe the current algorithm. Write it to ALGORITHM_DESIGN.md
- [ ] Make sure the tests in grain-processor-integration.test.ts are not too lenient
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] The grain shapes, are those only used when generating the final image, or are they also considered when doing grain development?
- [ ] Go through the code and apply the rules around constants from the instructions
- [ ] Go through the code and apply the rules around asserts from the instructions
- [ ] Go through the code and check for types that can be made more descriptive. Either by creating a new class, or just us a type alias. For example things like `Map<GrainPoint, number>`. What does `number` represent there?
- [ ] Go through the code and make sure we are using idiomatic modern typescript. For example use ** instead of Math.pow. Update your instructions to make sure you use modern idiomatic typescript in the future.
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead. Or expose the underlying parameters?
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
