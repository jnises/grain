# GitHub Copilot Instructions for Grain Repository

**Always follow these instructions first and fallback to additional search and context gathering only if the information here is incomplete or found to be in error.**

# Coding Guidelines

- This is a prototype, no need to worry about backwards compatibility and such.
- The tests were vibecoded and can often be wrong. If the user or design documents say something that contradicts the tests, trust the user and the documents.

## Development Guidelines

### Functional Design and Pure Functions

- Prefer pure functions and functional programming patterns over imperative code and mutation
- Pure functions should not modify their inputs or rely on external state; always return new values
- Minimize side effects and shared mutable state throughout the codebase
- Favor immutable data structures and transformations using map/filter/reduce where possible
- Use functional composition to build complex logic from simple, reusable functions
- Reserve mutation for performance-critical sections only, and document the rationale clearly
- If you use out-arguments instead of just returning the data, have a good reason to do so, and name the argument accordingly.
- Functional design improves testability, predictability, and maintainability

### Object Design and Lifecycle

- Design objects so all fields remain valid throughout the object's lifetime
- Avoid objects with "phases" where certain fields or methods are only valid after specific initialization steps
- If a class requires multi-step initialization or has functionality that's only valid in certain states, consider splitting it into multiple classes with clear responsibilities
- Prefer immutable objects or objects that are fully initialized at construction time
- Example: Instead of a class that requires `init()` before `process()` works, create separate classes or use a factory pattern that returns fully-initialized objects

### Avoiding Pointless Abstractions

- **NEVER create wrapper classes that only delegate to other classes** - this adds complexity without benefit
- Before extracting a class, ensure it provides meaningful abstraction with:
  - Substantial logic or processing
  - Clear separation of concerns
  - Simplified interface compared to what it wraps
  - Testability improvements
- Thin delegation methods are acceptable within the same class, but avoid creating entire classes for delegation
- When refactoring large classes, focus on extracting classes with real functionality, not just organizational wrappers
- If a proposed class would only have methods that call other classes' methods 1:1, don't create it

### Constants and Configuration

- Avoid magic numbers for non-obvious values. Use constants to improve maintainability:
  - Single-use constants: define just before the line where used
  - Function-specific constants: define at the start of the function
  - Module-specific constants: define at the top of the file
  - Global constants: define in `src/constants.ts`
    Prefer single-use constants to keep the information as close to the place where it is used as possible.

### Static Methods and Free Functions

- Prefer static methods for utility functions that don't depend on instance state
- Convert static methods to free functions when they aren't directly related to the class
- Place free functions in appropriate utility modules (e.g., `grain-math.ts` for mathematical operations)
- Guidelines for method organization:
  - **Instance methods**: Use when the function operates on or modifies instance state
  - **Static methods**: Use for utility functions that are conceptually related to the class but don't need instance data
  - **Free functions**: Use for pure utility functions that aren't conceptually tied to a specific class
- Mathematical and pure utility functions should generally be free functions in dedicated modules
- This improves code organization, testability, and reusability

### Error Handling

- Use assertions to validate assumptions and preconditions in your code
- Prefer failing fast and loudly over silent error handling
- For logic errors: use `assert()` to crash immediately with clear error messages
- For recoverable errors: throw descriptive exceptions with context
- Always validate inputs at function boundaries
- Use type guards for runtime type checking when TypeScript types aren't sufficient
- Don't use type guard asserts redundantly. If you do check something that is already guaranteed by typescript, write a comment why you think that is useful.
- Log errors with sufficient context for debugging before throwing/asserting
- Use the existing assertion utilities in `src/utils.ts`:
  - **`assert()`**: Use for critical assertions that should always be checked, even in production
  - **`devAssert()`**: Use for expensive assertions in hot code paths that should only run during development. This function is completely eliminated in production builds through dead code elimination
  - **`assertPositiveInteger()`, `assertPositiveNumber()`, `assertNonNegativeNumber()`**: Use for common validation patterns
- Choose `devAssert()` over `assert()` when:
  - The assertion is in performance-critical code (hot paths identified through profiling)
  - The check is expensive to perform (complex validation, deep object inspection)
  - The assertion is primarily for development debugging rather than critical safety
- **Integer Input Validation**: When algorithms require integer inputs, use `devAssert(() => Number.isInteger(value), 'message')` instead of silent conversion with `Math.floor()`. This prevents data loss and makes requirements explicit. If conversion is intentional, do it explicitly and document why.
  Same for unsigned integers. Don't `Math.abs`. Assert that the incoming value is indeed >= 0.

### Doc comments

- Document any function argument whose meaning isn't obvious.

### Descriptive Types and Type Aliases

- Prefer newtype patterns (e.g., branded types or opaque types) over type aliases to ensure type safety and prevent accidental assignment between types with the same underlying representation
- Avoid type aliases for primitives (e.g., `type GrainDensity = number`) as they do not provide compile-time safety
- Use branded types for distinct number/string types:
  - Example: `type LinearLightness = number & { __brand: 'LinearLightness' }`
  - Example: `type GrainDensity = number & { __brand: 'GrainDensity' }`
- Use interfaces for complex objects instead of inline types
- When using non-bespoke types (like `number`, `string`, `array`), document what they represent in doc comments:
  - Example: `/** Color value in sRGB color space (0-255) */ r: number`
  - Example: `/** Exposure compensation in stops */ exposureOffset: number`
- Prefer meaningful branded types over generic ones:
  - Good: `GrainDensity`, `ExposureStops`, `SrgbColor`
  - Avoid: `number`, `any`, `object` without context
- Use union types to constrain values: `type FilmType = 'kodak-gold' | 'fuji-400h' | 'tri-x'`
- This improves code readability, helps catch type errors, and makes the codebase more maintainable

### Code Reuse and Testing

- Import and use actual production classes in tests (e.g., `GrainGenerator`)
- **NEVER reimplement production functions in test files** - always import and test the actual production code
- If testing private methods, make them protected and create a test subclass, or extract to a testable utility module
- Test files verify behavior, not reimplement functionality
- Use dependency injection or factories for mocking external dependencies
- Test behavior, not implementation details
- Expose private methods via protected access or testing interfaces when needed
- When testing is difficult due to private methods or complex dependencies, refactor production code to be more testable rather than duplicating functionality in tests
- **NEVER use `new ImageData()` in tests** - Node.js test environment doesn't have DOM ImageData. Instead, create mock objects with `{ width, height, data: new Uint8ClampedArray(width * height * 4) }` structure

### Random numbers and testing

- Make sure any random value you generate is done using the interface RandomNumberGenerator. This needs to be dependency injected to any code that needs it.
- In order to get deterministic testing SeededRandomNumberGenerator should be used in tests.
- Don't do position based hash type rng.
- If you decide you really need position based rng for some reason use `squirrelNoise5`

## Working Effectively with the Grain Codebase

### Bootstrap and Dependencies

- **Prerequisites**: Node.js 18.0.0+ and npm 8.0.0+
- **Bootstrap commands** (run in order):
  ```bash
  npm install    # Takes ~55 seconds, NEVER CANCEL - timeout 120+ seconds
  ```

### Build and Quality Checks

- **Code quality checks**:
  ```bash
  npm run check  # Takes ~6 seconds - runs lint + type-check
  ```

### Testing

- **Unit tests**:
  ```bash
  npm test       # Takes ~19 seconds, NEVER CANCEL - timeout 60+ seconds
  ```
- **Performance benchmarks** (separate from unit tests):
  ```bash
  npm run benchmark  # Takes ~4 seconds - runs performance measurements only
  ```

### Development Server

- **Start development**:
  ```bash
  npm run dev    # Starts in ~200ms on http://localhost:5173/
  ```

### Build Production Version

```bash
npm run build    # Takes ~1.5 seconds - creates dist/ folder
npm run preview  # Preview built version on http://localhost:4173/
```

### Validation After Changes

**ALWAYS run these automated checks after making changes to core functionality:**

1. **Code Quality and Build Validation**:
   ```bash
   npm run check     # Must pass - linting and type checking
   npm test          # Must pass - all unit tests
   npm run build     # Must succeed - production build
   ```

2. **Manual Testing Instructions for Users**:
   When changes affect image processing, ask the user to verify:
   - Start dev server with `npm run dev`
   - Open http://localhost:5173/ and test image upload with `gray.png`
   - Verify grain processing works with default Kodak 400 preset
   - Expected processing time: 1-3 seconds for 512x512 images
   - Check debug visualizers at `/grain-debug.html`, `/grain-visualizer.html`, `/grain-patterns.html`

### Critical Timing and Timeout Guidelines

- **npm install**: 55 seconds - Set timeout to 120+ seconds, NEVER CANCEL
- **npm test**: 19 seconds - Set timeout to 60+ seconds, NEVER CANCEL
- **npm run benchmark**: 4 seconds - Set timeout to 30+ seconds
- **Image processing**: 1-3 seconds for typical images, up to 10+ seconds for large images

### CI/CD Validation

**Before committing, always run:**

```bash
npm run check     # Must pass - linting and type checking
npm test          # Must pass - all unit tests
npm run build     # Must succeed - production build
```

The CI pipeline (.github/workflows/ci.yml) runs these exact commands plus benchmarks on push to main.

## Development Workflow

### Server Management (CRITICAL)

- **ALWAYS check for running servers before starting new ones** to avoid port conflicts
- If you need to restart the server, use `npm run dev:restart` or `npm run dev:stop` first
- `npm run dev:stop` safely kills only processes using Vite ports (5173, 5174) without affecting other processes
- Before running `npm run dev`, `npm start`, or any long-running command, either check existing terminals or use `npm run dev:stop` to ensure no conflicts

### Before Starting Work

1. Check existing code structure and patterns
2. Identify where new files should be placed according to these guidelines
3. Use existing utilities and patterns where possible

### During Development

1. Place temporary files in appropriate locations
2. Follow existing code patterns and naming conventions
3. Add appropriate assertions and error handling
4. Write tests for new functionality
5. Run `npm run check` to verify code quality and TypeScript errors

### Before Completing

1. Clean up temporary files
2. Update documentation if needed
3. Update `ALGORITHM_DESIGN.md` if any relevant changes to the main algorithm have been made
4. Ensure all tests pass
5. Run `npm run check` to verify code quality and TypeScript errors
6. Check that no unnecessary files were added to the repository

## Project Structure and File Organization

### Temporary Files and Tools

When creating temporary files, debug utilities, or development tools, please follow these guidelines to keep the repository clean:

#### Temporary File Locations

- **Temporary scripts**: Place in `scripts/temp/` (will be git-ignored)
- **Debug utilities**: Place in `src/debug/` for source files or `public/debug/` for HTML files
- **Test data/fixtures**: Place in `test/fixtures/` or `test/temp/`
- **Benchmark files**: Place in `test/benchmarks/`
- **Development tools**: Place in `scripts/dev/`

#### Naming Conventions

- Prefix temporary files with `temp_` or `debug_`
- Use descriptive names that indicate purpose: `temp_grain_analysis.ts`, `debug_visualizer.html`
- Include date/timestamp for time-sensitive files: `temp_performance_test_2024-01-15.ts`

#### Cleanup Guidelines

- Remove temporary files after completing the task
- Keep debug utilities only if they provide ongoing value
- Avoid committing files to the root directory unless they're permanent project files

### File Naming and Organization

- Use kebab-case for filenames: `grain-generator.ts`, `test-utils.ts`
- Use descriptive names that clearly indicate purpose

## Tools

- Always use TypeScript for new tools; avoid JavaScript for scripts and utilities.
- Place tool scripts in the appropriate directory (see "Temporary File Locations" above).
- Use `npx tsx scriptpath.ts` to run TypeScript tools.
- Prefer pure functions and functional patterns in tool scripts for maintainability.
- Add comments or documentation to clarify tool purpose and usage.

# Memory and Learned Preferences

- When the user provides feedback that seems like a lasting preference rather than a one-time correction, add it to the appropriate section above with context about when and why it applies.
