# Coding Guidelines

## Architecture Principles

### Avoid Code Duplication
- **Reuse existing classes and functions** instead of reimplementing them
- When testing, import and use the actual production classes (e.g., `GrainGenerator`)
- Test files should focus on testing behavior, not reimplementing functionality
- If you need to expose private methods for testing, consider making them protected or creating a testing interface

### File Organization
- Core logic goes in `/src/`
- Test files go in `/test/` directory
- Test utilities and helpers can go in `/src/` but should reuse main implementations
- Web Worker code should import and delegate to core classes when possible

### Testing Best Practices
- Import production classes rather than duplicating their code
- Use dependency injection or factory patterns if you need to mock dependencies
- Focus tests on behavior verification, not implementation details
- When debugging, create focused test functions that use the main classes

### Code Reuse Examples

#### ✅ Good - Reusing existing classes:
```typescript
import { GrainGenerator } from './grain-generator';

export function testGrainGeneration(settings: GrainSettings) {
  const generator = new GrainGenerator(width, height, settings);
  return generator.generatePoissonDiskSampling(params.minDistance, params.grainDensity);
}
```

#### ❌ Bad - Duplicating implementation:
```typescript
class GrainProcessorTest {
  // Duplicating the same Poisson disk sampling logic that already exists
  public generatePoissonDiskSampling() { /* duplicate code */ }
}
```

## Agent Instructions

When working with a coding agent:

1. **Always check for existing implementations** before creating new ones
2. **Reuse and import existing classes** rather than duplicating code
3. **Extract shared logic** into reusable modules if needed
4. **Use composition over inheritance** when extending functionality
5. **Keep test files focused** on testing behavior, not reimplementing features

These guidelines help maintain code quality, reduce bugs, and make the codebase easier to maintain.
