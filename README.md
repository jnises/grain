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
