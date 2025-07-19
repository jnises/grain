- [ ] Remove the isProcessedDataNegative hack.
- [ ] Convert the algorithm to only be monochrome. Convert any color incoming images to grayscale.
  - [x] Add grayscale conversion function to convert input ImageData to grayscale
  - [x] Update GrainProcessor.processImage to convert input to grayscale at the start
  - [x] Modify grain compositing logic to work with single grayscale channel instead of RGB
  - [x] Remove color-specific film characteristics (channelSensitivity, colorShift, chromaticAberration)
  - [x] Update grain density calculations to work with grayscale values
    **COMPLETED**: Created a new `grayscaleToExposure()` function in `src/grain-math.ts` that calculates exposure directly from single grayscale luminance values, avoiding redundant RGB-to-luminance conversion. Updated `sampleGrainAreaExposure()` in `src/grain-sampling.ts` to use grayscale exposure calculation and sample only the red channel (since all RGB channels contain identical grayscale values after conversion). Added comprehensive tests in `test/exposure-conversion.test.ts` (5 new tests) and `test/grain-sampling.test.ts` (9 new tests) to verify correct functionality. All tests pass, and the system now efficiently processes grayscale exposure calculations while maintaining identical results to the previous RGB-based approach.
  - [x] Update lightness calculation functions to work with grayscale
    **COMPLETED**: Updated `calculateLightnessFactor()` function in `src/grain-math.ts` to work properly with grayscale data. Since all RGB channels contain identical values after grayscale conversion, simplified the luminance calculation to use a single channel instead of weighted RGB calculation. This is both more efficient and conceptually correct for monochrome processing. All existing lightness preservation tests continue to pass, confirming the functionality works correctly.
  - [ ] Update output generation to duplicate grayscale to RGB channels or keep as grayscale
  - [ ] Update all tests to work with grayscale processing expectations
  - [ ] Remove color specific types and functions that have been superseeded by grayscale versions
- [ ] Go through the code and apply the rules around asserts from the instructions
- [ ] Describe the current algorithm. Write it to ALGORITHM_DESIGN.md
- [ ] Make sure the tests in grain-processor-integration.test.ts are not too lenient
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] The grain shapes, are those only used when generating the final image, or are they also considered when doing grain development?
- [ ] Go through the code and apply the rules around constants from the instructions
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
