const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = 3002;

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.url === '/') {
    // Serve index.html
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>SYNTHEX - Working!</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255,255,255,0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            h1 { font-size: 3rem; margin-bottom: 1rem; }
            p { font-size: 1.2rem; opacity: 0.9; }
            .status { 
              display: inline-block;
              padding: 0.5rem 1rem;
              background: #10b981;
              border-radius: 50px;
              margin-top: 1rem;
            }
            a {
              display: inline-block;
              margin-top: 2rem;
              padding: 1rem 2rem;
              background: white;
              color: #764ba2;
              text-decoration: none;
              border-radius: 10px;
              font-weight: 600;
              transition: transform 0.2s;
            }
            a:hover { transform: translateY(-2px); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 SYNTHEX</h1>
            <p>Marketing Automation Platform</p>
            <div class="status">✅ Server Running</div>
            <br>
            <a href="/login">Go to Login</a>
          </div>
        </body>
        </html>
      `);
    }
  } else if (req.url === '/login') {
    const loginPath = path.join(__dirname, 'public', 'login-unified.html');
    if (fs.existsSync(loginPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(loginPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Login Page</h1><p>Login functionality coming soon!</p>');
    }
  } else if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'SYNTHEX Test Server'
    }));
  } else if (req.url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: 1,
          email: 'user@synthex.com',
          name: 'Test User'
        }
      }));
    });
  } else if (req.url === '/api/auth/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Registration successful',
        user: {
          id: Date.now(),
          email: 'newuser@synthex.com'
        }
      }));
    });
  } else if (req.url === '/api/dashboard/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        totalCampaigns: 12,
        activePosts: 45,
        engagement: 3250,
        growth: 15.7
      }
    }));
  } else if (req.url === '/api/campaigns') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: [
        {
          id: 1,
          name: 'Product Launch 2024',
          status: 'active',
          platforms: ['Twitter', 'LinkedIn'],
          posts: 15
        }
      ]
    }));
  } else if (req.url === '/api/content/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        content: 'AI-generated content here',
        suggestions: ['Add hashtags', 'Include CTA']
      }));
    });
  } else if (req.url === '/api/v1/campaigns/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total: 25,
      active: 8,
      scheduled: 10,
      completed: 7
    }));
  } else if (req.url.startsWith('/api/v1/dashboard/metrics')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      impressions: 125000,
      engagement: 8750,
      clicks: 3420,
      conversions: 234
    }));
  } else if (req.url === '/api/v1/dashboard/activity') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activities: [
        { type: 'post', platform: 'Twitter', time: '2 hours ago' },
        { type: 'campaign', name: 'Summer Sale', time: '5 hours ago' }
      ]
    }));
  } else if (req.url === '/docs') {
    const docsPath = path.join(__dirname, 'public', 'docs.html');
    if (fs.existsSync(docsPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(docsPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Documentation not found');
    }
  } else if (req.url === '/privacy') {
    const privacyPath = path.join(__dirname, 'public', 'privacy.html');
    if (fs.existsSync(privacyPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(privacyPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Privacy Policy</h1><p>Privacy policy coming soon.</p>');
    }
  } else if (req.url === '/terms') {
    const termsPath = path.join(__dirname, 'public', 'terms.html');
    if (fs.existsSync(termsPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(termsPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Terms of Service</h1><p>Terms coming soon.</p>');
    }
  } else if (req.url === '/support') {
    const supportPath = path.join(__dirname, 'public', 'support.html');
    if (fs.existsSync(supportPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(supportPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Support</h1><p>Contact support@synthex.ai</p>');
    }
  } else if (req.url === '/blog') {
    const blogPath = path.join(__dirname, 'public', 'blog.html');
    if (fs.existsSync(blogPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(blogPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Blog</h1><p>Blog posts coming soon.</p>');
    }
  } else if (req.url === '/dashboard' || req.url === '/dashboard.html') {
    const dashboardPath = path.join(__dirname, 'public', 'dashboard-unified.html');
    if (fs.existsSync(dashboardPath)) {
      res.setHeader('Content-Type', 'text/html');
      fs.createReadStream(dashboardPath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Dashboard</h1><p>Dashboard coming soon!</p>');
    }
  } else {
    // Serve static files
    let filePath = path.join(__dirname, 'public', req.url);
    
    // Security check
    if (!filePath.startsWith(path.join(__dirname, 'public'))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif'
      }[ext] || 'text/plain';
      
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`
  ✨ SYNTHEX Test Server Running!
  ================================
  Local: http://localhost:${PORT}
  Login: http://localhost:${PORT}/login
  API: http://localhost:${PORT}/api/health
  ================================
  Press Ctrl+C to stop
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});