import React, { useState } from 'react';
import { optimizerAPI } from '../api/optimizerAPI.js';

export default function TwitterOptimizer() {
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isThread, setIsThread] = useState(false);
  const [tweets, setTweets] = useState(['']);

  const analyzeContent = async () => {
    const textToAnalyze = isThread ? tweets.join(' ') : content;
    if (!textToAnalyze.trim()) return;
    
    setLoading(true);
    try {
      const result = await optimizerAPI.analyzeContent('twitter', textToAnalyze, {
        isThread,
        tweetCount: tweets.length
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

  const addTweet = () => {
    setTweets([...tweets, '']);
  };

  const updateTweet = (index, value) => {
    const newTweets = [...tweets];
    newTweets[index] = value;
    setTweets(newTweets);
  };

  const removeTweet = (index) => {
    if (tweets.length > 1) {
      const newTweets = tweets.filter((_, i) => i !== index);
      setTweets(newTweets);
    }
  };

  const getCharColor = (length) => {
    if (length > 280) return '#FF5252';
    if (length > 240) return '#FFC107';
    return '#4CAF50';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#1DA1F2';
    if (score >= 60) return '#17BF63';
    return '#E1444D';
  };

  return (
    <div className="optimizer-container twitter-optimizer">
      <div className="optimizer-header">
        <h2>
          <i className="fab fa-twitter"></i>
          Twitter/X Content Optimizer
        </h2>
        <p>Craft viral tweets and engaging threads</p>
      </div>

      <div className="optimizer-content">
        <div className="input-section">
          <div className="tweet-type-selector">
            <button
              className={`type-btn ${!isThread ? 'active' : ''}`}
              onClick={() => setIsThread(false)}
            >
              Single Tweet
            </button>
            <button
              className={`type-btn ${isThread ? 'active' : ''}`}
              onClick={() => setIsThread(true)}
            >
              Thread
            </button>
          </div>

          {!isThread ? (
            <>
              <label htmlFor="content">Your Tweet</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                rows="4"
                maxLength="280"
              />
              <div className="char-count" style={{ color: getCharColor(content.length) }}>
                {content.length} / 280
                {content.length > 240 && (
                  <span className="warning"> (Leave room for retweets)</span>
                )}
              </div>
            </>
          ) : (
            <>
              <label>Your Thread</label>
              {tweets.map((tweet, index) => (
                <div key={index} className="thread-tweet">
                  <div className="tweet-number">{index + 1}.</div>
                  <textarea
                    value={tweet}
                    onChange={(e) => updateTweet(index, e.target.value)}
                    placeholder={index === 0 ? "Start your thread..." : "Continue thread..."}
                    rows="3"
                    maxLength="280"
                  />
                  <div className="tweet-controls">
                    <span className="char-count" style={{ color: getCharColor(tweet.length) }}>
                      {tweet.length}/280
                    </span>
                    {tweets.length > 1 && (
                      <button
                        className="remove-tweet"
                        onClick={() => removeTweet(index)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button className="add-tweet-btn" onClick={addTweet}>
                <i className="fas fa-plus"></i> Add Tweet
              </button>
            </>
          )}
          
          <button 
            onClick={analyzeContent} 
            disabled={loading || (!content.trim() && !tweets.some(t => t.trim()))}
            className="analyze-btn"
          >
            {loading ? 'Analyzing...' : 'Analyze Tweet'}
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
                <h3>Virality Score</h3>
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
                <h3>🚀 Optimization Tips</h3>
                <ul>
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.hashtags && analysis.hashtags.length > 0 && (
              <div className="hashtags-card">
                <h3># Trending Hashtags</h3>
                <div className="hashtags-container">
                  {analysis.hashtags.map((tag, index) => (
                    <span key={index} className="hashtag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analysis.bestTiming && (
              <div className="timing-card">
                <h3>⏰ Best Times to Tweet</h3>
                <div className="timing-grid">
                  <div className="timing-item">
                    <span className="timing-label">Peak Days:</span>
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

            <div className="twitter-tips-card">
              <h3>🐦 Twitter Engagement Hacks</h3>
              <div className="tips-grid">
                <div className="tip-item">
                  <i className="fas fa-retweet"></i>
                  <span>Tweet same content 3-4x at different times</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-image"></i>
                  <span>Tweets with images get 2x engagement</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-comments"></i>
                  <span>Threads get 63% more engagement</span>
                </div>
                <div className="tip-item">
                  <i className="fas fa-poll"></i>
                  <span>Use polls to boost interactions</span>
                </div>
              </div>
            </div>

            <div className="best-practices-card">
              <h3>📚 Twitter Best Practices</h3>
              <ul>
                <li>Keep tweets between 71-100 characters for 17% more engagement</li>
                <li>Use 1-2 hashtags maximum (more reduces engagement)</li>
                <li>Include a clear call-to-action</li>
                <li>Tweet 3-7 times per day for optimal reach</li>
                <li>Engage with replies within 1 hour</li>
                <li>Use emojis strategically (but not too many)</li>
                <li>Share valuable insights, not just promotions</li>
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