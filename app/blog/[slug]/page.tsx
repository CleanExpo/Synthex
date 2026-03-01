'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, User, Share2, Twitter, Linkedin, Facebook, Copy, Check } from '@/components/icons';

// Sample blog post data - in production, this would come from a database
const blogPosts = {
  'what-is-skill-md-claude-code': {
    id: 'what-is-skill-md-claude-code',
    title: 'What Is a SKILL.md File? The Complete Guide for Claude Code Agents',
    excerpt: 'The definitive guide to SKILL.md — the open standard for defining reusable agent skills in Claude Code. Learn the format, see real examples, and understand how SKILL.md compares to AGENTS.md and CLAUDE.md.',
    content: `
      <p>If you've used Claude Code for more than a few sessions, you've probably noticed <code>.claude/skills/</code> directories appearing in projects. Inside each one sits a single file: <strong>SKILL.md</strong>. But what exactly is a SKILL.md file, and why has it become the cornerstone of how AI agents learn specialised workflows?</p>

      <p>This guide explains everything you need to know — from the format specification and real-world examples through to the difference between SKILL.md, AGENTS.md, and CLAUDE.md.</p>

      <h2>What Is a SKILL.md File?</h2>
      <p>A SKILL.md file is a structured Markdown document that defines a <strong>single, reusable capability</strong> for an AI coding agent. Think of it as a recipe card: it tells the agent what the skill does, when to activate it, and exactly how to execute it step by step.</p>

      <p>Skills live inside <code>.claude/skills/&lt;skill-name&gt;/SKILL.md</code> in your project. When a user's request matches the skill's trigger conditions, Claude Code loads the file and follows its instructions — turning a general-purpose assistant into a domain expert on demand.</p>

      <h3>Why Skills Exist</h3>
      <p>Without skills, you'd need to re-explain complex workflows every session. A SEO audit, a database migration checklist, a code review protocol — these are multi-step processes with specific rules. Skills encode that knowledge once and make it available permanently.</p>

      <p>The key benefits are:</p>
      <ul>
        <li><strong>Consistency</strong> — The agent follows the same process every time, eliminating drift between sessions</li>
        <li><strong>Shareability</strong> — Skills are plain Markdown files committed to Git, so your entire team benefits</li>
        <li><strong>Composability</strong> — Skills can reference other skills, creating layered workflows</li>
        <li><strong>Version control</strong> — Track changes to your agent's capabilities like any other code</li>
      </ul>

      <h2>The SKILL.md Format</h2>
      <p>Every SKILL.md file follows a consistent structure: <strong>YAML frontmatter</strong> for metadata, followed by <strong>Markdown body</strong> for instructions.</p>

      <h3>YAML Frontmatter</h3>
      <p>The frontmatter block at the top of the file defines key metadata that Claude Code uses to decide <em>when</em> and <em>how</em> to activate the skill:</p>

      <pre><code>---
name: seo-technical-audit
description: Audit, diagnose, and fix the technical SEO foundation of any website
triggers:
  - technical SEO
  - site speed
  - Core Web Vitals
  - crawlability
  - schema markup
tools:
  - Read
  - Grep
  - Glob
  - WebFetch
  - WebSearch
---</code></pre>

      <p>The <code>name</code> field is the skill's unique identifier. The <code>description</code> gives Claude a one-line summary. The <code>triggers</code> array lists keywords and phrases that cause the skill to activate — when a user mentions "Core Web Vitals" or "crawlability", this skill loads automatically.</p>

      <p>The optional <code>tools</code> array restricts which tools the skill can use, providing a security boundary.</p>

      <h3>Markdown Body</h3>
      <p>Below the frontmatter, the body contains the actual skill instructions in plain Markdown. This is where you define the step-by-step process, decision trees, output formats, and quality gates.</p>

      <p>A well-structured body typically includes:</p>
      <ul>
        <li><strong>Context section</strong> — Background knowledge the agent needs</li>
        <li><strong>Process steps</strong> — Numbered or ordered workflow stages</li>
        <li><strong>Output format</strong> — What the deliverable should look like</li>
        <li><strong>Quality checklist</strong> — Validation criteria before completion</li>
        <li><strong>References</strong> — Links to supporting files or external resources</li>
      </ul>

      <h2>Skill Types in Practice</h2>
      <p>Skills fall into two broad categories based on how strictly they should be followed:</p>

      <h3>Rigid Skills</h3>
      <p>These define exact processes that must be followed step by step — test-driven development workflows, security audit checklists, deployment runbooks. Deviating from the process defeats the purpose.</p>

      <h3>Flexible Skills</h3>
      <p>These provide principles and patterns that the agent adapts to context — content writing guidelines, code review heuristics, design system conventions. The spirit matters more than the letter.</p>

      <p>The skill itself should indicate which type it is. Rigid skills use imperative language ("You MUST", "Always", "Never"), while flexible skills use advisory language ("Prefer", "Consider", "When possible").</p>

      <h2>SKILL.md vs AGENTS.md vs CLAUDE.md</h2>
      <p>These three file types serve different purposes in the Claude Code ecosystem. Understanding the distinction is essential for structuring your AI-assisted workflows correctly.</p>

      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Scope</th>
            <th>Purpose</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>CLAUDE.md</strong></td>
            <td>Project-wide</td>
            <td>Project context, conventions, architecture overview</td>
            <td>Repository root or <code>~/.claude/</code></td>
          </tr>
          <tr>
            <td><strong>SKILL.md</strong></td>
            <td>Single capability</td>
            <td>Step-by-step workflow for one specific task</td>
            <td><code>.claude/skills/&lt;name&gt;/</code></td>
          </tr>
          <tr>
            <td><strong>AGENT.md</strong></td>
            <td>Agent persona</td>
            <td>Role definition, tools, delegation rules for a specialist agent</td>
            <td><code>.claude/agents/&lt;name&gt;.md</code></td>
          </tr>
        </tbody>
      </table>

      <p><strong>CLAUDE.md</strong> is the project's instruction manual — it tells the agent about the codebase, tech stack, naming conventions, and preferred workflows. It's always loaded.</p>

      <p><strong>SKILL.md</strong> is a capability module — it teaches the agent <em>how to do one thing well</em>. Skills are loaded on demand when their triggers match the user's request.</p>

      <p><strong>AGENT.md</strong> is a role definition — it creates a specialist persona (e.g., "build-engineer", "code-architect") with its own tools and responsibilities. Agents can invoke skills as part of their work.</p>

      <p>In practice, these compose together: CLAUDE.md sets the project context, an agent receives a task, and the agent invokes relevant skills to execute it. The hierarchy is <strong>project → agent → skill</strong>.</p>

      <h2>Real-World Example: A Complete SKILL.md</h2>
      <p>Here is a condensed example of a production SKILL.md used for SEO content briefs. Notice how it combines metadata, process steps, and quality gates:</p>

      <pre><code>---
name: seo-content-brief
description: Generate production-ready content briefs from verified keywords
triggers:
  - content brief
  - page outline
  - writing specification
  - heading structure
---

# SEO Content Brief Generator

## Process
1. Receive B.I.D.-verified keyword from seo-geo-architect skill
2. Analyse top 10 SERP results for the target keyword
3. Extract heading patterns, word counts, and content gaps
4. Generate brief with: target word count, heading hierarchy,
   required sections, internal link targets, schema type
5. Include E-E-A-T signal requirements

## Output Format
- H1 title with primary keyword
- H2/H3 heading hierarchy (minimum 6 headings)
- Target word count range
- Required schema markup type
- Internal linking targets (minimum 3)
- AI-capture tactics for GEO optimisation

## Quality Gate
Brief must score 80+ on the output-validator skill
before being delivered to the writer.</code></pre>

      <p>This skill transforms keyword research into actionable writing specifications. It chains with other skills (references <code>seo-geo-architect</code> and <code>output-validator</code>), demonstrating the composability that makes the system powerful.</p>

      <h2>Building Skills for Your Project</h2>
      <p>Creating effective skills follows a simple pattern:</p>

      <ol>
        <li><strong>Identify repetition</strong> — What workflow do you explain to the AI more than twice? That's a skill candidate.</li>
        <li><strong>Define triggers</strong> — What phrases would a user say that should activate this skill?</li>
        <li><strong>Write the process</strong> — Document the steps as if training a new team member.</li>
        <li><strong>Add quality gates</strong> — How do you verify the output is correct?</li>
        <li><strong>Test and iterate</strong> — Run the skill, check the output, refine the instructions.</li>
      </ol>

      <p>Start small. A skill with 5 clear steps is more useful than a skill with 50 ambiguous ones. You can always add complexity later as you observe how the agent interprets your instructions.</p>

      <h2>The Skills Ecosystem</h2>
      <p>Projects that adopt the SKILL.md standard often build substantial skill libraries. At Synthex, for example, we maintain 45 skills covering SEO strategy, content creation, code review, database operations, security hardening, deployment orchestration, and more.</p>

      <p>Skills are composable by design. A "blog-write" skill might chain through "blog-brief" (for the outline), "blog-seo-check" (for on-page validation), and "blog-schema" (for structured data) — each a separate SKILL.md file that can also be invoked independently.</p>

      <p>Because skills are plain Markdown files in Git, they're shareable across projects and teams. The <a href="https://github.com/CleanExpo/agents.md">CleanExpo/agents.md</a> repository provides an open-source reference for the format specification.</p>

      <h2>Getting Started</h2>
      <p>To add your first skill to a project:</p>

      <ol>
        <li>Create the directory: <code>mkdir -p .claude/skills/my-skill</code></li>
        <li>Create the file: <code>touch .claude/skills/my-skill/SKILL.md</code></li>
        <li>Add YAML frontmatter with name, description, and triggers</li>
        <li>Write the process instructions in the Markdown body</li>
        <li>Commit to Git and test by asking Claude Code a question that matches your triggers</li>
      </ol>

      <p>The skill activates automatically — no configuration beyond the file itself. That's the beauty of the convention-over-configuration approach.</p>
    `,
    author: {
      name: 'Phill McGurk',
      role: 'Founder & Lead Developer',
      avatar: '/images/authors/phill-mcgurk.jpg'
    },
    category: 'Developer Tools',
    tags: ['Claude Code', 'SKILL.md', 'AI Agents', 'Developer Tools', 'Automation'],
    publishedAt: '2026-02-28',
    readTime: '8 min read',
    image: '/images/blog/skill-md-guide.jpg'
  },
  'ai-revolution-social-media': {
    id: 'ai-revolution-social-media',
    title: 'The AI Revolution in Social Media Marketing',
    excerpt: 'How artificial intelligence is transforming the way brands connect with their audience',
    content: `
      <p>Artificial Intelligence is no longer a futuristic concept—it's here, and it's revolutionizing how we approach social media marketing. From content creation to audience analysis, AI tools are empowering marketers to work smarter, not harder.</p>
      
      <h2>The Current State of AI in Marketing</h2>
      <p>Today's AI-powered marketing tools can analyze vast amounts of data in seconds, identify patterns humans might miss, and generate insights that drive real results. At SYNTHEX, we've seen firsthand how AI can transform a brand's social media presence.</p>
      
      <h3>Key Benefits of AI in Social Media</h3>
      <ul>
        <li><strong>Personalization at Scale:</strong> AI enables hyper-personalized content for millions of users simultaneously</li>
        <li><strong>Predictive Analytics:</strong> Forecast trends and user behavior before they happen</li>
        <li><strong>Content Optimization:</strong> Automatically adjust content based on performance metrics</li>
        <li><strong>24/7 Engagement:</strong> AI-powered chatbots and response systems never sleep</li>
      </ul>
      
      <h2>Real-World Applications</h2>
      <p>Leading brands are already leveraging AI to gain competitive advantages:</p>
      
      <blockquote>
        "Using SYNTHEX's AI-powered content generation, we increased our engagement rate by 312% in just three months." - Sarah Chen, CMO at TechStart
      </blockquote>
      
      <h3>Content Creation and Curation</h3>
      <p>AI doesn't replace creativity—it enhances it. By analyzing what resonates with your audience, AI can suggest content topics, optimal posting times, and even generate initial drafts that maintain your brand voice.</p>
      
      <h3>Audience Intelligence</h3>
      <p>Understanding your audience has never been more sophisticated. AI can identify micro-segments within your audience, track sentiment in real-time, and predict which users are most likely to convert.</p>
      
      <h2>The Future is Here</h2>
      <p>As we look ahead, the integration of AI in social media marketing will only deepen. Visual recognition, natural language processing, and predictive modeling will become standard tools in every marketer's toolkit.</p>
      
      <p>The question isn't whether to adopt AI in your marketing strategy—it's how quickly you can integrate these powerful tools to stay ahead of the competition.</p>
    `,
    author: {
      name: 'Alex Rivera',
      role: 'Head of AI Research',
      avatar: '/images/authors/alex-rivera.jpg'
    },
    category: 'AI & Technology',
    tags: ['AI', 'Social Media', 'Marketing', 'Innovation'],
    publishedAt: '2025-08-05',
    readTime: '5 min read',
    image: '/images/blog/ai-revolution.jpg'
  },
  'maximizing-engagement-2025': {
    id: 'maximizing-engagement-2025',
    title: '10 Strategies to Maximize Engagement in 2025',
    excerpt: 'Evidence-based tactics that actually work in today\'s social landscape',
    content: `
      <p>Social media engagement isn't just about likes and shares—it's about building genuine connections with your audience. Here are 10 proven strategies that will transform your engagement metrics in 2025.</p>
      
      <h2>1. Interactive Content is King</h2>
      <p>Static posts are out; interactive experiences are in. Polls, quizzes, and AR filters generate 3x more engagement than traditional posts.</p>
      
      <h2>2. Micro-Video Dominance</h2>
      <p>Videos under 15 seconds receive 80% more engagement. Keep it short, punchy, and valuable.</p>
      
      <h2>3. Community-First Approach</h2>
      <p>Build communities, not just follower counts. Private groups and exclusive content create loyalty and drive organic growth.</p>
      
      <h2>4. AI-Powered Personalization</h2>
      <p>Use AI to deliver personalized content experiences. SYNTHEX's persona learning technology ensures every piece of content resonates with its intended audience.</p>
      
      <h2>5. Real-Time Engagement</h2>
      <p>Respond to trends and conversations as they happen. Speed and relevance are your competitive advantages.</p>
      
      <h2>6. User-Generated Content Campaigns</h2>
      <p>Your audience creates better content than you think. UGC campaigns see 6.9x higher engagement than brand-generated content.</p>
      
      <h2>7. Cross-Platform Storytelling</h2>
      <p>Tell cohesive stories across multiple platforms. Each platform should add a unique chapter to your brand narrative.</p>
      
      <h2>8. Value-First Content Strategy</h2>
      <p>Every post should answer: "What's in it for my audience?" Educational and entertaining content consistently outperforms promotional posts.</p>
      
      <h2>9. Authenticity Over Perfection</h2>
      <p>Behind-the-scenes content and authentic moments create stronger connections than polished, corporate messaging.</p>
      
      <h2>10. Data-Driven Optimization</h2>
      <p>Test, measure, and iterate. Use SYNTHEX's analytics to understand what works and double down on successful strategies.</p>
      
      <p>Implementing these strategies requires the right tools and mindset. Start with one or two, measure the results, and gradually expand your approach.</p>
    `,
    author: {
      name: 'Maria Santos',
      role: 'Content Strategy Director',
      avatar: '/images/authors/maria-santos.jpg'
    },
    category: 'Strategy',
    tags: ['Engagement', 'Strategy', 'Social Media', '2025 Trends'],
    publishedAt: '2025-08-03',
    readTime: '7 min read',
    image: '/images/blog/engagement-strategies.jpg'
  },
  'content-creation-scale': {
    id: 'content-creation-scale',
    title: 'Content Creation at Scale: A Complete Guide',
    excerpt: 'Learn how to produce quality content consistently without burning out',
    content: `
      <p>Creating content at scale doesn't mean sacrificing quality for quantity. With the right systems and tools, you can maintain high standards while dramatically increasing your output.</p>
      
      <h2>The Scale Challenge</h2>
      <p>Most brands struggle with content creation because they approach it reactively rather than systematically. Scaling requires a fundamental shift in how you think about content production.</p>
      
      <h2>Building Your Content Engine</h2>
      
      <h3>1. Content Pillars and Themes</h3>
      <p>Establish 4-6 core content pillars that align with your brand values and audience interests. This creates a framework for consistent content generation.</p>
      
      <h3>2. Batch Production</h3>
      <p>Create content in batches rather than daily. Dedicate specific days to ideation, creation, and scheduling. This approach can 10x your productivity.</p>
      
      <h3>3. Template Systems</h3>
      <p>Develop templates for different content types. SYNTHEX's template library provides proven formats that maintain quality while speeding up production.</p>
      
      <h3>4. Repurposing Strategy</h3>
      <p>One piece of content should spawn multiple assets. A blog post becomes a video script, infographic, social posts, and email newsletter content.</p>
      
      <h2>Leveraging AI for Scale</h2>
      <p>AI tools like SYNTHEX don't replace human creativity—they amplify it. Use AI for:</p>
      <ul>
        <li>Initial content drafts and ideation</li>
        <li>Variation generation for A/B testing</li>
        <li>Content optimization based on performance data</li>
        <li>Automated scheduling and distribution</li>
      </ul>
      
      <h2>Quality Control at Scale</h2>
      <p>Maintain quality standards with:</p>
      <ul>
        <li>Clear brand guidelines and voice documentation</li>
        <li>Peer review processes for high-stakes content</li>
        <li>Regular performance audits and optimization</li>
        <li>Continuous team training and development</li>
      </ul>
      
      <h2>Measuring Success</h2>
      <p>Track both quantity and quality metrics:</p>
      <ul>
        <li>Content output volume</li>
        <li>Engagement rates per piece</li>
        <li>Conversion metrics</li>
        <li>Brand consistency scores</li>
      </ul>
      
      <p>Scaling content creation is a marathon, not a sprint. Start with sustainable systems, leverage the right tools, and continuously refine your approach based on data and feedback.</p>
    `,
    author: {
      name: 'David Kim',
      role: 'VP of Marketing Operations',
      avatar: '/images/authors/david-kim.jpg'
    },
    category: 'Content Marketing',
    tags: ['Content Creation', 'Productivity', 'Scale', 'Automation'],
    publishedAt: '2025-08-01',
    readTime: '8 min read',
    image: '/images/blog/content-scale.jpg'
  }
};

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  
  // Get the blog post based on the slug
  const post = blogPosts[params.slug as keyof typeof blogPosts];
  
  // If post not found, redirect to blog page
  useEffect(() => {
    if (!post) {
      router.push('/blog');
    }
  }, [post, router]);
  
  if (!post) {
    return null;
  }
  
  // Defer to useEffect to avoid hydration mismatch (server has no window.location).
  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);
  
  const handleShare = (platform: string) => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(post.title);
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    };
    
    window.open(shareUrls[platform as keyof typeof shareUrls], '_blank');
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#1A1A1A]">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <Link 
            href="/blog"
            className="inline-flex items-center text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <article className="max-w-4xl mx-auto">
          {/* Article Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                {post.category}
              </Badge>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Calendar className="h-4 w-4" />
                {new Date(post.publishedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Clock className="h-4 w-4" />
                {post.readTime}
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {post.title}
            </h1>
            
            <p className="text-xl text-gray-400 mb-8">
              {post.excerpt}
            </p>
            
            {/* Author Info */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white">{post.author.name}</p>
                  <p className="text-sm text-gray-400">{post.author.role}</p>
                </div>
              </div>
              
              {/* Share Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare('twitter')}
                  className="border-gray-700 hover:bg-gray-900"
                >
                  <Twitter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare('linkedin')}
                  className="border-gray-700 hover:bg-gray-900"
                >
                  <Linkedin className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare('facebook')}
                  className="border-gray-700 hover:bg-gray-900"
                >
                  <Facebook className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="border-gray-700 hover:bg-gray-900"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Featured Image Placeholder */}
          <div className="w-full h-96 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-xl mb-12 flex items-center justify-center border border-gray-800">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Share2 className="h-12 w-12 text-cyan-400" />
              </div>
              <p className="text-gray-500">Featured Image</p>
            </div>
          </div>
          
          {/* Article Content - sanitized to prevent XSS */}
          <div
            className="prose prose-invert prose-lg max-w-none"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(post.content)
            }}
          />
          
          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-400">Tags:</span>
              {post.tags.map((tag: string) => (
                <Badge 
                  key={tag}
                  variant="outline" 
                  className="border-gray-700 text-gray-300"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* CTA Section */}
          <Card variant="glass-primary" className="mt-12">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-4">
                Ready to Transform Your Social Media Strategy?
              </h3>
              <p className="text-gray-400 mb-6">
                Join thousands of marketers using SYNTHEX to create engaging content at scale.
              </p>
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={() => router.push('/signup')}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                >
                  Start Free Trial
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push('/demo')}
                  className="border-gray-700 hover:bg-gray-900"
                >
                  Watch Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        </article>
      </main>
    </div>
  );
}