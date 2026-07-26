import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Architecture } from '../../shared/types/index.js';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Security Analysis Lambda
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 * 
 * Analyzes architecture for security vulnerabilities and provides remediation recommendations
 */

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface SecurityFinding {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  risk: string;
  remediation: string;
  effort: 'low' | 'medium' | 'high';
  autoFixable: boolean;
  changes?: {
    type: string;
    configuration: Record<string, any>;
  };
}

interface SecurityAnalysisResult {
  score: number; // 0-100
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: SecurityFinding[];
  recommendations: string[];
  aiInsights: string;
}

/**
 * Analyze architecture for security vulnerabilities
 */
function analyzeSecurityFindings(architecture: Architecture): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let findingId = 1;

  for (const service of architecture.services) {
    const config = service.configuration || {};

    // Check S3 buckets
    if (service.type === 'S3') {
      // Public access without encryption
      if (config.publicAccess === true && config.encryption !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'critical',
          category: 'Data Exposure',
          title: 'Public S3 Bucket Without Encryption',
          description: `S3 bucket "${service.name}" is publicly accessible and does not have encryption enabled.`,
          risk: 'Sensitive data could be exposed to unauthorized users. Data in transit and at rest is unencrypted.',
          remediation: 'Enable server-side encryption (SSE-S3 or SSE-KMS) and block public access unless absolutely necessary.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'S3',
            configuration: {
              ...config,
              encryption: true,
              publicAccess: false,
            },
          },
        });
      }

      // Public access
      if (config.publicAccess === true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'high',
          category: 'Data Exposure',
          title: 'Public S3 Bucket',
          description: `S3 bucket "${service.name}" allows public access.`,
          risk: 'Bucket contents may be accessible to anyone on the internet.',
          remediation: 'Enable Block Public Access settings unless the bucket is intended for static website hosting.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'S3',
            configuration: {
              ...config,
              publicAccess: false,
            },
          },
        });
      }

      // No encryption
      if (config.encryption !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'high',
          category: 'Encryption',
          title: 'S3 Bucket Without Encryption',
          description: `S3 bucket "${service.name}" does not have server-side encryption enabled.`,
          risk: 'Data at rest is not encrypted, violating compliance requirements (HIPAA, PCI DSS).',
          remediation: 'Enable default encryption with AES-256 (SSE-S3) or AWS KMS (SSE-KMS).',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'S3',
            configuration: {
              ...config,
              encryption: true,
            },
          },
        });
      }

      // No versioning
      if (config.versioning !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'medium',
          category: 'Data Protection',
          title: 'S3 Versioning Not Enabled',
          description: `S3 bucket "${service.name}" does not have versioning enabled.`,
          risk: 'Accidental deletion or overwrite of objects cannot be recovered.',
          remediation: 'Enable versioning to protect against accidental deletion and support compliance requirements.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'S3',
            configuration: {
              ...config,
              versioning: true,
            },
          },
        });
      }
    }

    // Check Lambda functions
    if (service.type === 'Lambda') {
      // No VPC
      if (!config.vpc) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'medium',
          category: 'Network Isolation',
          title: 'Lambda Not in VPC',
          description: `Lambda function "${service.name}" is not deployed in a VPC.`,
          risk: 'Function cannot access private resources securely and has direct internet access.',
          remediation: 'Deploy Lambda in a private subnet with VPC endpoints for AWS services.',
          effort: 'medium',
          autoFixable: false,
        });
      }

      // Environment variables with potential secrets
      if (config.environment) {
        const suspiciousKeys = ['password', 'secret', 'key', 'token', 'api_key', 'apikey'];
        const envVars = Object.keys(config.environment);
        const foundSuspicious = envVars.filter(key =>
          suspiciousKeys.some(suspicious => key.toLowerCase().includes(suspicious))
        );

        if (foundSuspicious.length > 0) {
          findings.push({
            id: `SEC-${findingId++}`,
            serviceId: service.id,
            serviceName: service.name,
            serviceType: service.type,
            severity: 'critical',
            category: 'Secrets Management',
            title: 'Hardcoded Secrets in Environment Variables',
            description: `Lambda function "${service.name}" has environment variables that may contain secrets: ${foundSuspicious.join(', ')}`,
            risk: 'Secrets stored in plaintext can be exposed through CloudFormation templates, logs, or console access.',
            remediation: 'Use AWS Secrets Manager or Parameter Store to store sensitive values. Reference them at runtime.',
            effort: 'medium',
            autoFixable: false,
          });
        }
      }

      // No reserved concurrency
      if (!config.reservedConcurrency) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'low',
          category: 'Resource Limits',
          title: 'No Reserved Concurrency Set',
          description: `Lambda function "${service.name}" does not have reserved concurrency configured.`,
          risk: 'Function could consume all account concurrency during a spike, affecting other functions.',
          remediation: 'Set appropriate reserved concurrency limits based on expected load.',
          effort: 'low',
          autoFixable: false,
        });
      }
    }

    // Check DynamoDB tables
    if (service.type === 'DynamoDB') {
      // No encryption
      if (config.encryption !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'high',
          category: 'Encryption',
          title: 'DynamoDB Table Without Encryption',
          description: `DynamoDB table "${service.name}" does not have encryption at rest enabled.`,
          risk: 'Sensitive data stored in the table is not encrypted, violating compliance requirements.',
          remediation: 'Enable encryption at rest using AWS-owned CMK or customer-managed KMS key.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'DynamoDB',
            configuration: {
              ...config,
              encryption: true,
            },
          },
        });
      }

      // No point-in-time recovery
      if (config.pointInTimeRecovery !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'medium',
          category: 'Data Protection',
          title: 'DynamoDB PITR Not Enabled',
          description: `DynamoDB table "${service.name}" does not have Point-in-Time Recovery enabled.`,
          risk: 'Cannot recover from accidental data corruption or deletion.',
          remediation: 'Enable Point-in-Time Recovery (PITR) to support recovery to any point in the last 35 days.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'DynamoDB',
            configuration: {
              ...config,
              pointInTimeRecovery: true,
            },
          },
        });
      }
    }

    // Check RDS instances
    if (service.type === 'RDS') {
      // Not encrypted
      if (config.encrypted !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'critical',
          category: 'Encryption',
          title: 'RDS Instance Without Encryption',
          description: `RDS instance "${service.name}" does not have encryption enabled.`,
          risk: 'Database data at rest is unencrypted, violating compliance requirements (HIPAA, PCI DSS).',
          remediation: 'Enable encryption at rest using AWS KMS. Note: Requires creating a new encrypted instance.',
          effort: 'high',
          autoFixable: false,
        });
      }

      // Public accessibility
      if (config.publiclyAccessible === true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'critical',
          category: 'Network Security',
          title: 'Publicly Accessible RDS Instance',
          description: `RDS instance "${service.name}" is publicly accessible.`,
          risk: 'Database is exposed to the internet, vulnerable to brute force and unauthorized access.',
          remediation: 'Disable public accessibility and access via VPC only.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'RDS',
            configuration: {
              ...config,
              publiclyAccessible: false,
            },
          },
        });
      }

      // No backup retention
      if (!config.backupRetentionPeriod || config.backupRetentionPeriod === 0) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'high',
          category: 'Data Protection',
          title: 'RDS Automated Backups Not Enabled',
          description: `RDS instance "${service.name}" does not have automated backups enabled.`,
          risk: 'Cannot recover from data loss or corruption events.',
          remediation: 'Enable automated backups with at least 7 days retention.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'RDS',
            configuration: {
              ...config,
              backupRetentionPeriod: 7,
            },
          },
        });
      }
    }

    // Check API Gateway
    if (service.type === 'APIGateway') {
      // No throttling
      if (!config.throttle) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'medium',
          category: 'API Security',
          title: 'API Gateway Without Throttling',
          description: `API Gateway "${service.name}" does not have throttling configured.`,
          risk: 'API is vulnerable to DDoS attacks and excessive usage costs.',
          remediation: 'Configure rate limits and burst limits appropriate for your use case.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'APIGateway',
            configuration: {
              ...config,
              throttle: {
                rateLimit: 10000,
                burstLimit: 5000,
              },
            },
          },
        });
      }

      // No logging
      if (config.logging !== true) {
        findings.push({
          id: `SEC-${findingId++}`,
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.type,
          severity: 'medium',
          category: 'Monitoring',
          title: 'API Gateway Logging Not Enabled',
          description: `API Gateway "${service.name}" does not have access logging enabled.`,
          risk: 'Cannot audit API access or investigate security incidents.',
          remediation: 'Enable CloudWatch Logs for access logging and execution logging.',
          effort: 'low',
          autoFixable: true,
          changes: {
            type: 'APIGateway',
            configuration: {
              ...config,
              logging: true,
              logLevel: 'INFO',
            },
          },
        });
      }
    }
  }

  return findings;
}

/**
 * Build AI prompt for security recommendations
 */
function buildSecurityPrompt(architecture: Architecture, findings: SecurityFinding[]): string {
  const findingsSummary = findings.map(f => 
    `- ${f.severity.toUpperCase()}: ${f.title} (${f.serviceName})`
  ).join('\n');

  return `You are an AWS security expert. Analyze this architecture and provide enterprise-grade security recommendations.

Architecture has ${findings.length} security findings:
${findingsSummary}

Provide:
1. Overall security assessment (1-2 sentences)
2. Priority security improvements (top 3-5 specific actions)
3. Compliance considerations (HIPAA, PCI DSS, SOC 2)
4. Additional security best practices not covered by automated checks

Be specific and actionable. Focus on AWS security services (IAM, KMS, Secrets Manager, WAF, Shield, GuardDuty).

Respond with plain text, no markdown formatting.`;
}

/**
 * Calculate security score based on findings
 */
function calculateSecurityScore(findings: SecurityFinding[]): number {
  if (findings.length === 0) return 100;

  const weights = {
    critical: 25,
    high: 15,
    medium: 5,
    low: 2,
  };

  const penalty = findings.reduce((sum, finding) => sum + weights[finding.severity], 0);
  return Math.max(0, 100 - penalty);
}

/**
 * Apply security fixes to architecture
 */
function applySecurityFixes(
  architecture: Architecture,
  findings: SecurityFinding[]
): Architecture {
  const fixedArchitecture = JSON.parse(JSON.stringify(architecture)); // Deep clone

  for (const finding of findings) {
    if (!finding.autoFixable || !finding.changes) continue;

    const service = fixedArchitecture.services.find((s: any) => s.id === finding.serviceId);
    if (service) {
      console.log('Applying security fix:', {
        findingId: finding.id,
        serviceId: finding.serviceId,
        title: finding.title,
      });

      // Merge configuration changes
      service.configuration = {
        ...service.configuration,
        ...finding.changes.configuration,
      };
    }
  }

  return fixedArchitecture;
}

/**
 * Main handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Security analysis request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Request body is required',
        }),
      };
    }

    const { architecture } = JSON.parse(event.body) as {
      architecture: Architecture;
    };

    if (!architecture || !architecture.services) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Valid architecture with services is required',
        }),
      };
    }

    // Analyze security
    const findings = analyzeSecurityFindings(architecture);
    const score = calculateSecurityScore(findings);

    // Count by severity
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;
    const lowCount = findings.filter(f => f.severity === 'low').length;

    // Get AI insights if there are findings
    let aiInsights = '';
    if (findings.length > 0) {
      const prompt = buildSecurityPrompt(architecture, findings);

      console.log('Requesting AI security insights from Bedrock...');

      const command = new ConverseCommand({
        modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.3,
        },
      });

      const bedrockResponse = await bedrockClient.send(command);
      const content = bedrockResponse.output?.message?.content;
      if (content && content.length > 0 && 'text' in content[0]) {
        aiInsights = content[0].text || '';
      }
    } else {
      aiInsights = 'Your architecture follows AWS security best practices. No significant security issues detected.';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical security ${criticalCount === 1 ? 'issue' : 'issues'} immediately`);
    }
    if (highCount > 0) {
      recommendations.push(`Fix ${highCount} high-severity ${highCount === 1 ? 'vulnerability' : 'vulnerabilities'}`);
    }
    if (mediumCount > 0) {
      recommendations.push(`Review ${mediumCount} medium-severity ${mediumCount === 1 ? 'finding' : 'findings'}`);
    }

    const result: SecurityAnalysisResult = {
      score,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      findings,
      recommendations,
      aiInsights,
    };

    console.log('Security analysis complete:', {
      score,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('Error analyzing security:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to analyze security',
        message: error.message,
      }),
    };
  }
};
