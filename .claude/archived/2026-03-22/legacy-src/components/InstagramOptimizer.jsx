import React, { useState } from 'react';
import { optimizerAPI } from '../api/optimizerAPI.js';

export default function InstagramOptimizer() {
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeContent = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const result = await optimizerAPI.analyzeContent('instagram', content);
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    return '#FF5252';
  };

  return (
    <div className="optimizer-container instagram-optimizer">
      <div className="optimizer-header">
        <h2>
          <i className="fab fa-instagram"></i>
          Instagram Content Optimizer
        </h2>
        <p>Optimize your Instagram posts for maximum engagement</p>
      </div>

      <div className="optimizer-content">
        <div className="input-section">
          <label htmlFor="content">Your Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your Instagram caption here..."
            rows="6"
            maxLength="2200"
          />
          <div className="char-count">
            {content.length} / 2200 characters
          </div>
          
          <button 
            onClick={analyzeContent} 
            disabled={loading || !content.trim()}
            className="analyze-btn"
          >
            {loading ? 'Analyzing...' : 'Analyze Content'}
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
                <h3>Optimization Score</h3>
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
                <h3>💡 Suggestions</h3>
                <ul>
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.hashtags && analysis.hashtags.length > 0 && (
              <div className="hashtags-card">
                <h3># Recommended Hashtags</h3>
                <div className="hashtags-container">
                  {analysis.hashtags.map((tag, index) => (
                    <span 
                      key={index} 
                      className="hashtag"
                      onClick={() => copyToClipboard(tag)}
                      title="Click to copy"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button 
                  className="copy-all-btn"
                  onClick={() => copyToClipboard(analysis.hashtags.join(' '))}
                >
                  {copied ? '✓ Copied!' : 'Copy All Hashtags'}
                </button>
              </div>
            )}

            {analysis.bestTiming && (
              <div className="timing-card">
                <h3>⏰ Best Posting Times</h3>
                <div className="timing-grid">
                  <div className="timing-item">
                    <span className="timing-label">Days:</span>
                    <span className="timing-value">
                      {analysis.bestTiming.days.join(', ')}
                    </span>
                  </div>
                  <div className="timing-item">
                    <span className="timing-label">Hours:</span>
                    <span className="timing-value">
                      {analysis.bestTiming.hours.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="best-practices-card">
              <h3>📚 Instagram Best Practices</h3>
              <ul>
                <li>Use 10-30 relevant hashtags for maximum reach</li>
                <li>Keep captions between 125-150 words</li>
                <li>Include a call-to-action (CTA)</li>
                <li>Use emojis to increase engagement by 48%</li>
                <li>Post consistently at optimal times</li>
                <li>Engage with comments within the first hour</li>
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