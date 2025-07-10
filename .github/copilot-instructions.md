# Coding Guidelines

## Core Principles

### Constants
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

### Avoid Code Duplication
- Unless absolutely necessary reuse existing classes and functions instead of reimplementing
- Import and use actual production classes in tests (e.g., `GrainGenerator`)
- Test files verify behavior, not reimplement functionality
- Expose private methods via protected access or testing interfaces when needed

### File Organization
- Core logic: `/src/`
- Tests: `/test/`
- Web Workers: import and delegate to core classes
- Test utilities: reuse main implementations from `/src/`

### Testing Strategy
- Import production classes, never duplicate code
- Use dependency injection or factories for mocking
- Test behavior, not implementation details
- Create focused test functions using main classes

## Examples

### ✅ Correct: Reuse existing classes
```typescript
import { GrainGenerator } from './grain-generator';

export function testGrainGeneration(settings: GrainSettings) {
  const generator = new GrainGenerator(width, height, settings);
  return generator.generatePoissonDiskSampling(minDistance, grainDensity);
}
```

### ❌ Wrong: Duplicate implementation
```typescript
class GrainProcessorTest {
  public generatePoissonDiskSampling() { /* duplicate code */ }
}
```

## Best Practices

1. **Check for existing implementations** before creating new ones
2. **Import and reuse classes** rather than duplicating code
3. **Extract shared logic** into reusable modules when needed
4. **Use composition over inheritance** for extending functionality
5. **Focus tests on behavior** verification, not reimplementation

## File Organization

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

#### Git Ignore Patterns
The following patterns are already git-ignored:
- `scripts/temp/`
- `*.temp.*`
- `temp_*`
- `debug_*`
- `test/temp/`

#### Cleanup Guidelines
- Remove temporary files after completing the task
- Keep debug utilities only if they provide ongoing value
- Document any permanent debug tools in this file
- Avoid committing files to the root directory unless they're permanent project files

#### Existing Debug/Development Files
Current debug files that should be cleaned up eventually:
- `public/grain-debug.html` - Grain generation debugging interface
- `public/grain-visualizer.html` - Grain visualization tool  
- `public/test-image-generator.html` - Test image generation tool

#### Preferred Project Structure
```
/
├── src/                 # Core source code only
├── test/                # Test files
│   ├── fixtures/        # Test data/fixtures
│   ├── temp/           # Temporary test files (git-ignored)
│   └── benchmarks/     # Performance benchmarks
├── scripts/            # Build and utility scripts
│   ├── temp/           # Temporary scripts (git-ignored)
│   └── dev/            # Development tools
├── public/             # Static web assets
│   └── debug/          # Debug HTML files (if needed)
└── docs/               # Documentation
```

## Code Organization Guidelines

### File Naming
- Use kebab-case for filenames: `grain-generator.ts`, `test-utils.ts`
- Use descriptive names that clearly indicate purpose
- Group related functionality in the same file when appropriate

### Import Organization
- Import external dependencies first
- Import internal modules second
- Group imports by type (types vs implementations)
- Use relative imports for local files

### Constants and Configuration
- Define constants in `src/constants.ts` for global values
- Use module-level constants for file-specific values
- Avoid magic numbers - use named constants instead

### Error Handling
- Use the existing assertion utilities in `src/utils.ts`
- Prefer failing fast with descriptive error messages
- Log context when assertions fail for debugging

### Testing
- Reuse existing classes rather than creating test-specific implementations
- Use dependency injection for mocking (e.g., seeded RNG for deterministic tests)
- Place test files adjacent to source files when possible
- Use descriptive test names that explain the behavior being tested

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
