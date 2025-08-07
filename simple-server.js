const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'development'
  });
});

// Mock Authentication
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple mock validation
  if (email && password) {
    res.json({
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 1,
        email: email,
        name: email.split('@')[0],
        role: 'user'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  
  if (email && password) {
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: Date.now(),
        email: email,
        name: name || email.split('@')[0]
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
});

// Mock Dashboard Data
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalCampaigns: 12,
      activePosts: 45,
      engagement: 3250,
      growth: 15.7,
      recentActivity: [
        { type: 'post', platform: 'Twitter', time: '2 hours ago' },
        { type: 'campaign', name: 'Summer Sale', time: '5 hours ago' },
        { type: 'analytics', metric: 'engagement', value: '+12%', time: '1 day ago' }
      ]
    }
  });
});

// Mock Campaigns
app.get('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Product Launch 2024',
        status: 'active',
        platforms: ['Twitter', 'LinkedIn', 'Facebook'],
        posts: 15,
        engagement: 1250
      },
      {
        id: 2,
        name: 'Holiday Season',
        status: 'scheduled',
        platforms: ['Instagram', 'TikTok'],
        posts: 8,
        engagement: 0
      }
    ]
  });
});

// Mock Content Creation
app.post('/api/content/generate', (req, res) => {
  const { prompt, platform } = req.body;
  
  res.json({
    success: true,
    data: {
      content: `Generated content for ${platform}: ${prompt}`,
      suggestions: [
        'Add relevant hashtags',
        'Include a call-to-action',
        'Use engaging visuals'
      ],
      preview: {
        text: `Here's your AI-generated content for ${platform}. This is a mock response but demonstrates the API is working!`,
        hashtags: ['#AI', '#Marketing', '#Automation'],
        estimatedReach: Math.floor(Math.random() * 10000)
      }
    }
  });
});

// Default route - serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-unified.html'));
});

// Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-unified.html'));
});

// Catch all - serve index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 SYNTHEX Server Running!
  ============================
  Local: http://localhost:${PORT}
  Dashboard: http://localhost:${PORT}/dashboard
  Login: http://localhost:${PORT}/login
  API Health: http://localhost:${PORT}/api/health
  ============================
  `);
});