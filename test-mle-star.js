const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api/mle-star';

async function testMLEStarIntegration() {
  console.log('🌟 Google MLE Star Framework Integration Test');
  console.log('=' .repeat(60));
  
  // 1. Test Scoping Evaluation
  console.log('\n📋 Testing Scoping Dimension:');
  try {
    const scopingResponse = await fetch(`${BASE_URL}/evaluate/scoping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectDetails: {
          name: 'Marketing Content AI',
          goal: 'Increase engagement by 40%',
          data: '50000 social media posts',
          stakeholders: ['Marketing Team', 'Data Science', 'Product'],
          timeline: '6 weeks'
        }
      })
    });
    const scoping = await scopingResponse.json();
    console.log('✅ Scoping Score:', scoping.result.score + '%');
    console.log('   Recommendations:', scoping.result.recommendations.length);
  } catch (error) {
    console.error('❌ Scoping failed:', error.message);
  }
  
  // 2. Test Training Evaluation
  console.log('\n🎯 Testing Training Dimension:');
  try {
    const trainingResponse = await fetch(`${BASE_URL}/evaluate/training`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelConfig: {
          algorithm: 'transformer',
          epochs: 20,
          batchSize: 64,
          learningRate: 0.001,
          optimizer: 'adam',
          dataAugmentation: true
        }
      })
    });
    const training = await trainingResponse.json();
    console.log('✅ Training Score:', training.result.score + '%');
  } catch (error) {
    console.error('❌ Training failed:', error.message);
  }
  
  // 3. Test Analysis Evaluation
  console.log('\n📊 Testing Analysis Dimension:');
  try {
    const analysisResponse = await fetch(`${BASE_URL}/evaluate/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelMetrics: {
          accuracy: 0.94,
          precision: 0.92,
          recall: 0.93,
          f1: 0.925,
          auc: 0.97,
          bias: 0.02
        }
      })
    });
    const analysis = await analysisResponse.json();
    console.log('✅ Analysis Score:', analysis.result.score + '%');
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
  
  // 4. Test Reliability Evaluation
  console.log('\n🔒 Testing Reliability Dimension:');
  try {
    const reliabilityResponse = await fetch(`${BASE_URL}/evaluate/reliability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deploymentConfig: {
          environment: 'production',
          replicas: 5,
          autoScale: true,
          monitoring: 'prometheus',
          alerting: 'pagerduty',
          sla: '99.9%'
        }
      })
    });
    const reliability = await reliabilityResponse.json();
    console.log('✅ Reliability Score:', reliability.result.score + '%');
  } catch (error) {
    console.error('❌ Reliability failed:', error.message);
  }
  
  // 5. Test Excellence Evaluation
  console.log('\n⭐ Testing Excellence Dimension:');
  try {
    const excellenceResponse = await fetch(`${BASE_URL}/evaluate/excellence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectArtifacts: {
          documentation: 'comprehensive',
          tests: 250,
          coverage: 0.92,
          codeReview: 'passed',
          security: 'audited',
          reproducible: true
        }
      })
    });
    const excellence = await excellenceResponse.json();
    console.log('✅ Excellence Score:', excellence.result.score + '%');
  } catch (error) {
    console.error('❌ Excellence failed:', error.message);
  }
  
  // 6. Get Overall MLE Star Score
  console.log('\n🌟 Overall MLE Star Score:');
  try {
    const scoreResponse = await fetch(`${BASE_URL}/score`);
    const scoreData = await scoreResponse.json();
    console.log('━'.repeat(40));
    console.log('  Scoping:     ', scoreData.score.scoping + '%');
    console.log('  Training:    ', scoreData.score.training + '%');
    console.log('  Analysis:    ', scoreData.score.analysis + '%');
    console.log('  Reliability: ', scoreData.score.reliability + '%');
    console.log('  Excellence:  ', scoreData.score.excellence + '%');
    console.log('━'.repeat(40));
    console.log('  OVERALL:     ', scoreData.score.overall + '%', scoreData.interpretation.overall);
    console.log('  Production Ready:', scoreData.interpretation.productionReady ? '✅ YES' : '❌ NO');
  } catch (error) {
    console.error('❌ Score calculation failed:', error.message);
  }
  
  // 7. Test Context7 Integration
  console.log('\n🧠 Testing Context7 Integration:');
  try {
    // Update context windows
    for (let i = 1; i <= 3; i++) {
      await fetch(`${BASE_URL}/context7/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowId: i,
          content: {
            context: `Marketing Context ${i}`,
            data: `Historical data for window ${i}`,
            metrics: { engagement: 0.1 * i }
          },
          priority: 5 - i
        })
      });
    }
    console.log('✅ Updated 3 context windows');
    
    // Sequential thinking with context
    const thinkResponse = await fetch(`${BASE_URL}/context7/sequential-think`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: 'Optimize marketing content for viral reach',
        steps: [
          'Analyze viral content patterns',
          'Identify key engagement triggers',
          'Generate content variations',
          'Test and optimize',
          'Deploy best performer'
        ]
      })
    });
    const thinking = await thinkResponse.json();
    console.log('✅ Sequential thinking completed');
    console.log('   Steps processed:', thinking.result.steps.length);
    console.log('   Total duration:', thinking.result.totalDuration + 'ms');
    
    // Get context report
    const contextReport = await fetch(`${BASE_URL}/context7/report`);
    const report = await contextReport.json();
    console.log('✅ Context7 Report:');
    console.log('   Active windows:', report.report.activeWindows + '/' + report.report.totalWindows);
    console.log('   Token usage:', report.report.totalTokens + '/' + report.report.maxTokens);
  } catch (error) {
    console.error('❌ Context7 failed:', error.message);
  }
  
  // 8. Create and Execute ML Pipeline
  console.log('\n🔧 Testing ML Pipeline:');
  try {
    // Create pipeline
    const pipelineResponse = await fetch(`${BASE_URL}/pipeline/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Marketing Model Pipeline',
        config: {
          data: { source: 'social_media_dataset', size: 10000 },
          features: { 
            textFeatures: ['content', 'hashtags'],
            numericFeatures: ['likes', 'shares', 'comments']
          },
          training: { 
            algorithm: 'transformer',
            epochs: 10
          },
          evaluation: { 
            metrics: ['accuracy', 'f1', 'auc']
          },
          deployment: { 
            environment: 'staging',
            replicas: 3
          }
        }
      })
    });
    const pipeline = await pipelineResponse.json();
    console.log('✅ Pipeline created:', pipeline.pipeline.name);
    console.log('   Pipeline ID:', pipeline.pipeline.id);
    console.log('   Stages:', pipeline.pipeline.stages.length);
    
    // Execute pipeline
    console.log('⚡ Executing pipeline...');
    const executeResponse = await fetch(`${BASE_URL}/pipeline/execute/${pipeline.pipeline.id}`, {
      method: 'POST'
    });
    const execution = await executeResponse.json();
    console.log('✅ Pipeline executed successfully');
    console.log('   Results:', execution.results.length, 'stages completed');
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
  }
  
  // 9. Generate MLE Report
  console.log('\n📋 Generating MLE Report:');
  try {
    const reportResponse = await fetch(`${BASE_URL}/report`);
    const report = await reportResponse.json();
    console.log('✅ Report Generated:');
    console.log('   Overall Score:', report.report.summary.overallScore + '%');
    console.log('   Models:', report.report.summary.totalModels);
    console.log('   Pipelines:', report.report.summary.totalPipelines);
    console.log('   Recommendation:', report.report.summary.recommendation);
    
    if (report.report.insights && report.report.insights.length > 0) {
      console.log('   Key Insights:');
      report.report.insights.slice(0, 3).forEach(insight => {
        console.log('   • ' + insight);
      });
    }
  } catch (error) {
    console.error('❌ Report generation failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✨ MLE Star Integration Test Complete!');
  console.log('\n📚 Documentation:');
  console.log('   • MLE Star Guide: docs/MLE-STAR-INTEGRATION.md');
  console.log('   • MCP TTD RD: docs/MCP-TTD-RD-INTEGRATION.md');
  console.log('   • Enhancement Research: PRODUCT-ENHANCEMENT-RESEARCH.md');
}

// Run the test
testMLEStarIntegration().catch(console.error);