# Grain - Physically Plausible Analog Film Grain Simulation

> **⚠️ Prototype Notice**: This is a prototype project designed to test coding agent workflows and development processes. While it implements sophisticated grain simulation algorithms, the functionality is not yet complete and should not be expected to produce production-ready results.

A TypeScript/React application that simulates realistic analog film grain effects for digital images. This project implements sophisticated algorithms that model the actual structure and behavior of silver halide crystals in photographic emulsion, creating grain that appears authentic even when zoomed in.

## 🎯 Features

- **Physically Accurate Grain**: Models real film grain characteristics based on photographic principles
- **Variable Grain Size**: Creates realistic grain with natural size variation across the image
- **ISO-Responsive**: Grain size and density automatically adjust based on film speed settings
- **Luminance-Dependent Response**: Grain visibility varies realistically across shadows, mid-tones, and highlights
- **Color Channel Modeling**: Separate grain characteristics for RGB channels, matching real film behavior
- **High Performance**: Optimized algorithms with Web Worker support for non-blocking processing
- **Interactive Visualization**: Real-time grain preview and parameter adjustment

## 🧬 Technical Approach

This project goes beyond simple noise generation to create authentic film grain through:

- **Poisson disk sampling** for blue noise grain distribution
- **Multi-channel color response modeling** with channel-specific grain characteristics
- **Organic grain shapes** using 2D Perlin noise for irregular boundaries
- **Exposure-dependent grain density** following real photographic behavior
- **Blue noise sampling** to avoid artificial regular patterns

The algorithms are designed to be both scientifically accurate and computationally efficient.

## 📋 Requirements

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)

### Installation
```bash
# Clone the repository
git clone https://github.com/jnises/grain.git
cd grain

# Install dependencies
npm install

# Start development server
npm run dev
```

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
Stop after you've completed the item.
If it looks like a bigger task first split it up into subtasks and add add those as subtasks to TODO.md, then ask the user for feedback on the subtasks before continuing.
```
Or if you are using vscode run the canned prompt `/todo-act`