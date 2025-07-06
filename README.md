## Working with a coding agent

When working with a coding agent, please follow this workflow:

1.  **Run the development server yourself:** In a separate terminal, navigate to the project root and run `npm run dev`. Keep this terminal open to see real-time HMR updates in your browser.
2.  **Request changes from the agent:** Use the Gemini CLI terminal to ask the agent to modify code, add features, or fix bugs.
3.  **Agent will verify changes:** After making changes, the agent will automatically run `npm run build` or `npx tsc` to check for compilation or type errors. If errors occur, the agent will attempt to fix them.
4.  **Observe HMR updates:** Your browser, running `npm run dev`, will automatically reflect the agent's changes via HMR once they are successfully applied and verified.
5.  **Report errors to the agent:** If you encounter any runtime errors in your browser or in the terminal running `npm run dev`, please copy and paste the full error message to the agent for analysis and resolution.

## 🧪 Testing

This project uses Vitest for testing. Available test commands:

- `npm test` - Run tests once (for CI/production)
- `npm run test:watch` - Run tests in watch mode (for development)
- `npm run test:ui` - Run tests with UI interface
- `npm run benchmark` - Run performance benchmarks to verify optimizations

### Test Structure
- Unit tests are in the `/test/` directory
- Test utilities that reuse main classes are in `/src/grain-worker-test.ts`
- Tests focus on behavior verification rather than implementation details

## ⚡ Performance Benchmarking

This project includes comprehensive performance benchmarks to verify that the multiple grain layers optimization is working correctly.

### Running Benchmarks

```bash
# Run all performance benchmarks
npm run benchmark

# Run specific benchmark tests
npm test -- performance-benchmark.test.ts
npm test -- grain-worker-performance.test.ts
```

### What the Benchmarks Measure

1. **Grain Generation Performance**: Compares single layer vs multiple layers grain generation speed
2. **Processing Throughput**: Measures pixels processed per second across different image sizes
3. **Optimization Effectiveness**: Verifies that multiple layers performs within acceptable range of single layer
4. **Scaling Performance**: Tests performance consistency across different image dimensions

### Expected Results

With the optimization in place, you should see:

- **Multiple layers 1.2-1.6x faster** than single layer mode (due to optimized algorithms)
- **Consistent performance** across different image sizes
- **High throughput**: 200+ grains/ms processing rate
- **Low overhead**: < 30ms processing time for typical images

### Benchmark Output Example

```
📈 Results for 400x300:
  Single Layer:     46.75ms
  Multiple Layers:  30.77ms
  Performance:      52.0% faster than expected
  Optimization:     ✅ OPTIMIZED

📊 Detailed Performance Metrics:
  400x300:
    Single:   3.03M pixels/sec
    Multiple: 4.10M pixels/sec
    Ratio:    1.35x
```

### Performance Tracking in Browser

When using the grain processor in the browser, detailed performance metrics are logged to the console:

```
=== Performance Benchmarks ===
Grain Generation: 15.33ms
Spatial Grid Creation: 2.45ms
Pixel Processing: 28.92ms
Total Processing: 46.70ms
  - 2.57M pixels/sec

=== Performance Metrics ===
Total processing speed: 2.57M pixels/sec
Processing overhead: 5.2%
Layer processing mode: Multiple Layers (optimized)
```

### Programmatic Performance Access

The grain worker automatically tracks performance metrics. To access them in your application:

```typescript
// Performance metrics are automatically logged to console
// Look for these log entries when processing images:
// - "=== Performance Benchmarks ==="
// - "=== Performance Metrics ==="

// The grain worker includes detailed timing for:
// - Grain Generation: Time to create grain structures
// - Spatial Grid Creation: Time to build spatial optimization
// - Pixel Processing: Time to apply grain to each pixel
// - Multiple/Single Layer Processing: Mode-specific timing
```

### Troubleshooting Performance

If benchmarks show poor performance:

1. **Check browser dev tools** - Performance tab can identify bottlenecks
2. **Verify optimization** - Multiple layers should be comparable to single layer speed
3. **Image size impact** - Very large images (>1MP) may show different characteristics
4. **System resources** - CPU usage should remain reasonable during processing

### Optimization Story

The grain processing algorithm was significantly optimized to resolve performance bottlenecks:

**Before Optimization:**
- Multiple layers mode was much slower due to O(n²) complexity
- Each pixel performed expensive `layer.grains.filter(grain => nearbyGrains.includes(grain))` operations
- Processing time scaled poorly with grain density

**After Optimization:**
- Implemented grain-to-layer mapping for O(1) layer lookup
- Eliminated redundant filtering operations
- Multiple layers now performs better than single layer mode
- Benchmarks verify the optimization effectiveness

### More Information

For detailed implementation details and algorithm design, see:
- `ALGORITHM_DESIGN.md` - Complete algorithm specification
- `IMPLEMENTATION_SUMMARY.md` - Summary of recent optimizations
- `TODO.md` - Current development status and completed optimizations