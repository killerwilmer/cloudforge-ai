import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
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
    return `SERVICE_ID="${service.id}" | Name: ${service.name} | Type: ${service.type} | Cost: $${cost?.monthlyCost || 0}/month
  Current Config: ${JSON.stringify(service.configuration || {})}`;
  }).join('\n\n');
  
  return `You are an AWS cost optimization expert. Analyze this architecture and suggest specific, actionable cost optimizations.

Architecture Services (COPY THE SERVICE_ID EXACTLY):
${servicesDescription}

Total Monthly Cost: $${currentCosts.reduce((sum, c) => sum + c.monthlyCost, 0).toFixed(2)}

**CRITICAL INSTRUCTION**: When you create recommendations, you MUST copy the SERVICE_ID value EXACTLY as shown above. For example:
- If you see: SERVICE_ID="lambda-create-1", use "lambda-create-1"
- If you see: SERVICE_ID="api-gateway-1", use "api-gateway-1"
- DO NOT create your own IDs like "create-todo-handler" or "todo-rest-api"

Provide cost optimization recommendations following these rules:
1. Suggest specific AWS service alternatives or configuration changes
2. Calculate realistic cost savings for each recommendation
3. Explain the trade-offs (performance, scalability, complexity)
4. Focus on high-impact optimizations (>15% savings)
5. Only recommend well-supported AWS services

Common optimization strategies:
- Lambda: use ARM64 architecture="arm64" for 20% savings, reduce memory if over-provisioned
- DynamoDB: Switch billingMode from "PAY_PER_REQUEST" to "PROVISIONED" if traffic is predictable
- RDS: Use smaller instanceClass, enable storage autoscaling
- API Gateway: Set apiType="HTTP" instead of REST for 70% cheaper
- S3: Use storageClass="INTELLIGENT_TIERING" for infrequent access
- CloudFront: Optimize cache behavior to reduce origin requests

Respond with a JSON array. Each recommendation MUST use this exact format:
{
  "serviceId": "EXACT-SERVICE-ID-FROM-ABOVE",
  "currentService": "description of current",
  "currentMonthlyCost": 50.00,
  "recommendedService": "description of recommended",
  "recommendedMonthlyCost": 15.00,
  "reasoning": "Explanation",
  "changes": {
    "type": "ServiceType",
    "configuration": { "memory": 512, "architecture": "arm64" }
  }
}

Only include recommendations with >$5/month or >15% savings. Return ONLY valid JSON, no markdown.`;
}

/**
 * Map AI's incorrect serviceId to correct one by fuzzy matching service names
 */
function mapServiceId(aiServiceId: string, serviceName: string, architecture: Architecture): string {
  // First try: exact ID match
  const exactMatch = architecture.services.find(s => s.id === aiServiceId);
  if (exactMatch) {
    console.log(`✓ Exact ID match: ${aiServiceId}`);
    return aiServiceId;
  }
  
  // Second try: fuzzy match by service name
  // Convert both to lowercase and remove special chars for comparison
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedAiId = normalize(aiServiceId);
  
  for (const service of architecture.services) {
    const normalizedServiceName = normalize(service.name);
    const normalizedServiceId = normalize(service.id);
    
    // Check if AI's ID contains parts of the service name or ID
    if (normalizedAiId.includes(normalizedServiceName) || 
        normalizedServiceName.includes(normalizedAiId) ||
        normalizedAiId.includes(normalizedServiceId)) {
      console.log(`✓ Fuzzy match: "${aiServiceId}" → "${service.id}" (via "${service.name}")`);
      return service.id;
    }
  }
  
  // Third try: match by service type pattern
  // e.g., "todo-rest-api" should match the APIGateway service
  if (aiServiceId.includes('api') || aiServiceId.includes('gateway')) {
    const apiService = architecture.services.find(s => s.type === 'APIGateway');
    if (apiService) {
      console.log(`✓ Type match: "${aiServiceId}" → "${apiService.id}" (APIGateway)`);
      return apiService.id;
    }
  }
  
  if (aiServiceId.includes('lambda') || aiServiceId.includes('handler')) {
    // Try to match by function name patterns
    const keywords = ['create', 'read', 'update', 'delete', 'get', 'post', 'put', 'list'];
    for (const keyword of keywords) {
      if (normalizedAiId.includes(keyword)) {
        const lambdaService = architecture.services.find(s => 
          s.type === 'Lambda' && normalize(s.name).includes(keyword)
        );
        if (lambdaService) {
          console.log(`✓ Lambda keyword match: "${aiServiceId}" → "${lambdaService.id}" (${keyword})`);
          return lambdaService.id;
        }
      }
    }
  }
  
  if (aiServiceId.includes('dynamodb') || aiServiceId.includes('table') || aiServiceId.includes('db')) {
    const dbService = architecture.services.find(s => s.type === 'DynamoDB');
    if (dbService) {
      console.log(`✓ Type match: "${aiServiceId}" → "${dbService.id}" (DynamoDB)`);
      return dbService.id;
    }
  }
  
  console.warn(`✗ No match found for AI serviceId: "${aiServiceId}"`);
  return aiServiceId; // Return as-is if no match
}

/**
 * Parse AI response to extract recommendations
 */
function parseAIResponse(aiResponse: string, architecture: Architecture): OptimizationRecommendation[] {
  try {
    let cleaned = aiResponse.trim();
    
    // Extract JSON from markdown code blocks
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      cleaned = jsonBlockMatch[1].trim();
    }
    
    // Find the last ] which closes the JSON array, and cut everything after it
    const lastBracketIndex = cleaned.lastIndexOf(']');
    if (lastBracketIndex !== -1) {
      cleaned = cleaned.substring(0, lastBracketIndex + 1);
    }
    
    // Try to parse as JSON
    const parsed = JSON.parse(cleaned);
    const recommendations = Array.isArray(parsed) ? parsed : [parsed];
    
    console.log(`AI returned ${recommendations.length} recommendations`);
    
    // Calculate savings for each recommendation
    return recommendations.map(rec => {
      const savings = rec.currentMonthlyCost - rec.recommendedMonthlyCost;
      const savingsPercentage = (savings / rec.currentMonthlyCost) * 100;
      
      // Map AI's incorrect serviceId to correct one
      const correctServiceId = mapServiceId(rec.serviceId, rec.serviceName || '', architecture);
      
      // Look up service name from architecture
      const service = architecture.services.find(s => s.id === correctServiceId);
      const serviceName = service?.name || rec.serviceName || 'Unknown Service';
      
      console.log(`Recommendation: ${correctServiceId} (${serviceName}): $${rec.currentMonthlyCost} → $${rec.recommendedMonthlyCost}`);
      
      return {
        serviceId: correctServiceId, // Use corrected ID
        serviceName,
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
      console.log('Applying optimization to service:', {
        serviceId: rec.serviceId,
        serviceName: service.name,
        currentConfig: service.configuration,
        changes: rec.changes,
      });
      
      // Update service type if changed
      if (rec.changes.type && rec.changes.type !== service.type) {
        console.log(`Changing service type from ${service.type} to ${rec.changes.type}`);
        service.type = rec.changes.type;
      }
      
      // Merge configuration changes
      const newConfig = {
        ...service.configuration,
        ...rec.changes.configuration,
        // Add optimization metadata
        optimized: true,
        originalType: service.type,
        originalConfiguration: JSON.parse(JSON.stringify(service.configuration)),
      };
      
      console.log('New configuration:', newConfig);
      service.configuration = newConfig;
    } else {
      console.warn('Service not found for optimization:', rec.serviceId);
    }
  }
  
  console.log('Optimized architecture:', JSON.stringify(optimizedArchitecture, null, 2));
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
    
    // Call Bedrock using Converse API (same as generate-architecture)
    const command = new ConverseCommand({
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', // Use same model as generate-architecture
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.3, // Lower temperature for more consistent recommendations
      },
    });
    
    const bedrockResponse = await bedrockClient.send(command);
    
    if (!bedrockResponse.output || !bedrockResponse.output.message) {
      console.error('Bedrock returned no output');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'AI model did not return a response',
        }),
      };
    }
    
    // Extract text from response
    const content = bedrockResponse.output.message.content;
    if (!content || content.length === 0) {
      console.error('Bedrock returned empty content');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'AI model returned empty response',
        }),
      };
    }
    
    const textContent = content[0];
    if (!textContent || !('text' in textContent)) {
      console.error('Bedrock content has no text field');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'AI model response format invalid',
        }),
      };
    }
    
    const aiResponseText = textContent.text;
    if (!aiResponseText) {
      console.error('Bedrock text content is empty');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'AI model returned empty text',
        }),
      };
    }
    
    console.log('Bedrock response:', aiResponseText);
    
    // Parse recommendations
    const recommendations = parseAIResponse(aiResponseText, architecture);
    
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
