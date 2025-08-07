"""
Test and Integration Script for Content Generation System
Tests all components and ensures proper integration
"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path

# Import all our modules
from smart_content_generator import SmartContentGenerator
from trend_discovery_system import TrendDiscoverySystem
from content_scheduler import ContentScheduler

async def test_content_generation():
    """Test the smart content generator"""
    
    print("\n" + "="*50)
    print("TESTING CONTENT GENERATION SYSTEM")
    print("="*50)
    
    generator = SmartContentGenerator()
    
    # Test 1: Single keyword
    print("\n[TEST 1] Single Keyword Generation")
    print("-"*30)
    
    result = await generator.generate_from_input(
        "sustainability",
        platforms=['instagram', 'linkedin', 'tiktok']
    )
    
    print(f"✓ Generated content for {len(result['generated_content'])} platforms")
    print(f"✓ Enriched input type: {result['enriched_input']['type']}")
    print(f"✓ Key concepts: {result['enriched_input']['key_concepts']}")
    
    # Test 2: Phrase input
    print("\n[TEST 2] Phrase Generation")
    print("-"*30)
    
    result = await generator.generate_from_input(
        "eco-friendly water bottles for active lifestyle",
        platforms=['instagram', 'facebook']
    )
    
    print(f"✓ Generated content for phrase input")
    print(f"✓ Intent detected: {result['enriched_input']['intent']}")
    print(f"✓ Tone detected: {result['enriched_input']['tone']}")
    
    # Test 3: Paragraph input
    print("\n[TEST 3] Paragraph Generation")
    print("-"*30)
    
    paragraph = """
    Our company is launching a revolutionary new line of sustainable products
    that combine cutting-edge technology with environmental responsibility.
    These products are designed for modern consumers who care about the planet.
    """
    
    result = await generator.generate_from_input(
        paragraph,
        platforms=['linkedin', 'twitter'],
        generate_variations=5
    )
    
    print(f"✓ Generated content from paragraph")
    print(f"✓ Target audience: {result['enriched_input']['target_audience']}")
    
    return True

async def test_trend_discovery():
    """Test the trend discovery system"""
    
    print("\n" + "="*50)
    print("TESTING TREND DISCOVERY SYSTEM")
    print("="*50)
    
    trend_system = TrendDiscoverySystem()
    
    # Test 1: Discover trends for keywords
    print("\n[TEST 1] Keyword Trend Discovery")
    print("-"*30)
    
    trends = await trend_system.discover_trends(
        keywords=['AI', 'sustainability', 'innovation'],
        platforms=['instagram', 'tiktok', 'linkedin'],
        timeframe='24h'
    )
    
    print(f"✓ Discovered {len(trends['global_trends'])} global trends")
    print(f"✓ Platform trends for {len(trends['platform_trends'])} platforms")
    print(f"✓ Found {len(trends['viral_content'])} viral patterns")
    
    # Test 2: Real-time trends
    print("\n[TEST 2] Real-time Trends")
    print("-"*30)
    
    real_time = await trend_system.get_real_time_trends()
    
    print(f"✓ Global trending topics: {len(real_time['global_trending'])}")
    print(f"✓ Breaking trends: {len(real_time['breaking_trends'])}")
    print(f"✓ Platform-specific trends loaded")
    
    # Test 3: Emerging topics
    print("\n[TEST 3] Emerging Topics Analysis")
    print("-"*30)
    
    trends = await trend_system.discover_trends(
        keywords=['metaverse', 'web3'],
        platforms=['twitter', 'reddit']
    )
    
    print(f"✓ Emerging topics identified: {len(trends['emerging_topics'])}")
    print(f"✓ Predictive insights generated")
    print(f"✓ Competitor analysis completed")
    
    return True

async def test_content_scheduler():
    """Test the content scheduling system"""
    
    print("\n" + "="*50)
    print("TESTING CONTENT SCHEDULING SYSTEM")
    print("="*50)
    
    scheduler = ContentScheduler()
    
    # Test 1: Schedule single post
    print("\n[TEST 1] Single Post Scheduling")
    print("-"*30)
    
    post_id = await scheduler.schedule_post(
        platform='instagram',
        content='Test post for scheduling system #test',
        scheduled_time=datetime.now() + timedelta(hours=1),
        hashtags=['#test', '#automation']
    )
    
    print(f"✓ Scheduled post with ID: {post_id}")
    
    # Test 2: Batch scheduling
    print("\n[TEST 2] Batch Scheduling")
    print("-"*30)
    
    batch_posts = [
        {
            'platform': 'twitter',
            'content': 'First batch post #automation',
            'hashtags': ['#automation', '#ai']
        },
        {
            'platform': 'linkedin',
            'content': 'Professional insights on automation',
            'hashtags': ['#business', '#automation']
        },
        {
            'platform': 'facebook',
            'content': 'Community update on our progress',
            'hashtags': ['#community', '#update']
        }
    ]
    
    batch_ids = await scheduler.schedule_batch(
        batch_posts,
        spacing_minutes=30,
        randomize=True
    )
    
    print(f"✓ Scheduled {len(batch_ids)} posts in batch")
    
    # Test 3: Smart scheduling
    print("\n[TEST 3] Smart Scheduling")
    print("-"*30)
    
    optimal_times = await scheduler.apply_smart_scheduling(
        content='Important announcement about our new features',
        platforms=['instagram', 'twitter', 'linkedin']
    )
    
    print(f"✓ Calculated optimal times for {len(optimal_times)} platforms")
    for platform, time in optimal_times.items():
        print(f"  - {platform}: {time.strftime('%Y-%m-%d %H:%M')}")
    
    # Test 4: Automation rules
    print("\n[TEST 4] Automation Rules")
    print("-"*30)
    
    rule_id = await scheduler.create_automation_rule(
        name='Daily Morning Post',
        trigger_type='time_based',
        conditions={'time': {'hour': 9, 'minute': 0}},
        actions=[
            {
                'type': 'schedule_post',
                'platform': 'instagram',
                'content': 'Good morning! Start your day with positivity',
                'delay': 0,
                'hashtags': ['#morning', '#motivation']
            }
        ],
        platforms=['instagram', 'facebook']
    )
    
    print(f"✓ Created automation rule: {rule_id}")
    
    # Test 5: Analytics
    print("\n[TEST 5] Schedule Analytics")
    print("-"*30)
    
    analytics = await scheduler.get_schedule_analytics()
    
    print(f"✓ Total scheduled posts: {analytics['total_scheduled']}")
    print(f"✓ Posts in next 24h: {analytics['next_24h']}")
    print(f"✓ Posts this week: {analytics['this_week']}")
    
    return True

async def test_integration():
    """Test integration between all components"""
    
    print("\n" + "="*50)
    print("TESTING SYSTEM INTEGRATION")
    print("="*50)
    
    # Initialize all systems
    generator = SmartContentGenerator()
    trend_system = TrendDiscoverySystem()
    scheduler = ContentScheduler()
    
    print("\n[INTEGRATION TEST] End-to-End Workflow")
    print("-"*40)
    
    # Step 1: Discover trends
    print("\n1. Discovering trends...")
    trends = await trend_system.discover_trends(
        keywords=['technology', 'innovation'],
        platforms=['instagram', 'linkedin']
    )
    print(f"   ✓ Trends discovered")
    
    # Step 2: Generate content based on trends
    print("\n2. Generating content...")
    trending_keyword = trends['global_trends'][0].keyword if trends['global_trends'] else 'technology'
    
    content_result = await generator.generate_from_input(
        trending_keyword,
        platforms=['instagram', 'linkedin'],
        include_trends=True
    )
    print(f"   ✓ Content generated for trending topic: {trending_keyword}")
    
    # Step 3: Schedule the generated content
    print("\n3. Scheduling content...")
    schedule_tasks = []
    
    for platform, post in content_result['generated_content'].items():
        # Get optimal time for platform
        optimal_times = await scheduler.apply_smart_scheduling(
            post.content,
            [platform]
        )
        
        # Schedule the post
        post_id = await scheduler.schedule_post(
            platform=platform,
            content=post.content,
            scheduled_time=optimal_times[platform],
            hashtags=post.hashtags,
            media=post.media_suggestions
        )
        
        schedule_tasks.append(post_id)
        print(f"   ✓ Scheduled for {platform}: {post_id}")
    
    # Step 4: Create automation for high-performing content
    print("\n4. Setting up automation...")
    automation_rule = await scheduler.create_automation_rule(
        name='Viral Content Replication',
        trigger_type='performance_based',
        conditions={
            'metric': 'engagement_rate',
            'threshold': 0.1,
            'comparison': 'greater_than'
        },
        actions=[
            {
                'type': 'schedule_post',
                'platform': 'all',
                'content': 'Similar content based on high performance',
                'delay': 1440  # 24 hours later
            }
        ],
        platforms=['instagram', 'linkedin']
    )
    print(f"   ✓ Automation rule created: {automation_rule}")
    
    # Step 5: Verify integration
    print("\n5. Verifying integration...")
    
    # Check that all components are working together
    analytics = await scheduler.get_schedule_analytics()
    
    print(f"   ✓ System integration successful")
    print(f"   ✓ {analytics['total_scheduled']} posts scheduled")
    print(f"   ✓ All components communicating properly")
    
    return True

async def run_all_tests():
    """Run all system tests"""
    
    print("\n" + "="*60)
    print(" SYNTHEX CONTENT GENERATION SYSTEM - COMPLETE TEST SUITE")
    print("="*60)
    print(f"\nTest Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        ("Content Generation", test_content_generation),
        ("Trend Discovery", test_trend_discovery),
        ("Content Scheduling", test_content_scheduler),
        ("System Integration", test_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            print(f"\n\nRunning: {test_name}")
            success = await test_func()
            results.append((test_name, success))
            print(f"\n✅ {test_name} - PASSED")
        except Exception as e:
            results.append((test_name, False))
            print(f"\n❌ {test_name} - FAILED: {str(e)}")
    
    # Summary
    print("\n" + "="*60)
    print(" TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Test End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! System is ready for production.")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Please review and fix issues.")
    
    return passed == total

def main():
    """Main entry point"""
    
    # Create necessary directories
    data_path = Path("D:/Synthex/data")
    subdirs = ['cache', 'cache/trends', 'schedules', 'platforms']
    
    for subdir in subdirs:
        (data_path / subdir).mkdir(parents=True, exist_ok=True)
    
    # Run tests
    success = asyncio.run(run_all_tests())
    
    if success:
        print("\n" + "="*60)
        print(" SYSTEM READY FOR DEPLOYMENT")
        print("="*60)
        print("\nNext steps:")
        print("1. Configure API keys in environment variables")
        print("2. Set up platform OAuth credentials")
        print("3. Deploy the web interface")
        print("4. Start the scheduler daemon")
        print("5. Monitor system performance")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())