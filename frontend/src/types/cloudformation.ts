/**
 * CloudFormation template types
 */

export interface CloudFormationTemplate {
  AWSTemplateFormatVersion: string
  Description: string
  Parameters?: Record<string, Parameter>
  Resources: Record<string, Resource>
  Outputs?: Record<string, Output>
}

export interface Resource {
  Type: string
  Properties: Record<string, unknown>
  DependsOn?: string | string[]
}

export interface Parameter {
  Type: string
  Description?: string
  Default?: unknown
  AllowedValues?: unknown[]
  MinValue?: number
  MaxValue?: number
}

export interface Output {
  Description: string
  Value: unknown
  Export?: { Name: string }
}
