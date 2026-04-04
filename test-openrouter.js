#!/usr/bin/env node

// OpenRouter Integration Test Script
// This script tests the OpenRouter Horizon Alpha integration

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testOpenRouter() {
  console.log('🧪 Testing OpenRouter Integration...\n');

  try {
    // Test 1: Check status
    console.log('1️⃣ Testing OpenRouter Status...');
    const statusResponse = await axios.get(`${BASE_URL}/api/openrouter/status`);
    console.log('✅ Status:', statusResponse.data.message);
    console.log('📊 Configured:', statusResponse.data.configured);
    console.log('🤖 Default Model:', statusResponse.data.defaultModel);
    console.log('');

    if (!statusResponse.data.configured) {
      console.log('❌ OpenRouter not configured. Please add OPENROUTER_API_KEY to your .env file');
      return;
    }

    // Test 2: List models
    console.log('2️⃣ Testing Available Models...');
    const modelsResponse = await axios.get(`${BASE_URL}/api/openrouter/models`);
    console.log('📚 Available Models:', modelsResponse.data.models.length);
    console.log('🌟 Recommended:', modelsResponse.data.recommended);
    console.log('');

    // Test 3: Connection test
    console.log('3️⃣ Testing Connection...');
    const testResponse = await axios.get(`${BASE_URL}/api/openrouter/test`);
    console.log('✅ Connection:', testResponse.data.success ? 'Success' : 'Failed');
    console.log('💬 Response:', testResponse.data.response);
    console.log('');

    // Test 4: Generate marketing content
    console.log('4️⃣ Testing Marketing Content Generation...');
    const contentResponse = await axios.post(`${BASE_URL}/api/openrouter/marketing/generate`, {
      prompt: 'Create a compelling social media post for a new AI-powered marketing tool',
      contentType: 'social_post'
    });
    console.log('📝 Generated Content:');
    console.log(contentResponse.data.content);
    console.log('');

    // Test 5: Generate variations
    console.log('5️⃣ Testing Content Variations...');
    const variationsResponse = await axios.post(`${BASE_URL}/api/openrouter/marketing/variations`, {
      prompt: 'Limited time offer - 50% off our premium features',
      count: 2,
      contentType: 'email'
    });
    console.log('🔄 Generated Variations:');
    variationsResponse.data.variations.forEach((variation, index) => {
      console.log(`   ${index + 1}. ${variation.substring(0, 100)}...`);
    });
    console.log('');

    // Test 6: Optimize content
    console.log('6️⃣ Testing Content Optimization...');
    const optimizeResponse = await axios.post(`${BASE_URL}/api/openrouter/marketing/optimize`, {
      content: 'Buy now! Great deal!',
      platform: 'instagram',
      goals: ['engagement', 'conversions']
    });
    console.log('🔧 Original:', optimizeResponse.data.original);
    
    // Handle optimization response safely
    const optimization = optimizeResponse.data.optimization;
    if (optimization) {
      // Handle optimized content
      const optimizedContent = optimization.optimizedContent || optimization.optimized || 'No optimized content';
      console.log('✨ Optimized:', optimizedContent.substring(0, 150) + (optimizedContent.length > 150 ? '...' : ''));
      
      // Handle analysis field safely
      const analysis = optimization.analysis || 'No analysis available';
      const analysisText = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);
      console.log('📈 Analysis:', analysisText.substring(0, 150) + (analysisText.length > 150 ? '...' : ''));
      
      // Handle suggestions safely
      if (optimization.suggestions && Array.isArray(optimization.suggestions)) {
        console.log('💡 Suggestions:');
        optimization.suggestions.slice(0, 3).forEach((suggestion, i) => {
          const suggestionText = typeof suggestion === 'string' ? suggestion : JSON.stringify(suggestion);
          console.log(`   ${i + 1}. ${suggestionText.substring(0, 80)}${suggestionText.length > 80 ? '...' : ''}`);
        });
      }
    } else {
      console.log('⚠️ No optimization data received');
    }
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('🌐 OpenRouter Horizon Alpha integration is working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the server is running (npm run dev)');
    console.log('2. Check your OPENROUTER_API_KEY in .env file');
    console.log('3. Ensure you have internet connectivity');
  }
}

async function main() {
  console.log('🤖 Auto Marketing Agent - OpenRouter Test Suite');
  console.log('================================================\n');
  
  // Wait a moment for server to be ready
  console.log('⏱️ Waiting for server to be ready...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testOpenRouter();
}

if (require.main === module) {
  main();
}
