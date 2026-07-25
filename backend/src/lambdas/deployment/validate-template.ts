import { CloudFormationClient, ValidateTemplateCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const cfnClient = new CloudFormationClient({});
const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

export interface ValidateTemplateInput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
}

export interface ValidateTemplateOutput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  isValid: boolean;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  capabilities?: string[];
  error?: string;
}

/**
 * Step Functions handler: Validate CloudFormation template
 * Updates deployment status in DynamoDB
 */
export const handler = async (event: ValidateTemplateInput): Promise<ValidateTemplateOutput> => {
  console.log('Validating template for deployment:', event.deploymentId);

  try {
    // Update deployment status to validating
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, validatingAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'VALIDATING' },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    // Validate CloudFormation template
    const validateCommand = new ValidateTemplateCommand({
      TemplateBody: event.templateBody,
    });

    const result = await cfnClient.send(validateCommand);

    console.log('Template validation successful:', {
      deploymentId: event.deploymentId,
      parameters: result.Parameters?.length || 0,
      capabilities: result.Capabilities?.length || 0,
    });

    // Update deployment status to validated
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, validatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'VALIDATED' },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    return {
      deploymentId: event.deploymentId,
      userId: event.userId,
      templateBody: event.templateBody,
      stackName: event.stackName,
      region: event.region,
      isValid: true,
      parameters: result.Parameters?.map((p) => ({
        ParameterKey: p.ParameterKey!,
        ParameterValue: p.DefaultValue || '',
      })),
      capabilities: result.Capabilities,
    };
  } catch (error: any) {
    console.error('Template validation failed:', error);

    const errorMessage = error.message || 'Unknown validation error';

    // Update deployment status to failed
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression:
          'SET #status = :status, failedAt = :now, errorMessage = :error',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'VALIDATION_FAILED' },
          ':now': { S: new Date().toISOString() },
          ':error': { S: errorMessage },
        },
      })
    );

    return {
      deploymentId: event.deploymentId,
      userId: event.userId,
      templateBody: event.templateBody,
      stackName: event.stackName,
      region: event.region,
      isValid: false,
      error: errorMessage,
    };
  }
};
