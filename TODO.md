- [x] **The grain generator seems to generate more grains with higher iso. I would expect fewer and larger grains for higher iso? Write some tests to validate the behavior.**
  - [x] Created comprehensive tests in `test/grain-iso-behavior.test.ts` to validate current grain generation behavior
  - [x] **Findings**: Current implementation has complex but reasonable behavior:
    - **Grain Size**: Higher ISO → larger grains ✅ (physically correct, scales directly: ISO 100=0.5px, ISO 1600=8px)
    - **Grain Density**: Increases with ISO until geometric constraints kick in at high ISO
    - **Key insight**: At very high ISO (1600), grain count drops to 117 vs 469 at ISO 800 due to large grain size constraints
    - **Result**: Accidentally more physically realistic at extremes than initially expected
  - [x] Tests document expected vs actual behavior and provide foundation for future improvements
- [x] Check that GrainProcessor.processImage uses the output of the beer lambert calculation correctly according to ALGORITHM_DESIGN.md. Specifically the behavior that denser grains should result in lighter output.
  - [x] **Analysis**: Found that the Beer-Lambert law calculation was correct, but the final photographic paper simulation was backwards
  - [x] **Issue**: Code used `finalGrayscale = lightTransmission`, which made dense grains produce dark output (opposite of expected behavior)
  - [x] **Root Cause**: Missing simulation of photographic paper response - more light transmission should create darker paper, not lighter
  - [x] **Solution**: Changed to `finalGrayscale = 1.0 - lightTransmission` to simulate paper darkening with light exposure
  - [x] **Verification**: Tested relative grain behavior - now correctly shows Dark < Medium < Bright output ordering ✓
  - [x] **Performance Impact**: Lightness correction factors improved from ~0.03 to ~0.65-2.7 (much more reasonable range)
- [x] Clean up ALGORITHM_DESIGN.md
  - [x] **Completed**: Streamlined document to focus on core implementation principles
  - [x] **Key changes**: Emphasized critical "negative behavior" warning at top with code examples
  - [x] **Improvements**: Removed verbose explanations, added concrete TypeScript snippets for key calculations
  - [x] **Focus**: Document now directly guides implementation decisions without redundant theory
  - [x] **Linear color space**: Clarified pipeline boundaries and conversion requirements
- [x] Write tests that checks that the actual grains generation is physically plausible.
  I expect that at higher iso the grains should be larger and fewer.
  At lower iso the grains should be more numerous but smaller.
  The scaling should be such that the total coverage of the grains is greater at higher iso.
  - [x] **Research completed**: Confirmed how film grains work in the real world:
    - **Higher ISO**: Larger silver halide crystals, more light-sensitive, but FEWER per unit area
    - **Lower ISO**: Smaller crystals, less light-sensitive individually, but MORE densely packed
    - **Total coverage**: Higher ISO films have greater effective light-capturing area despite fewer grains
    - **Current issue**: Our implementation has the opposite behavior (more grains at higher ISO)
  - [x] Update ALGORITHM_DESIGN.md with this physically accurate grain behavior
  - [x] Write comprehensive tests that validate the physically correct grain behavior:
    - [x] Test that grain count DECREASES as ISO increases
    - [x] Test that average grain size INCREASES as ISO increases  
    - [x] Test that total grain coverage area INCREASES as ISO increases
    - [x] Test grain size distribution patterns match real film behavior
    - [x] **Implementation completed**: Created comprehensive test suite in `test/grain-physical-behavior.test.ts`
    - [x] **Test validation**: All tests properly fail, confirming current behavior is opposite of physics
    - [x] **Current findings**: Grain count increases with ISO (400→800→1600 grains) instead of decreasing
    - [x] **Physics correctness**: Grain size scaling works correctly, but density behavior needs fixing
  - [x] Update the grain generation algorithm to match physical film behavior:
    - [x] **Phase 1: Fix core density formula** ✅
      - [x] Replace `desiredDensityFactor = iso / ISO_TO_DENSITY_DIVISOR` with inverse formula
      - [x] Implement `desiredDensityFactor = BASE_DENSITY_FACTOR / (1 + iso / ISO_NORMALIZATION_CONSTANT)`
      - [x] Add new constants: `BASE_DENSITY_FACTOR`, `ISO_NORMALIZATION_CONSTANT` 
      - [x] Test that basic grain count decreases with ISO (run physical behavior test)
      - [x] **RESULT**: Grain count now correctly decreases: ISO 100: 19200 → ISO 3200: 117 grains ✅
    - [x] **Phase 2: Adjust coverage compensation** ✅ (with geometric constraints)
      - [x] Modify coverage calculation to account for grain size scaling
      - [x] Ensure total grain coverage area increases with ISO in viable range (ISO 100-400)
      - [x] Balance grain count reduction vs grain size increase for net coverage gain  
      - [x] **RESULT**: Coverage increases until geometric constraints limit packing (~ISO 400)
      - [x] **NOTE**: Full coverage scaling requires 3D grain stacking (future TODO item)
    - [x] **Phase 3: Tune constants and validate** ✅
      - [x] Fine-tune `BASE_DENSITY_FACTOR`, `ISO_NORMALIZATION_CONSTANT` for realistic grain counts
      - [x] Adjust `MAX_DENSITY_FACTOR` and related constraints if needed
      - [x] Verify geometric constraints work properly (large grains can't pack too densely)
      - [x] Test edge cases: very high ISO (3200+) and very low ISO (25-50)
    - [x] **Phase 4: Integration testing** ✅
      - [x] Ensure all physical behavior tests pass
      - [x] Verify grain size scaling still works correctly
      - [x] Check that visual output looks reasonable across ISO range
  - [x] Update existing grain behavior tests to reflect new physically accurate expectations
  - [x] Update any dependent code that assumes the old grain density behavior
    - [x] **Fixed test**: `test/grain-distribution.test.ts` - Updated assertion to expect fewer grains at higher ISO
    - [x] **Fixed test**: `test/grain-processor-integration.test.ts` - Updated misleading test name and comments
    - [x] **Result**: All tests now correctly expect physically accurate behavior
- [ ] If I try to add iso 50 grain to a 400x300 image I get this error:
  ```
  grain-worker.ts:80 Worker error: Maximum call stack size exceeded RangeError: Maximum call stack size exceeded
  at GrainGenerator.createGrainGrid (http://localhost:5173/src/grain-generator.ts?t=1753016956836:389:31)
  at WorkerGrainProcessor.createGrainGrid (http://localhost:5173/src/grain-processor.ts?t=1753016956836:107:32)
  at WorkerGrainProcessor.processImage (http://localhost:5173/src/grain-processor.ts?t=1753016956836:133:28)
  at self.onmessage (http://localhost:5173/src/grain-worker.ts?worker_file&type=module:40:36)

grain-worker-manager.ts:158 Worker processing error: Maximum call stack size exceeded
App.tsx:266 Grain processing failed: Maximum call stack size exceeded
﻿
  ```
  Since the grains are quite dense, would it make more sense to use an array rather than a map to store the grid?
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
- [ ] Update the grain generation logic to do a full 3d emulsion simulation.
  * In real film grains are suspended at multiple depths, and can overlap.
  * In the current implementation we don't support overlapping.
  * Could just take the current grain generation and just have multiple at different depths?
  * refer to GRAIN_OVERLAPPING.md for some notes on the issue
- [ ] Add support for lower iso than 50
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
- [ ] **Add upsampling workflow for grain detail**: Implement 2x-4x upsampling before grain rendering, then downsample for final output. This will allow proper grain internal structure and edge softness instead of pixel-level noise.
- [ ] **Implement grain bridging and clustering effects**: Add simulation of grains connecting during development through clustering algorithms. This creates more realistic grain patterns that match actual film behavior.
- [ ] **Add edge effects near high-contrast boundaries**: Implement grain density changes near high-contrast image boundaries to simulate developer depletion and chemical diffusion effects.
- [ ] Is it possible to parallelize the algorithm? Or move parts of it to the gpu using webgpu?
- [ ] Go through the repo and clean up any unused files
- [ ] Go through the code looking for repeating patterns and refactor them into shared code if it makes sense.
- [ ] The html files in public shouldn't be included in the production build
- [ ] Go through the code and clean up any comments left by a coding agent to indicate what it has changed. Comments should typically describe "why" not "what. And while comments describing changes is useful when iteracting with an agent we don't want that in the final code.
