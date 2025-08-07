"""
Smart Content Generation System
Takes single word, keyword, phrase, or paragraph and auto-generates 
high-performing social media posts for multiple platforms
"""

import os
import json
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import re
import hashlib
from pathlib import Path

# Import existing modules
from platform_automation import PlatformSpecialist
from content_transformation_engine import ContentTransformationEngine, ContentIdea, PlatformContent
from viral_content_analyzer import ViralContentAnalyzer
from cpu_manager import get_cpu_manager

@dataclass
class TrendData:
    """Trending topic data structure"""
    keyword: str
    trend_score: float
    related_hashtags: List[str]
    viral_formats: List[str]
    peak_times: List[str]
    sentiment: str
    volume: int

@dataclass
class PlatformBestPractice:
    """Platform-specific best practices"""
    platform: str
    content_format: str
    optimal_length: Dict[str, int]
    posting_times: List[str]
    engagement_tactics: List[str]
    algorithm_preferences: Dict[str, Any]
    current_trends: List[str]

@dataclass
class GeneratedPost:
    """Generated social media post"""
    platform: str
    content: str
    headline: Optional[str]
    hashtags: List[str]
    media_suggestions: List[str]
    cta: str
    optimal_posting_time: str
    estimated_engagement: float
    viral_potential: float
    variations: List[Dict[str, Any]]

class SmartContentGenerator:
    """
    Main engine for intelligent content generation
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
        self.base_path = Path("D:/Synthex")
        self.data_path = self.base_path / "data"
        self.cpu_manager = get_cpu_manager(max_cpu=75.0)
        
        # Initialize sub-systems
        self.transformation_engine = ContentTransformationEngine()
        self.viral_analyzer = ViralContentAnalyzer()
        
        # Platform configurations
        self.platforms = {
            'instagram': {
                'formats': ['reels', 'stories', 'posts', 'carousel'],
                'optimal_chars': {'reels': 150, 'stories': 100, 'posts': 2200, 'carousel': 300},
                'best_times': ['8:00', '12:00', '17:00', '20:00'],
                'trending_formats': ['behind-the-scenes', 'tutorials', 'before-after']
            },
            'facebook': {
                'formats': ['video', 'photo', 'text', 'live'],
                'optimal_chars': {'video': 200, 'photo': 300, 'text': 500},
                'best_times': ['9:00', '13:00', '15:00', '19:00'],
                'trending_formats': ['stories', 'polls', 'community-posts']
            },
            'twitter': {
                'formats': ['tweet', 'thread', 'spaces'],
                'optimal_chars': {'tweet': 280, 'thread': 280},
                'best_times': ['8:00', '12:00', '17:00', '21:00'],
                'trending_formats': ['hot-takes', 'threads', 'quote-tweets']
            },
            'linkedin': {
                'formats': ['article', 'post', 'video', 'document'],
                'optimal_chars': {'article': 1900, 'post': 1300, 'video': 200},
                'best_times': ['7:30', '12:00', '17:30'],
                'trending_formats': ['thought-leadership', 'case-studies', 'industry-insights']
            },
            'tiktok': {
                'formats': ['video', 'live'],
                'optimal_chars': {'video': 150, 'live': 100},
                'best_times': ['6:00', '10:00', '19:00', '23:00'],
                'trending_formats': ['challenges', 'tutorials', 'storytimes']
            },
            'pinterest': {
                'formats': ['pin', 'idea-pin', 'board'],
                'optimal_chars': {'pin': 500, 'idea-pin': 200},
                'best_times': ['14:00', '21:00'],
                'trending_formats': ['how-to', 'infographics', 'collections']
            },
            'youtube': {
                'formats': ['shorts', 'video', 'live', 'community'],
                'optimal_chars': {'shorts': 100, 'video': 5000, 'community': 500},
                'best_times': ['14:00', '17:00', '20:00'],
                'trending_formats': ['tutorials', 'vlogs', 'reviews']
            },
            'reddit': {
                'formats': ['post', 'comment', 'ama'],
                'optimal_chars': {'post': 40000, 'comment': 10000},
                'best_times': ['9:00', '13:00', '17:00', '22:00'],
                'trending_formats': ['discussions', 'ama', 'guides']
            }
        }
        
        # Load cached trends and best practices
        self.trends_cache = self._load_trends_cache()
        self.best_practices_cache = self._load_best_practices()
        
    async def generate_from_input(
        self, 
        user_input: str,
        platforms: Optional[List[str]] = None,
        include_trends: bool = True,
        generate_variations: int = 3,
        sandbox_mode: bool = True
    ) -> Dict[str, Any]:
        """
        Main generation function - takes any text input and creates platform-optimized content
        
        Args:
            user_input: Single word, keyword, phrase, or paragraph
            platforms: List of platforms to generate for (default: all)
            include_trends: Whether to incorporate trending data
            generate_variations: Number of variations per platform
            sandbox_mode: Whether to prepare for sandbox editing
            
        Returns:
            Dict containing generated posts, trends, and sandbox data
        """
        
        # Step 1: Analyze and enrich input
        enriched_input = await self._analyze_input(user_input)
        
        # Step 2: Discover trends if requested
        trends = {}
        if include_trends:
            trends = await self._discover_trends(enriched_input)
        
        # Step 3: Get platform best practices
        best_practices = await self._fetch_best_practices(platforms)
        
        # Step 4: Generate content for each platform
        generated_content = {}
        target_platforms = platforms or list(self.platforms.keys())
        
        for platform in target_platforms:
            platform_trends = trends.get(platform, {})
            platform_practices = best_practices.get(platform, {})
            
            # Create dynamic prompt
            prompt = self._create_generation_prompt(
                enriched_input,
                platform,
                platform_trends,
                platform_practices
            )
            
            # Generate content
            post = await self._generate_platform_post(
                prompt,
                platform,
                generate_variations
            )
            
            generated_content[platform] = post
        
        # Step 5: Prepare sandbox data if requested
        sandbox_data = None
        if sandbox_mode:
            sandbox_data = self._prepare_sandbox_data(generated_content)
        
        # Step 6: Calculate performance predictions
        performance_predictions = await self._predict_performance(generated_content)
        
        return {
            'input': user_input,
            'enriched_input': enriched_input,
            'trends': trends,
            'generated_content': generated_content,
            'sandbox_data': sandbox_data,
            'performance_predictions': performance_predictions,
            'generation_timestamp': datetime.now().isoformat()
        }
    
    async def _analyze_input(self, user_input: str) -> Dict[str, Any]:
        """Analyze and enrich user input"""
        
        # Determine input type
        word_count = len(user_input.split())
        input_type = 'keyword' if word_count == 1 else 'phrase' if word_count < 10 else 'paragraph'
        
        # Extract key concepts
        key_concepts = self._extract_key_concepts(user_input)
        
        # Determine intent and tone
        intent = self._analyze_intent(user_input)
        tone = self._analyze_tone(user_input)
        
        return {
            'original': user_input,
            'type': input_type,
            'word_count': word_count,
            'key_concepts': key_concepts,
            'intent': intent,
            'tone': tone,
            'target_audience': self._infer_audience(user_input)
        }
    
    async def _discover_trends(self, enriched_input: Dict) -> Dict[str, Any]:
        """Discover trending topics and formats"""
        
        trends = {}
        
        # Simulate trend discovery (in production, would call real APIs)
        # This would integrate with Google Trends, Twitter API, Reddit API, etc.
        
        for concept in enriched_input['key_concepts']:
            # Mock trend data - replace with real API calls
            trend_data = TrendData(
                keyword=concept,
                trend_score=0.85,
                related_hashtags=[f"#{concept}", f"#{concept}2024", f"#trending{concept}"],
                viral_formats=['reels', 'shorts', 'stories'],
                peak_times=['12:00', '18:00', '21:00'],
                sentiment='positive',
                volume=15000
            )
            trends[concept] = trend_data
        
        return trends
    
    async def _fetch_best_practices(self, platforms: Optional[List[str]]) -> Dict[str, Any]:
        """Fetch current best practices for platforms"""
        
        best_practices = {}
        target_platforms = platforms or list(self.platforms.keys())
        
        for platform in target_platforms:
            # Load from cache or fetch latest
            if platform in self.best_practices_cache:
                best_practices[platform] = self.best_practices_cache[platform]
            else:
                # Fetch latest best practices
                best_practices[platform] = await self._fetch_platform_best_practices(platform)
        
        return best_practices
    
    async def _fetch_platform_best_practices(self, platform: str) -> PlatformBestPractice:
        """Fetch latest best practices for a specific platform"""
        
        # This would connect to platform-specific APIs or analytics services
        # For now, using predefined best practices
        
        platform_config = self.platforms.get(platform, {})
        
        return PlatformBestPractice(
            platform=platform,
            content_format=platform_config.get('formats', [])[0] if platform_config.get('formats') else 'post',
            optimal_length=platform_config.get('optimal_chars', {}),
            posting_times=platform_config.get('best_times', []),
            engagement_tactics=['hook', 'story', 'cta', 'hashtags'],
            algorithm_preferences={'engagement': 'high', 'retention': 'critical'},
            current_trends=platform_config.get('trending_formats', [])
        )
    
    def _create_generation_prompt(
        self,
        enriched_input: Dict,
        platform: str,
        trends: Dict,
        best_practices: Dict
    ) -> str:
        """Create optimized prompt for content generation"""
        
        prompt = f"""
        Generate a high-converting {platform} post based on:
        
        Topic: {enriched_input['original']}
        Intent: {enriched_input['intent']}
        Tone: {enriched_input['tone']}
        Target Audience: {enriched_input['target_audience']}
        
        Platform: {platform}
        Best Format: {best_practices.get('content_format', 'post')}
        Optimal Length: {best_practices.get('optimal_length', {})}
        
        Current Trends: {json.dumps(trends, default=str)}
        Best Practices: {json.dumps(best_practices, default=str)}
        
        Requirements:
        1. Start with attention-grabbing hook
        2. Include platform-specific formatting
        3. Add relevant trending hashtags
        4. Include clear call-to-action
        5. Optimize for {platform} algorithm
        6. Make it shareable and engaging
        
        Generate complete post with:
        - Main content
        - Headline (if applicable)
        - Hashtags
        - Visual suggestions
        - CTA
        """
        
        return prompt
    
    async def _generate_platform_post(
        self,
        prompt: str,
        platform: str,
        num_variations: int
    ) -> GeneratedPost:
        """Generate platform-specific post with variations"""
        
        # This would call the actual LLM API
        # For demonstration, creating structured response
        
        main_content = f"Generated content for {platform} based on prompt"
        
        variations = []
        for i in range(num_variations):
            variations.append({
                'version': i + 1,
                'content': f"Variation {i+1} of content",
                'hook': f"Hook variation {i+1}",
                'focus': ['engagement', 'conversion', 'viral'][i % 3]
            })
        
        return GeneratedPost(
            platform=platform,
            content=main_content,
            headline=f"Compelling headline for {platform}" if platform in ['linkedin', 'facebook'] else None,
            hashtags=[f"#{platform}", "#trending", "#viral"],
            media_suggestions=['video', 'image', 'carousel'],
            cta="Learn more / Shop now / Join us",
            optimal_posting_time=self.platforms[platform]['best_times'][0],
            estimated_engagement=0.85,
            viral_potential=0.72,
            variations=variations
        )
    
    def _prepare_sandbox_data(self, generated_content: Dict) -> Dict[str, Any]:
        """Prepare data for sandbox UI"""
        
        sandbox_data = {
            'editable_elements': [],
            'media_placeholders': [],
            'interactive_components': [],
            'preview_modes': {}
        }
        
        for platform, post in generated_content.items():
            sandbox_data['editable_elements'].append({
                'platform': platform,
                'content_id': f"{platform}_content",
                'editable': True,
                'content': post.content,
                'constraints': self.platforms[platform].get('optimal_chars', {})
            })
            
            sandbox_data['media_placeholders'].append({
                'platform': platform,
                'media_type': post.media_suggestions,
                'upload_enabled': True,
                'ai_suggestions': True
            })
            
            sandbox_data['preview_modes'][platform] = {
                'desktop': True,
                'mobile': True,
                'native_app': True
            }
        
        return sandbox_data
    
    async def _predict_performance(self, generated_content: Dict) -> Dict[str, Any]:
        """Predict performance metrics for generated content"""
        
        predictions = {}
        
        for platform, post in generated_content.items():
            predictions[platform] = {
                'estimated_reach': self._calculate_reach(platform, post),
                'engagement_rate': post.estimated_engagement,
                'viral_probability': post.viral_potential,
                'best_posting_time': post.optimal_posting_time,
                'expected_roi': self._calculate_roi(platform, post)
            }
        
        return predictions
    
    def _calculate_reach(self, platform: str, post: GeneratedPost) -> int:
        """Calculate estimated reach"""
        base_reach = {
            'instagram': 5000,
            'facebook': 3000,
            'twitter': 2000,
            'linkedin': 1500,
            'tiktok': 10000,
            'pinterest': 2500,
            'youtube': 8000,
            'reddit': 4000
        }
        
        reach = base_reach.get(platform, 1000)
        reach *= (1 + post.viral_potential)
        
        return int(reach)
    
    def _calculate_roi(self, platform: str, post: GeneratedPost) -> float:
        """Calculate expected ROI"""
        engagement_value = post.estimated_engagement * 100
        viral_bonus = post.viral_potential * 50
        
        return round(engagement_value + viral_bonus, 2)
    
    def _extract_key_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        # Simple keyword extraction - would use NLP in production
        words = text.lower().split()
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'}
        keywords = [w for w in words if w not in stopwords and len(w) > 3]
        return keywords[:5]
    
    def _analyze_intent(self, text: str) -> str:
        """Analyze user intent from text"""
        if any(word in text.lower() for word in ['buy', 'shop', 'purchase', 'get']):
            return 'commercial'
        elif any(word in text.lower() for word in ['learn', 'how', 'what', 'why']):
            return 'informational'
        elif any(word in text.lower() for word in ['best', 'top', 'review']):
            return 'comparison'
        else:
            return 'general'
    
    def _analyze_tone(self, text: str) -> str:
        """Analyze tone of text"""
        if any(word in text.lower() for word in ['amazing', 'awesome', 'great', 'love']):
            return 'enthusiastic'
        elif any(word in text.lower() for word in ['professional', 'business', 'corporate']):
            return 'professional'
        elif any(word in text.lower() for word in ['fun', 'lol', 'cool', 'yeah']):
            return 'casual'
        else:
            return 'neutral'
    
    def _infer_audience(self, text: str) -> str:
        """Infer target audience from text"""
        if any(word in text.lower() for word in ['business', 'b2b', 'enterprise']):
            return 'business'
        elif any(word in text.lower() for word in ['teen', 'young', 'student']):
            return 'youth'
        elif any(word in text.lower() for word in ['family', 'parent', 'kids']):
            return 'family'
        else:
            return 'general'
    
    def _load_trends_cache(self) -> Dict:
        """Load cached trends data"""
        cache_file = self.data_path / 'cache' / 'trends_cache.json'
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)
        return {}
    
    def _load_best_practices(self) -> Dict:
        """Load cached best practices"""
        cache_file = self.data_path / 'cache' / 'best_practices_cache.json'
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)
        return {}
    
    async def generate_batch(
        self,
        inputs: List[str],
        platforms: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Generate content for multiple inputs"""
        
        results = []
        for input_text in inputs:
            result = await self.generate_from_input(input_text, platforms)
            results.append(result)
        
        return results


# Example usage
async def main():
    generator = SmartContentGenerator()
    
    # Single keyword example
    result = await generator.generate_from_input(
        "eco-friendly water bottles",
        platforms=['instagram', 'tiktok', 'linkedin']
    )
    
    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())