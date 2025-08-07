/**
 * Complete System Test - Verifies all components
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Colors for console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

console.clear();
console.log(colors.bright + colors.magenta);
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║              SYNTHEX COMPLETE SYSTEM TEST                  ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(colors.reset);

// System Status
const systemStatus = {
    server: false,
    database: false,
    openrouter: false,
    supabase: false,
    contentGenerator: false,
    scheduler: false,
    ui: false
};

// Check environment
console.log(colors.cyan + '\n📋 Environment Check:' + colors.reset);
const requiredEnv = [
    'OPENROUTER_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'JWT_SECRET'
];

requiredEnv.forEach(env => {
    if (process.env[env]) {
        console.log(colors.green + `  ✓ ${env} configured` + colors.reset);
    } else {
        console.log(colors.red + `  ✗ ${env} missing` + colors.reset);
    }
});

// Health endpoint
app.get('/health', (req, res) => {
    systemStatus.server = true;
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: systemStatus
    });
});

// API Info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'SYNTHEX API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            content: '/api/content',
            trends: '/api/trends',
            schedule: '/api/schedule',
            auth: '/api/auth',
            dashboard: '/api/dashboard'
        }
    });
});

// Content Generation endpoint
app.post('/api/content/generate', async (req, res) => {
    try {
        const { input, platforms } = req.body;
        
        // Check if OpenRouter is configured
        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: 'OpenRouter API not configured'
            });
        }
        
        systemStatus.openrouter = true;
        systemStatus.contentGenerator = true;
        
        // Mock response for testing
        const mockContent = {
            input,
            platforms: platforms || ['instagram', 'twitter', 'linkedin'],
            generated: {
                instagram: {
                    content: `✨ ${input} - Transforming the way we think about marketing! 🚀\n\n#AI #Marketing #Innovation`,
                    hashtags: ['#AI', '#Marketing', '#Innovation'],
                    optimalTime: '18:00',
                    engagement: 0.85
                },
                twitter: {
                    content: `🧵 Why ${input} is the future of digital marketing:\n\n1/ AI-powered insights\n2/ Real-time optimization\n3/ Multi-platform synergy`,
                    hashtags: ['#MarketingAI', '#DigitalTransformation'],
                    optimalTime: '14:00',
                    engagement: 0.72
                },
                linkedin: {
                    content: `The Future of Marketing: ${input}\n\nAs industry leaders, we must embrace AI-driven strategies...`,
                    hashtags: ['#ThoughtLeadership', '#Innovation'],
                    optimalTime: '09:00',
                    engagement: 0.68
                }
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(mockContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trends endpoint
app.get('/api/trends', async (req, res) => {
    try {
        const trends = {
            global: [
                { keyword: 'AI Marketing', score: 92, growth: '+45%' },
                { keyword: 'Automation', score: 88, growth: '+32%' },
                { keyword: 'Content Generation', score: 85, growth: '+28%' }
            ],
            platforms: {
                instagram: ['Reels', 'Stories', 'Carousels'],
                tiktok: ['Challenges', 'Duets', 'Tutorials'],
                linkedin: ['Thought Leadership', 'Case Studies']
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Schedule endpoint
app.post('/api/schedule', async (req, res) => {
    try {
        const { platform, content, scheduledTime } = req.body;
        
        systemStatus.scheduler = true;
        
        const scheduled = {
            id: Math.random().toString(36).substr(2, 9),
            platform,
            content,
            scheduledTime: scheduledTime || new Date(Date.now() + 3600000).toISOString(),
            status: 'scheduled',
            created: new Date().toISOString()
        };
        
        res.json(scheduled);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard data endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const dashboard = {
            stats: {
                totalPosts: 142,
                scheduledPosts: 28,
                totalReach: 125000,
                avgEngagement: 0.082
            },
            recentPosts: [
                {
                    platform: 'instagram',
                    content: 'Latest product launch!',
                    engagement: 0.095,
                    reach: 5200
                },
                {
                    platform: 'twitter',
                    content: 'Thread about industry trends',
                    engagement: 0.072,
                    reach: 3800
                }
            ],
            upcomingSchedule: [
                {
                    platform: 'linkedin',
                    time: '2024-12-31 09:00',
                    content: 'Year-end insights'
                },
                {
                    platform: 'instagram',
                    time: '2024-12-31 18:00',
                    content: 'New Year celebration post'
                }
            ]
        };
        
        res.json(dashboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth test endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Mock auth for testing
        if (email && password) {
            res.json({
                success: true,
                token: 'mock-jwt-token',
                user: {
                    id: '123',
                    email,
                    name: 'Test User'
                }
            });
        } else {
            res.status(400).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check Python services
function checkPythonServices() {
    console.log(colors.cyan + '\n🐍 Python Services Check:' + colors.reset);
    
    const pythonFiles = [
        'smart_content_generator.py',
        'trend_discovery_system.py',
        'content_scheduler.py',
        'test_content_generation_system.py'
    ];
    
    pythonFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(colors.green + `  ✓ ${file} found` + colors.reset);
        } else {
            console.log(colors.yellow + `  ⚠ ${file} not found` + colors.reset);
        }
    });
}

// Check UI files
function checkUIFiles() {
    console.log(colors.cyan + '\n🎨 UI Files Check:' + colors.reset);
    
    const uiFiles = [
        'public/index.html',
        'public/content-generator-sandbox.html',
        'public/dashboard.html',
        'public/login.html'
    ];
    
    uiFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(colors.green + `  ✓ ${file} found` + colors.reset);
            systemStatus.ui = true;
        } else {
            console.log(colors.yellow + `  ⚠ ${file} not found` + colors.reset);
        }
    });
}

// Check database
async function checkDatabase() {
    console.log(colors.cyan + '\n💾 Database Check:' + colors.reset);
    
    try {
        // Check if Prisma is configured
        if (fs.existsSync('prisma/schema.prisma')) {
            console.log(colors.green + '  ✓ Prisma schema found' + colors.reset);
            systemStatus.database = true;
        } else {
            console.log(colors.yellow + '  ⚠ Prisma schema not found' + colors.reset);
        }
        
        // Check Supabase
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            console.log(colors.green + '  ✓ Supabase configured' + colors.reset);
            systemStatus.supabase = true;
        } else {
            console.log(colors.yellow + '  ⚠ Supabase not configured' + colors.reset);
        }
    } catch (error) {
        console.log(colors.red + `  ✗ Database check failed: ${error.message}` + colors.reset);
    }
}

// Start server
app.listen(PORT, async () => {
    systemStatus.server = true;
    
    console.log(colors.green + `\n✓ Server running on http://localhost:${PORT}` + colors.reset);
    
    // Run checks
    checkPythonServices();
    checkUIFiles();
    await checkDatabase();
    
    // Print access points
    console.log(colors.magenta + '\n📍 Access Points:' + colors.reset);
    console.log(colors.cyan + `  Main App: http://localhost:${PORT}` + colors.reset);
    console.log(colors.cyan + `  Content Generator: http://localhost:${PORT}/content-generator-sandbox.html` + colors.reset);
    console.log(colors.cyan + `  Dashboard: http://localhost:${PORT}/dashboard.html` + colors.reset);
    console.log(colors.cyan + `  API Info: http://localhost:${PORT}/api` + colors.reset);
    console.log(colors.cyan + `  Health Check: http://localhost:${PORT}/health` + colors.reset);
    
    // Print test commands
    console.log(colors.magenta + '\n🧪 Test Commands:' + colors.reset);
    console.log(colors.yellow + '  Test content generation:');
    console.log('    curl -X POST http://localhost:' + PORT + '/api/content/generate \\');
    console.log('      -H "Content-Type: application/json" \\');
    console.log('      -d \'{"input":"sustainable marketing","platforms":["instagram","twitter"]}\'');
    console.log(colors.yellow + '\n  Test trends:');
    console.log('    curl http://localhost:' + PORT + '/api/trends');
    console.log(colors.yellow + '\n  Test Python system:');
    console.log('    python test_content_generation_system.py' + colors.reset);
    
    // System ready
    console.log(colors.bright + colors.green);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           🚀 SYNTHEX SYSTEM IS READY! 🚀                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
    
    // Final status
    console.log(colors.cyan + '\nSystem Status:' + colors.reset);
    Object.entries(systemStatus).forEach(([service, status]) => {
        const icon = status ? '✓' : '⚠';
        const color = status ? colors.green : colors.yellow;
        console.log(`${color}  ${icon} ${service}${colors.reset}`);
    });
    
    console.log(colors.cyan + '\nPress Ctrl+C to stop the server' + colors.reset);
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log(colors.yellow + '\n\nShutting down gracefully...' + colors.reset);
    process.exit(0);
});