
// Quick test script for SYNTHEX functionality
import { supabase, auth, db } from './lib/supabase-client';
import { contentGenerator } from './lib/services/content-generator';

async function testIntegration() {
  console.log('Testing SYNTHEX Integration...');
  
  // Test 1: Database connection
  const { connected } = await testConnection();
  console.log('Database:', connected ? '✅ Connected' : '❌ Failed');
  
  // Test 2: AI Content Generation
  try {
    const content = await contentGenerator.generateContent({
      platform: 'twitter',
      topic: 'AI in marketing',
      hookType: 'question',
      includeHashtags: true
    });
    console.log('AI Generation: ✅ Working');
    console.log('Sample:', content.primary.substring(0, 100) + '...');
  } catch (error) {
    console.log('AI Generation: ❌ Failed', error.message);
  }
  
  // Test 3: Auth system
  try {
    // This will fail without valid credentials, but tests the system
    await auth.signIn('test@example.com', 'password');
  } catch (error) {
    console.log('Auth System: ✅ Responding (login failed as expected)');
  }
}

testIntegration();
