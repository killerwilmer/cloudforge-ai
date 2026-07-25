import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Architecture } from '../../shared/types/index.js';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Cost Optimization Lambda
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 
 * Uses AI to analyze architecture and suggest cost-saving optimizations
 */

interface OptimizationRecommendation {
  serviceId: string;
  serviceName: string;
  currentService: string;
  currentMonthlyCost: number;
  recommendedService: string;
  recommendedMonthlyCost: number;
  monthlySavings: number;
  savingsPercentage: number;
  reasoning: string;
  changes: {
    type: string;
    configuration: Record<string, any>;
  };
}

interface CostOptimizationResult {
  totalCurrentCost: number;
  totalOptimizedCost: number;
  totalMonthlySavings: number;
  savingsPercentage: number;
  recommendations: OptimizationRecommendation[];
  optimizedArchitecture: Architecture;
}

/**
 * Build AI prompt for cost optimization
 */
function buildOptimizationPrompt(architecture: Architecture, currentCosts: any[]): string {
  const servicesDescription = architecture.services.map(service => {
    const cost = currentCosts.find(c => c.serviceId === service.id);
    return `- ${service.name} (${service.type}): $${cost?.monthlyCost || 0}/month
  Configuration: ${JSON.stringify(service.configuration || {})}`;
  }).join('\n');
  
  return `You are an AWS cost optimization expert. Analyze this architecture and suggest specific, actionable cost optimizations.

Architecture:
${servicesDescription}

Total Monthly Cost: $${currentCosts.reduce((sum, c) => sum + c.monthlyCost, 0).toFixed(2)}

Provide cost optimization recommendations following these rules:
1. Suggest specific AWS service alternatives or configuration changes
2. Calculate realistic cost savings for each recommendation
3. Explain the trade-offs (performance, scalability, complexity)
4. Focus on high-impact optimizations (>20% savings)
5. Only recommend well-supported AWS services

Common optimization strategies:
- Lambda: Reduce memory allocation if over-provisioned, use ARM64 (Graviton2) for 20% savings
- DynamoDB: Switch from on-demand to provisioned capacity if traffic is predictable
- RDS: Use smaller instance types, enable storage autoscaling, consider Aurora Serverless
- API Gateway: Switch from REST API to HTTP API (70% cheaper)
- S3: Use Intelligent-Tiering for infrequently accessed data
- CloudFront: Optimize cache behavior to reduce origin requests

Respond with a JSON array of recommendations. Each recommendation must have:
{
  "serviceId": "service-id-from-input",
  "currentService": "current service type",
  "currentMonthlyCost": 50.00,
  "recommendedService": "recommended service type or change",
  "recommendedMonthlyCost": 15.00,
  "reasoning": "Explanation of the optimization and trade-offs",
  "changes": {
    "type": "Lambda",
    "configuration": { "memory": 512, "architecture": "arm64" }
  }
}

Only include recommendations that provide meaningful savings (>$5/month or >20%). Return ONLY valid JSON, no markdown or additional text.`;
}

/**
 * Parse AI response to extract recommendations
 */
function parseAIResponse(aiResponse: string): OptimizationRecommendation[] {
  try {
    // Remove markdown code blocks if present
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }
    
    // Try to parse as JSON
    const parsed = JSON.parse(cleaned);
    const recommendations = Array.isArray(parsed) ? parsed : [parsed];
    
    // Calculate savings for each recommendation
    return recommendations.map(rec => {
      const savings = rec.currentMonthlyCost - rec.recommendedMonthlyCost;
      const savingsPercentage = (savings / rec.currentMonthlyCost) * 100;
      
      return {
        serviceId: rec.serviceId,
        serviceName: rec.serviceName || 'Unknown',
        currentService: rec.currentService,
        currentMonthlyCost: rec.currentMonthlyCost,
        recommendedService: rec.recommendedService,
        recommendedMonthlyCost: rec.recommendedMonthlyCost,
        monthlySavings: parseFloat(savings.toFixed(2)),
        savingsPercentage: parseFloat(savingsPercentage.toFixed(1)),
        reasoning: rec.reasoning,
        changes: rec.changes,
      };
    });
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', aiResponse);
    return [];
  }
}

/**
 * Apply optimization recommendations to architecture
 */
function applyOptimizations(
  architecture: Architecture,
  recommendations: OptimizationRecommendation[]
): Architecture {
  const optimizedArchitecture = JSON.parse(JSON.stringify(architecture)); // Deep clone
  
  for (const rec of recommendations) {
    const service = optimizedArchitecture.services.find((s: any) => s.id === rec.serviceId);
    if (service) {
      // Update service type if changed
      if (rec.changes.type !== service.type) {
        service.type = rec.changes.type;
      }
      
      // Merge configuration changes
      service.configuration = {
        ...service.configuration,
        ...rec.changes.configuration,
        // Add optimization metadata
        optimized: true,
        originalType: service.type,
        originalConfiguration: service.configuration,
      };
    }
  }
  
  return optimizedArchitecture;
}

/**
 * Main handler
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Cost optimization request:', JSON.stringify(event, null, 2));
  
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
    
    const { architecture, currentCosts } = JSON.parse(event.body) as {
      architecture: Architecture;
      currentCosts: any[];
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
    
    // Build AI prompt
    const prompt = buildOptimizationPrompt(architecture, currentCosts || []);
    
    console.log('Sending optimization prompt to Bedrock...');
    
    // Call Bedrock for optimization recommendations
    const bedrockRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent recommendations
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };
    
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // Updated to latest version
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(bedrockRequest),
    });
    
    const bedrockResponse = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    
    console.log('Bedrock response:', JSON.stringify(responseBody, null, 2));
    
    // Extract AI-generated text
    const aiResponseText = responseBody.content[0].text;
    
    // Parse recommendations
    const recommendations = parseAIResponse(aiResponseText);
    
    if (recommendations.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          totalCurrentCost: currentCosts.reduce((sum, c) => sum + c.monthlyCost, 0),
          totalOptimizedCost: currentCosts.reduce((sum, c) => sum + c.monthlyCost, 0),
          totalMonthlySavings: 0,
          savingsPercentage: 0,
          recommendations: [],
          optimizedArchitecture: architecture,
          message: 'Your architecture is already well-optimized. No significant cost savings found.',
        }),
      };
    }
    
    // Calculate totals
    const totalCurrentCost = currentCosts.reduce((sum, c) => sum + c.monthlyCost, 0);
    const totalSavings = recommendations.reduce((sum, rec) => sum + rec.monthlySavings, 0);
    const totalOptimizedCost = totalCurrentCost - totalSavings;
    const savingsPercentage = (totalSavings / totalCurrentCost) * 100;
    
    // Apply optimizations to create optimized architecture
    const optimizedArchitecture = applyOptimizations(architecture, recommendations);
    
    const result: CostOptimizationResult = {
      totalCurrentCost: parseFloat(totalCurrentCost.toFixed(2)),
      totalOptimizedCost: parseFloat(totalOptimizedCost.toFixed(2)),
      totalMonthlySavings: parseFloat(totalSavings.toFixed(2)),
      savingsPercentage: parseFloat(savingsPercentage.toFixed(1)),
      recommendations,
      optimizedArchitecture,
    };
    
    console.log('Optimization result:', JSON.stringify(result, null, 2));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
    
  } catch (error: any) {
    console.error('Error optimizing costs:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to optimize costs',
        message: error.message,
      }),
    };
  }
};
