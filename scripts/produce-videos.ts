#!/usr/bin/env npx ts-node
/**
 * SYNTHEX Video Production CLI
 *
 * Produces explainer videos for the Synthex platform.
 *
 * Usage:
 *   npx ts-node scripts/produce-videos.ts [workflow] [options]
 *
 * Workflows:
 *   platformOverview   - Full platform tour (90s)
 *   contentGenerator   - AI content creation demo (60s)
 *   analyticsDashboard - Analytics walkthrough (45s)
 *   smartScheduler     - Scheduler demo (60s)
 *   viralPatterns      - Pattern analysis (45s)
 *   all                - Produce all videos
 *
 * Options:
 *   --skip-upload      Skip YouTube upload
 *   --check            Check system readiness only
 *
 * Environment Variables Required:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 *   ELEVENLABS_API_KEY (optional, for voiceover)
 */

import { VideoOrchestrator, SYNTHEX_WORKFLOWS } from '../lib/video';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const workflow = args[0];
  const skipUpload = args.includes('--skip-upload');
  const checkOnly = args.includes('--check');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          SYNTHEX VIDEO PRODUCTION PIPELINE               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const orchestrator = new VideoOrchestrator();

  // Check readiness
  console.log('[System] Checking readiness...\n');
  const readiness = await orchestrator.checkReadiness();

  if (readiness.issues.length > 0) {
    console.log('⚠️  Issues found:');
    readiness.issues.forEach((issue) => console.log(`   - ${issue}`));
    console.log('');
  }

  if (checkOnly) {
    if (readiness.ready) {
      console.log('✅ System is ready for video production');
    } else {
      console.log('❌ System is NOT ready. Fix the issues above first.');
    }
    return;
  }

  // Show help if no workflow specified
  if (!workflow) {
    console.log('Usage: npx ts-node scripts/produce-videos.ts [workflow] [options]\n');
    console.log('Available workflows:');
    Object.keys(SYNTHEX_WORKFLOWS).forEach((name) => {
      const w = SYNTHEX_WORKFLOWS[name as keyof typeof SYNTHEX_WORKFLOWS];
      console.log(`  ${name.padEnd(20)} - ${w.description} (${w.duration}s)`);
    });
    console.log(`  ${'all'.padEnd(20)} - Produce all videos\n`);
    console.log('Options:');
    console.log('  --skip-upload      Skip YouTube upload');
    console.log('  --check            Check system readiness only\n');
    return;
  }

  // Validate workflow
  if (workflow !== 'all' && !(workflow in SYNTHEX_WORKFLOWS)) {
    console.error(`❌ Unknown workflow: ${workflow}`);
    console.log('\nAvailable workflows:', Object.keys(SYNTHEX_WORKFLOWS).join(', '), 'all');
    process.exit(1);
  }

  // Production options
  const options = {
    skipUpload,
    // Add login credentials if needed
    // login: { email: 'demo@synthex.social', password: 'demo123' },
  };

  console.log(`[Config] Workflow: ${workflow}`);
  console.log(`[Config] Skip upload: ${skipUpload}`);
  console.log('');

  try {
    if (workflow === 'all') {
      // Produce all videos
      const results = await orchestrator.produceAll(options);
      orchestrator.exportResults(results);
    } else {
      // Produce single video
      const result = await orchestrator.produceVideo(
        workflow as keyof typeof SYNTHEX_WORKFLOWS,
        options
      );
      orchestrator.exportResults([result]);
    }

    console.log('\n✅ Production complete!');
    console.log('   Check ./output/production_results.json for details');

  } catch (error) {
    console.error('\n❌ Production failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
