## 🧪 Testing

This project uses Vitest for testing with separate configurations for unit tests and performance benchmarks.

**Unit Tests:**
- `npm test` - Run unit tests once (excludes performance benchmarks for faster execution)
- `npm run test:watch` - Run unit tests in watch mode (for development)
- `npm run test:ui` - Run unit tests with UI interface

**Performance Benchmarks:**
- `npm run benchmark` - Run performance benchmarks (separate from unit tests)

### Test Structure
- Unit tests are in the `/test/` directory (excluding performance benchmark files)
- Performance benchmarks: `test/performance-benchmark.test.ts` and `test/grain-worker-performance.test.ts`
- Test utilities that reuse main classes are in `/src/grain-worker-test.ts`
- Tests focus on behavior verification rather than implementation details
- Benchmarks focus on performance measurement without assertions

## ⚡ Performance Benchmarking

This project includes comprehensive performance benchmarks that are separated from the regular unit tests. Benchmarks focus on measuring and reporting performance metrics for tracking performance over time and identifying optimization opportunities.

### Running Benchmarks

```bash
# Run all performance benchmarks (separate from unit tests)
npm run benchmark
```

The benchmark tests are excluded from the regular `npm test` command to keep unit test runs fast. Benchmarks measure processing time, grain count ratios, throughput, and scaling characteristics without making assertions - they purely collect and report performance data.

## Working with coding agent
- Add items to `TODO.md`
- Issue a prompt like this:
```
Find the first unchecked (sub?)item in TODO.md and act on it.
Start by checking if it is still applicable.
If it looks like a small task just do it.
If it looks like a bigger task first split it up into subtasks and add add those as subtasks to TODO.md, then ask the user for feedback on the subtasks before continuing.
```