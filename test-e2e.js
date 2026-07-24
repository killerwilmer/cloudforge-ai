#!/usr/bin/env node

/**
 * End-to-End Test Script for CloudForge AI
 * Tests authentication and architecture generation flow
 */

const https = require('https');

const API_BASE = 'https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod';
const EMAIL = 'killerwilmer@gmail.com';
const PASSWORD = 'Skynet2049@?';

function makeRequest(url, method, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testFlow() {
  console.log('🚀 CloudForge AI E2E Test\n');

  try {
    // Step 1: Sign In
    console.log('1️⃣  Signing in...');
    const signInResponse = await makeRequest(
      `${API_BASE}/auth/signin`,
      'POST',
      { email: EMAIL, password: PASSWORD }
    );

    if (signInResponse.statusCode !== 200) {
      throw new Error(`Sign in failed: ${JSON.stringify(signInResponse.body)}`);
    }

    const { accessToken } = signInResponse.body;
    console.log('   ✅ Signed in successfully');
    console.log(`   📝 Access token: ${accessToken.substring(0, 50)}...\n`);

    // Step 2: Generate Architecture
    console.log('2️⃣  Generating architecture...');
    const description = 'I need a serverless REST API with Lambda, API Gateway, and DynamoDB for managing user tasks.';
    
    console.log(`   📄 Description: "${description}"\n`);
    console.log('   ⏳ Waiting for AI response (this may take 10-30 seconds)...\n');

    const generateResponse = await makeRequest(
      `${API_BASE}/api/architectures/generate`,
      'POST',
      { description },
      { 'Authorization': `Bearer ${accessToken}` }
    );

    if (generateResponse.statusCode !== 200) {
      throw new Error(`Generation failed: ${JSON.stringify(generateResponse.body)}`);
    }

    const { architecture, usage } = generateResponse.body;
    
    console.log('   ✅ Architecture generated successfully!\n');
    console.log('   📊 Results:');
    console.log(`   • Name: ${architecture.metadata.name}`);
    console.log(`   • Description: ${architecture.metadata.description}`);
    console.log(`   • Services: ${architecture.services.length}`);
    console.log(`   • Connections: ${architecture.connections.length}`);
    console.log(`   • Region: ${architecture.metadata.region || 'us-east-1'}\n`);

    console.log('   🔧 AWS Services:');
    architecture.services.forEach(service => {
      console.log(`      • ${service.type}: ${service.name}`);
    });

    console.log(`\n   💰 Token Usage:`);
    console.log(`      • Input: ${usage.inputTokens} tokens`);
    console.log(`      • Output: ${usage.outputTokens} tokens`);
    console.log(`      • Total: ${usage.totalTokens} tokens\n`);

    console.log('✅ All tests passed! The application is working correctly! 🎉');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFlow();
