const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api/mcp-ttd';

async function testMCPStatus() {
  console.log('\n📊 Testing MCP Status...');
  try {
    const response = await fetch(`${BASE_URL}/mcp/status`);
    const data = await response.json();
    console.log('✅ MCP Status:', data);
  } catch (error) {
    console.error('❌ MCP Status failed:', error.message);
  }
}

async function testSequentialThinking() {
  console.log('\n🧠 Testing Sequential Thinking...');
  try {
    const response = await fetch(`${BASE_URL}/mcp/sequential-think`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: 'Create viral Twitter content for AI product launch',
        steps: [
          'Analyze current Twitter trends',
          'Identify target audience pain points',
          'Create attention-grabbing hook',
          'Write concise value proposition',
          'Add relevant hashtags and CTA'
        ]
      })
    });
    const data = await response.json();
    console.log('✅ Sequential Thinking Result:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Sequential Thinking failed:', error.message);
  }
}

async function testTTDWorkflow() {
  console.log('\n🧪 Testing TTD Workflow...');
  
  // Step 1: Create tests
  console.log('1️⃣ Creating tests...');
  try {
    const testResponse = await fetch(`${BASE_URL}/ttd/create-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        featureName: 'engagement-calculator',
        testCases: [
          {
            id: 'tc1',
            description: 'Should calculate engagement rate',
            input: { likes: 100, shares: 20, views: 1000 },
            expectedOutput: { engagementRate: 12 }
          },
          {
            id: 'tc2',
            description: 'Should handle zero views',
            input: { likes: 0, shares: 0, views: 0 },
            expectedOutput: { engagementRate: 0 }
          }
        ]
      })
    });
    const testData = await testResponse.json();
    console.log('✅ Tests created:', testData.success ? 'Success' : 'Failed');
  } catch (error) {
    console.error('❌ Test creation failed:', error.message);
  }
  
  // Step 2: Implement feature
  console.log('2️⃣ Implementing feature...');
  try {
    const implementation = `
export class EngagementCalculator {
  async execute(input) {
    const { likes = 0, shares = 0, views = 0 } = input;
    if (views === 0) {
      return { engagementRate: 0 };
    }
    const engagementRate = ((likes + shares) / views) * 100;
    return { engagementRate: Math.round(engagementRate) };
  }
}`;
    
    const implResponse = await fetch(`${BASE_URL}/ttd/implement-feature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        featureName: 'engagement-calculator',
        implementation
      })
    });
    const implData = await implResponse.json();
    console.log('✅ Feature implementation:', implData.success ? 'Tests passed!' : 'Tests failed');
  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting MCP and TTD RD Integration Tests\n');
  console.log('=' .repeat(50));
  
  await testMCPStatus();
  await testSequentialThinking();
  await testTTDWorkflow();
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ All tests completed!');
  console.log('\n📚 Documentation: docs/MCP-TTD-RD-INTEGRATION.md');
  console.log('🔧 Configuration: mcp.config.json');
}

// Run tests
runAllTests().catch(console.error);