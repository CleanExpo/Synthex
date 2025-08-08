/**
 * Health Check and Monitoring System
 * Phase 9: Quality Assurance
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

class HealthMonitor {
  constructor(config) {
    this.config = {
      apiUrl: process.env.API_URL || 'https://api.synthex.app',
      checkInterval: 60000, // 1 minute
      alertThreshold: 3, // Alert after 3 consecutive failures
      services: [
        { name: 'API', endpoint: '/api/v2/health' },
        { name: 'Database', endpoint: '/api/v2/health/db' },
        { name: 'Redis', endpoint: '/api/v2/health/redis' },
        { name: 'Auth', endpoint: '/api/v2/auth/status' }
      ],
      metrics: {
        responseTime: [],
        uptime: { start: Date.now(), checks: 0, failures: 0 },
        errors: []
      },
      ...config
    };
    
    this.failureCount = {};
    this.setupEmailTransporter();
  }
  
  setupEmailTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  async checkService(service) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(
        `${this.config.apiUrl}${service.endpoint}`,
        { timeout: 5000 }
      );
      
      const responseTime = Date.now() - startTime;
      
      // Reset failure count on success
      this.failureCount[service.name] = 0;
      
      return {
        service: service.name,
        status: 'healthy',
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Increment failure count
      this.failureCount[service.name] = (this.failureCount[service.name] || 0) + 1;
      
      // Send alert if threshold reached
      if (this.failureCount[service.name] >= this.config.alertThreshold) {
        await this.sendAlert(service, error);
      }
      
      return {
        service: service.name,
        status: 'unhealthy',
        responseTime,
        error: error.message,
        failureCount: this.failureCount[service.name],
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async checkAllServices() {
    const results = await Promise.all(
      this.config.services.map(service => this.checkService(service))
    );
    
    // Update metrics
    this.updateMetrics(results);
    
    // Log results
    this.logResults(results);
    
    return {
      timestamp: new Date().toISOString(),
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
      services: results,
      metrics: this.getMetrics()
    };
  }
  
  updateMetrics(results) {
    // Update response times
    results.forEach(result => {
      if (!this.config.metrics.responseTime[result.service]) {
        this.config.metrics.responseTime[result.service] = [];
      }
      
      this.config.metrics.responseTime[result.service].push({
        time: result.responseTime,
        timestamp: result.timestamp
      });
      
      // Keep only last 100 measurements
      if (this.config.metrics.responseTime[result.service].length > 100) {
        this.config.metrics.responseTime[result.service].shift();
      }
    });
    
    // Update uptime
    this.config.metrics.uptime.checks++;
    const failures = results.filter(r => r.status === 'unhealthy').length;
    this.config.metrics.uptime.failures += failures;
  }
  
  getMetrics() {
    const uptime = this.config.metrics.uptime;
    const uptimePercentage = ((uptime.checks - uptime.failures) / uptime.checks * 100).toFixed(2);
    
    // Calculate average response times
    const avgResponseTimes = {};
    for (const [service, times] of Object.entries(this.config.metrics.responseTime)) {
      if (times.length > 0) {
        const avg = times.reduce((sum, t) => sum + t.time, 0) / times.length;
        avgResponseTimes[service] = Math.round(avg);
      }
    }
    
    return {
      uptime: `${uptimePercentage}%`,
      totalChecks: uptime.checks,
      totalFailures: uptime.failures,
      avgResponseTimes,
      lastCheck: new Date().toISOString()
    };
  }
  
  async sendAlert(service, error) {
    const mailOptions = {
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAIL,
      subject: `🚨 Synthex Health Alert: ${service.name} is down`,
      html: `
        <h2>Service Health Alert</h2>
        <p><strong>Service:</strong> ${service.name}</p>
        <p><strong>Endpoint:</strong> ${service.endpoint}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Failure Count:</strong> ${this.failureCount[service.name]}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p>Please investigate immediately.</p>
      `
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Alert sent for ${service.name}`);
    } catch (emailError) {
      console.error('Failed to send alert email:', emailError);
    }
  }
  
  logResults(results) {
    const timestamp = new Date().toISOString();
    const healthy = results.filter(r => r.status === 'healthy').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    
    console.log(`[${timestamp}] Health Check: ${healthy} healthy, ${unhealthy} unhealthy`);
    
    results.forEach(result => {
      if (result.status === 'unhealthy') {
        console.error(`  ❌ ${result.service}: ${result.error}`);
      } else {
        console.log(`  ✅ ${result.service}: ${result.responseTime}ms`);
      }
    });
  }
  
  start() {
    console.log('Starting health monitoring...');
    
    // Initial check
    this.checkAllServices();
    
    // Schedule regular checks
    this.interval = setInterval(() => {
      this.checkAllServices();
    }, this.config.checkInterval);
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Health monitoring stopped');
    }
  }
  
  // Performance monitoring
  async checkPerformance() {
    const metrics = {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    // Check if memory usage is too high
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      await this.sendAlert(
        { name: 'Memory Usage' },
        new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`)
      );
    }
    
    return metrics;
  }
  
  // API endpoint monitoring
  async checkAPIEndpoints() {
    const endpoints = [
      { path: '/api/v2/analytics', method: 'GET' },
      { path: '/api/v2/ai-content/generate', method: 'POST' },
      { path: '/api/v2/scheduler/posts', method: 'GET' },
      { path: '/api/v2/teams/members', method: 'GET' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${this.config.apiUrl}${endpoint.path}`,
          headers: {
            'Authorization': `Bearer ${process.env.MONITOR_API_TOKEN}`
          },
          timeout: 10000
        });
        
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'success',
          statusCode: response.status,
          responseTime: Date.now() - startTime
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: 'failed',
          error: error.message,
          responseTime: Date.now() - startTime
        });
      }
    }
    
    return results;
  }
  
  // Generate health report
  async generateReport() {
    const health = await this.checkAllServices();
    const performance = await this.checkPerformance();
    const endpoints = await this.checkAPIEndpoints();
    
    return {
      timestamp: new Date().toISOString(),
      health,
      performance,
      endpoints,
      metrics: this.getMetrics()
    };
  }
}

// Export for use
module.exports = HealthMonitor;

// Run if executed directly
if (require.main === module) {
  const monitor = new HealthMonitor();
  monitor.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down health monitor...');
    monitor.stop();
    process.exit(0);
  });
}
