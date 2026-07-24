# Testing Guide for CloudForge AI

This document explains the testing strategy and patterns used in the CloudForge AI project.

## Overview

We use a multi-layered testing approach:
- **Unit Tests**: Test individual functions and components in isolation
- **Property-Based Tests**: Test universal properties that should always hold
- **Integration Tests**: Test interactions between modules (planned)
- **End-to-End Tests**: Test complete user workflows (planned)

## Frontend Testing (Vitest)

### Setup

Tests are located alongside source files with `.test.ts` or `.test.tsx` suffix.

**Run tests:**
```bash
cd frontend
npm test              # Run tests once
npm test -- --watch   # Watch mode
npm run test:coverage # Generate coverage report
```

### Testing Patterns

#### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './myFunction'

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected')
  })

  it('should handle edge cases', () => {
    expect(myFunction('')).toBe(null)
    expect(myFunction(null)).toBe(null)
  })
})
```

#### Property-Based Tests with fast-check

Property-based testing verifies universal properties across many randomly generated inputs.

```typescript
import * as fc from 'fast-check'

describe('validation', () => {
  it('should always require @ in email', () => {
    fc.assert(
      fc.property(fc.emailAddress(), email => {
        if (isValidEmail(email)) {
          expect(email).toContain('@')
        }
      }),
      { numRuns: 100 } // Test with 100 random inputs
    )
  })
})
```

**When to use property-based testing:**
- Parsers and serialization code (CloudFormation, JSON)
- Data transformations (Architecture → CloudFormation)
- Validation logic
- Any code with universal invariants

#### React Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import { ServiceNode } from './ServiceNode'

describe('ServiceNode', () => {
  it('should render service name', () => {
    render(<ServiceNode service={{ name: 'api', type: 'Lambda' }} />)
    expect(screen.getByText('api')).toBeInTheDocument()
  })

  it('should call onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<ServiceNode service={{...}} onSelect={onSelect} />)
    
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('service-id')
  })
})
```

### Test Organization

```
src/
├── components/
│   ├── ServiceNode.tsx
│   └── ServiceNode.test.tsx
├── utils/
│   ├── validation.ts
│   └── validation.test.ts
└── test/
    └── setup.ts          # Global test setup
```

## Backend Testing (Jest)

### Setup

Tests are located alongside source files with `.test.ts` or `.spec.ts` suffix.

**Run tests:**
```bash
cd backend
npm test              # Run tests once
npm run test:watch    # Watch mode
```

### Testing Patterns

#### Testing Lambda Handlers

```typescript
import { handler } from './myLambda'
import { APIGatewayProxyEvent } from 'aws-lambda'

describe('myLambda handler', () => {
  it('should return success response', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({ key: 'value' }),
      requestContext: { requestId: 'test-123' } as any,
    }

    const result = await handler(event as APIGatewayProxyEvent)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ success: true })
  })
})
```

#### Mocking AWS SDK Clients

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

jest.mock('@aws-sdk/client-dynamodb')

describe('DynamoDB operations', () => {
  beforeEach(() => {
    // Mock DynamoDB client
    ;(DynamoDBClient as jest.Mock).mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({
        Items: [{ userId: 'test-123' }],
      }),
    }))
  })

  it('should fetch user from DynamoDB', async () => {
    const user = await getUser('test-123')
    expect(user.userId).toBe('test-123')
  })
})
```

#### Testing Utilities

```typescript
describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('should log structured JSON', () => {
    logger.info('Test message')
    
    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0])
    expect(loggedData.level).toBe('INFO')
  })
})
```

### Test Organization

```
src/
├── lambdas/
│   ├── auth/
│   │   ├── sign-in.ts
│   │   └── sign-in.test.ts
├── shared/
│   └── utils/
│       ├── logger.ts
│       └── logger.test.ts
```

## Property-Based Testing for Parsers

CloudForge AI includes CloudFormation and diagram parsers that must maintain data integrity through round-trip transformations. These are perfect candidates for property-based testing.

### CloudFormation Round-Trip Property

**Property**: For any valid CloudFormation template, `parse(print(x)) ≡ x`

```typescript
import * as fc from 'fast-check'

describe('CloudFormation Parser', () => {
  // Feature: cloudforge-ai, Property 4: CloudFormation Round-Trip Equivalence
  it('should maintain equivalence through parse-print-parse round trip', () => {
    fc.assert(
      fc.property(cfnTemplateArbitrary(), (template) => {
        const parsed = parseCloudFormation(template)
        const printed = printCloudFormation(parsed)
        const reparsed = parseCloudFormation(printed)
        expect(reparsed).toEqual(parsed)
      }),
      { numRuns: 100 }
    )
  })
})

// Custom arbitrary for generating valid templates
function cfnTemplateArbitrary() {
  return fc.record({
    AWSTemplateFormatVersion: fc.constant('2010-09-09'),
    Description: fc.string(),
    Resources: fc.dictionary(
      fc.string(),
      fc.record({
        Type: fc.constantFrom('AWS::Lambda::Function', 'AWS::DynamoDB::Table'),
        Properties: fc.object()
      })
    )
  })
}
```

### Diagram Round-Trip Property

**Property**: For any valid diagram, `parse(print(x)) ≡ x`

```typescript
// Feature: cloudforge-ai, Property 9: Diagram Round-Trip Equivalence
it('should maintain equivalence through diagram round trip', () => {
  fc.assert(
    fc.property(diagramArbitrary(), (diagram) => {
      const json = serializeDiagram(diagram)
      const deserialized = parseDiagram(json)
      expect(deserialized).toEqual(diagram)
    }),
    { numRuns: 100 }
  )
})
```

## Coverage Goals

- **Critical paths**: 100% (authentication, deployment, CloudFormation generation)
- **Business logic**: 80%+
- **UI components**: 60%+
- **Utilities**: 90%+

**Check coverage:**
```bash
# Frontend
cd frontend && npm run test:coverage

# Backend
cd backend && npm test -- --coverage
```

## Test Naming Conventions

- **File names**: `*.test.ts` or `*.spec.ts`
- **Describe blocks**: Name of the unit being tested
- **It blocks**: Should describe expected behavior

```typescript
describe('ArchitectureValidator', () => {
  describe('validateConnections', () => {
    it('should accept valid Lambda to API Gateway connection', () => {
      // ...
    })

    it('should reject invalid Lambda to S3 connection', () => {
      // ...
    })
  })
})
```

## Running Tests in CI

Tests run automatically on:
- Every pull request
- Before deployment
- Scheduled nightly builds

**CI commands:**
```bash
# Frontend
cd frontend && npm run lint && npm run type-check && npm test -- --run

# Backend  
cd backend && npm run lint && npm run build && npm test
```

## Debugging Tests

### Frontend (Vitest)

```bash
# Run specific test file
npm test src/utils/validation.test.ts

# Run tests matching pattern
npm test -- --grep "email"

# Show detailed output
npm test -- --reporter=verbose
```

### Backend (Jest)

```bash
# Run specific test file
npm test src/shared/utils/logger.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="logger"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Best Practices

1. **Test behavior, not implementation**: Test what the code does, not how it does it
2. **Keep tests simple**: Each test should verify one thing
3. **Use descriptive names**: Test names should explain what is being tested
4. **Avoid test interdependence**: Each test should run independently
5. **Mock external dependencies**: Don't make real API calls in unit tests
6. **Test edge cases**: Empty strings, null, undefined, boundary values
7. **Use property-based tests for parsers**: Verify universal invariants
8. **Follow AAA pattern**: Arrange, Act, Assert

## Common Pitfalls

❌ **Don't test private implementation details**
```typescript
// Bad
expect(component.state.isLoading).toBe(false)

// Good
expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
```

❌ **Don't make tests dependent on order**
```typescript
// Bad - tests depend on shared state
let userId: string
it('should create user', () => { userId = createUser() })
it('should fetch user', () => { fetchUser(userId) })

// Good - each test is independent
it('should fetch user', () => {
  const userId = createUser()
  fetchUser(userId)
})
```

❌ **Don't skip error cases**
```typescript
// Bad - only tests happy path
it('should parse template', () => {
  const result = parse(validTemplate)
  expect(result).toBeDefined()
})

// Good - tests error handling
it('should throw on invalid template', () => {
  expect(() => parse(invalidTemplate)).toThrow(ValidationError)
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Jest Documentation](https://jestjs.io/)
- [fast-check Documentation](https://fast-check.dev/)
- [Testing Library](https://testing-library.com/)
- [Property-Based Testing Introduction](https://hypothesis.works/articles/what-is-property-based-testing/)
