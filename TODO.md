- [x] Adjust the exposure to make sure the algorithm doesn't change the overall brightness of the image.
  **ANALYSIS**: The Beer-Lambert law implementation correctly uses white light (not original color) as established in commit a80668d920dc641f13399e335cfe8ada37d3cc42. The brightness change is expected due to the physical two-phase process: 1) input determines grain density, 2) white light viewing. Solution documented in ALGORITHM_DESIGN.md.
  **SUBTASKS**:
  - [x] Implement floating-point processing pipeline to avoid precision loss
    **COMPLETED**: Implemented comprehensive floating-point processing pipeline that preserves precision throughout grain rendering. The system now: 1) Converts input Uint8ClampedArray to Float32Array (0.0-1.0 range), 2) Processes all grain calculations in floating-point, 3) Applies Beer-Lambert compositing with floating-point precision, 4) Calculates brightness correction factor to preserve overall image brightness, 5) Converts back to Uint8ClampedArray only at the final output stage. This eliminates precision loss from integer clamping during intermediate calculations and includes automatic brightness preservation.
  - [x] Add post-processing brightness correction to preserve overall image brightness
    **COMPLETED**: Integrated into the floating-point pipeline. The system calculates brightness ratio between original and processed floating-point data, then applies correction factor during final conversion to preserve overall image brightness.
  - [x] Calculate and apply uniform brightness scaling factor after grain rendering
    **COMPLETED**: Implemented `calculateBrightnessFactor()` method that computes average brightness ratio and applies uniform scaling during the final Uint8 conversion step. The correction maintains the visual balance while preserving grain effects.
- [x] rgbToExposureFloat handles nans and infs silently. could either of those occur for valid input? should it be silent?
  **ANALYSIS COMPLETED**: Investigated the mathematical operations in `rgbToExposureFloat` and determined that with valid inputs (0-1 range), NaN and Infinity cannot occur from the mathematical operations. The function properly validates inputs using assertions that catch NaN/Infinity and throw errors (not silent). Changed the silent `Number.isFinite(result) ? result : 0` fallback to an explicit assertion with detailed context for debugging. The function now fails fast and loudly if somehow a non-finite result is produced, following the error handling guidelines.
- [ ] grain-worker.ts is getting quite long. should it be split up into multiple files?
  **ANALYSIS**: The file is 1113 lines long and contains several distinct responsibilities that could be separated for better maintainability and testability.
  **SUBTASKS**:
  - [x] Extract performance tracking utilities to `src/performance-tracker.ts`
    **COMPLETED**: Successfully extracted `PerformanceBenchmark` interface and `PerformanceTracker` class to a dedicated module. Updated imports in `grain-worker.ts` and verified all tests pass. The new module provides clean separation of performance tracking concerns.
  - [x] Extract sampling kernel generation to `src/grain-sampling.ts`
    **COMPLETED**: Successfully extracted `SamplePoint` and `SamplingKernel` interfaces, `KernelGenerator` class, and `sampleGrainAreaExposure` function to a dedicated module. The grain worker now uses the external kernel generator, maintaining clean separation of concerns while preserving all functionality. All tests pass.
  - [x] Extract color space conversions and utility functions to appropriate modules
    **COMPLETED**: Successfully extracted `rgbToLab` function to `src/color-space.ts` and `noise` function to `src/noise.ts`. These pure functions are now properly separated from the main `GrainProcessor` class, improving modularity and testability. The grain worker file was reduced from 828 to 705 lines. All tests pass after the refactoring.
  - [x] Split `GrainProcessor` class into smaller, focused classes (e.g., grain generation, grain effects calculation, image processing pipeline)
    - [x] Extract `GrainDensityCalculator` class (methods: `calculateIntrinsicGrainDensities`, `calculateIntrinsicGrainDensity`, `filmCurve`, `calculatePixelGrainEffect`) to `src/grain-density.ts` - contains substantial grain physics algorithms
      **COMPLETED**: Successfully extracted `GrainDensityCalculator` class with methods `calculateIntrinsicGrainDensities`, `calculateIntrinsicGrainDensity`, `filmCurve`, and `calculatePixelGrainEffect` to `src/grain-density.ts`. The grain worker now uses the external density calculator for all grain physics algorithms, maintaining clean separation of concerns while preserving all functionality. Updated the test suite to work with the new structure. All tests pass after the refactoring. The grain worker file was reduced from 639 to 480 lines.
  - [x] Ensure all tests still pass after refactoring
    **COMPLETED**: Verified that all 197 tests pass successfully. The refactoring work has been done correctly and all functionality is preserved with clean separation of concerns.
- [ ] Looks like the brightnessFactor compensation is applied in gamma space. Is that physically plausible? The brightness compensation should be applied as if adjusting the exposure when taking the photo or developing the photo copy.
- [ ] Is the current color maths done in a gamma correct way?
- [ ] Go through the code and apply the rules around constants from the instructions
- [ ] Go through the code and apply the rules around asserts from the instructions
- [ ] Go through the code and check for types that can be made more descriptive. Either by creating a new class, or just us a type alias. For example things like `Map<GrainPoint, number>`. What does `number` represent there?
- [ ] Update ALGORITHM_DESIGN.md to reflect the changes that have been made to the algorithm. Also look at git history for what changes have been made. If this is difficult to do we should probably just remove the file.
  For example we are not using voronoi diagrams.
  The change from multi layer to variable grain size.
- [ ] Try to clean up processImage and related code a bit. It has been refactored a bunch and there seems to be a bunch of unnecessary remnants of old things.
- [ ] When checking surrounding cells in processImage, are we sure a 3x3 neighborhood is large enough to fit the largest size grains?
- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense. Specifically test GrainProcessor.processImage using some kind of test pattern.
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead. Or expose the underlying parameters?
- [ ] The grain shapes, are those only used when generating the final image, or are they also considered when doing grain development?
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
