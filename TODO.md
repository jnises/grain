- [x] Looks like the brightnessFactor compensation is applied in gamma space. Is that physically plausible? The brightness compensation should be applied as if adjusting the exposure when taking the photo or developing the photo copy.
  **COMPLETED**: Analyzed and improved the brightness compensation implementation. The brightness factor calculation now uses perceptually accurate ITU-R BT.709 luminance weights (0.2126 * R + 0.7152 * G + 0.0722 * B) instead of simple RGB averaging. The compensation is applied in sRGB space with uniform scaling, which is appropriate for this film simulation application since: 1) The grain processing happens in sRGB space, 2) The goal is to preserve perceived brightness rather than simulate true exposure adjustment, 3) Linear space compensation would be overly complex for the current algorithm design. All brightness preservation tests pass with improved accuracy.
- [x] Is the current color maths done in a gamma correct way?
  **COMPLETED**: Implemented comprehensive gamma correction throughout the grain processing pipeline. The system now: 1) Converts input sRGB values to linear space using proper gamma correction functions (`srgbToLinear`), 2) Performs all grain calculations (Beer-Lambert law, brightness calculations, etc.) in linear RGB space for physically correct light blending, 3) Converts back to sRGB space using gamma encoding (`linearToSrgb`) before output. This ensures that light transmission calculations are physically accurate and brightness preservation works correctly in the perceptually correct color space. All tests pass with the updated linear color space processing.
- [x] Make sure we work with colors in linear space as much as possible. Convert from/to gamma on input/output.
  **COMPLETED**: All color processing, grain compositing, and exposure calculations are performed in linear RGB space. Input is converted from sRGB to linear at the start, and output is converted back to sRGB at the end. All relevant tests pass, confirming correct implementation.
- [x] Use "lightness" rather than "brightness" in the processing pipeline
  **COMPLETED**: Replaced "brightness" terminology with "lightness" throughout the processing pipeline. Updated function names from `applyBrightnessScaling` to `applyLightnessScaling` and `calculateBrightnessFactor` to `calculateLightnessFactor` in `grain-math.ts:62,104`. Updated corresponding imports and function calls in `grain-worker.ts:330-336`. Updated test descriptions and variable names in `exposure-brightness-preservation.test.ts` to use "lightness" terminology. All tests pass and the terminology now correctly reflects perceptual lightness rather than the more ambiguous "brightness" term.
- [x] Try to clean up processImage and related code a bit. It has been refactored a bunch and there seems to be a bunch of unnecessary remnants of old things.
  - [x] ~~Extract lightness correction into pure function~~ (Already done - `calculateLightnessFactor` and `applyLightnessScaling` exist)
  - [x] ~~Extract grain exposure calculation into pure function~~ (Already done - `calculateGrainExposures` is pure)
  - [x] Extract main pixel processing loop into pure function `processPixelEffects(grains, exposureMap, imageData) -> Float32Array`
  - [x] Extract progress reporting helper to reduce inline clutter and standardize progress percentages
- [ ] Update ALGORITHM_DESIGN.md to reflect the changes that have been made to the algorithm. Also look at git history for what changes have been made. If this is difficult to do we should probably just remove the file.
  For example we are not using voronoi diagrams.
  The change from multi layer to variable grain size.
- [ ] When checking surrounding cells in processImage, are we sure a 3x3 neighborhood is large enough to fit the largest size grains?
- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense. Specifically test GrainProcessor.processImage using some kind of test pattern.
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
- [ ] Add option for monochrome grains
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
