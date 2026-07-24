---
inclusion: auto
---

# CloudForge AI - Coding Standards

## Overview

This document establishes coding standards, conventions, and best practices for the CloudForge AI project. All code must adhere to these standards to ensure consistency, maintainability, and quality across the codebase.

## Technology Stack

- **Frontend**: React 18+ with TypeScript, Vite, React Flow, Monaco Editor
- **Backend**: AWS Lambda (Node.js 20.x runtime), TypeScript
- **Infrastructure**: AWS CDK (TypeScript)
- **Testing**: Vitest, fast-check (property-based testing), React Testing Library
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

---

## General Principles

### 1. Correctness First
- Prioritize correctness over performance optimizations
- Write type-safe code using TypeScript strict mode
- Validate inputs at system boundaries (API endpoints, file parsers)
- Use property-based testing for critical data transformations

### 2. Explicit Over Implicit
- Prefer explicit type annotations over type inference for public APIs
- Make error cases explicit with Result types or descriptive exceptions
- Document assumptions and invariants in comments

### 3. Fail Fast
- Validate early and throw clear errors near the source of problems
- Use type guards and runtime validation for external data
- Never swallow errors silently

### 4. Immutability by Default
- Use `const` for all variables unless mutation is required
- Prefer immutable data structures and pure functions
- Use spread operators and array methods (map, filter, reduce) over mutations

### 5. Single Responsibility
- Each function should do one thing well
- Keep functions under 50 lines when possible
- Extract complex logic into named helper functions

---

## TypeScript Standards

### Type Annotations

**Always annotate**:
- Function parameters and return types
- Public class properties and methods
- Complex expressions where type is not obvious

**Let TypeScript infer**:
- Simple variable assignments where type is clear
- Private implementation details

```typescript
// ✅ Good - explicit function signature
export function generateArchitecture(
  description: string,
  context?: ArchitectureContext
): Promise<Architecture> {
  const services: AWSService[] = []  // ✅ Inference OK for local variables
  // ...
}

// ❌ Bad - missing return type
export function generateArchitecture(description: string, context?: ArchitectureContext) {
  // ...
}
```

### Type Safety

- **Enable strict mode**: `"strict": true` in `tsconfig.json`
- **No `any` types**: Use `unknown` for truly unknown types, then narrow with type guards
- **No non-null assertions (`!`)**: Handle null/undefined explicitly with optional chaining or guards
- **Use discriminated unions** for state management and error handling

```typescript
// ✅ Good - discriminated union for results
type Result<T, E> = 
  | { success: true; value: T }
  | { success: false; error: E }

function parseTemplate(yaml: string): Result<Template, ParseError> {
  try {
    const parsed = parse(yaml)
    return { success: true, value: parsed }
  } catch (e) {
    return { success: false, error: toParseError(e) }
  }
}

// ❌ Bad - using any
function parseTemplate(yaml: string): any {
  return parse(yaml)
}
```

### Interfaces vs Types

- Use **interfaces** for object shapes that may be extended
- Use **types** for unions, intersections, and utility types

```typescript
// ✅ Good - interface for extensible objects
export interface AWSService {
  id: string
  type: string
  name: string
  configuration: Record<string, unknown>
}

// ✅ Good - type for unions
export type DeploymentPhase = 
  | 'VALIDATING' 
  | 'IN_PROGRESS' 
  | 'COMPLETE' 
  | 'FAILED'
```

---

## Naming Conventions

### Files and Directories

- **Components**: PascalCase - `VisualEditor.tsx`, `ServiceNode.tsx`
- **Utilities**: camelCase - `formatTemplate.ts`, `validateArchitecture.ts`
- **Types**: PascalCase - `Architecture.ts`, `CloudFormationTemplate.ts`
- **Tests**: Match source file with `.test.ts` suffix - `formatTemplate.test.ts`
- **Directories**: kebab-case - `visual-editor/`, `cloudformation-generator/`

### Variables and Functions

- **Variables**: camelCase - `templateString`, `deploymentStatus`
- **Constants**: SCREAMING_SNAKE_CASE - `MAX_RETRY_ATTEMPTS`, `DEFAULT_REGION`
- **Functions**: camelCase verbs - `generateTemplate()`, `validateConnection()`
- **Boolean variables**: Use `is`, `has`, `should` prefixes - `isValid`, `hasErrors`, `shouldRetry`
- **Event handlers**: Use `handle` prefix - `handleServiceClick()`, `handleDragEnd()`

### Types and Interfaces

- **Interfaces**: PascalCase nouns - `Architecture`, `DeploymentOptions`
- **Type aliases**: PascalCase - `Result`, `ServiceType`
- **Enums**: PascalCase with PascalCase members - `DeploymentPhase.IN_PROGRESS`
- **Generics**: Single uppercase letter or descriptive PascalCase - `T`, `TError`, `TValue`

```typescript
// ✅ Good naming examples
const MAX_TEMPLATE_SIZE = 51200  // bytes
const isTemplateValid = validateTemplate(template)

function handleDeploymentStart(deploymentId: string): void {
  // ...
}

interface CloudFormationTemplate {
  Resources: Record<string, Resource>
}

type Result<TValue, TError> = 
  | { success: true; value: TValue }
  | { success: false; error: TError }
```

---

## Code Organization

### File Structure

Each file should follow this order:

1. Imports (external, then internal)
2. Type definitions and interfaces
3. Constants
4. Main implementation
5. Helper functions (unexported if private)

```typescript
// 1. Imports
import { CloudFormation } from 'aws-sdk'
import { ValidationResult } from '@/types/validation'

// 2. Types
export interface TemplateGeneratorOptions {
  formatVersion: string
  description?: string
}

// 3. Constants
const DEFAULT_FORMAT_VERSION = '2010-09-09'
const MAX_RESOURCES = 500

// 4. Main implementation
export class TemplateGenerator {
  // ...
}

// 5. Helper functions
function validateResourceCount(count: number): void {
  if (count > MAX_RESOURCES) {
    throw new Error(`Resource count exceeds maximum of ${MAX_RESOURCES}`)
  }
}
```

### Component Structure (React)

React components should follow this pattern:

```typescript
// 1. Imports
import { useState, useEffect } from 'react'
import { ServiceNode } from './ServiceNode'

// 2. Types
interface VisualEditorProps {
  architecture: Architecture
  onChange: (architecture: Architecture) => void
}

// 3. Component
export function VisualEditor({ architecture, onChange }: VisualEditorProps): JSX.Element {
  // 4. Hooks
  const [selectedService, setSelectedService] = useState<string | null>(null)
  
  useEffect(() => {
    // Effect logic
  }, [architecture])

  // 5. Event handlers
  function handleServiceClick(serviceId: string): void {
    setSelectedService(serviceId)
  }

  // 6. Render helpers
  function renderServices(): JSX.Element[] {
    return architecture.services.map(service => (
      <ServiceNode key={service.id} service={service} onClick={handleServiceClick} />
    ))
  }

  // 7. Main render
  return (
    <div className="visual-editor">
      {renderServices()}
    </div>
  )
}
```

### Module Organization

Organize code into logical modules:

```
src/
├── components/         # React components
│   ├── visual-editor/
│   ├── code-editor/
│   └── deployment-status/
├── services/          # Business logic services
│   ├── ai-engine/
│   ├── cloudformation/
│   └── deployment/
├── types/             # Shared TypeScript types
├── utils/             # Pure utility functions
├── hooks/             # Custom React hooks
├── api/               # API client functions
└── config/            # Configuration and constants
```

---

## Error Handling

### Error Types

Define custom error classes for different error categories:

```typescript
// Base error class
export class CloudForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

// Specific error types
export class ValidationError extends CloudForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details)
  }
}

export class ServiceError extends CloudForgeError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message, 'SERVICE_ERROR', { ...details, service, retryable })
  }
}
```

### Error Handling Patterns

**For async operations**:

```typescript
// ✅ Good - explicit error handling with Result type
async function deployTemplate(
  template: CloudFormationTemplate
): Promise<Result<Deployment, DeploymentError>> {
  try {
    const validated = await validateTemplate(template)
    if (!validated.success) {
      return { success: false, error: validated.error }
    }
    
    const deployment = await createStack(template)
    return { success: true, value: deployment }
  } catch (error) {
    return { 
      success: false, 
      error: new DeploymentError('Failed to deploy', toErrorDetails(error))
    }
  }
}

// ❌ Bad - throwing exceptions for control flow
async function deployTemplate(template: CloudFormationTemplate): Promise<Deployment> {
  const validated = await validateTemplate(template)
  if (!validated.valid) {
    throw new Error('Invalid template')  // Don't use exceptions for expected errors
  }
  return await createStack(template)
}
```

**For validation**:

```typescript
// ✅ Good - return validation results
function validateArchitecture(architecture: Architecture): ValidationResult {
  const errors: ValidationError[] = []
  
  if (architecture.services.length === 0) {
    errors.push({
      field: 'services',
      message: 'Architecture must contain at least one service'
    })
  }

  
  return {
    valid: errors.length === 0,
    errors
  }
}
```

**Retry logic for external services**:

```typescript
// ✅ Good - exponential backoff with jitter
async function callWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxAttempts && isRetryable(error)) {
        const backoff = Math.pow(2, attempt - 1) * 1000  // 1s, 2s, 4s
        const jitter = Math.random() * 1000
        await sleep(backoff + jitter)
      }
    }
  }
  
  throw lastError!
}
```

---

## Security Standards

### 1. No Hardcoded Secrets

**NEVER** hardcode credentials, API keys, or sensitive configuration.

```typescript
// ✅ Good - use environment variables
const bedrockEndpoint = process.env.BEDROCK_ENDPOINT
const apiKey = process.env.API_KEY

if (!apiKey) {
  throw new Error('API_KEY environment variable is required')
}

// ❌ Bad - hardcoded secrets
const apiKey = 'sk-1234567890abcdef'  // NEVER DO THIS
```

### 2. No Logging of PII or Tokens

**NEVER** log personally identifiable information or authentication tokens.

```typescript
// ✅ Good - log only non-sensitive data
logger.info('User authenticated', {
  userId: user.id,  // OK - internal ID
  timestamp: new Date().toISOString()
})

// ❌ Bad - logging sensitive data
logger.info('User authenticated', {
  email: user.email,        // PII - don't log
  accessToken: token,       // Secret - don't log
  password: user.password   // NEVER EVER log passwords
})
```

### 3. Validate ALL Inputs

**ALWAYS** validate data at system boundaries (API endpoints, file parsers, external services).

```typescript
// ✅ Good - validate inputs with type guards
function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function createUser(request: unknown): Promise<User> {
  // Validate input structure
  if (!isValidUserRequest(request)) {
    throw new ValidationError('Invalid user request')
  }
  
  // Additional business validation
  if (!isValidEmail(request.email)) {
    throw new ValidationError('Invalid email format')
  }
  
  return await userRepository.create(request)
}

// ❌ Bad - trusting unvalidated input
export async function createUser(request: any): Promise<User> {
  return await userRepository.create(request)  // Dangerous!
}
```

### 4. Parameterized Queries Only

**ALWAYS** use parameterized queries. **NEVER** concatenate user input into SQL or NoSQL queries.

```typescript
// ✅ Good - parameterized DynamoDB query
async function getDiagram(diagramId: string): Promise<DiagramRecord | null> {
  const result = await dynamodb.get({
    TableName: 'cloudforge-diagrams',
    Key: { diagramId }  // Safe - uses parameter
  }).promise()
  
  return result.Item as DiagramRecord || null
}

// ✅ Good - parameterized SQL (if using RDS)
async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]  // Safe - parameterized
  )
  return result.rows[0] || null
}

// ❌ Bad - SQL injection vulnerability
async function getUserByEmail(email: string): Promise<User | null> {
  const query = `SELECT * FROM users WHERE email = '${email}'`  // NEVER DO THIS
  const result = await db.query(query)
  return result.rows[0] || null
}
```

### 5. Sanitize Outputs

When displaying user-provided content in UI, sanitize to prevent XSS attacks:

```typescript
// ✅ Good - React automatically escapes
function DiagramName({ name }: { name: string }): JSX.Element {
  return <h1>{name}</h1>  // React escapes by default
}

// ✅ Good - explicit sanitization when using dangerouslySetInnerHTML
import DOMPurify from 'dompurify'

function RichDescription({ html }: { html: string }): JSX.Element {
  const sanitized = DOMPurify.sanitize(html)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### 6. Secure AWS Credentials

Store and handle AWS credentials securely:

```typescript
// ✅ Good - use AWS Secrets Manager
async function getAWSCredentials(userId: string): Promise<AWSCredentials> {
  const secretName = `cloudforge/aws-credentials/${userId}`
  
  const result = await secretsManager.getSecretValue({
    SecretId: secretName
  }).promise()
  
  if (!result.SecretString) {
    throw new Error('Secret not found')
  }
  
  return JSON.parse(result.SecretString)
}

// ❌ Bad - storing credentials in database unencrypted
async function getAWSCredentials(userId: string): Promise<AWSCredentials> {
  const user = await getUserFromDB(userId)
  return {
    accessKeyId: user.awsAccessKey,     // Don't store like this
    secretAccessKey: user.awsSecretKey  // Extremely dangerous
  }
}
```

---

## Testing Standards

### Test Organization

- Place tests alongside source files: `formatTemplate.ts` → `formatTemplate.test.ts`
- Use `describe` blocks to group related tests
- Use descriptive test names that explain what is being tested

```typescript
describe('CloudFormationGenerator', () => {
  describe('generateTemplate', () => {
    it('should generate valid CloudFormation YAML from architecture', () => {
      // Test implementation
    })
    
    it('should include all services from architecture diagram', () => {
      // Test implementation
    })
    
    it('should throw ValidationError for empty architecture', () => {
      // Test implementation
    })
  })
})
```

### Property-Based Testing

Use property-based testing for parsers and data transformations:

```typescript
import fc from 'fast-check'

// Feature: cloudforge-ai, Property 4: CloudFormation Round-Trip Equivalence
describe('CloudFormation Parser', () => {
  it('should maintain equivalence through parse-print-parse round trip', () => {
    fc.assert(
      fc.property(cfnTemplateArbitrary(), (template) => {
        const parsed = parseCloudFormation(template)
        const printed = printCloudFormation(parsed)
        const reparsed = parseCloudFormation(printed)
        expect(reparsed).toEqual(parsed)
      }),
      { numRuns: 100 }  // Minimum 100 iterations
    )
  })
})

// Custom arbitrary for CloudFormation templates
function cfnTemplateArbitrary(): fc.Arbitrary<CloudFormationTemplate> {
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

### Unit Testing Best Practices

```typescript
// ✅ Good - AAA pattern (Arrange, Act, Assert)
it('should calculate total monthly cost from service costs', () => {
  // Arrange
  const architecture: Architecture = {
    services: [
      { id: '1', type: 'Lambda', name: 'api', configuration: {} },
      { id: '2', type: 'DynamoDB', name: 'users', configuration: {} }
    ],
    connections: []
  }
  const assumptions: UsageAssumptions = {
    region: 'us-east-1',
    requestsPerMonth: 1_000_000
  }
  
  // Act
  const estimate = await costEstimator.estimateCost(architecture, assumptions)
  
  // Assert
  expect(estimate.totalMonthlyCost).toBeGreaterThan(0)
  expect(estimate.breakdown).toHaveLength(2)
  expect(estimate.currency).toBe('USD')
})

// ❌ Bad - unclear test structure
it('cost estimation', async () => {
  const estimate = await costEstimator.estimateCost(someArchitecture, someAssumptions)
  expect(estimate.totalMonthlyCost > 0).toBe(true)
}
```

### Mocking External Services

```typescript
// ✅ Good - mock external dependencies
import { vi } from 'vitest'

import { BedrockClient } from '@aws-sdk/client-bedrock'

describe('AIEngineService', () => {
  it('should generate architecture from description', async () => {
    // Mock Bedrock API
    const mockBedrock = vi.mocked(BedrockClient)
    mockBedrock.prototype.send = vi.fn().mockResolvedValue({
      body: JSON.stringify({ architecture: mockArchitecture })
    })
    
    const aiEngine = new AIEngineService(mockBedrock)
    const result = await aiEngine.generateArchitecture('Create a REST API')
    
    expect(result.services).toHaveLength(3)
    expect(mockBedrock.prototype.send).toHaveBeenCalledTimes(1)
  })
})
```

---

## React Standards

### Component Design

- Prefer **function components** over class components
- Use **named exports** instead of default exports for better refactoring
- Keep components **small and focused** (< 200 lines)
- Extract complex logic into **custom hooks**

```typescript
// ✅ Good - small, focused component
interface ServiceNodeProps {
  service: AWSService
  selected: boolean
  onSelect: (id: string) => void
}

export function ServiceNode({ service, selected, onSelect }: ServiceNodeProps): JSX.Element {
  const className = selected ? 'service-node selected' : 'service-node'
  
  return (
    <div className={className} onClick={() => onSelect(service.id)}>
      <img src={getServiceIcon(service.type)} alt={service.type} />
      <span>{service.name}</span>
    </div>
  )
}

// ❌ Bad - default export, complex component
export default function BigComponent() {
  // 500 lines of mixed logic and JSX
}
```

### Hooks

- Use hooks at the **top level** only (not in loops, conditions, or nested functions)
- Extract **custom hooks** for reusable logic
- Name custom hooks with `use` prefix

```typescript
// ✅ Good - custom hook for diagram auto-save
export function useAutoSave(
  diagram: Architecture,
  interval: number = 30000
): { lastSaved: Date | null; saving: boolean } {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  
  useEffect(() => {
    const timer = setInterval(async () => {
      setSaving(true)
      try {
        await saveDiagram(diagram)
        setLastSaved(new Date())
      } finally {
        setSaving(false)
      }
    }, interval)
    
    return () => clearInterval(timer)
  }, [diagram, interval])
  
  return { lastSaved, saving }
}
```

### State Management

- Use **local state** for UI-only concerns
- Use **context** for cross-component shared state
- Keep state **minimal and normalized**

```typescript
// ✅ Good - minimal state
function VisualEditor(): JSX.Element {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const { architecture, updateArchitecture } = useArchitecture()
  
  const selectedService = architecture.services.find(s => s.id === selectedServiceId)
  
  return (
    // ...
  )
}

// ❌ Bad - duplicated state
function VisualEditor(): JSX.Element {
  const [services, setServices] = useState<AWSService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<AWSService | null>(null)
  // selectedService is derived from services + selectedServiceId - don't duplicate!
}
```

### Event Handlers

- Define handlers **inside components** when they need props/state
- Use **useCallback** for handlers passed to child components to prevent re-renders
- Pass **minimal data** to handlers (IDs instead of objects)

```typescript
// ✅ Good - optimized handler
function DiagramEditor({ architecture }: DiagramEditorProps): JSX.Element {
  const handleServiceSelect = useCallback((serviceId: string) => {
    // Handler logic
  }, [])  // Add dependencies if needed
  
  return (
    <div>
      {architecture.services.map(service => (
        <ServiceNode
          key={service.id}
          service={service}
          onSelect={handleServiceSelect}
        />
      ))}
    </div>
  )
}
```

---

## AWS Lambda Standards

### Handler Structure

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { logger } from './utils/logger'

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  
  try {
    logger.info('Processing request', { requestId })
    
    // Validate input
    const body = JSON.parse(event.body || '{}')
    if (!isValidRequest(body)) {
      return errorResponse(400, 'Invalid request body')
    }
    
    // Business logic
    const result = await processRequest(body)
    
    logger.info('Request completed', { requestId })
    return successResponse(result)
    
  } catch (error) {
    logger.error('Request failed', { requestId, error })
    return errorResponse(500, 'Internal server error')
  }
}

// Helper functions
function successResponse(data: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  }
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: message })
  }
}
```

### Cold Start Optimization

- Initialize SDK clients **outside the handler** for reuse across invocations
- Use **provisioned concurrency** for latency-sensitive functions
- Keep deployment packages **small** (< 50MB uncompressed)

```typescript
// ✅ Good - initialize outside handler
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'

// Initialized once per container
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION })
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION })

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Use pre-initialized clients
  const result = await dynamodb.send(...)
  return successResponse(result)
}

// ❌ Bad - initialize inside handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION })  // Created every invocation!
  const result = await dynamodb.send(...)
  return successResponse(result)
}
```

### Environment Variables

- Load environment variables at **module initialization**
- Validate required variables at **startup**
- Use descriptive names with prefixes

```typescript
// ✅ Good - validate at startup
const REQUIRED_ENV_VARS = [
  'AWS_REGION',
  'DYNAMODB_TABLE_NAME',
  'BEDROCK_MODEL_ID'
] as const

// Validate on module load
for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

// Type-safe access
const CONFIG = {
  region: process.env.AWS_REGION!,
  tableName: process.env.DYNAMODB_TABLE_NAME!,
  modelId: process.env.BEDROCK_MODEL_ID!
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Use CONFIG instead of process.env directly
  const result = await queryTable(CONFIG.tableName)
  return successResponse(result)
}
```

---

## Comments and Documentation

### When to Comment

**DO comment**:
- Complex algorithms or business logic
- Non-obvious workarounds or bug fixes
- API interfaces and public functions
- Regular expressions
- Performance-critical sections

**DON'T comment**:
- Obvious code that is self-explanatory
- Code that can be clarified by better naming
- Commented-out code (delete it instead)

```typescript
// ✅ Good - explains non-obvious logic
// Use exponential backoff to avoid overwhelming the API during outages.
// Jitter prevents thundering herd when multiple instances retry simultaneously.
const backoff = Math.pow(2, attempt - 1) * 1000
const jitter = Math.random() * 1000
await sleep(backoff + jitter)

// ✅ Good - documents API contract
/**
 * Generates a CloudFormation template from an architecture diagram.
 * 
 * @param architecture - The architecture diagram to convert
 * @param options - Template generation options
 * @returns A valid CloudFormation template
 * @throws {ValidationError} If the architecture contains invalid services or connections
 */
export function generateTemplate(
  architecture: Architecture,
  options?: TemplateOptions
): CloudFormationTemplate {
  // ...
}

// ❌ Bad - obvious comment
// Increment counter by 1
counter = counter + 1

// ❌ Bad - outdated commented code
// const oldImplementation = () => {
//   // This doesn't work anymore
// }
```

### JSDoc for Public APIs

Use JSDoc for all exported functions and types:

```typescript
/**
 * Validates an AWS architecture for deployment readiness.
 * 
 * Checks for:
 * - Missing required configurations
 * - Invalid service connections
 * - AWS account quotas
 * - IAM permission requirements
 * 
 * @param architecture - The architecture to validate
 * @param awsAccount - The target AWS account information
 * @returns Validation result with any errors found
 * 
 * @example
 * ```typescript
 * const result = validateArchitecture(myArchitecture, account)
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors)
 * }
 * ```
 */
export function validateArchitecture(
  architecture: Architecture,
  awsAccount: AWSAccount
): ValidationResult {
  // ...
}
```

---

## Performance Guidelines

### Avoid Premature Optimization

- Write **correct** code first, optimize later if needed
- Profile before optimizing
- Focus on **algorithmic complexity** before micro-optimizations

### Common Optimizations

**1. Memoization for expensive computations**

```typescript
// ✅ Good - memoize cost calculations
const costCache = new Map<string, CostEstimate>()

function estimateCostCached(architecture: Architecture): CostEstimate {
  const key = hashArchitecture(architecture)
  
  if (costCache.has(key)) {
    return costCache.get(key)!
  }
  
  const estimate = estimateCost(architecture)
  costCache.set(key, estimate)
  return estimate
}
```

**2. Batch operations**

```typescript
// ✅ Good - batch DynamoDB writes
async function saveDiagrams(diagrams: DiagramRecord[]): Promise<void> {
  const batches = chunk(diagrams, 25)  // DynamoDB batch limit
  
  await Promise.all(
    batches.map(batch => dynamodb.batchWriteItem({
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    }))
  )
}

// ❌ Bad - sequential writes
async function saveDiagrams(diagrams: DiagramRecord[]): Promise<void> {
  for (const diagram of diagrams) {
    await dynamodb.putItem({ TableName: tableName, Item: diagram })
  }
}
```

**3. Lazy loading**

```typescript
// ✅ Good - lazy load large diagrams
async function getDiagramSummary(diagramId: string): Promise<DiagramSummary> {
  const metadata = await dynamodb.getItem({
    TableName: 'cloudforge-diagrams',
    Key: { diagramId },
    ProjectionExpression: 'id, #name, version, updatedAt',
    ExpressionAttributeNames: { '#name': 'name' }
  }).promise()
  
  return metadata.Item as DiagramSummary
}
```

---

## Git Workflow Standards

### Branch Naming

- **Feature branches**: `feature/<short-description>`
- **Bug fixes**: `fix/<bug-name>`
- **Refactoring**: `refactor/<component>`
- Examples: `feature/diagram-export`, `fix/deployment-timeout`, `refactor/ai-engine`

### Commit Messages

Format: `<type>: <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no behavior change)
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `perf`: Performance improvements
- `style`: Code formatting (no logic change)

Examples:
```
feat: add CloudFormation template validation
fix: resolve race condition in deployment polling
refactor: extract cost calculation to separate service
docs: update API authentication guide
test: add property-based tests for parser
```

### Commit Practices

- **Atomic commits**: One logical change per commit
- **Specific staging**: Stage files explicitly by path
- **Never skip hooks**: Let pre-commit checks run
- **Review before commit**: Use `git diff --staged`

```bash
# ✅ Good - explicit staging
git add src/services/cloudformation-generator.ts
git add src/services/cloudformation-generator.test.ts
git commit -m "feat: add CloudFormation template generator"

# ❌ Bad - staging everything
git add .
git commit -m "updates"
```

### Files to Never Commit

Ensure `.gitignore` includes:
```
# Environment variables
.env
.env.local
.env.production
.env.*.local

# Dependencies
node_modules/
.pnp/
.yarn/

# Build outputs
dist/
build/
.next/
out/

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# AWS
.aws/
credentials

# Secrets and keys
*.pem
*.key
secrets.json
```

---

## Code Review Checklist

Before submitting code for review, verify:

### Functionality
- [ ] Code implements requirements correctly
- [ ] Edge cases are handled
- [ ] Error handling is comprehensive
- [ ] All acceptance criteria are met

### Code Quality
- [ ] TypeScript strict mode enabled, no `any` types
- [ ] Functions are small and focused (< 50 lines)
- [ ] Variable and function names are descriptive
- [ ] No duplicated code (DRY principle)
- [ ] Comments explain "why", not "what"

### Security
- [ ] No hardcoded secrets or credentials
- [ ] All inputs are validated
- [ ] No PII or tokens in logs
- [ ] Parameterized queries only (no string concatenation)
- [ ] User-provided content is sanitized

### Testing
- [ ] Unit tests cover new functionality
- [ ] Property-based tests for parsers/transformations
- [ ] Tests follow AAA pattern
- [ ] Mock external dependencies
- [ ] All tests pass

### Performance
- [ ] No obvious performance issues
- [ ] SDK clients initialized outside Lambda handlers
- [ ] Batch operations used where appropriate
- [ ] Database queries optimized

### Git
- [ ] Commits are atomic and well-described
- [ ] Branch name follows convention
- [ ] No sensitive files committed
- [ ] Pre-commit hooks passed

---

## Tools and Configuration

### ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Prettier Configuration

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "avoid"
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

---

## Summary

These coding standards ensure CloudForge AI maintains high quality, security, and maintainability. When in doubt:

1. **Correctness first** - make it work, then make it better
2. **Type safety** - leverage TypeScript's type system fully
3. **Security by default** - validate inputs, protect secrets, sanitize outputs
4. **Test thoroughly** - especially parsers and critical paths
5. **Write for humans** - clear names, helpful comments, simple logic

All contributors must follow these standards. Code reviews will enforce compliance.
