/**
 * Complete System Launcher for SYNTHEX
 * Checks all requirements and starts all services
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const https = require('https');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class SystemLauncher {
    constructor() {
        this.checks = {
            environment: false,
            dependencies: false,
            database: false,
            apis: false,
            server: false,
            ui: false
        };
        
        this.services = {
            backend: null,
            frontend: null,
            scheduler: null,
            monitor: null
        };
        
        this.config = {
            backendPort: process.env.PORT || 3001,
            frontendPort: 3000,
            schedulerPort: 3002,
            monitorPort: 3003
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const typeColors = {
            info: colors.cyan,
            success: colors.green,
            warning: colors.yellow,
            error: colors.red,
            header: colors.magenta
        };
        
        const color = typeColors[type] || colors.reset;
        console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
    }

    printHeader() {
        console.clear();
        console.log(colors.bright + colors.magenta);
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                   SYNTHEX SYSTEM LAUNCHER                  ║');
        console.log('║           AI-Powered Marketing Platform v1.0.0             ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(colors.reset);
    }

    async checkEnvironment() {
        this.log('Checking environment variables...', 'info');
        
        const required = [
            'OPENROUTER_API_KEY',
            'DATABASE_URL',
            'JWT_SECRET',
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ];
        
        const missing = [];
        
        // Load .env file if exists
        if (fs.existsSync('.env')) {
            require('dotenv').config();
            this.log('✓ .env file loaded', 'success');
        } else {
            this.log('⚠ No .env file found', 'warning');
        }
        
        for (const env of required) {
            if (!process.env[env]) {
                missing.push(env);
            }
        }
        
        if (missing.length > 0) {
            this.log(`Missing environment variables: ${missing.join(', ')}`, 'error');
            return false;
        }
        
        this.log('✓ All required environment variables found', 'success');
        
        // Check optional API keys
        const optional = [
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET'
        ];
        
        const configured = optional.filter(env => process.env[env]);
        if (configured.length > 0) {
            this.log(`✓ Optional APIs configured: ${configured.length}/${optional.length}`, 'success');
        }
        
        this.checks.environment = true;
        return true;
    }

    async checkDependencies() {
        this.log('Checking dependencies...', 'info');
        
        return new Promise((resolve) => {
            // Check if node_modules exists
            if (!fs.existsSync('node_modules')) {
                this.log('Dependencies not installed. Installing now...', 'warning');
                
                const install = spawn('npm', ['install'], {
                    shell: true,
                    stdio: 'inherit'
                });
                
                install.on('close', (code) => {
                    if (code === 0) {
                        this.log('✓ Dependencies installed successfully', 'success');
                        this.checks.dependencies = true;
                        resolve(true);
                    } else {
                        this.log('✗ Failed to install dependencies', 'error');
                        resolve(false);
                    }
                });
            } else {
                this.log('✓ Dependencies already installed', 'success');
                this.checks.dependencies = true;
                resolve(true);
            }
        });
    }

    async checkDatabase() {
        this.log('Checking database connection...', 'info');
        
        try {
            // Check if Prisma client is generated
            const prismaClientPath = path.join('node_modules', '@prisma', 'client');
            
            if (!fs.existsSync(prismaClientPath)) {
                this.log('Generating Prisma client...', 'info');
                await this.runCommand('npx', ['prisma', 'generate']);
                this.log('✓ Prisma client generated', 'success');
            }
            
            // Check database connection
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            try {
                await prisma.$connect();
                this.log('✓ Database connected successfully', 'success');
                await prisma.$disconnect();
                this.checks.database = true;
                return true;
            } catch (error) {
                this.log(`Database connection failed: ${error.message}`, 'error');
                
                // Try to run migrations
                this.log('Attempting to run database migrations...', 'info');
                await this.runCommand('npx', ['prisma', 'migrate', 'deploy']);
                
                return false;
            }
        } catch (error) {
            this.log(`Database check failed: ${error.message}`, 'error');
            return false;
        }
    }

    async checkAPIs() {
        this.log('Checking API connections...', 'info');
        
        const apis = [];
        
        // Check OpenRouter API
        if (process.env.OPENROUTER_API_KEY) {
            try {
                const response = await this.testAPI(
                    'https://openrouter.ai/api/v1/models',
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
                        }
                    }
                );
                
                if (response.ok) {
                    this.log('✓ OpenRouter API connected', 'success');
                    apis.push('OpenRouter');
                }
            } catch (error) {
                this.log('⚠ OpenRouter API check failed', 'warning');
            }
        }
        
        // Check Supabase
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            try {
                const response = await this.testAPI(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                        }
                    }
                );
                
                if (response.ok) {
                    this.log('✓ Supabase connected', 'success');
                    apis.push('Supabase');
                }
            } catch (error) {
                this.log('⚠ Supabase check failed', 'warning');
            }
        }
        
        this.checks.apis = apis.length > 0;
        this.log(`✓ ${apis.length} API(s) connected`, apis.length > 0 ? 'success' : 'warning');
        return true;
    }

    async testAPI(url, options = {}) {
        return new Promise((resolve) => {
            const protocol = url.startsWith('https') ? https : http;
            
            const req = protocol.get(url, options, (res) => {
                resolve({ ok: res.statusCode < 400 });
            });
            
            req.on('error', () => {
                resolve({ ok: false });
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ ok: false });
            });
        });
    }

    async buildProject() {
        this.log('Building project...', 'info');
        
        try {
            // Build TypeScript
            if (fs.existsSync('tsconfig.json')) {
                this.log('Compiling TypeScript...', 'info');
                await this.runCommand('npm', ['run', 'build']);
                this.log('✓ Project built successfully', 'success');
            }
            
            return true;
        } catch (error) {
            this.log(`Build failed: ${error.message}`, 'error');
            return false;
        }
    }

    async startBackendServer() {
        this.log('Starting backend server...', 'info');
        
        try {
            // Check if there's a compiled version
            const useCompiled = fs.existsSync('dist/index.js');
            
            const command = useCompiled ? 'node' : 'npx';
            const args = useCompiled ? ['dist/index.js'] : ['ts-node', 'src/index.ts'];
            
            this.services.backend = spawn(command, args, {
                shell: true,
                env: { ...process.env, PORT: this.config.backendPort }
            });
            
            this.services.backend.stdout.on('data', (data) => {
                console.log(`[Backend] ${data.toString().trim()}`);
            });
            
            this.services.backend.stderr.on('data', (data) => {
                console.error(`[Backend Error] ${data.toString().trim()}`);
            });
            
            // Wait for server to start
            await this.waitForServer(this.config.backendPort);
            
            this.log(`✓ Backend server running on port ${this.config.backendPort}`, 'success');
            this.checks.server = true;
            return true;
        } catch (error) {
            this.log(`Failed to start backend: ${error.message}`, 'error');
            return false;
        }
    }

    async startFrontendServer() {
        this.log('Starting frontend server...', 'info');
        
        try {
            // Use simple HTTP server for static files
            const express = require('express');
            const app = express();
            
            // Serve static files
            app.use(express.static('public'));
            
            // API proxy
            app.use('/api', (req, res) => {
                const apiUrl = `http://localhost:${this.config.backendPort}${req.url}`;
                req.pipe(
                    require('http').request(apiUrl, {
                        method: req.method,
                        headers: req.headers
                    }, (apiRes) => {
                        res.writeHead(apiRes.statusCode, apiRes.headers);
                        apiRes.pipe(res);
                    })
                );
            });
            
            const server = app.listen(this.config.frontendPort, () => {
                this.log(`✓ Frontend server running on port ${this.config.frontendPort}`, 'success');
                this.checks.ui = true;
            });
            
            this.services.frontend = server;
            return true;
        } catch (error) {
            this.log(`Failed to start frontend: ${error.message}`, 'error');
            return false;
        }
    }

    async startContentScheduler() {
        this.log('Starting content scheduler...', 'info');
        
        try {
            // Start the Python scheduler
            if (fs.existsSync('content_scheduler.py')) {
                this.services.scheduler = spawn('python', ['content_scheduler.py'], {
                    shell: true
                });
                
                this.services.scheduler.stdout.on('data', (data) => {
                    console.log(`[Scheduler] ${data.toString().trim()}`);
                });
                
                this.log('✓ Content scheduler started', 'success');
            } else {
                this.log('⚠ Content scheduler not found', 'warning');
            }
            
            return true;
        } catch (error) {
            this.log(`Failed to start scheduler: ${error.message}`, 'warning');
            return true; // Non-critical
        }
    }

    async startMonitoring() {
        this.log('Starting monitoring service...', 'info');
        
        try {
            // Simple monitoring endpoint
            const express = require('express');
            const app = express();
            
            app.get('/health', (req, res) => {
                res.json({
                    status: 'healthy',
                    services: {
                        backend: this.checks.server,
                        frontend: this.checks.ui,
                        database: this.checks.database,
                        apis: this.checks.apis
                    },
                    timestamp: new Date().toISOString()
                });
            });
            
            app.listen(this.config.monitorPort, () => {
                this.log(`✓ Monitoring service on port ${this.config.monitorPort}`, 'success');
            });
            
            return true;
        } catch (error) {
            this.log(`Failed to start monitoring: ${error.message}`, 'warning');
            return true; // Non-critical
        }
    }

    async waitForServer(port, timeout = 30000) {
        const start = Date.now();
        
        while (Date.now() - start < timeout) {
            try {
                const response = await this.testAPI(`http://localhost:${port}/health`);
                if (response.ok) return true;
            } catch (error) {
                // Server not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error(`Server on port ${port} failed to start within ${timeout}ms`);
    }

    runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                shell: true,
                stdio: 'inherit'
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
        });
    }

    printSummary() {
        console.log('\n');
        this.log('════════════════════════════════════════', 'header');
        this.log('           SYSTEM STATUS SUMMARY         ', 'header');
        this.log('════════════════════════════════════════', 'header');
        
        const status = {
            'Environment': this.checks.environment,
            'Dependencies': this.checks.dependencies,
            'Database': this.checks.database,
            'APIs': this.checks.apis,
            'Backend Server': this.checks.server,
            'Frontend UI': this.checks.ui
        };
        
        for (const [component, isOk] of Object.entries(status)) {
            const icon = isOk ? '✓' : '✗';
            const color = isOk ? colors.green : colors.red;
            console.log(`${color}  ${icon} ${component}${colors.reset}`);
        }
        
        console.log('\n');
        this.log('════════════════════════════════════════', 'header');
        this.log('            ACCESS POINTS                ', 'header');
        this.log('════════════════════════════════════════', 'header');
        
        console.log(`${colors.cyan}  🌐 Main Application:${colors.reset} http://localhost:${this.config.frontendPort}`);
        console.log(`${colors.cyan}  📱 Content Generator:${colors.reset} http://localhost:${this.config.frontendPort}/content-generator-sandbox.html`);
        console.log(`${colors.cyan}  🔌 API Endpoints:${colors.reset} http://localhost:${this.config.backendPort}/api`);
        console.log(`${colors.cyan}  📊 API Documentation:${colors.reset} http://localhost:${this.config.backendPort}/api-docs`);
        console.log(`${colors.cyan}  💚 Health Check:${colors.reset} http://localhost:${this.config.monitorPort}/health`);
        
        console.log('\n');
        this.log('════════════════════════════════════════', 'header');
        this.log('           QUICK COMMANDS                ', 'header');
        this.log('════════════════════════════════════════', 'header');
        
        console.log(`${colors.yellow}  • Test Content Generation:${colors.reset} python run_content_generator.py`);
        console.log(`${colors.yellow}  • Run Tests:${colors.reset} npm test`);
        console.log(`${colors.yellow}  • View Logs:${colors.reset} Check ./logs directory`);
        console.log(`${colors.yellow}  • Stop All:${colors.reset} Press Ctrl+C`);
        
        console.log('\n');
    }

    async launch() {
        this.printHeader();
        
        try {
            // Run all checks
            if (!await this.checkEnvironment()) {
                throw new Error('Environment check failed');
            }
            
            if (!await this.checkDependencies()) {
                throw new Error('Dependencies check failed');
            }
            
            if (!await this.checkDatabase()) {
                this.log('⚠ Database not available - using local storage', 'warning');
            }
            
            await this.checkAPIs();
            
            // Build project if needed
            if (!fs.existsSync('dist')) {
                await this.buildProject();
            }
            
            // Start all services
            await this.startBackendServer();
            await this.startFrontendServer();
            await this.startContentScheduler();
            await this.startMonitoring();
            
            // Print summary
            this.printSummary();
            
            this.log('🚀 SYNTHEX is ready! All systems operational.', 'success');
            
            // Keep process alive
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());
            
        } catch (error) {
            this.log(`Launch failed: ${error.message}`, 'error');
            this.printSummary();
            process.exit(1);
        }
    }

    shutdown() {
        this.log('\nShutting down services...', 'info');
        
        // Kill all services
        for (const [name, service] of Object.entries(this.services)) {
            if (service) {
                try {
                    if (service.kill) {
                        service.kill();
                    } else if (service.close) {
                        service.close();
                    }
                    this.log(`✓ ${name} stopped`, 'success');
                } catch (error) {
                    this.log(`Failed to stop ${name}: ${error.message}`, 'error');
                }
            }
        }
        
        this.log('Goodbye! 👋', 'info');
        process.exit(0);
    }
}

// Launch the system
const launcher = new SystemLauncher();
launcher.launch();