- [x] Add a document called ALGORITHM_DESIGN.md that contains some high level design goals for the desired algorithm implementation.
  - [x] It should mention that the input image is only used to develop or expose the grains. The grains are then used to "print" a final photo. As if the input image was the light that the camera saw. Then the developed film is used in a darkroom to create a photo. Explain it using a analog film processing analogy.
  - [x] All color operations should be done in linear space. srgb packing/unpacking is done on output/input from the pipeline.
- [x] processPixelEffects should return a new result image rather than writing to resultFloatData.
- [x] ### Iterative Lightness Compensation Implementation

  The lightness compensation should be done using an iterative approach. Currently the compensation is only done at the end. A more physically plausible approach would be to adjust the exposure iteratively over a few iteration until the desired lightness is achieved.

  **Progress:**
  - [x] Extract film development phase into reusable function
  - [x] Move lightness factor calculation after each iteration
  - [x] Remove code duplication between estimation and main pipeline 
  - [x] Fix exposure adjustment bounds checking - uses logarithmic scaling with dampening and strict clamping to [0,1]
  - [x] Implement convergence logic that iterates the development phase until target lightness is achieved (with max iteration limit)
  - [x] Add configuration for iteration parameters (max iterations, convergence threshold)
  - [x] Update performance tracking to account for multiple iterations
  - [x] Update progress reporting to account for multiple iterations
  - [x] Test iterative vs single-pass approaches to ensure quality improvements
    - **Results**: Iterative approach provides significant improvements for mid-tone images (e.g., 50% gray: single-pass 42.16% error vs iterative 0.01% error)
    - **Edge case discovered**: Very dark images (18% gray) show 100% error for both approaches - needs investigation
    - **Convergence working**: Algorithm typically converges within 1-2 iterations for most cases
  - [x] **Improve the dark image behavior. Make sure the test passes.**
    - [x] Investigated why 18% gray images produced 100% lightness error (output became completely black)
    - [x] Root cause discovered: Incorrect darkroom physics implementation - `finalGrayscale = 1.0 - lightTransmission` was backwards
    - [x] Fixed Beer-Lambert law application: `finalGrayscale = lightTransmission` for positive image simulation
    - [x] Fixed "no grains" case: changed from `finalGrayscale = 0.0` (black) to `finalGrayscale = 1.0` (transparent film → bright result)
    - [x] Verified exposure adjustment factor calculation works correctly for low-exposure scenarios  
    - [x] Tested iterative convergence behavior with dark images - now produces excellent results:
      - **5% gray**: 0.0500 → 0.0510 (2.0% error) ✅
      - **18% gray**: 0.1800 → 0.1843 (2.4% error) ✅ 
      - **All gray levels**: Under 6% error instead of 100% black output
    - [x] Updated tests to reflect that both approaches now work well (removed expectation of >5% single-pass error)
    - [x] All iterative-vs-single-pass tests now pass ✅
  - [x] Update algorithm documentation to reflect the iterative development process, as well as other recent changes.
- [x] **The grain generator seems to generate more grains with higher iso. I would expect fewer and larger grains for higher iso? Write some tests to validate the behavior.**
  - [x] Created comprehensive tests in `test/grain-iso-behavior.test.ts` to validate current grain generation behavior
  - [x] **Findings**: Current implementation has complex but reasonable behavior:
    - **Grain Size**: Higher ISO → larger grains ✅ (physically correct, scales directly: ISO 100=0.5px, ISO 1600=8px)
    - **Grain Density**: Increases with ISO until geometric constraints kick in at high ISO
    - **Key insight**: At very high ISO (1600), grain count drops to 117 vs 469 at ISO 800 due to large grain size constraints
    - **Result**: Accidentally more physically realistic at extremes than initially expected
  - [x] Tests document expected vs actual behavior and provide foundation for future improvements
- [ ] Write tests that checks that the actual grains generation is physically plausible.
  I expect that at higher iso the grains should be larger and fewer.
  At lower iso the grains should be more numerous but smaller.
  The scaling should be such that the total coverage of the grains is greater at higher iso.
  - [x] **Research completed**: Confirmed how film grains work in the real world:
    - **Higher ISO**: Larger silver halide crystals, more light-sensitive, but FEWER per unit area
    - **Lower ISO**: Smaller crystals, less light-sensitive individually, but MORE densely packed
    - **Total coverage**: Higher ISO films have greater effective light-capturing area despite fewer grains
    - **Current issue**: Our implementation has the opposite behavior (more grains at higher ISO)
  - [ ] Update ALGORITHM_DESIGN.md with this physically accurate grain behavior
  - [ ] Write comprehensive tests that validate the physically correct grain behavior:
    - [ ] Test that grain count DECREASES as ISO increases
    - [ ] Test that average grain size INCREASES as ISO increases  
    - [ ] Test that total grain coverage area INCREASES as ISO increases
    - [ ] Test grain size distribution patterns match real film behavior
  - [ ] Update the grain generation algorithm to match physical film behavior:
    - [ ] Modify density calculation to decrease grain count with higher ISO
    - [ ] Ensure grain size scaling works correctly with new density model
    - [ ] Verify total coverage area increases appropriately with ISO
    - [ ] Test edge cases (very high/low ISO values)
  - [ ] Update existing grain behavior tests to reflect new physically accurate expectations
  - [ ] Update any dependent code that assumes the old grain density behavior
- [ ] Run processImage in a benchmark to check how much time each step takes. Adjust reportProgress to match.
- [ ] Find all skipped tests and list them here as subtasks, so we can try enabling them again one by one.
  - [ ] `test/grain-processor.test.ts` > "should produce minimal changes to the original image at low ISO"
  - [ ] `test/grain-processor.test.ts` > "should have minimal grain effect at very low ISO (50)"  
  - [ ] `test/grain-processor.test.ts` > "should preserve image structure at low ISO"
  - [ ] `test/grain-processor-integration.test.ts` > "should process checkerboard patterns correctly"
  - [ ] `test/grain-processor-integration.test.ts` > "should produce minimal changes to the original image at low ISO"
  - [ ] `test/grain-processor-integration.test.ts` > "should have minimal grain effect at very low ISO (50)"
  - [ ] `test/grain-processor-integration.test.ts` > "should preserve image structure at low ISO" 
  - [ ] `test/exposure-lightness-preservation.test.ts` > "should preserve overall lightness for middle gray (18% gray)"
  - [ ] `test/exposure-lightness-preservation.test.ts` > "should preserve overall lightness for various gray levels"
  - [ ] `test/exposure-lightness-preservation.test.ts` > "should preserve overall lightness for black and white extremes"
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
