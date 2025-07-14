# Coding Guidelines
- This is a prototype, no need to worry about backwards compatibility and such.

## Core Principles

### Code Reuse and Testing
- Import and use actual production classes in tests (e.g., `GrainGenerator`)
- Test files verify behavior, not reimplement functionality
- Use dependency injection or factories for mocking
- Test behavior, not implementation details
- Expose private methods via protected access or testing interfaces when needed

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
- Group related functionality in the same file when appropriate
- Web Workers: import and delegate to core classes
- Test utilities: reuse main implementations from `/src/`

### Import Organization
- Import external dependencies first
- Import internal modules second
- Group imports by type (types vs implementations)
- Use relative imports for local files

## Development Guidelines

### Constants and Configuration
- Avoid magic numbers for non-obvious values. Use constants to improve maintainability:
  - Global constants: define in `src/constants.ts`
  - Module-specific constants: define at the top of the file
  - Function-specific constants: define at the start of the function
  - Single-use constants: define just before the line where used

### Error Handling
- Use assertions to validate assumptions and preconditions in your code
- Prefer failing fast and loudly over silent error handling
- For logic errors: use `assert()` to crash immediately with clear error messages
- For recoverable errors: throw descriptive exceptions with context
- Always validate inputs at function boundaries
- Use type guards for runtime type checking when TypeScript types aren't sufficient
- Log errors with sufficient context for debugging before throwing/asserting
- Use the existing assertion utilities in `src/utils.ts`

## Development Workflow

### Before Starting Work
1. Check existing code structure and patterns
2. Identify where new files should be placed according to these guidelines
3. Use existing utilities and patterns where possible

### During Development
1. Place temporary files in appropriate locations
2. Follow existing code patterns and naming conventions
3. Add appropriate assertions and error handling
4. Write tests for new functionality

### Before Completing
1. Clean up temporary files
2. Update documentation if needed
3. Ensure all tests pass
4. Check that no unnecessary files were added to the repository
