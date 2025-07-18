# Coding Guidelines
- This is a prototype, no need to worry about backwards compatibility and such.

## Development Guidelines

### Functional Design and Pure Functions
- Prefer pure functions and functional programming patterns over imperative code and mutation
- Pure functions should not modify their inputs or rely on external state; always return new values
- Minimize side effects and shared mutable state throughout the codebase
- Favor immutable data structures and transformations using map/filter/reduce where possible
- Use functional composition to build complex logic from simple, reusable functions
- Reserve mutation for performance-critical sections only, and document the rationale clearly
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
  - Global constants: define in `src/constants.ts`
  - Module-specific constants: define at the top of the file
  - Function-specific constants: define at the start of the function
  - Single-use constants: define just before the line where used

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
- Log errors with sufficient context for debugging before throwing/asserting
- Use the existing assertion utilities in `src/utils.ts`

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
3. Ensure all tests pass
4. Run `npm run check` to verify code quality and TypeScript errors
5. Check that no unnecessary files were added to the repository

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
- Use descriptive names that indicate purpose: `temp_grain_analysis.js`, `debug_visualizer.html`
- Include date/timestamp for time-sensitive files: `temp_performance_test_2024-01-15.js`

#### Cleanup Guidelines
- Remove temporary files after completing the task
- Keep debug utilities only if they provide ongoing value
- Avoid committing files to the root directory unless they're permanent project files

### File Naming and Organization
- Use kebab-case for filenames: `grain-generator.ts`, `test-utils.ts`
- Use descriptive names that clearly indicate purpose


# Memory and Learned Preferences
- When the user provides feedback that seems like a lasting preference rather than a one-time correction, add it to the appropriate section above with context about when and why it applies.
