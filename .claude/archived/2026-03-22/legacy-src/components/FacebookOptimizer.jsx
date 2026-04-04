import React, { useState } from 'react';
import { optimizerAPI } from '../api/optimizerAPI.js';

export default function FacebookOptimizer() {
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [postType, setPostType] = useState('text');

  const analyzeContent = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const result = await optimizerAPI.analyzeContent('facebook', content, {
        postType,
        includeHashtags: true,
        includeTiming: true
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
    if (score >= 80) return '#1877F2';
    if (score >= 60) return '#42B883';
    return '#FF5252';
  };

  return (
    <div className="optimizer-container facebook-optimizer">
      <div className="optimizer-header">
        <h2>
          <i className="fab fa-facebook"></i>
          Facebook Content Optimizer
        </h2>
        <p>Maximize your Facebook reach and engagement</p>
      </div>

      <div className="optimizer-content">
        <div className="input-section">
          <div className="post-type-selector">
            <label>Post Type:</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="text"
                  checked={postType === 'text'}
                  onChange={(e) => setPostType(e.target.value)}
                />
                Text Only
              </label>
              <label>
                <input
                  type="radio"
                  value="image"
                  checked={postType === 'image'}
                  onChange={(e) => setPostType(e.target.value)}
                />
                With Image
              </label>
              <label>
                <input
                  type="radio"
                  value="video"
                  checked={postType === 'video'}
                  onChange={(e) => setPostType(e.target.value)}
                />
                With Video
              </label>
              <label>
                <input
                  type="radio"
                  value="link"
                  checked={postType === 'link'}
                  onChange={(e) => setPostType(e.target.value)}
                />
                With Link
              </label>
            </div>
          </div>

          <label htmlFor="content">Your Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Write your Facebook post here..."
            rows="8"
            maxLength="63206"
          />
          <div className="char-count">
            {content.length} characters
            {content.length > 500 && <span className="warning"> (Consider shorter for better engagement)</span>}
          </div>
          
          <button 
            onClick={analyzeContent} 
            disabled={loading || !content.trim()}
            className="analyze-btn"
          >
            {loading ? 'Analyzing...' : 'Analyze Post'}
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
                <h3>Engagement Score</h3>
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
                <h3>📈 Optimization Tips</h3>
                <ul>
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.bestTiming && (
              <div className="timing-card">
                <h3>⏰ Optimal Posting Schedule</h3>
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
              </div>
            )}

            <div className="engagement-tips-card">
              <h3>💬 Engagement Boosters</h3>
              <div className="tips-grid">
                <div className="tip-item">
                  <i className="fas fa-question-circle"></i>
                  <span>Ask questions to spark conversation</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-video"></i>
                  <span>Native videos get 6x more engagement</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-users"></i>
                  <span>Tag relevant pages and people</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-chart-line"></i>
                  <span>Share valuable insights and data</span>
                </div>
              </div>
            </div>

            <div className="best-practices-card">
              <h3>📚 Facebook Algorithm Tips</h3>
              <ul>
                <li>Keep posts between 40-80 words for optimal engagement</li>
                <li>Avoid external links in initial post (add in comments)</li>
                <li>Respond to comments within the first hour</li>
                <li>Use Facebook native video for 10x more reach</li>
                <li>Post when your audience is most active</li>
                <li>Create meaningful interactions, not just likes</li>
                <li>Avoid engagement bait and clickbait</li>
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