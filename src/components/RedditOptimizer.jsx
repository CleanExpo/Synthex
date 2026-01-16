import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowUp, Award, Users, TrendingUp, BookOpen, MessageCircle, Star } from '@/components/icons';

/**
 * Reddit Platform Optimizer Component
 * Optimizes content for Reddit's community-driven algorithm
 */
export const RedditOptimizer = () => {
  const [content, setContent] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [postType, setPostType] = useState('text');
  const [metrics, setMetrics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  // Reddit Algorithm Insights 2024
  const algorithmFactors = {
    upvoteVelocity: {
      firstHour: 'Critical for front page',
      ratio: 0.85, // 85% upvote ratio minimum
      weight: 0.35,
      impact: 'Early upvotes = exponential reach'
    },
    engagement: {
      comments: 'More valuable than upvotes',
      controversiality: 0.4, // Some debate is good
      awards: 'Boost visibility significantly',
      weight: 0.30
    },
    timing: {
      optimal: '9-10 AM EST weekdays',
      worst: 'Weekends and late nights',
      subredditSpecific: true,
      weight: 0.20
    },
    authenticity: {
      selfPromotion: 'Max 10% of activity',
      communityRatio: '9:1 interaction rule',
      karma: 'Comment karma > post karma',
      weight: 0.15
    }
  };

  // Reddit Content Formulas
  const contentFormulas = {
    story: {
      name: 'Personal Story',
      structure: [
        'Compelling title (curiosity gap)',
        'TLDR at top',
        'Paragraph breaks every 2-3 sentences',
        'Update/Edit sections',
        'Respond to comments'
      ],
      bestSubreddits: ['r/tifu', 'r/AmItheAsshole', 'r/relationships'],
      upvoteRate: '87%',
      example: 'TIFU by [specific action] leading to [unexpected outcome]'
    },
    advice: {
      name: 'Advice/Tips Post',
      structure: [
        'Clear value proposition',
        'Numbered/bulleted list',
        'Actionable steps',
        'Personal experience',
        'Resources/links'
      ],
      bestSubreddits: ['r/LifeProTips', 'r/YouShouldKnow', 'r/personalfinance'],
      upvoteRate: '82%',
      example: 'YSK: This simple trick can save you $X per year'
    },
    question: {
      name: 'Discussion Starter',
      structure: [
        'Open-ended question',
        'Context in text body',
        'Own answer in comments',
        'Engage with responses',
        'Award good answers'
      ],
      bestSubreddits: ['r/AskReddit', 'r/NoStupidQuestions', 'r/explainlikeimfive'],
      upvoteRate: '79%',
      example: 'What\'s the most underrated [topic] that everyone should know?'
    },
    data: {
      name: 'Data/Infographic',
      structure: [
        '[OC] tag required',
        'Clear visualization',
        'Source in comments',
        'Methodology explained',
        'Interactive discussion'
      ],
      bestSubreddits: ['r/dataisbeautiful', 'r/coolguides', 'r/infographics'],
      upvoteRate: '91%',
      example: '[OC] I analyzed X and found surprising pattern Y'
    },
    ama: {
      name: 'AMA Format',
      structure: [
        'Proof/verification',
        'Interesting title',
        'Background info',
        'Answer everything',
        'Follow up later'
      ],
      bestSubreddits: ['r/IAmA', 'r/casualiama', 'niche communities'],
      upvoteRate: '85%',
      example: 'I am [unique position/experience], AMA!'
    }
  };

  // Subreddit Strategy
  const subredditStrategy = {
    research: {
      rules: 'Read ALL rules first',
      culture: 'Lurk for 2 weeks minimum',
      flairs: 'Use appropriate post flair',
      timing: 'Check subreddit peak times'
    },
    targeting: [
      { size: 'Large (1M+)', strategy: 'High quality, unique angle', difficulty: 'Hard' },
      { size: 'Medium (100K-1M)', strategy: 'Community-focused', difficulty: 'Medium' },
      { size: 'Small (<100K)', strategy: 'Personal, engaged', difficulty: 'Easy' },
      { size: 'Niche', strategy: 'Expert content', difficulty: 'Variable' }
    ],
    karma: {
      building: 'Comment first, post later',
      ratio: 'Maintain 3:1 comment to post',
      quality: 'Quality > quantity always'
    }
  };

  // Comment Strategy
  const commentStrategy = {
    timing: {
      new: 'Comment on rising posts',
      hot: 'Reply to top comments',
      speed: 'First 30 minutes crucial'
    },
    types: {
      informative: 'Add valuable information',
      humorous: 'Clever, contextual humor',
      supportive: 'Empathy and understanding',
      contrarian: 'Respectful disagreement'
    },
    formatting: {
      structure: 'Short paragraphs',
      emphasis: '**Bold** key points',
      lists: 'Bullet points for clarity',
      edits: 'Edit: for transparency'
    }
  };

  const analyzeContent = () => {
    const analysis = {
      titleScore: analyzeTitleScore(content),
      communityFit: checkCommunityFit(subreddit),
      engagementPotential: predictEngagement(content),
      upvoteRatio: predictUpvoteRatio(content),
      frontPageChance: calculateFrontPageChance(content),
      improvements: generateImprovements(content)
    };
    
    setMetrics(analysis);
    generateRecommendations(analysis);
  };

  const analyzeTitleScore = (text) => {
    const compelling = ['TIL', 'YSK', 'LPT', 'ELI5', 'TIFU', 'AMA'];
    const hasCompelling = compelling.some(term => 
      text.toUpperCase().includes(term)
    );
    const hasQuestion = text.includes('?');
    const length = text.length > 20 && text.length < 120;
    
    let score = 40;
    if (hasCompelling) score += 25;
    if (hasQuestion) score += 15;
    if (length) score += 20;
    
    return Math.min(score, 100);
  };

  const checkCommunityFit = (sub) => {
    // Simulated community fit check
    if (!sub) return 0;
    return Math.floor(Math.random() * 30) + 65;
  };

  const predictEngagement = (text) => {
    const hasQuestion = text.includes('?');
    const controversial = text.toLowerCase().includes('unpopular opinion');
    const story = text.toLowerCase().includes('story time');
    
    let score = 50;
    if (hasQuestion) score += 15;
    if (controversial) score += 10;
    if (story) score += 15;
    
    return Math.min(score, 100);
  };

  const predictUpvoteRatio = (text) => {
    const base = 75;
    const quality = text.length > 100 ? 10 : 0;
    return Math.min(base + quality, 95);
  };

  const calculateFrontPageChance = (text) => {
    const titleScore = analyzeTitleScore(text) * 0.3;
    const engagement = predictEngagement(text) * 0.4;
    const timing = 20; // Assume good timing
    return Math.min(titleScore + engagement + timing, 90);
  };

  const generateImprovements = (text) => {
    const improvements = [];
    if (!text.includes('?') && postType === 'text') {
      improvements.push('Consider framing as a question for more engagement');
    }
    if (text.length < 50) {
      improvements.push('Add more context for better engagement');
    }
    if (!subreddit) {
      improvements.push('Select target subreddit for specific optimization');
    }
    return improvements;
  };

  const generateRecommendations = (analysis) => {
    const recs = [];
    
    if (analysis.titleScore < 70) {
      recs.push({
        type: 'title',
        priority: 'high',
        suggestion: 'Start with TIL, YSK, or ask a compelling question'
      });
    }
    
    if (analysis.communityFit < 75) {
      recs.push({
        type: 'community',
        priority: 'high',
        suggestion: 'Research subreddit rules and recent top posts'
      });
    }
    
    recs.push({
      type: 'timing',
      priority: 'medium',
      suggestion: 'Post at 9-10 AM EST on Tuesday-Thursday'
    });
    
    setRecommendations(recs);
  };

  return (
    <div className="reddit-optimizer">
      <div className="optimizer-header">
        <h2>Reddit Content Optimizer</h2>
        <p>Master the front page with community-optimized content</p>
      </div>

      <div className="optimizer-grid">
        {/* Content Input Section */}
        <div className="content-input-section">
          <h3>Post Details</h3>
          <input
            type="text"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            placeholder="Target subreddit (e.g., r/technology)"
            className="subreddit-input"
          />
          <select 
            value={postType} 
            onChange={(e) => setPostType(e.target.value)}
            className="post-type-select"
          >
            <option value="text">Text Post</option>
            <option value="link">Link Post</option>
            <option value="image">Image/GIF</option>
            <option value="video">Video Post</option>
          </select>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter post title and content..."
            rows={6}
          />
          <button onClick={analyzeContent} className="analyze-btn">
            <ArrowUp /> Analyze Reddit Potential
          </button>
        </div>

        {/* Metrics Dashboard */}
        {metrics && (
          <div className="metrics-dashboard">
            <h3>Reddit Performance Metrics</h3>
            <div className="metric-cards">
              <div className="metric-card">
                <div className="metric-icon"><BookOpen /></div>
                <div className="metric-value">{metrics.titleScore}%</div>
                <div className="metric-label">Title Score</div>
              </div>
              <div className="metric-card">
                <div className="metric-icon"><Users /></div>
                <div className="metric-value">{metrics.communityFit}%</div>
                <div className="metric-label">Community Fit</div>
              </div>
              <div className="metric-card">
                <div className="metric-icon"><MessageCircle /></div>
                <div className="metric-value">{metrics.engagementPotential}%</div>
                <div className="metric-label">Engagement</div>
              </div>
              <div className="metric-card">
                <div className="metric-icon"><ArrowUp /></div>
                <div className="metric-value">{metrics.upvoteRatio}%</div>
                <div className="metric-label">Upvote Ratio</div>
              </div>
              <div className="metric-card frontpage">
                <div className="metric-icon"><TrendingUp /></div>
                <div className="metric-value">{metrics.frontPageChance}%</div>
                <div className="metric-label">Front Page</div>
              </div>
            </div>
          </div>
        )}

        {/* Content Formulas */}
        <div className="content-formulas">
          <h3>Proven Reddit Formulas</h3>
          <div className="formula-grid">
            {Object.values(contentFormulas).map((formula, index) => (
              <div key={index} className="formula-card">
                <h4>{formula.name}</h4>
                <div className="formula-stats">
                  <span className="upvote-rate">⬆️ {formula.upvoteRate}</span>
                  <span className="best-subs">📍 {formula.bestSubreddits[0]}</span>
                </div>
                <ol className="formula-structure">
                  {formula.structure.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <div className="formula-example">
                  <strong>Example:</strong> {formula.example}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subreddit Strategy */}
        <div className="subreddit-strategy">
          <h3>Subreddit Targeting Guide</h3>
          <div className="strategy-sections">
            <div className="research-tips">
              <h4>Research Phase</h4>
              <ul>
                {Object.entries(subredditStrategy.research).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}:</strong> {value}
                  </li>
                ))}
              </ul>
            </div>
            <div className="size-strategy">
              <h4>Size-Based Strategy</h4>
              {subredditStrategy.targeting.map((target, i) => (
                <div key={i} className="target-card">
                  <span className="size">{target.size}</span>
                  <span className="strategy">{target.strategy}</span>
                  <span className={`difficulty ${target.difficulty.toLowerCase()}`}>
                    {target.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comment Strategy */}
        <div className="comment-strategy">
          <h3>Comment Optimization</h3>
          <div className="comment-grid">
            <div className="comment-timing">
              <h4>Timing Strategy</h4>
              {Object.entries(commentStrategy.timing).map(([key, value]) => (
                <div key={key} className="timing-tip">
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
            <div className="comment-types">
              <h4>Comment Types</h4>
              {Object.entries(commentStrategy.types).map(([type, desc]) => (
                <div key={type} className="comment-type">
                  <span className="type-name">{type}</span>
                  <span className="type-desc">{desc}</span>
                </div>
              ))}
            </div>
            <div className="comment-formatting">
              <h4>Formatting Tips</h4>
              {Object.entries(commentStrategy.formatting).map(([key, value]) => (
                <div key={key} className="format-tip">
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="recommendations-panel">
            <h3>Optimization Recommendations</h3>
            {recommendations.map((rec, index) => (
              <div key={index} className={`recommendation ${rec.priority}`}>
                <div className="rec-priority">{rec.priority}</div>
                <div className="rec-content">{rec.suggestion}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reddit Checklist */}
        <div className="reddit-checklist">
          <h3>Pre-Post Checklist</h3>
          <div className="checklist">
            <label><input type="checkbox" /> Read ALL subreddit rules</label>
            <label><input type="checkbox" /> Check recent top posts for style</label>
            <label><input type="checkbox" /> Title under 120 characters</label>
            <label><input type="checkbox" /> No spelling/grammar errors</label>
            <label><input type="checkbox" /> Appropriate flair selected</label>
            <label><input type="checkbox" /> TLDR for long posts</label>
            <label><input type="checkbox" /> Sources/proof ready if needed</label>
            <label><input type="checkbox" /> Ready to respond for 2 hours</label>
            <label><input type="checkbox" /> Cross-post strategy planned</label>
            <label><input type="checkbox" /> Not violating self-promotion rules</label>
          </div>
        </div>

        {/* Karma Building */}
        <div className="karma-building">
          <h3>Karma Building Strategy</h3>
          <div className="karma-tips">
            <div className="tip-card">
              <h4>Quick Wins</h4>
              <ul>
                <li>Sort by Rising, comment early</li>
                <li>Answer questions in r/AskReddit new</li>
                <li>Helpful comments in hobby subs</li>
                <li>Share expertise in niche communities</li>
                <li>Participate in daily threads</li>
              </ul>
            </div>
            <div className="tip-card">
              <h4>Long-term Growth</h4>
              <ul>
                <li>Become known in 2-3 subreddits</li>
                <li>Create quality OC regularly</li>
                <li>Help newcomers consistently</li>
                <li>Moderate a small community</li>
                <li>Host AMAs in your expertise</li>
              </ul>
            </div>
            <div className="tip-card">
              <h4>Avoid These</h4>
              <ul>
                <li>Reposting without credit</li>
                <li>Karma farming subs</li>
                <li>Vote manipulation</li>
                <li>Excessive self-promotion</li>
                <li>Breaking subreddit rules</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedditOptimizer;