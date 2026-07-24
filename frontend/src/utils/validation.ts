/**
 * Input validation utilities
 * Security requirement: Validate ALL inputs
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidServiceName(name: string): boolean {
  // Service names must be 1-64 characters, alphanumeric with hyphens
  const serviceNameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$/
  return serviceNameRegex.test(name)
}

export function isValidRegion(region: string): boolean {
  // Valid AWS regions
  const validRegions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'ap-southeast-1',
    'ap-northeast-1',
  ]
  return validRegions.includes(region)
}
