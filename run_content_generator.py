#!/usr/bin/env python
"""
Quick Run Script for Content Generation System
Works with OpenRouter API configured in .env
"""

import os
import asyncio
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our modules
from smart_content_generator import SmartContentGenerator
from trend_discovery_system import TrendDiscoverySystem
from content_scheduler import ContentScheduler

def print_header(text):
    """Print formatted header"""
    print("\n" + "="*60)
    print(f" {text}")
    print("="*60)

def print_section(text):
    """Print formatted section"""
    print(f"\n▶ {text}")
    print("-"*40)

async def interactive_mode():
    """Run in interactive mode"""
    
    print_header("SYNTHEX CONTENT GENERATOR - INTERACTIVE MODE")
    print("\nOpenRouter API Status:", "✅ Connected" if os.getenv('OPENROUTER_API_KEY') else "❌ Not Found")
    
    # Initialize systems
    generator = SmartContentGenerator()
    trend_system = TrendDiscoverySystem()
    scheduler = ContentScheduler()
    
    while True:
        print("\n" + "="*60)
        print("\nWhat would you like to do?")
        print("1. Generate content from keyword/phrase")
        print("2. Discover trending topics")
        print("3. Schedule content")
        print("4. View scheduled posts")
        print("5. Run automated campaign")
        print("6. Exit")
        
        choice = input("\nEnter choice (1-6): ").strip()
        
        if choice == '1':
            await generate_content_interactive(generator, trend_system)
        elif choice == '2':
            await discover_trends_interactive(trend_system)
        elif choice == '3':
            await schedule_content_interactive(scheduler, generator)
        elif choice == '4':
            await view_schedules(scheduler)
        elif choice == '5':
            await run_campaign(generator, trend_system, scheduler)
        elif choice == '6':
            print("\n👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please try again.")

async def generate_content_interactive(generator, trend_system):
    """Interactive content generation"""
    
    print_section("CONTENT GENERATION")
    
    # Get input
    user_input = input("Enter your keyword, phrase, or paragraph: ").strip()
    if not user_input:
        print("❌ No input provided")
        return
    
    # Select platforms
    print("\nSelect platforms (comma-separated):")
    print("Options: instagram, facebook, twitter, linkedin, tiktok, pinterest, youtube, reddit")
    print("Or press Enter for all platforms")
    
    platform_input = input("Platforms: ").strip()
    if platform_input:
        platforms = [p.strip() for p in platform_input.split(',')]
    else:
        platforms = None  # All platforms
    
    # Include trends?
    include_trends = input("\nInclude trending topics? (y/n): ").lower() == 'y'
    
    print("\n⏳ Generating content...")
    
    try:
        # Generate content
        result = await generator.generate_from_input(
            user_input,
            platforms=platforms,
            include_trends=include_trends,
            generate_variations=3
        )
        
        # Display results
        print_header("GENERATED CONTENT")
        
        print(f"\n📝 Input Type: {result['enriched_input']['type']}")
        print(f"🎯 Intent: {result['enriched_input']['intent']}")
        print(f"🎨 Tone: {result['enriched_input']['tone']}")
        print(f"👥 Target Audience: {result['enriched_input']['target_audience']}")
        
        for platform, post in result['generated_content'].items():
            print(f"\n{'='*50}")
            print(f"📱 {platform.upper()}")
            print(f"{'='*50}")
            print(f"\n📝 Content:\n{post.content}")
            print(f"\n🏷️ Hashtags: {' '.join(post.hashtags)}")
            print(f"⏰ Best Time: {post.optimal_posting_time}")
            print(f"📈 Engagement: {post.estimated_engagement * 100:.1f}%")
            print(f"🚀 Viral Potential: {post.viral_potential * 100:.1f}%")
            
            if post.media_suggestions:
                print(f"🎬 Media: {', '.join(post.media_suggestions)}")
            
            if post.variations:
                print(f"🔄 Variations: {len(post.variations)} available")
        
        # Save option
        save = input("\n💾 Save generated content to file? (y/n): ").lower() == 'y'
        if save:
            filename = f"generated_content_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(filename, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            print(f"✅ Saved to {filename}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

async def discover_trends_interactive(trend_system):
    """Interactive trend discovery"""
    
    print_section("TREND DISCOVERY")
    
    # Get keywords
    keywords_input = input("Enter keywords to analyze (comma-separated): ").strip()
    if not keywords_input:
        print("❌ No keywords provided")
        return
    
    keywords = [k.strip() for k in keywords_input.split(',')]
    
    print("\n⏳ Discovering trends...")
    
    try:
        # Discover trends
        trends = await trend_system.discover_trends(
            keywords=keywords,
            timeframe='24h'
        )
        
        # Display results
        print_header("TREND ANALYSIS")
        
        # Global trends
        print("\n🌍 Global Trends:")
        for trend in trends['global_trends'][:5]:
            print(f"  • {trend.keyword}: {trend.trend_score:.1f}% trending")
            print(f"    Growth: +{trend.growth_rate:.1f}% | Volume: {trend.volume:,}")
            print(f"    Hashtags: {', '.join(trend.hashtags[:3])}")
        
        # Platform trends
        print("\n📱 Platform-Specific Trends:")
        for platform, data in list(trends['platform_trends'].items())[:3]:
            print(f"\n  {platform.upper()}:")
            print(f"    Topics: {', '.join(data.trending_topics[:3])}")
            print(f"    Formats: {', '.join(data.viral_formats[:2])}")
        
        # Emerging topics
        print("\n🚀 Emerging Topics:")
        for topic in trends['emerging_topics'][:3]:
            print(f"  • {topic['base_keyword']}")
            print(f"    Potential: {topic['growth_potential']*100:.0f}%")
            print(f"    Time to peak: {topic['time_to_peak']}")
        
        # Real-time trends
        real_time = await trend_system.get_real_time_trends()
        print("\n⚡ Real-Time Trending Now:")
        for trend in real_time['global_trending'][:5]:
            print(f"  • {trend['topic']} (Score: {trend['score']})")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

async def schedule_content_interactive(scheduler, generator):
    """Interactive content scheduling"""
    
    print_section("CONTENT SCHEDULING")
    
    # Generate or use existing content
    use_existing = input("Use existing content? (y/n): ").lower() == 'y'
    
    if not use_existing:
        # Generate new content first
        user_input = input("Enter content idea: ").strip()
        if not user_input:
            print("❌ No input provided")
            return
        
        print("\n⏳ Generating content for scheduling...")
        
        result = await generator.generate_from_input(
            user_input,
            platforms=['instagram', 'twitter', 'linkedin']
        )
        
        # Schedule each platform's content
        for platform, post in result['generated_content'].items():
            # Get optimal time
            optimal_times = await scheduler.apply_smart_scheduling(
                post.content,
                [platform]
            )
            
            # Schedule the post
            post_id = await scheduler.schedule_post(
                platform=platform,
                content=post.content,
                scheduled_time=optimal_times[platform],
                hashtags=post.hashtags
            )
            
            print(f"✅ Scheduled for {platform}: {optimal_times[platform].strftime('%Y-%m-%d %H:%M')}")
            print(f"   Post ID: {post_id}")
    else:
        # Manual scheduling
        platform = input("Platform: ").strip()
        content = input("Content: ").strip()
        
        # Get optimal time
        optimal_times = await scheduler.apply_smart_scheduling(content, [platform])
        optimal_time = optimal_times[platform]
        
        print(f"\n📅 Suggested time: {optimal_time.strftime('%Y-%m-%d %H:%M')}")
        use_suggested = input("Use suggested time? (y/n): ").lower() == 'y'
        
        if not use_suggested:
            # Manual time input
            time_str = input("Enter time (YYYY-MM-DD HH:MM): ").strip()
            from datetime import datetime
            scheduled_time = datetime.strptime(time_str, '%Y-%m-%d %H:%M')
        else:
            scheduled_time = optimal_time
        
        # Schedule
        post_id = await scheduler.schedule_post(
            platform=platform,
            content=content,
            scheduled_time=scheduled_time
        )
        
        print(f"✅ Scheduled! Post ID: {post_id}")

async def view_schedules(scheduler):
    """View scheduled posts"""
    
    print_section("SCHEDULED POSTS")
    
    analytics = await scheduler.get_schedule_analytics()
    
    print(f"\n📊 Schedule Overview:")
    print(f"  • Total scheduled: {analytics['total_scheduled']}")
    print(f"  • Next 24 hours: {analytics['next_24h']}")
    print(f"  • This week: {analytics['this_week']}")
    
    if analytics['by_platform']:
        print(f"\n📱 By Platform:")
        for platform, count in analytics['by_platform'].items():
            print(f"  • {platform}: {count} posts")
    
    if analytics['by_status']:
        print(f"\n📈 By Status:")
        for status, count in analytics['by_status'].items():
            print(f"  • {status}: {count}")
    
    if analytics['performance_summary']['avg_engagement'] > 0:
        print(f"\n🎯 Performance:")
        print(f"  • Avg Engagement: {analytics['performance_summary']['avg_engagement']*100:.1f}%")
        print(f"  • Total Reach: {analytics['performance_summary']['total_reach']:,}")

async def run_campaign(generator, trend_system, scheduler):
    """Run an automated campaign"""
    
    print_section("AUTOMATED CAMPAIGN")
    
    campaign_name = input("Campaign name: ").strip()
    keywords = input("Keywords (comma-separated): ").strip().split(',')
    platforms = input("Platforms (comma-separated): ").strip().split(',')
    num_posts = int(input("Number of posts to generate: ") or "5")
    
    print(f"\n⏳ Running campaign: {campaign_name}")
    
    # Step 1: Discover trends
    print("\n1️⃣ Discovering trends...")
    trends = await trend_system.discover_trends(keywords)
    
    # Step 2: Generate content for each keyword
    print("\n2️⃣ Generating content...")
    all_posts = []
    
    for keyword in keywords[:num_posts]:
        result = await generator.generate_from_input(
            keyword.strip(),
            platforms=[p.strip() for p in platforms],
            include_trends=True
        )
        
        for platform, post in result['generated_content'].items():
            all_posts.append({
                'platform': platform,
                'content': post.content,
                'hashtags': post.hashtags
            })
    
    # Step 3: Schedule posts
    print("\n3️⃣ Scheduling posts...")
    post_ids = await scheduler.schedule_batch(
        all_posts,
        spacing_minutes=60,
        randomize=True
    )
    
    print(f"\n✅ Campaign '{campaign_name}' created!")
    print(f"   • {len(post_ids)} posts scheduled")
    print(f"   • Platforms: {', '.join(set(p['platform'] for p in all_posts))}")
    print(f"   • Spacing: 60 minutes between posts")
    
    # Create automation rule
    create_automation = input("\n🤖 Create automation rule for this campaign? (y/n): ").lower() == 'y'
    
    if create_automation:
        rule_id = await scheduler.create_automation_rule(
            name=f"{campaign_name}_automation",
            trigger_type='time_based',
            conditions={'time': {'hour': 9}},
            actions=[
                {
                    'type': 'schedule_post',
                    'platform': platforms[0],
                    'content': f'Daily {campaign_name} update',
                    'delay': 0
                }
            ],
            platforms=[p.strip() for p in platforms]
        )
        print(f"✅ Automation rule created: {rule_id}")

async def main():
    """Main entry point"""
    
    # Check API key
    if not os.getenv('OPENROUTER_API_KEY'):
        print("⚠️ Warning: OPENROUTER_API_KEY not found in environment variables")
        print("Please set it in your .env file")
        return
    
    # Create necessary directories
    data_path = Path("D:/Synthex/data")
    subdirs = ['cache', 'cache/trends', 'schedules']
    for subdir in subdirs:
        (data_path / subdir).mkdir(parents=True, exist_ok=True)
    
    # Run interactive mode
    await interactive_mode()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("Please check your configuration and try again.")