const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api/enhancement';

async function runResearchTests() {
  console.log('🔬 Auto Marketing Platform - Product Enhancement Research Demo');
  console.log('=' .repeat(60));
  
  // 1. Analyze Current Capabilities
  console.log('\n📊 Current Capabilities Analysis:');
  try {
    const capResponse = await fetch(`${BASE_URL}/research/capabilities`);
    const capabilities = await capResponse.json();
    console.log('✅ Core Features:', capabilities.capabilities.core.length);
    console.log('✅ Supported Platforms:', capabilities.capabilities.platforms.join(', '));
    console.log('⚠️  Limitations:', capabilities.capabilities.limitations.length, 'identified');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // 2. Market Trends Research
  console.log('\n📈 Market Trends:');
  try {
    const trendsResponse = await fetch(`${BASE_URL}/research/trends`);
    const trends = await trendsResponse.json();
    console.log('✅ Emerging Trends:', trends.trends.emerging.length);
    console.log('✅ Competitors Analyzed:', trends.trends.competitive.length);
    console.log('✅ Opportunities:', trends.trends.opportunities.length);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // 3. Implementation Plan
  console.log('\n🗓️ Implementation Roadmap:');
  try {
    const planResponse = await fetch(`${BASE_URL}/research/implementation-plan`);
    const plan = await planResponse.json();
    console.log('Phase 1 (2 weeks):', plan.plan.phase1.features.join(', '));
    console.log('Phase 2 (3 weeks):', plan.plan.phase2.features.join(', '));
    console.log('Phase 3 (2 weeks):', plan.plan.phase3.features.join(', '));
    console.log('Phase 4 (2 weeks):', plan.plan.phase4.features.join(', '));
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // 4. Test Analytics Dashboard
  console.log('\n📊 Analytics Dashboard Demo:');
  try {
    // Aggregate metrics
    const metricsResponse = await fetch(`${BASE_URL}/analytics/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms: ['twitter', 'linkedin'],
        timeRange: '7d'
      })
    });
    const metrics = await metricsResponse.json();
    console.log('✅ Metrics aggregated:', metrics.metrics.aggregated);
    console.log('   Total Impressions:', metrics.metrics.data.total.impressions);
    console.log('   Total Engagement:', metrics.metrics.data.total.engagement);
    
    // Performance prediction
    const predictionResponse = await fetch(`${BASE_URL}/analytics/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        historicalData: [100, 150, 200, 180, 250],
        model: 'linear'
      })
    });
    const prediction = await predictionResponse.json();
    console.log('✅ Performance Prediction:');
    console.log('   Next Period:', prediction.prediction.prediction);
    console.log('   Confidence:', (prediction.prediction.confidence * 100).toFixed(0) + '%');
    console.log('   Trend:', prediction.prediction.trend);
    
    // Trending content
    const trendingResponse = await fetch(`${BASE_URL}/analytics/trending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: [
          { id: '1', content: 'AI Marketing Tips', views: 1000, likes: 150, shares: 50, comments: 30 },
          { id: '2', content: 'Social Media Trends', views: 500, likes: 20, shares: 5, comments: 2 }
        ],
        threshold: 0.5
      })
    });
    const trending = await trendingResponse.json();
    console.log('✅ Trending Analysis:');
    console.log('   Posts Analyzed:', trending.trending.analyzed);
    console.log('   Trending Found:', trending.trending.trending.length);
    console.log('   Suggestions:', trending.trending.suggestions.length);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // 5. Business Insights
  console.log('\n💡 Strategic Insights:');
  try {
    const insightsResponse = await fetch(`${BASE_URL}/research/insights`);
    const insights = await insightsResponse.json();
    
    for (const insight of insights.insights) {
      console.log(`\n${insight.area}:`);
      console.log('  Findings:', insight.findings.length);
      console.log('  Opportunities:', insight.opportunities.length);
      console.log('  Recommendations:', insight.recommendations[0]);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // 6. Product Roadmap
  console.log('\n🚀 Product Roadmap:');
  try {
    const roadmapResponse = await fetch(`${BASE_URL}/research/roadmap`);
    const roadmap = await roadmapResponse.json();
    
    console.log('Q1 2025:', roadmap.roadmap.q1_2025.goals[0]);
    console.log('  Target Users:', roadmap.roadmap.q1_2025.metrics.users);
    console.log('  Target MRR: $', roadmap.roadmap.q1_2025.metrics.mrr);
    
    console.log('Q4 2025:', roadmap.roadmap.q4_2025.goals[0]);
    console.log('  Target Users:', roadmap.roadmap.q4_2025.metrics.users);
    console.log('  Target MRR: $', roadmap.roadmap.q4_2025.metrics.mrr);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Research Complete!');
  console.log('\n📄 Full report available at: PRODUCT-ENHANCEMENT-RESEARCH.md');
  console.log('📚 TTD RD Integration docs: docs/MCP-TTD-RD-INTEGRATION.md');
  console.log('\n🎯 Next Steps:');
  console.log('1. Review enhancement priorities');
  console.log('2. Begin Phase 1 implementation');
  console.log('3. Set up continuous testing');
  console.log('4. Deploy with auto-rollback');
}

// Run the demo
runResearchTests().catch(console.error);