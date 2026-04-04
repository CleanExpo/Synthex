import React, { useState } from 'react';
import { optimizerAPI } from '../api/optimizerAPI.js';

export default function LinkedInOptimizer() {
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState('article');
  const [industry, setIndustry] = useState('general');

  const analyzeContent = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const result = await optimizerAPI.analyzeContent('linkedin', content, {
        postType,
        industry,
        targetAudience: 'professional'
      });
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysis({
        error: true,
        message: 'Failed to analyze content. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#0A66C2';
    if (score >= 60) return '#057642';
    return '#CC1016';
  };

  const industries = [
    'general', 'technology', 'marketing', 'finance', 'healthcare', 
    'education', 'consulting', 'manufacturing', 'retail', 'media'
  ];

  return (
    <div className="optimizer-container linkedin-optimizer">
      <div className="optimizer-header">
        <h2>
          <i className="fab fa-linkedin"></i>
          LinkedIn Content Optimizer
        </h2>
        <p>Professional content optimization for maximum business impact</p>
      </div>

      <div className="optimizer-content">
        <div className="input-section">
          <div className="settings-row">
            <div className="post-type-selector">
              <label>Content Type:</label>
              <select value={postType} onChange={(e) => setPostType(e.target.value)}>
                <option value="article">Article/Insight</option>
                <option value="update">Company Update</option>
                <option value="thought">Thought Leadership</option>
                <option value="question">Question/Poll</option>
                <option value="achievement">Achievement</option>
                <option value="event">Event Promotion</option>
              </select>
            </div>

            <div className="industry-selector">
              <label>Industry:</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {industries.map(ind => (
                  <option key={ind} value={ind}>
                    {ind.charAt(0).toUpperCase() + ind.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="content">Your LinkedIn Post</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your professional insights, achievements, or industry thoughts..."
            rows="10"
            maxLength="3000"
          />
          <div className="content-stats">
            <span className="char-count">
              {content.length} / 3000 characters
            </span>
            <span className="word-count">
              {content.split(/\s+/).filter(word => word.length > 0).length} words
              {content.split(/\s+/).filter(word => word.length > 0).length < 150 && 
                <span className="warning"> (Aim for 150+ words)</span>
              }
            </span>
          </div>
          
          <button 
            onClick={analyzeContent} 
            disabled={loading || !content.trim()}
            className="analyze-btn"
          >
            {loading ? 'Analyzing...' : 'Analyze Professional Content'}
          </button>
        </div>

        {analysis && !analysis.error && (
          <div className="results-section">
            <div className="score-card">
              <div className="score-circle" style={{ borderColor: getScoreColor(analysis.score) }}>
                <span className="score-value">{analysis.score}</span>
                <span className="score-label">Score</span>
              </div>
              <div className="score-details">
                <h3>Professional Impact Score</h3>
                <div className="score-bar">
                  <div 
                    className="score-fill" 
                    style={{ 
                      width: `${analysis.score}%`,
                      backgroundColor: getScoreColor(analysis.score)
                    }}
                  />
                </div>
              </div>
            </div>

            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <div className="suggestions-card">
                <h3>💼 Professional Optimization</h3>
                <ul>
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.hashtags && analysis.hashtags.length > 0 && (
              <div className="hashtags-card">
                <h3># Professional Hashtags</h3>
                <div className="hashtags-container">
                  {analysis.hashtags.map((tag, index) => (
                    <span key={index} className="hashtag professional">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="hashtag-tip">
                  💡 Use 3-5 relevant hashtags. Research shows posts with hashtags get 12.6% more engagement.
                </p>
              </div>
            )}

            {analysis.bestTiming && (
              <div className="timing-card">
                <h3>⏰ Optimal Professional Posting</h3>
                <div className="timing-grid">
                  <div className="timing-item">
                    <span className="timing-label">Best Days:</span>
                    <span className="timing-value">
                      {analysis.bestTiming.days.join(', ')}
                    </span>
                  </div>
                  <div className="timing-item">
                    <span className="timing-label">Peak Hours:</span>
                    <span className="timing-value">
                      {analysis.bestTiming.hours.join(', ')}
                    </span>
                  </div>
                </div>
                <p className="timing-tip">
                  🎯 B2B posts perform best during business hours when professionals are active.
                </p>
              </div>
            )}

            <div className="engagement-strategies-card">
              <h3>📈 LinkedIn Engagement Strategies</h3>
              <div className="strategies-grid">
                <div className="strategy-item">
                  <i className="fas fa-lightbulb"></i>
                  <div>
                    <h4>Share Insights</h4>
                    <p>Industry trends, data-driven observations</p>
                  </div>
                </div>
                <div className="strategy-item">
                  <i className="fas fa-question-circle"></i>
                  <div>
                    <h4>Ask Questions</h4>
                    <p>Spark professional discussions</p>
                  </div>
                </div>
                <div className="strategy-item">
                  <i className="fas fa-graduation-cap"></i>
                  <div>
                    <h4>Share Learning</h4>
                    <p>Lessons learned, skill development</p>
                  </div>
                </div>
                <div className="strategy-item">
                  <i className="fas fa-handshake"></i>
                  <div>
                    <h4>Celebrate Others</h4>
                    <p>Team achievements, industry peers</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="content-framework-card">
              <h3>📋 LinkedIn Content Framework</h3>
              <div className="framework-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <div>
                    <h4>Hook (First 2 lines)</h4>
                    <p>Grab attention with compelling opening</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-number">2</span>
                  <div>
                    <h4>Value (Main content)</h4>
                    <p>Share insights, experiences, or lessons</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-number">3</span>
                  <div>
                    <h4>Call to Action</h4>
                    <p>Ask questions, invite discussion</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="best-practices-card">
              <h3>📚 LinkedIn Algorithm Tips</h3>
              <ul>
                <li>Posts with 150+ words get 2x more engagement</li>
                <li>Native video content gets 5x more shares</li>
                <li>Comment within the first hour to boost reach</li>
                <li>Tag relevant people (max 5) to expand reach</li>
                <li>Use line breaks for better readability</li>
                <li>Share personal stories with professional lessons</li>
                <li>Engage meaningfully with others' content</li>
                <li>Post consistently (3-5x per week)</li>
              </ul>
            </div>
          </div>
        )}

        {analysis && analysis.error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {analysis.message}
          </div>
        )}
      </div>
    </div>
  );
}