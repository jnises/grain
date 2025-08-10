# Performance Profiling and Hotspot Analysis

This document describes the profiling tools available for identifying performance bottlenecks and hotspots in the grain processing algorithm.

## Available Profiling Tools

### 1. 🔥 Comprehensive Profiling Script

The easiest way to run all profiling tools:

```bash
npm run profile:hotspots
```

This runs both flamegraph and V8 profiling, processes the results, and provides optimization recommendations.

### 2. 📊 Flamegraph Profiler (Inspector-based)

```bash
npm run profile:flamegraph
```

This uses the Node.js Inspector API to generate detailed CPU profiles that can be analyzed in Chrome DevTools or speedscope.app.

**Generated files:** `.cpuprofile` files in `scripts/profiling/output/`

**Analysis tools:**

- **Chrome DevTools:** Navigate to `chrome://inspect` → "Open dedicated DevTools for Node" → Profiler tab
- **speedscope.app:** Upload .cpuprofile files for interactive flamegraph visualization
- **VSCode:** Install "Profile Visualizer" extension

### 3. ⚡ Simple V8 Profiler (--prof flag)

```bash
npm run profile:simple
```

Uses Node.js built-in V8 profiler to generate traditional profiling reports.

**Generated files:** `isolate-*.log` → processed to `profile.txt`

## Current Hotspot Analysis (based on profiling results)

### Performance Breakdown

From the flamegraph profiling, the main bottlenecks are:

1. **Pixel Processing: ~80-85% of total time**
   - Most expensive operation in the algorithm
   - Runs multiple times during iterative development
   - Contains the core grain effects calculations

2. **Grain Generation: ~10-20% of total time**
   - Variable grain generation with Poisson disk sampling
   - Fallback grid generation for coverage
   - Spatial grid creation for optimization

3. **Iterative Development: Multiplies pixel processing cost**
   - Runs pixel processing 5 times by default
   - Each iteration processes all pixels to calculate lightness factor
   - Major opportunity for optimization

### Specific Hotspots Identified

Based on the existing performance analysis and profiling:

#### Hot Path 1: `processPixelEffects()`

- **Location:** `src/grain-processor.ts:456+`
- **Issue:** Nested loops through pixels and nearby grains
- **Complexity:** O(pixels × nearby_grains)
- **Optimization opportunities:**
  - Reduce grain lookup radius
  - Improve spatial grid efficiency
  - Vectorize grain influence calculations

#### Hot Path 2: Iterative Development Loop

- **Location:** `src/grain-processor.ts:212+`
- **Issue:** Full pixel processing repeated 5 times
- **Optimization opportunities:**
  - Reduce iteration count
  - Use sampling for lightness estimation instead of full processing
  - Cache intermediate results

#### Hot Path 3: Grain Grid Lookups

- **Location:** Throughout pixel processing
- **Issue:** Repeated spatial grid queries
- **Optimization opportunities:**
  - Precompute more grain relationships
  - Use more efficient data structures
  - Consider WebWorkers for parallelization

## Optimization Recommendations

### Priority 1: High Impact

1. **Optimize iterative development**: Use sampling for lightness estimation instead of full pixel processing
2. **Improve spatial grid efficiency**: Reduce unnecessary grain distance calculations
3. **Vectorize grain calculations**: Use SIMD-like operations where possible

### Priority 2: Medium Impact

1. **Reduce iteration count**: Find optimal balance between quality and performance
2. **Cache grain influence maps**: Precompute grain effects for common patterns
3. **Optimize memory access patterns**: Improve data locality in hot loops

### Priority 3: Low Impact

1. **Profile with different ISO settings**: Understand scaling behavior
2. **Consider WebGPU acceleration**: Move pixel processing to GPU
3. **Explore different algorithms**: Alternative approaches to grain simulation

## Using the Profiling Data

### Chrome DevTools Analysis

1. Open Chrome and navigate to `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to the "Profiler" tab
4. Click "Load" and select a `.cpuprofile` file from `scripts/profiling/output/`
5. Analyze the flame graph to identify functions with high self-time

### speedscope.app Analysis

1. Go to [https://speedscope.app](https://speedscope.app)
2. Click "Load profile" and upload a `.cpuprofile` file
3. Use the interactive flame graph to explore call stacks
4. Look for wide bars (high CPU usage) and deep stacks (inefficient call patterns)

### V8 Profile Analysis

Look for the "Bottom up (heavy) profile" section in the generated `profile.txt` file. Functions with high "self" percentages are the main hotspots.

## Measuring Optimization Impact

After making optimizations, re-run the profiling to measure impact:

```bash
# Before optimization
npm run profile:hotspots

# Make changes...

# After optimization
npm run profile:hotspots

# Compare the results
```

Look for:

- Reduced total processing time
- Lower self-time percentages for optimized functions
- Better pixel processing rates (pixels/second)
- Fewer iterations needed for convergence

## Advanced Profiling

### With clinic.js

If you have clinic.js installed globally:

```bash
# Flame graph
clinic flame -- node -r tsx/esm scripts/profiling/simple_profiler.mjs

# System-level analysis
clinic doctor -- node -r tsx/esm scripts/profiling/simple_profiler.mjs

# Bubble profiler for async operations
clinic bubbleprof -- node -r tsx/esm scripts/profiling/simple_profiler.mjs
```

### Manual V8 Profiling

For more control over V8 profiling:

```bash
node --prof --trace-opt --trace-deopt scripts/profiling/simple_profiler.mjs
node --prof-process isolate-*.log > detailed-profile.txt
```

This provides optimization and deoptimization information that can help identify performance issues.
