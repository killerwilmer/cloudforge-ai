#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import 'source-map-support/register'
import { CloudForgeAIStack } from '../lib/cloudforge-ai-stack'

const app = new cdk.App()

new CloudForgeAIStack(app, 'CloudForgeAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'CloudForge AI - AWS Infrastructure Design and Deployment Platform',
  tags: {
    Project: 'CloudForgeAI',
    ManagedBy: 'CDK',
  },
})

app.synth()
