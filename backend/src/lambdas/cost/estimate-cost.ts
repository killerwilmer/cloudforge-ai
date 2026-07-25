import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Architecture } from '../../shared/types/index.js';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Cost Estimation Lambda
 * Requirements: 15.1, 15.2, 15.3, 15.6
 * 
 * Estimates monthly AWS costs for an architecture
 */

interface ServiceCost {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  monthlyCost: number;
  breakdown: {
    component: string;
    cost: number;
    unit: string;
  }[];
}

interface CostEstimate {
  totalMonthlyCost: number;
  services: ServiceCost[];
  assumptions: string[];
  lastUpdated: string;
}

/**
 * Calculate cost for a Lambda function
 * Based on AWS Lambda pricing: $0.20 per 1M requests + $0.0000166667 per GB-second
 */
function estimateLambdaCost(service: any): ServiceCost {
  const memory = service.configuration?.memory || 128; // MB
  const timeout = service.configuration?.timeout || 3; // seconds
  const requestsPerMonth = service.configuration?.requestsPerMonth || 100000;
  
  // Compute cost: GB-seconds
  const gbSeconds = (memory / 1024) * timeout * requestsPerMonth;
  const computeCost = gbSeconds * 0.0000166667;
  
  // Request cost
  const requestCost = (requestsPerMonth / 1000000) * 0.20;
  
  const totalCost = computeCost + requestCost;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        component: 'Compute (GB-seconds)',
        cost: parseFloat(computeCost.toFixed(2)),
        unit: `${Math.round(gbSeconds)} GB-seconds`,
      },
      {
        component: 'Requests',
        cost: parseFloat(requestCost.toFixed(2)),
        unit: `${requestsPerMonth.toLocaleString()} requests`,
      },
    ],
  };
}

/**
 * Calculate cost for DynamoDB
 * Based on on-demand pricing: $1.25 per million write request units, $0.25 per million read request units
 * Storage: $0.25 per GB-month
 */
function estimateDynamoDBCost(service: any): ServiceCost {
  const readRequestsPerMonth = service.configuration?.readRequestsPerMonth || 100000;
  const writeRequestsPerMonth = service.configuration?.writeRequestsPerMonth || 50000;
  const storageGB = service.configuration?.storageGB || 1;
  
  const readCost = (readRequestsPerMonth / 1000000) * 0.25;
  const writeCost = (writeRequestsPerMonth / 1000000) * 1.25;
  const storageCost = storageGB * 0.25;
  
  const totalCost = readCost + writeCost + storageCost;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        component: 'Read requests',
        cost: parseFloat(readCost.toFixed(2)),
        unit: `${readRequestsPerMonth.toLocaleString()} reads`,
      },
      {
        component: 'Write requests',
        cost: parseFloat(writeCost.toFixed(2)),
        unit: `${writeRequestsPerMonth.toLocaleString()} writes`,
      },
      {
        component: 'Storage',
        cost: parseFloat(storageCost.toFixed(2)),
        unit: `${storageGB} GB`,
      },
    ],
  };
}

/**
 * Calculate cost for S3
 * Standard storage: $0.023 per GB-month
 * PUT requests: $0.005 per 1,000 requests
 * GET requests: $0.0004 per 1,000 requests
 */
function estimateS3Cost(service: any): ServiceCost {
  const storageGB = service.configuration?.storageGB || 10;
  const putRequestsPerMonth = service.configuration?.putRequestsPerMonth || 10000;
  const getRequestsPerMonth = service.configuration?.getRequestsPerMonth || 50000;
  
  const storageCost = storageGB * 0.023;
  const putCost = (putRequestsPerMonth / 1000) * 0.005;
  const getCost = (getRequestsPerMonth / 1000) * 0.0004;
  
  const totalCost = storageCost + putCost + getCost;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        component: 'Storage',
        cost: parseFloat(storageCost.toFixed(2)),
        unit: `${storageGB} GB`,
      },
      {
        component: 'PUT requests',
        cost: parseFloat(putCost.toFixed(2)),
        unit: `${putRequestsPerMonth.toLocaleString()} PUTs`,
      },
      {
        component: 'GET requests',
        cost: parseFloat(getCost.toFixed(2)),
        unit: `${getRequestsPerMonth.toLocaleString()} GETs`,
      },
    ],
  };
}

/**
 * Calculate cost for API Gateway
 * REST API: $3.50 per million requests
 * HTTP API: $1.00 per million requests (cheaper)
 */
function estimateAPIGatewayCost(service: any): ServiceCost {
  const requestsPerMonth = service.configuration?.requestsPerMonth || 100000;
  const isHTTPAPI = service.configuration?.type === 'HTTP';
  
  const pricePerMillion = isHTTPAPI ? 1.00 : 3.50;
  const requestCost = (requestsPerMonth / 1000000) * pricePerMillion;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(requestCost.toFixed(2)),
    breakdown: [
      {
        component: `${isHTTPAPI ? 'HTTP' : 'REST'} API requests`,
        cost: parseFloat(requestCost.toFixed(2)),
        unit: `${requestsPerMonth.toLocaleString()} requests`,
      },
    ],
  };
}

/**
 * Calculate cost for RDS
 * t3.micro: $0.017 per hour = ~$12.24/month
 * Storage: $0.115 per GB-month
 */
function estimateRDSCost(service: any): ServiceCost {
  const instanceType = service.configuration?.instanceType || 't3.micro';
  const storageGB = service.configuration?.storageGB || 20;
  
  // Simplified pricing for common instance types
  const instancePricing: Record<string, number> = {
    't3.micro': 12.24,
    't3.small': 24.48,
    't3.medium': 48.96,
    't3.large': 97.92,
  };
  
  const instanceCost = instancePricing[instanceType] || 12.24;
  const storageCost = storageGB * 0.115;
  
  const totalCost = instanceCost + storageCost;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        component: `Instance (${instanceType})`,
        cost: parseFloat(instanceCost.toFixed(2)),
        unit: '730 hours',
      },
      {
        component: 'Storage',
        cost: parseFloat(storageCost.toFixed(2)),
        unit: `${storageGB} GB`,
      },
    ],
  };
}

/**
 * Calculate cost for SQS
 * Standard: $0.40 per million requests (first 1M free)
 */
function estimateSQSCost(service: any): ServiceCost {
  const requestsPerMonth = service.configuration?.requestsPerMonth || 100000;
  
  // First 1M requests free
  const billableRequests = Math.max(0, requestsPerMonth - 1000000);
  const requestCost = (billableRequests / 1000000) * 0.40;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(requestCost.toFixed(2)),
    breakdown: [
      {
        component: 'Requests',
        cost: parseFloat(requestCost.toFixed(2)),
        unit: `${requestsPerMonth.toLocaleString()} requests (1M free)`,
      },
    ],
  };
}

/**
 * Calculate cost for SNS
 * $0.50 per million requests (first 1M free)
 */
function estimateSNSCost(service: any): ServiceCost {
  const requestsPerMonth = service.configuration?.requestsPerMonth || 50000;
  
  // First 1M requests free
  const billableRequests = Math.max(0, requestsPerMonth - 1000000);
  const requestCost = (billableRequests / 1000000) * 0.50;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(requestCost.toFixed(2)),
    breakdown: [
      {
        component: 'Publish requests',
        cost: parseFloat(requestCost.toFixed(2)),
        unit: `${requestsPerMonth.toLocaleString()} requests (1M free)`,
      },
    ],
  };
}

/**
 * Calculate cost for Cognito
 * Free tier: 50,000 MAU
 * Beyond free tier: $0.0055 per MAU
 */
function estimateCognitoCost(service: any): ServiceCost {
  const monthlyActiveUsers = service.configuration?.monthlyActiveUsers || 10000;
  
  // First 50k MAU free
  const billableMAU = Math.max(0, monthlyActiveUsers - 50000);
  const cost = billableMAU * 0.0055;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(cost.toFixed(2)),
    breakdown: [
      {
        component: 'Monthly Active Users',
        cost: parseFloat(cost.toFixed(2)),
        unit: `${monthlyActiveUsers.toLocaleString()} MAU (50k free)`,
      },
    ],
  };
}

/**
 * Calculate cost for CloudFront
 * Data transfer out: $0.085 per GB (first 10 TB)
 * HTTP/HTTPS requests: $0.0075 per 10,000 requests
 */
function estimateCloudFrontCost(service: any): ServiceCost {
  const dataTransferGB = service.configuration?.dataTransferGB || 100;
  const requestsPerMonth = service.configuration?.requestsPerMonth || 1000000;
  
  const transferCost = dataTransferGB * 0.085;
  const requestCost = (requestsPerMonth / 10000) * 0.0075;
  
  const totalCost = transferCost + requestCost;
  
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        component: 'Data transfer out',
        cost: parseFloat(transferCost.toFixed(2)),
        unit: `${dataTransferGB} GB`,
      },
      {
        component: 'Requests',
        cost: parseFloat(requestCost.toFixed(2)),
        unit: `${requestsPerMonth.toLocaleString()} requests`,
      },
    ],
  };
}

/**
 * Estimate cost for a service based on its type
 */
function estimateServiceCost(service: any): ServiceCost {
  const serviceType = service.type.toLowerCase();
  
  if (serviceType.includes('lambda') || serviceType.includes('function') || serviceType.includes('handler')) {
    return estimateLambdaCost(service);
  }
  
  if (serviceType.includes('dynamodb') || serviceType.includes('table')) {
    return estimateDynamoDBCost(service);
  }
  
  if (serviceType.includes('s3') || serviceType.includes('bucket')) {
    return estimateS3Cost(service);
  }
  
  if (serviceType.includes('api') || serviceType.includes('gateway')) {
    return estimateAPIGatewayCost(service);
  }
  
  if (serviceType.includes('rds') || serviceType.includes('database')) {
    return estimateRDSCost(service);
  }
  
  if (serviceType.includes('sqs') || serviceType.includes('queue')) {
    return estimateSQSCost(service);
  }
  
  if (serviceType.includes('sns') || serviceType.includes('topic')) {
    return estimateSNSCost(service);
  }
  
  if (serviceType.includes('cognito') || serviceType.includes('user pool')) {
    return estimateCognitoCost(service);
  }
  
  if (serviceType.includes('cloudfront') || serviceType.includes('cdn')) {
    return estimateCloudFrontCost(service);
  }
  
  // Default for unknown services - minimal cost
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.type,
    monthlyCost: 0,
    breakdown: [
      {
        component: 'Unknown service type',
        cost: 0,
        unit: 'Not estimated',
      },
    ],
  };
}

/**
 * Main handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Cost estimation request:', JSON.stringify(event, null, 2));
  
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
    
    const { architecture } = JSON.parse(event.body) as { architecture: Architecture };
    
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
    
    // Calculate cost for each service
    const serviceCosts: ServiceCost[] = architecture.services.map(service => 
      estimateServiceCost(service)
    );
    
    // Calculate total monthly cost
    const totalMonthlyCost = serviceCosts.reduce((sum, service) => sum + service.monthlyCost, 0);
    
    // Build cost estimate response
    const estimate: CostEstimate = {
      totalMonthlyCost: parseFloat(totalMonthlyCost.toFixed(2)),
      services: serviceCosts,
      assumptions: [
        'Costs are estimated for us-east-1 region',
        'Assumes standard AWS pricing (no reserved instances or savings plans)',
        'Traffic and usage patterns are based on default or configured values',
        'Does not include data transfer costs between services',
        'Free tier benefits are included where applicable',
        'Actual costs may vary based on real usage patterns',
      ],
      lastUpdated: new Date().toISOString(),
    };
    
    console.log('Cost estimate generated:', JSON.stringify(estimate, null, 2));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(estimate),
    };
    
  } catch (error: any) {
    console.error('Error estimating cost:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to estimate cost',
        message: error.message,
      }),
    };
  }
};
