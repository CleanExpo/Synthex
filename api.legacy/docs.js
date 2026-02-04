/**
 * API Documentation Generator
 * Auto-generates comprehensive API documentation
 */

import fs from 'fs';
import path from 'path';

// API Documentation Configuration
const API_CONFIG = {
  title: 'Synthex Marketing API',
  version: '1.0.0',
  description: 'Comprehensive API for AI-powered social media marketing automation',
  baseUrl: process.env.NODE_ENV === 'production' ? 'https://synthex.social' : 'http://localhost:3000',
  contact: {
    name: 'Synthex Support',
    email: 'support@synthex.social',
    url: 'https://synthex.social/support'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  }
};

// API Endpoints Documentation
const API_ENDPOINTS = {
  '/api/ai': {
    methods: ['POST'],
    summary: 'AI Content Generation and Optimization',
    description: 'Handles AI-powered content generation, optimization, and analysis',
    authentication: 'Bearer Token Required',
    rateLimit: '50 requests per minute',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['optimize', 'generate-hashtags', 'generate-ideas', 'analyze'],
        description: 'Type of AI operation to perform'
      },
      platform: {
        type: 'string',
        required: true,
        enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'pinterest', 'youtube', 'reddit'],
        description: 'Target social media platform'
      },
      content: {
        type: 'string',
        required: true,
        maxLength: 10000,
        description: 'Content to optimize or analyze'
      },
      options: {
        type: 'object',
        required: false,
        properties: {
          save: { type: 'boolean', description: 'Save optimized content to database' },
          tone: { type: 'string', enum: ['casual', 'professional', 'humorous', 'serious'] },
          audience: { type: 'string', description: 'Target audience description' }
        }
      }
    },
    responses: {
      200: {
        description: 'AI operation completed successfully',
        example: {
          success: true,
          data: {
            optimizedContent: 'Your optimized content here...',
            hashtags: ['#marketing', '#ai', '#socialmedia'],
            suggestions: ['Add more emojis', 'Include call-to-action'],
            score: 85
          },
          creditsRemaining: 95
        }
      },
      401: { description: 'Authentication required' },
      429: { description: 'Rate limit exceeded' },
      500: { description: 'AI processing failed' }
    }
  },

  '/api/email': {
    methods: ['POST', 'GET'],
    summary: 'Email Service Management',
    description: 'Send emails and manage email queue status',
    authentication: 'Optional for GET, Required for POST',
    rateLimit: '100 requests per hour',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: ['welcome', 'password-reset', 'notification', 'custom'],
        description: 'Type of email to send'
      },
      userEmail: {
        type: 'string',
        format: 'email',
        required: true,
        description: 'Recipient email address'
      },
      userName: {
        type: 'string',
        required: true,
        description: 'Recipient name'
      },
      title: {
        type: 'string',
        required: false,
        description: 'Email title (for notifications)'
      },
      content: {
        type: 'string',
        required: false,
        description: 'Email content (for notifications and custom emails)'
      }
    },
    responses: {
      200: {
        description: 'Email sent successfully',
        example: {
          success: true,
          messageId: '<20231215123456.1.abc@synthex.social>',
          message: 'Email sent successfully'
        }
      },
      400: { description: 'Invalid email type or missing parameters' },
      500: { description: 'Email service failed' }
    }
  },

  '/api/metrics': {
    methods: ['GET'],
    summary: 'System Metrics and Analytics',
    description: 'Real-time system performance and user analytics',
    authentication: 'Optional (some data requires auth)',
    rateLimit: '1000 requests per hour',
    parameters: {
      type: {
        type: 'string',
        required: false,
        enum: ['all', 'system', 'users', 'content', 'performance'],
        default: 'all',
        description: 'Type of metrics to retrieve'
      },
      timeframe: {
        type: 'string',
        required: false,
        enum: ['1h', '6h', '24h', '7d', '30d'],
        default: '24h',
        description: 'Time range for metrics'
      }
    },
    responses: {
      200: {
        description: 'Metrics retrieved successfully',
        example: {
          system: {
            uptime: 86400,
            requestCount: 1234,
            errorRate: 0.12,
            activeUsers: 45
          },
          users: {
            total: 1234,
            active: 567,
            new: 89,
            growth: 15.2
          },
          performance: {
            avgResponseTime: 245,
            errorRates: { rate: 0.12, total: 15 },
            throughput: { requestsPerSecond: 12.5 }
          },
          timestamp: 1671123456789
        }
      },
      500: { description: 'Failed to fetch metrics' }
    }
  },

  '/api/auth/login': {
    methods: ['POST'],
    summary: 'User Authentication',
    description: 'Authenticate users and create sessions',
    authentication: 'None',
    rateLimit: '10 requests per minute per IP',
    parameters: {
      email: {
        type: 'string',
        format: 'email',
        required: true,
        description: 'User email address'
      },
      password: {
        type: 'string',
        required: true,
        minLength: 6,
        description: 'User password'
      },
      rememberMe: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Extend session duration'
      }
    },
    responses: {
      200: {
        description: 'Login successful',
        example: {
          success: true,
          user: {
            id: 'user_123',
            email: 'user@example.com',
            name: 'John Doe',
            plan: 'pro'
          },
          token: 'eyJhbGciOiJIUzI1NiIs...',
          expiresAt: '2023-12-16T12:34:56Z'
        }
      },
      401: { description: 'Invalid credentials' },
      429: { description: 'Too many login attempts' }
    }
  },

  '/api/optimize/:platform': {
    methods: ['POST'],
    summary: 'Platform-Specific Optimization',
    description: 'Optimize content for specific social media platforms',
    authentication: 'Bearer Token Required',
    rateLimit: '20 requests per minute',
    parameters: {
      platform: {
        type: 'string',
        required: true,
        in: 'path',
        enum: ['instagram', 'facebook', 'twitter', 'linkedin'],
        description: 'Social media platform'
      },
      content: {
        type: 'string',
        required: true,
        maxLength: 5000,
        description: 'Content to optimize'
      },
      options: {
        type: 'object',
        required: false,
        properties: {
          includeHashtags: { type: 'boolean', default: true },
          tone: { type: 'string', enum: ['casual', 'professional'] },
          maxLength: { type: 'number', description: 'Maximum content length' }
        }
      }
    },
    responses: {
      200: {
        description: 'Content optimized successfully',
        example: {
          success: true,
          optimizedContent: 'Your optimized content...',
          hashtags: ['#marketing', '#growth'],
          metrics: {
            engagementScore: 8.5,
            readabilityScore: 7.2,
            sentimentScore: 0.8
          },
          suggestions: [
            'Consider adding more visual elements',
            'Include a call-to-action'
          ]
        }
      },
      400: { description: 'Invalid platform or content' },
      401: { description: 'Authentication required' }
    }
  },

  '/api/health': {
    methods: ['GET'],
    summary: 'System Health Check',
    description: 'Check the health status of all system components',
    authentication: 'None',
    rateLimit: 'No limit',
    parameters: {},
    responses: {
      200: {
        description: 'System health status',
        example: {
          status: 'healthy',
          timestamp: '2023-12-15T12:34:56Z',
          services: {
            database: { status: 'healthy', responseTime: 45 },
            redis: { status: 'healthy', responseTime: 12 },
            ai: { status: 'healthy', responseTime: 234 },
            email: { status: 'healthy', queue: 3 }
          },
          uptime: 86400,
          version: '1.0.0'
        }
      },
      503: { description: 'Service unhealthy' }
    }
  }
};

// Error Codes Documentation
const ERROR_CODES = {
  'AUTH_001': 'Invalid authentication token',
  'AUTH_002': 'Token expired',
  'AUTH_003': 'Insufficient permissions',
  'RATE_001': 'Rate limit exceeded',
  'RATE_002': 'Daily quota exceeded',
  'AI_001': 'AI service unavailable',
  'AI_002': 'Content too long for processing',
  'AI_003': 'Unsupported platform',
  'EMAIL_001': 'Invalid email address',
  'EMAIL_002': 'Email service unavailable',
  'DB_001': 'Database connection error',
  'DB_002': 'Query timeout',
  'SYS_001': 'Internal server error',
  'SYS_002': 'Service temporarily unavailable'
};

// Rate Limiting Documentation
const RATE_LIMITS = {
  'Free Plan': {
    '/api/ai': '10 requests per hour',
    '/api/optimize/*': '20 requests per hour',
    '/api/email': '5 requests per day',
    '/api/metrics': '100 requests per hour'
  },
  'Pro Plan': {
    '/api/ai': '100 requests per hour',
    '/api/optimize/*': '200 requests per hour',
    '/api/email': '50 requests per day',
    '/api/metrics': '1000 requests per hour'
  },
  'Enterprise Plan': {
    '/api/ai': '1000 requests per hour',
    '/api/optimize/*': '2000 requests per hour',
    '/api/email': '500 requests per day',
    '/api/metrics': 'Unlimited'
  }
};

// Generate HTML documentation
export function generateHTMLDocs() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${API_CONFIG.title} - Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 40px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .nav {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .nav ul {
            list-style: none;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .nav a {
            color: #6366f1;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        
        .nav a:hover {
            background-color: #f1f5f9;
        }
        
        .section {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .section h2 {
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .endpoint {
            margin-bottom: 40px;
            padding: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        
        .endpoint h3 {
            color: #1e293b;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .method {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        .method.post { background-color: #10b981; color: white; }
        .method.get { background-color: #06b6d4; color: white; }
        .method.put { background-color: #f59e0b; color: white; }
        .method.delete { background-color: #ef4444; color: white; }
        
        .params, .responses {
            margin-top: 15px;
        }
        
        .param, .response {
            margin: 10px 0;
            padding: 10px;
            background-color: #f8fafc;
            border-radius: 5px;
        }
        
        .param-name, .response-code {
            font-weight: bold;
            color: #6366f1;
        }
        
        .param-type {
            color: #64748b;
            font-style: italic;
        }
        
        .required {
            color: #ef4444;
            font-size: 0.9rem;
        }
        
        pre {
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 10px 0;
        }
        
        code {
            background-color: #e2e8f0;
            color: #1e293b;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        
        .rate-limit-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .rate-limit-table th,
        .rate-limit-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .rate-limit-table th {
            background-color: #f1f5f9;
            font-weight: bold;
        }
        
        .error-code {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            margin: 5px 0;
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            border-radius: 4px;
        }
        
        @media (max-width: 768px) {
            .nav ul {
                flex-direction: column;
            }
            
            .endpoint h3 {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${API_CONFIG.title}</h1>
            <p>${API_CONFIG.description}</p>
            <p>Version ${API_CONFIG.version} | Base URL: <code>${API_CONFIG.baseUrl}</code></p>
        </div>
        
        <nav class="nav">
            <ul>
                <li><a href="#authentication">Authentication</a></li>
                <li><a href="#endpoints">API Endpoints</a></li>
                <li><a href="#rate-limits">Rate Limits</a></li>
                <li><a href="#error-codes">Error Codes</a></li>
                <li><a href="#examples">Examples</a></li>
            </ul>
        </nav>
        
        <section id="authentication" class="section">
            <h2>Authentication</h2>
            <p>Most API endpoints require authentication using a Bearer token. Include the token in the Authorization header:</p>
            <pre>Authorization: Bearer YOUR_API_TOKEN</pre>
            <p>To obtain an API token, login via the <code>/api/auth/login</code> endpoint or generate one in your dashboard.</p>
        </section>
        
        <section id="endpoints" class="section">
            <h2>API Endpoints</h2>
            ${Object.entries(API_ENDPOINTS).map(([path, config]) => `
                <div class="endpoint">
                    <h3>
                        ${config.methods.map(method => `<span class="method ${method.toLowerCase()}">${method}</span>`).join('')}
                        <code>${path}</code>
                    </h3>
                    <p><strong>${config.summary}</strong></p>
                    <p>${config.description}</p>
                    <p><strong>Authentication:</strong> ${config.authentication}</p>
                    <p><strong>Rate Limit:</strong> ${config.rateLimit}</p>
                    
                    ${Object.keys(config.parameters).length > 0 ? `
                        <div class="params">
                            <h4>Parameters</h4>
                            ${Object.entries(config.parameters).map(([name, param]) => `
                                <div class="param">
                                    <span class="param-name">${name}</span>
                                    ${param.required ? '<span class="required">*required</span>' : ''}
                                    <span class="param-type">(${param.type})</span>
                                    <p>${param.description}</p>
                                    ${param.enum ? `<p><strong>Values:</strong> ${param.enum.join(', ')}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="responses">
                        <h4>Responses</h4>
                        ${Object.entries(config.responses).map(([code, response]) => `
                            <div class="response">
                                <span class="response-code">${code}</span>
                                <p>${response.description}</p>
                                ${response.example ? `<pre>${JSON.stringify(response.example, null, 2)}</pre>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </section>
        
        <section id="rate-limits" class="section">
            <h2>Rate Limits</h2>
            <p>API usage is limited based on your plan tier:</p>
            <table class="rate-limit-table">
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Free Plan</th>
                        <th>Pro Plan</th>
                        <th>Enterprise Plan</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(RATE_LIMITS['Free Plan']).map(endpoint => `
                        <tr>
                            <td><code>${endpoint}</code></td>
                            <td>${RATE_LIMITS['Free Plan'][endpoint]}</td>
                            <td>${RATE_LIMITS['Pro Plan'][endpoint]}</td>
                            <td>${RATE_LIMITS['Enterprise Plan'][endpoint]}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </section>
        
        <section id="error-codes" class="section">
            <h2>Error Codes</h2>
            <p>Standard HTTP status codes are used, along with specific error codes:</p>
            ${Object.entries(ERROR_CODES).map(([code, description]) => `
                <div class="error-code">
                    <strong>${code}</strong>
                    <span>${description}</span>
                </div>
            `).join('')}
        </section>
        
        <section id="examples" class="section">
            <h2>Usage Examples</h2>
            
            <h3>JavaScript/Fetch</h3>
            <pre>// Optimize content for Instagram
const response = await fetch('${API_CONFIG.baseUrl}/api/ai', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    action: 'optimize',
    platform: 'instagram',
    content: 'Check out our new product!',
    options: { save: true, tone: 'casual' }
  })
});

const result = await response.json();
console.log(result.data.optimizedContent);</pre>

            <h3>cURL</h3>
            <pre>curl -X POST "${API_CONFIG.baseUrl}/api/ai" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "action": "optimize",
    "platform": "instagram",
    "content": "Check out our new product!"
  }'</pre>

            <h3>Python</h3>
            <pre>import requests

url = "${API_CONFIG.baseUrl}/api/ai"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN"
}
data = {
    "action": "optimize",
    "platform": "instagram",
    "content": "Check out our new product!"
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result["data"]["optimizedContent"])</pre>
        </section>
        
        <footer class="section">
            <h2>Support</h2>
            <p>For API support, contact us at <a href="mailto:${API_CONFIG.contact.email}">${API_CONFIG.contact.email}</a></p>
            <p>Documentation last updated: ${new Date().toLocaleDateString()}</p>
        </footer>
    </div>
</body>
</html>`;

  return html;
}

// Generate OpenAPI/Swagger specification
export function generateOpenAPISpec() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: API_CONFIG.title,
      version: API_CONFIG.version,
      description: API_CONFIG.description,
      contact: API_CONFIG.contact,
      license: API_CONFIG.license
    },
    servers: [
      {
        url: API_CONFIG.baseUrl,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        }
      }
    }
  };

  // Convert our endpoint documentation to OpenAPI format
  Object.entries(API_ENDPOINTS).forEach(([path, config]) => {
    spec.paths[path] = {};
    
    config.methods.forEach(method => {
      spec.paths[path][method.toLowerCase()] = {
        summary: config.summary,
        description: config.description,
        security: config.authentication.includes('Required') ? [{ bearerAuth: [] }] : [],
        parameters: Object.entries(config.parameters).map(([name, param]) => ({
          name,
          in: param.in || 'body',
          required: param.required,
          schema: {
            type: param.type,
            enum: param.enum,
            maxLength: param.maxLength,
            minLength: param.minLength
          },
          description: param.description
        })),
        responses: Object.fromEntries(
          Object.entries(config.responses).map(([code, response]) => [
            code,
            {
              description: response.description,
              content: response.example ? {
                'application/json': {
                  example: response.example
                }
              } : undefined
            }
          ])
        )
      };
    });
  });

  return spec;
}

// Main documentation handler
export default async function handler(req, res) {
  const { format = 'html' } = req.query;

  try {
    switch (format) {
      case 'html':
        res.setHeader('Content-Type', 'text/html');
        res.send(generateHTMLDocs());
        break;
        
      case 'json':
      case 'openapi':
        res.setHeader('Content-Type', 'application/json');
        res.json(generateOpenAPISpec());
        break;
        
      case 'markdown':
        res.setHeader('Content-Type', 'text/plain');
        res.send(generateMarkdownDocs());
        break;
        
      default:
        res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (error) {
    console.error('Documentation generation error:', error);
    res.status(500).json({ error: 'Failed to generate documentation' });
  }
}

// Generate Markdown documentation
function generateMarkdownDocs() {
  const markdown = `
# ${API_CONFIG.title}

${API_CONFIG.description}

**Version:** ${API_CONFIG.version}  
**Base URL:** ${API_CONFIG.baseUrl}

## Authentication

Most API endpoints require authentication using a Bearer token:

\`\`\`
Authorization: Bearer YOUR_API_TOKEN
\`\`\`

## API Endpoints

${Object.entries(API_ENDPOINTS).map(([path, config]) => `
### ${config.methods.join(', ')} ${path}

**${config.summary}**

${config.description}

**Authentication:** ${config.authentication}  
**Rate Limit:** ${config.rateLimit}

#### Parameters

${Object.entries(config.parameters).map(([name, param]) => 
  `- **${name}** (${param.type})${param.required ? ' *required*' : ''}: ${param.description}`
).join('\n')}

#### Responses

${Object.entries(config.responses).map(([code, response]) => 
  `- **${code}**: ${response.description}`
).join('\n')}

`).join('')}

## Error Codes

${Object.entries(ERROR_CODES).map(([code, description]) => 
  `- **${code}**: ${description}`
).join('\n')}

## Rate Limits

### Free Plan
${Object.entries(RATE_LIMITS['Free Plan']).map(([endpoint, limit]) => 
  `- ${endpoint}: ${limit}`
).join('\n')}

### Pro Plan
${Object.entries(RATE_LIMITS['Pro Plan']).map(([endpoint, limit]) => 
  `- ${endpoint}: ${limit}`
).join('\n')}

### Enterprise Plan
${Object.entries(RATE_LIMITS['Enterprise Plan']).map(([endpoint, limit]) => 
  `- ${endpoint}: ${limit}`
).join('\n')}

## Support

For API support, contact us at ${API_CONFIG.contact.email}

---
Documentation generated on ${new Date().toLocaleDateString()}
`;

  return markdown;
}

// Export configuration for external use
export { API_CONFIG, API_ENDPOINTS, ERROR_CODES, RATE_LIMITS };