# Grain - Analog Film Grain Simulation

> **⚠️ Prototype Notice**: This is a prototype project designed to test coding agent workflows and development processes. The functionality is not yet complete and should not be expected to produce production-ready results.

A TypeScript/React application that simulates analog film grain effects for digital images. This project implements algorithms that attempt to model aspects of film grain structure and behavior.

## 🎯 Features

- **Film Grain Simulation**: Simulates film grain characteristics based on various parameters
- **Variable Grain Size**: Creates grain with size variation across the image
- **ISO-Responsive**: Grain size and density adjust based on film speed settings
- **Luminance-Dependent Response**: Grain visibility varies across shadows, mid-tones, and highlights
- **Monochrome Processing**: Processes all input images as grayscale for film grain simulation
- **Web Worker Support**: Includes Web Worker support for non-blocking processing
- **Interactive Visualization**: Real-time grain preview and parameter adjustment

## 🧬 Technical Approach

This project explores film grain simulation through:

- **Poisson disk sampling** for grain distribution
- **Multi-channel color response modeling** with channel-specific grain characteristics
- **Grain shapes** using 2D Perlin noise for irregular boundaries
- **Exposure-dependent grain density** following photographic behavior patterns
- **Blue noise sampling** to avoid regular patterns

The algorithms aim to balance visual results with computational requirements.

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

## 🔧 Development Scripts

### Server Management

- `npm run dev` - Start the Vite development server
- `npm run dev:stop` - Safely stop any running development servers (targets Vite ports 5173, 5174)
- `npm run dev:restart` - Stop existing servers and start a fresh development server

The `dev:stop` script safely targets only processes using Vite's default ports to avoid accidentally killing other processes.

## 🧪 Testing

This project uses Vitest for testing with separate configurations for unit tests and performance benchmarks.

**Unit Tests:**

- `npm test` - Run unit tests once (excludes performance benchmarks for faster execution)
- `npm run test:watch` - Run unit tests in watch mode (for development)
- `npm run test:ui` - Run unit tests with UI interface

**Code Quality:**

- `npm run check` - Run both linting and type checking
- `npm run lint` - Run ESLint for code style and quality checks
- `npm run type-check` - Run TypeScript compiler for type checking

**Performance Benchmarks:**

- `npm run benchmark` - Run performance benchmarks (separate from unit tests)

### Test Structure

- Unit tests are in the `/test/` directory (excluding performance benchmark files)
- Performance benchmarks: `test/performance-benchmark.test.ts` and `test/grain-worker-performance.test.ts`
- Tests focus on behavior verification rather than implementation details
- Benchmarks focus on performance measurement without assertions

## ⚡ Performance Benchmarking

This project includes performance benchmarks that are separated from the regular unit tests. Benchmarks measure and report performance metrics for tracking performance over time and identifying optimization opportunities.

### Running Benchmarks

```bash
# Run all performance benchmarks (separate from unit tests)
npm run benchmark
```

The benchmark tests are excluded from the regular `npm test` command to keep unit test runs fast. Benchmarks measure processing time, grain count ratios, throughput, and scaling characteristics without making assertions - they purely collect and report performance data.
