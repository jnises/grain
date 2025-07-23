- disabling poisson grains -> still stripes
- disabling fallback grain -> still stripes
- `const finalGrainIntrinsicDensityMap = convergedGrainIntrinsicDensityMap!;` seems to be the problem
- `GrainProcessor.adjustGrainExposures` seems to be the problem
- no perhaps that wasn't the issue. just that adjusting the grain exposures makes the exposures dark enough to see the stripes
- so grainExposureMap is broken
- so calculateGrainExposures is broken?
- so sampleGrainAreaExposure is a problem?
- exposures are correct
- densities are wrong?
- This crap is the problem: ```    const randomSeed =
      (grain.x * GRAIN_RANDOM_SEED_X + grain.y * GRAIN_RANDOM_SEED_Y) %
      GRAIN_RANDOM_SEED_MOD;
    const randomSensitivity =
      (randomSeed / GRAIN_RANDOM_SEED_MOD) * GRAIN_RANDOM_SENSITIVITY_RANGE -
      GRAIN_RANDOM_SENSITIVITY_OFFSET;
```
- have the agent go through the code an find any bad custom rng
