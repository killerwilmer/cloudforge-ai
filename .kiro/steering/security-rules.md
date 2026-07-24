---
inclusion: always
---

# Security Rules

These security requirements MUST be enforced in all code you write for this project.

## Secret Management

**NEVER hardcode secrets, credentials, API keys, or sensitive configuration values.**

- Use environment variables via `process.env` for all sensitive data
- Store secrets in `.env` files (ensure they're in `.gitignore`)
- Use AWS Secrets Manager, Parameter Store, or similar services for production
- Examples of secrets: API keys, database passwords, JWT secrets, encryption keys, OAuth tokens

## Logging and Data Privacy

**NEVER log Personally Identifiable Information (PII) or authentication tokens.**

- Do not log: passwords, tokens, session IDs, credit cards, SSNs, email addresses, phone numbers, IP addresses
- Sanitize error messages before logging
- Use structured logging with explicit field controls
- Redact sensitive fields in debug outputs

## Input Validation

**Validate ALL user inputs without exception.**

- Validate type, format, length, and range for all inputs
- Use schema validation libraries (e.g., Zod, Joi, Yup)
- Sanitize inputs to prevent injection attacks
- Apply validation at API boundaries and before database operations
- Reject invalid input; never silently coerce or ignore validation failures

## Database Security

**ALWAYS use parameterized queries; NEVER concatenate SQL strings.**

- Use prepared statements or ORM query builders
- Never interpolate user input directly into SQL
- Apply this rule to ALL database queries without exception
- Examples:
  - ✅ `db.query('SELECT * FROM users WHERE id = ?', [userId])`
  - ❌ `db.query('SELECT * FROM users WHERE id = ' + userId)`

## Additional Security Practices

- Use HTTPS for all external communications
- Implement proper authentication and authorization checks
- Apply the principle of least privilege
- Keep dependencies updated and scan for vulnerabilities
- Use secure random number generators for tokens and IDs
- Implement rate limiting on API endpoints
