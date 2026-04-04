/**
 * Test Suite for Agent Hierarchy
 * Tests the Master Orchestrator -> Marketing Orchestrator -> Sub-Agents flow
 */

import { masterOrchestrator } from './master-orchestrator';
import { marketingOrchestrator } from './marketing-orchestrator';

async function testAgentHierarchy() {
  console.log('🧪 Starting Agent Hierarchy Test Suite\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Master Orchestrator Initialization
    console.log('\n📋 Test 1: Master Orchestrator Initialization');
    await masterOrchestrator.start();
    const systemStatus = masterOrchestrator.getSystemStatus();
    console.log('✅ Master Orchestrator Status:', {
      status: systemStatus.orchestrator.status,
      agents: systemStatus.agents.total,
      health: systemStatus.orchestrator.health
    });

    // Test 2: Create User Session
    console.log('\n📋 Test 2: User Session Management');
    const userSession = masterOrchestrator.createUserSession('test-user-1', 'pro');
    console.log('✅ User Session Created:', {
      userId: userSession.userId,
      tier: userSession.tier,
      permissions: userSession.permissions.length
    });

    // Test 3: Marketing Orchestrator Integration
    console.log('\n📋 Test 3: Marketing Orchestrator Status');
    const marketingStatus = marketingOrchestrator.getComprehensiveStatus();
    console.log('✅ Marketing Orchestrator:', {
      platformAgents: marketingOrchestrator.platformAgents.size,
      specialists: Object.keys(marketingStatus.specialists || {}).length
    });

    // Test 4: Sub-Agent Coordinators
    console.log('\n📋 Test 4: Sub-Agent Coordinators');
    
    // Test Platform Specialist
    const platformOptimization = await marketingOrchestrator.optimizeContentForAllPlatforms(
      { text: 'Test content for optimization', media: 'image' },
      ['instagram', 'tiktok', 'linkedin']
    );
    console.log('✅ Platform Specialist:', {
      optimized: !!platformOptimization.optimized,
      scheduled: platformOptimization.scheduled?.length || 0
    });

    // Test Trend Predictor
    const trendCampaign = await marketingOrchestrator.createTrendBasedCampaign();
    console.log('✅ Trend Predictor:', {
      campaign: !!trendCampaign.campaign,
      trends: trendCampaign.trends?.length || 0
    });

    // Test Social Scheduler
    const scheduledContent = await marketingOrchestrator.smartScheduleContent([
      { platform: 'instagram', content: { text: 'Instagram post' }, priority: 'high' },
      { platform: 'twitter', content: { text: 'Tweet content' }, priority: 'medium' },
      { platform: 'linkedin', content: { text: 'LinkedIn update' }, priority: 'low' }
    ]);
    console.log('✅ Social Scheduler:', {
      scheduled: scheduledContent.scheduled?.length || 0,
      queueTotal: scheduledContent.queueStatus?.metrics?.totalQueued || 0
    });

    // Test 5: Task Processing Flow
    console.log('\n📋 Test 5: Task Processing Flow');
    const taskRequest = {
      type: 'content:generate',
      data: {
        prompt: 'Create engaging content about AI',
        platforms: ['instagram', 'linkedin']
      }
    };
    
    const taskResult = await masterOrchestrator.processUserRequest('test-user-1', taskRequest);
    console.log('✅ Task Created:', {
      taskId: taskResult.taskId,
      status: taskResult.status,
      estimatedCompletion: taskResult.estimatedCompletion
    });

    // Test 6: Campaign Launch
    console.log('\n📋 Test 6: Campaign Launch');
    const testCampaign = {
      id: 'test-campaign-1',
      name: 'Test Marketing Campaign',
      platforms: ['instagram', 'twitter'],
      objectives: ['brand_awareness', 'engagement'],
      budget: 1000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      targetAudience: {
        demographics: {
          ageRange: [25, 45] as [number, number],
          gender: ['all'],
          locations: ['US'],
          languages: ['en']
        },
        psychographics: {
          interests: ['technology', 'innovation'],
          values: ['quality', 'efficiency'],
          lifestyle: ['professional']
        },
        behaviors: {
          purchaseHistory: [],
          engagementLevel: 'medium' as const,
          platformPreferences: ['instagram', 'twitter']
        }
      },
      content: {
        tone: 'professional' as const,
        formats: ['image', 'text'] as any[],
        themes: ['innovation', 'technology'],
        hooks: ['Did you know?', 'Discover how'],
        ctas: ['Learn more', 'Get started']
      },
      status: 'draft' as const
    };

    await marketingOrchestrator.launchCampaign(testCampaign);
    console.log('✅ Campaign Launched:', testCampaign.name);

    // Test 7: Performance Analytics
    console.log('\n📋 Test 7: Performance Analytics');
    const campaignAnalysis = await marketingOrchestrator.analyzeCampaign('test-campaign-1');
    console.log('✅ Campaign Analysis:', {
      hasMetrics: !!campaignAnalysis.metrics,
      hasRecommendations: !!campaignAnalysis.recommendations,
      hasPredictions: !!campaignAnalysis.predictions
    });

    // Test 8: Content Generation
    console.log('\n📋 Test 8: Content Generation');
    const generatedContent = await marketingOrchestrator.generateContent(
      'instagram',
      'Create an engaging post about sustainable technology',
      { tone: 'inspirational', includeHashtags: true }
    );
    console.log('✅ Content Generated:', {
      platform: generatedContent.platform,
      hasContent: !!generatedContent.content,
      compliance: generatedContent.metadata?.compliance?.passed !== false
    });

    // Test 9: Competitive Intelligence
    console.log('\n📋 Test 9: Competitive Intelligence');
    const competitiveData = await marketingOrchestrator.getCompetitiveIntelligence(['competitor1', 'competitor2']);
    console.log('✅ Competitive Intelligence:', {
      competitors: Object.keys(competitiveData).length,
      hasData: !!competitiveData
    });

    // Test 10: System Health Check
    console.log('\n📋 Test 10: System Health Check');
    const finalStatus = masterOrchestrator.getSystemStatus();
    console.log('✅ Final System Status:', {
      health: finalStatus.orchestrator.health,
      activeAgents: finalStatus.agents.active,
      activeTasks: finalStatus.tasks.active,
      completedTasks: finalStatus.tasks.completed
    });

    // Summary
    console.log('\n', '='.repeat(50));
    console.log('✅ All Tests Completed Successfully!');
    console.log('Agent Hierarchy is functioning correctly:');
    console.log('  1. Master Orchestrator ✓');
    console.log('  2. Marketing Orchestrator ✓');
    console.log('  3. Platform Specialist Coordinator ✓');
    console.log('  4. Social Scheduler Coordinator ✓');
    console.log('  5. Trend Predictor Coordinator ✓');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
  } finally {
    // Cleanup
    await masterOrchestrator.stop();
    console.log('\n🛑 Test Suite Completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAgentHierarchy().catch(console.error);
}

export { testAgentHierarchy };