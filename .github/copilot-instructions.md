# Coding Guidelines

## Core Principles

- Avoid magic numbers in the code for nonobvious values. Instead use constants to make the code more maintainable. If a constant is applicable to multiple parts of the codebase define it in `src/constants.ts`. If a constant is only applicable to a specific part of the code, define the constant there. If a constant is only applicable within a function define it in that function. If a constant is only applicable to a single line of code, define it just before that line.

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
