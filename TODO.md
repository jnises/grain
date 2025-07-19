- [x] Remove the grain intensity functionality. Iso should be enough to control the amount of grain applied.
  **COMPLETED**: Successfully removed the redundant `grainIntensity` parameter from the grain processing pipeline. Changes included:
  - Removed `grainIntensity` from the `GrainSettings` interface and all film presets
  - Removed grain intensity validation from type guards and assertion functions
  - Removed grain intensity UI controls (slider) from the web interface
  - Removed the multiplication by `grainIntensity` in the grain density calculation, replacing it with a fixed multiplier
  - Updated all test files to remove `grainIntensity` references and removed the dedicated grain intensity test section
  - Verified that ISO already controls fundamental grain properties (size, density, count) through direct calculations
  The grain simulation now relies solely on ISO settings for grain control, eliminating redundant parameters and simplifying the interface while maintaining all functionality. All tests pass and the build succeeds.
- [ ] What does `GrainSettings.upscaleFactor` do. Can it be removed?
- [ ] processPixelEffects should return a new result image rather than writing to resultFloatData.
- [ ] Create a page like public/grain-debug.html that replicates the testpatterns from grain-processor-integration.test.ts
- [ ] Go through the code and apply the rules around constants from the instructions
- [ ] Go through the code and check for types that can be made more descriptive. Either by creating a new class, or just us a type alias. For example things like `Map<GrainPoint, number>`. What does `number` represent there? If a non-bespoke type is used, make sure to document what it represents in a doc comment. For example is a `number` that represents a color in srgb or linear?
- [ ] Go through the code and make sure we are using idiomatic modern typescript. For example use ** instead of Math.pow. Update your instructions to make sure you use modern idiomatic typescript in the future.
- [ ] Make sure the tests in grain-processor-integration.test.ts are not too lenient
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
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
