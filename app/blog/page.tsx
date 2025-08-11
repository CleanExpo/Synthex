'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, ArrowRight, Calendar, Clock, User, TrendingUp, Brain, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  featured: boolean;
}

const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'How AI is Revolutionizing Social Media Marketing in 2025',
    excerpt: 'Discover the latest AI trends transforming how businesses approach social media marketing, from predictive analytics to automated content generation.',
    author: 'Sarah Chen',
    date: '2025-01-10',
    readTime: '7 min read',
    category: 'AI Trends',
    image: '/blog/ai-revolution.jpg',
    featured: true
  },
  {
    id: '2',
    title: '10x Your Engagement: The Ultimate Guide to Viral Content',
    excerpt: 'Learn the psychological triggers and data-driven strategies that make content go viral across different social platforms.',
    author: 'Marcus Johnson',
    date: '2025-01-08',
    readTime: '12 min read',
    category: 'Strategy',
    image: '/blog/viral-content.jpg',
    featured: true
  },
  {
    id: '3',
    title: 'Platform-Specific Optimization: Mastering the Algorithm',
    excerpt: 'Deep dive into how each social media algorithm works and how to optimize your content for maximum reach on each platform.',
    author: 'Emily Rodriguez',
    date: '2025-01-05',
    readTime: '15 min read',
    category: 'Optimization',
    image: '/blog/algorithms.jpg',
    featured: false
  },
  {
    id: '4',
    title: 'The Psychology of Social Media: Understanding Your Audience',
    excerpt: 'Explore the cognitive biases and behavioral patterns that drive social media engagement and how to leverage them ethically.',
    author: 'Dr. James Miller',
    date: '2025-01-03',
    readTime: '10 min read',
    category: 'Psychology',
    image: '/blog/psychology.jpg',
    featured: false
  },
  {
    id: '5',
    title: 'Case Study: From 0 to 100K Followers in 90 Days',
    excerpt: 'A detailed breakdown of how a startup used Synthex to grow their social media presence exponentially in just three months.',
    author: 'Alex Turner',
    date: '2024-12-28',
    readTime: '8 min read',
    category: 'Case Study',
    image: '/blog/case-study.jpg',
    featured: false
  },
  {
    id: '6',
    title: 'Content Calendars That Convert: A Data-Driven Approach',
    excerpt: 'Learn how to create and optimize content calendars based on engagement data and audience behavior patterns.',
    author: 'Lisa Wang',
    date: '2024-12-25',
    readTime: '9 min read',
    category: 'Planning',
    image: '/blog/calendar.jpg',
    featured: false
  }
];

const categories = ['All', 'AI Trends', 'Strategy', 'Optimization', 'Psychology', 'Case Study', 'Planning'];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filteredPosts, setFilteredPosts] = useState(blogPosts);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let posts = blogPosts;
    
    if (selectedCategory !== 'All') {
      posts = posts.filter(post => post.category === selectedCategory);
    }
    
    if (searchTerm) {
      posts = posts.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredPosts(posts);
  }, [selectedCategory, searchTerm]);

  const featuredPost = blogPosts.find(post => post.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 liquid-glass border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-cyan-400" />
              <span className="text-2xl font-bold gradient-text-cyan">Synthex</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4 heading-serif">
              Synthex <span className="gradient-text-cyan">Blog</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Insights, strategies, and updates from the world of AI-powered social media marketing
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400/50"
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      {featuredPost && selectedCategory === 'All' && !searchTerm && (
        <section className="px-6 pb-12">
          <div className="container mx-auto">
            <Card className="liquid-glass p-8 hover:shadow-2xl transition-all">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl h-64 md:h-full flex items-center justify-center">
                  <Brain className="w-24 h-24 text-white/50" />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-xs rounded-full">
                      Featured
                    </span>
                    <span className="text-cyan-400 text-sm">{featuredPost.category}</span>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4 heading-serif">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-300 mb-6">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-gray-400 text-sm mb-6">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {featuredPost.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(featuredPost.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {featuredPost.readTime}
                    </span>
                  </div>
                  <Link href={`/blog/${featuredPost.id}`}>
                    <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                      Read Article
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Blog Posts Grid */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No articles found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <Card key={post.id} className="liquid-glass p-6 hover:transform hover:scale-105 transition-all">
                  <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg h-48 mb-4 flex items-center justify-center">
                    {post.category === 'AI Trends' && <Brain className="w-16 h-16 text-cyan-400/50" />}
                    {post.category === 'Strategy' && <TrendingUp className="w-16 h-16 text-amber-400/50" />}
                    {post.category === 'Optimization' && <Zap className="w-16 h-16 text-purple-400/50" />}
                    {post.category === 'Psychology' && <User className="w-16 h-16 text-green-400/50" />}
                    {post.category === 'Case Study' && <Calendar className="w-16 h-16 text-blue-400/50" />}
                    {post.category === 'Planning' && <Clock className="w-16 h-16 text-pink-400/50" />}
                  </div>
                  <span className="text-cyan-400 text-sm">{post.category}</span>
                  <h3 className="text-xl font-bold text-white mt-2 mb-3">
                    {post.title}
                  </h3>
                  <p className="text-gray-400 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-gray-500 text-sm mb-4">
                    <span>{post.author}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <Link href={`/blog/${post.id}`}>
                    <Button variant="ghost" className="w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10">
                      Read More
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="modern-skeu p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Stay Updated with AI Marketing Insights
            </h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Get weekly tips, strategies, and updates on AI-powered social media marketing delivered to your inbox.
            </p>
            <form className="max-w-md mx-auto flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              />
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-6">
                Subscribe
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}