# Testing Guide

This project uses **Vitest** for testing, providing fast and modern test execution with excellent TypeScript support and DOM testing capabilities. The project has been converted to TypeScript, enhancing type safety and developer experience.

## Getting Started

### Run Tests
```bash
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode (re-runs on file changes)
npm run test:coverage   # Run tests with coverage report
npm run test:ui         # Open Vitest UI (if installed)
```

## Test Structure

### Test Files
- `tests/utils.test.ts` - Tests for utility and DOM helper functions (formatDuration, createElementFromTemplate, etc.)
- `tests/analysis.test.ts` - Tests for data analysis functions (findTimestampGaps, extractActivityTimes, etc.)

### Test Configuration
- `vitest.config.js` - Main test configuration with TypeScript support
- `tests/test-setup.js` - Test environment setup (mocks, global setup)

## Coverage

The current test coverage focuses on:
- ✅ **Utility & DOM Functions** (~99% coverage) - Pure functions like formatDuration, GPS conversion, DOM helpers
- ✅ **Data Analysis** (~98% coverage) - Core business logic for FIT file processing  
- ❌ **Main Application** (0% coverage) - Event handlers and UI coordination (harder to test)

## Writing Tests

### Basic Test Structure
```typescript
import { functionToTest } from '../src/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      const result = functionToTest(input);
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### Testing DOM Functions
```typescript
import { createElementFromTemplate } from '../src/utils';

describe('createElementFromTemplate', () => {
  it('creates element from template', () => {
    // Mock setup is handled in test-setup.js
    const result = createElementFromTemplate('test-template', { 
      'field': 'value' 
    });
    
    expect(result).toBeDefined();
  });
});
```

### Testing Data Analysis
```typescript
import { findTimestampGaps } from '../src/analysis';
import type { RecordMessage } from '../src/types';

describe('findTimestampGaps', () => {
  it('identifies gaps larger than 5 minutes', () => {
    const records: RecordMessage[] = [
      { timestamp: new Date('2024-01-01T10:00:00Z') },
      { timestamp: new Date('2024-01-01T10:10:00Z') } // 10 min gap
    ];
    
    const gaps = findTimestampGaps(records);
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gapDurationMinutes).toBe(10);
  });
});
```

## Mocking

### Global Mocks (in test-setup.js)
- **Leaflet** - Maps library is mocked since it's not available in jsdom
- **DOM Elements** - Common elements like `fitFile`, `parseButton` are mocked
- **Fetch API** - For testing example file loading
- **Console methods** - To reduce noise during testing

### Custom Mocks
```typescript
// In individual test files
const mockFunction = vi.fn();
mockFunction.mockReturnValue('test value');

expect(mockFunction).toHaveBeenCalledWith(expectedArg);
```

## Best Practices

### 1. Test Pure Functions First
Start with utility functions and data processing functions as they're easiest to test:
```typescript
// ✅ Easy to test
function formatDuration(seconds: number): string {
  return `${seconds}s`;
}

// ❌ Harder to test (has side effects)
function updateUI(data: string): void {
  document.getElementById('result')!.innerHTML = data;
}
```

### 2. Use Descriptive Test Names
```typescript
// ✅ Good
it('returns null when no GPS coordinates are provided')

// ❌ Bad  
it('handles edge case')
```

### 3. Test Edge Cases
```typescript
describe('formatDuration', () => {
  it('handles zero seconds', () => {
    expect(formatDuration(0)).toBe('0m 0s');
  });
  
  it('handles very large durations', () => {
    expect(formatDuration(7322)).toBe('2h 2m 2s');
  });
});
```

### 4. Keep Tests Independent
Each test should be able to run in isolation:
```typescript
describe('function tests', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });
});
```

## Adding New Tests

### For a New Utility or DOM Function
1. Add the function to `src/utils.ts` with proper TypeScript types
2. Export it with type information
3. Add tests to `tests/utils.test.ts`
4. Run `npm test` to verify

### For a New Analysis Function
1. Add the function to `src/analysis.ts` with proper TypeScript types
2. Export it and any dependencies with type information
3. Add tests to `tests/analysis.test.ts`
4. Include edge cases and error handling

### For Integration Tests
Consider testing entire workflows:
```typescript
it('processes complete FIT file workflow', () => {
  const mockFitData = createMockFitData();
  const result = processFitFile(mockFitData);
  
  expect(result.slowPeriods).toBeDefined();
  expect(result.timestampGaps).toBeDefined();
});
```

## Continuous Integration

Tests should run automatically in CI/CD:
```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Debugging Tests

### Running Single Tests
```bash
npx vitest tests/utils.test.ts         # Run specific file
npx vitest -t "formatDuration"         # Run tests matching pattern
```

### Debug Mode
```bash
npx vitest --inspect-brk    # Start with debugger
```

### Common Issues
1. **Mock not working** - Check `tests/test-setup.js` for proper mock setup
2. **DOM not available** - Ensure `environment: 'jsdom'` in vitest config
3. **Import errors** - Check that functions are properly exported from TypeScript modules and import paths use `../src/`
4. **Type errors** - Ensure TypeScript types are correctly defined and imported where needed

## Future Testing Goals

- [ ] Add integration tests for complete FIT file processing
- [ ] Add visual regression tests for UI components  
- [ ] Add performance tests for large FIT files
- [ ] Add E2E tests using Playwright
- [ ] Increase main.ts coverage by extracting testable functions