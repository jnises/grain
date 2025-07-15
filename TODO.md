- [x] Why does applyBeerLambertCompositing take originalColor as a parameter? Shouldn't the final color only depend on the grains? The original color should have been used to calculate the grain responses, but after that why are they used?
  **ANALYSIS REVEALS CONCEPTUAL ERROR**: The current implementation incorrectly uses the input image color as both exposure light AND viewing light. Correct physics: 1) Input image determines grain density during "exposure", 2) When "viewing" the film, WHITE printing light passes through grains: `final = white_light * exp(-density)`. The current approach conflates exposure and viewing steps. We should use white light [255,255,255] for Beer-Lambert compositing to create proper film negative, then optionally invert for positive print.
  **FIXED**: Updated `applyBeerLambertCompositing()` to use white light (255) instead of original color for physically accurate film viewing simulation. The method now properly implements the two-phase process: 1) input image determines grain exposure/density, 2) white viewing light passes through developed grains following Beer-Lambert law. Tests updated to verify correct white light behavior.
- [x] Run `npm run check` and fix the issues.
  **FIXED**: Resolved 2 ESLint errors in `grain-worker.ts`: 1) Replaced `any` type with proper union type `ProgressMessage | ResultMessage | ErrorMessage` for the `safePostMessage` function parameter, 2) Removed unused `error` parameter in catch block. Added missing `ErrorMessage` import from types.
- [ ] Adjust the exposure to make sure the algorithm doesn't change the overall brightness of the image.
- [ ] Go through the code and look for methods that should be static.
- [ ] Look for static methods that should really be free functions.
- [ ] Go through the code and apply the rules around constants from the instructions
- [ ] Go through the code and check for types that can be made more descriptive. Either by creating a new class, or just us a type alias. For example things like `Map<GrainPoint, number>`. What does `number` represent there?
- [ ] Try to clean up processImage and related code a bit. It has been refactored a bunch and there seems to be a bunch of unnecessary remnants of old things.
- [ ] When checking surrounding cells in processImage, are we sure a 3x3 neighborhood is large enough to fit the largest size grains?
- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense. Specifically test GrainProcessor.processImage using some kind of test pattern.
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead. Or expose the underlying parameters?
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
