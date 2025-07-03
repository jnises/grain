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
