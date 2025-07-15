- [x] run linting and fix any issues
- [x] should the lint and type-check package.json scripts be separate? could they be combined? is there a reason to run them separately?
- [x] add debugging option in dev mode that draws a point at the center of each grain on the generated image
- [x] fix the eslint warning
- [ ] In GrainProcessor.processImage, split out the code into two parts, first calculate the density of all the grains, then calculate how the grains affect each pixel.
  Currently the grain strength (what does that represent?) seems to depend in the position of the pixel being shaded. Why is that? If that is to affect the shape of the grains perhaps that should be applied in the second part as described above?
  - [x] **ANALYSIS COMPLETE**: The issue is that `calculateGrainStrength()` uses pixel coordinates `(x,y)` to apply noise, making grain strength position-dependent rather than an intrinsic grain property.
  - [x] **Phase 1: Refactor grain strength calculation**
    - [x] Create new method `calculateIntrinsicGrainDensity()` that takes only `(exposure, grain)` parameters (no pixel coords)
    - [x] Move development threshold logic, sensitivity, and shape modifiers to intrinsic calculation
    - [x] Remove pixel-position noise from grain strength calculation
    - [x] Update grain exposure calculation to store intrinsic density for each grain
  - [x] **Phase 2: Create pixel-level grain effects**
    - [x] Create new method `calculatePixelGrainEffect()` that takes intrinsic grain density and pixel position
    - [x] Move pixel-level noise texture (using x,y coordinates) to this method
    - [x] Add distance falloff calculation based on grain position and radius
    - [x] Add grain shape effects (elliptical distortion) based on pixel offset from grain center
  - [ ] **Phase 3: Update processImage workflow**
    - [ ] Modify processImage to use two-phase approach: 1) Pre-calculate intrinsic density for all grains, 2) For each pixel, calculate effects from nearby grains
    - [ ] Update the main pixel loop to call `calculatePixelGrainEffect()` instead of `calculateGrainStrength()`
    - [ ] Ensure grain compositing logic works with the new structure
  - [ ] **Phase 4: Add verification tests**
    - [ ] Add tests to verify that grain intrinsic properties are position-independent
    - [ ] Add tests to verify that visual effects properly vary by position
    - [ ] Add performance tests to ensure the refactor doesn't impact performance negatively
  
- [ ] Add tests that applies the entire algorithm to some test patterns and make sure the result makes sense. Specifically test GrainProcessor.processImage using some kind of test pattern.
- [ ] Add slider to control how large the grains are relative to the image, as if to simulate the image being a cropped version of a small sections of the negative. (Or will this have the same effect as adjusting the iso?)
- [ ] Do the film type settings refer to common industry standard settings? Or do they just result in some made up parameters? If made up, convert them to use some non-brand names instead.
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
