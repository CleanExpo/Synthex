/**
 * Monitoring and Analytics Setup
 * Real-time monitoring for deployment and feature performance
 */

export class MonitoringSystem {
  constructor() {
    this.metrics = {
      errorRate: 0,
      pageLoadTime: [],
      apiLatency: [],
      memoryUsage: [],
      activeUsers: 0,
      featureUsage: new Map()
    };
    
    this.thresholds = {
      errorRate: 0.05, // 5%
      pageLoadTime: 3000, // 3 seconds
      apiLatency: 500, // 500ms
      memoryUsage: 0.8 // 80%
    };
    
    this.alerts = [];
    this.listeners = new Set();
    this.isMonitoring = false;
  }
  
  // Initialize monitoring
  init() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Set up error tracking
    this.setupErrorTracking();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
    
    // Set up feature usage tracking
    this.setupFeatureTracking();
    
    // Set up heartbeat
    this.startHeartbeat();
    
    console.log('Monitoring system initialized');
  }
  
  // Error tracking
  setupErrorTracking() {
    if (typeof window === 'undefined') return;
    
    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Track promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'promise_rejection',
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString()
      });
    });
    
    // Track console errors
    const originalError = console.error;
    console.error = (...args) => {
      this.logError({
        type: 'console_error',
        message: args.join(' '),
        timestamp: new Date().toISOString()
      });
      originalError.apply(console, args);
    };
  }
  
  // Performance monitoring
  setupPerformanceMonitoring() {
    if (typeof window === 'undefined') return;
    
    // Monitor page load time
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      
      if (loadTime > 0) {
        this.recordMetric('pageLoadTime', loadTime);
      }
    }
    
    // Monitor resource timing
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.recordResourceTiming(entry);
          } else if (entry.entryType === 'measure') {
            this.recordCustomTiming(entry);
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource', 'measure'] });
    }
    
    // Monitor memory usage
    if (window.performance && window.performance.memory) {
      setInterval(() => {
        const memory = window.performance.memory;
        const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        this.recordMetric('memoryUsage', usage);
      }, 10000); // Every 10 seconds
    }
  }
  
  // Feature usage tracking
  setupFeatureTracking() {
    // Track feature flag usage
    const originalIsFeatureEnabled = window.synthexFeatures?.isFeatureEnabled;
    
    if (originalIsFeatureEnabled) {
      window.synthexFeatures.isFeatureEnabled = (featureName) => {
        this.trackFeatureUsage(featureName);
        return originalIsFeatureEnabled(featureName);
      };
    }
  }
  
  // Log error
  logError(error) {
    // Update error rate
    const totalRequests = this.metrics.apiLatency.length || 100;
    this.metrics.errorRate = (this.metrics.errorRate * totalRequests + 1) / (totalRequests + 1);
    
    // Check threshold
    if (this.metrics.errorRate > this.thresholds.errorRate) {
      this.triggerAlert('error_rate', {
        current: this.metrics.errorRate,
        threshold: this.thresholds.errorRate,
        error
      });
    }
    
    // Send to monitoring service
    this.sendToMonitoringService({
      type: 'error',
      data: error
    });
    
    // Notify listeners
    this.notifyListeners('error', error);
  }
  
  // Record metric
  recordMetric(name, value) {
    if (Array.isArray(this.metrics[name])) {
      this.metrics[name].push(value);
      
      // Keep only last 100 values
      if (this.metrics[name].length > 100) {
        this.metrics[name].shift();
      }
      
      // Check threshold
      const avg = this.metrics[name].reduce((a, b) => a + b, 0) / this.metrics[name].length;
      
      if (this.thresholds[name] && avg > this.thresholds[name]) {
        this.triggerAlert(name, {
          current: avg,
          threshold: this.thresholds[name],
          values: this.metrics[name].slice(-10)
        });
      }
    } else {
      this.metrics[name] = value;
      
      if (this.thresholds[name] && value > this.thresholds[name]) {
        this.triggerAlert(name, {
          current: value,
          threshold: this.thresholds[name]
        });
      }
    }
    
    this.notifyListeners('metric', { name, value });
  }
  
  // Record resource timing
  recordResourceTiming(entry) {
    if (entry.name.includes('/api/')) {
      this.recordMetric('apiLatency', entry.duration);
    }
  }
  
  // Record custom timing
  recordCustomTiming(entry) {
    this.recordMetric(`custom_${entry.name}`, entry.duration);
  }
  
  // Track feature usage
  trackFeatureUsage(featureName) {
    const count = this.metrics.featureUsage.get(featureName) || 0;
    this.metrics.featureUsage.set(featureName, count + 1);
  }
  
  // Trigger alert
  triggerAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    // Send alert notification
    this.sendAlert(alert);
    
    // Notify listeners
    this.notifyListeners('alert', alert);
    
    // Auto-resolve after 5 minutes
    setTimeout(() => {
      alert.resolved = true;
    }, 5 * 60 * 1000);
  }
  
  // Send alert
  sendAlert(alert) {
    console.warn('MONITORING ALERT:', alert);
    
    // Send to monitoring service
    this.sendToMonitoringService({
      type: 'alert',
      data: alert
    });
    
    // Show user notification if critical
    if (alert.type === 'error_rate' && window.synthexNotifications) {
      window.synthexNotifications.show({
        type: 'warning',
        message: 'System experiencing higher than normal error rate',
        persistent: true
      });
    }
  }
  
  // Send to monitoring service
  async sendToMonitoringService(data) {
    try {
      // In production, this would send to your monitoring service
      // For now, just log to console
      console.log('Monitoring data:', data);
      
      // Example: Send to monitoring endpoint
      if (typeof fetch !== 'undefined') {
        await fetch('/api/monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }).catch(() => {
          // Silently fail to avoid cascading errors
        });
      }
    } catch (error) {
      // Don't throw errors from monitoring
      console.error('Failed to send monitoring data:', error);
    }
  }
  
  // Start heartbeat
  startHeartbeat() {
    setInterval(() => {
      this.sendToMonitoringService({
        type: 'heartbeat',
        metrics: this.getMetricsSummary(),
        timestamp: new Date().toISOString()
      });
    }, 60000); // Every minute
  }
  
  // Get metrics summary
  getMetricsSummary() {
    const summary = {
      errorRate: this.metrics.errorRate,
      activeUsers: this.metrics.activeUsers,
      featureUsage: Object.fromEntries(this.metrics.featureUsage)
    };
    
    // Calculate averages for arrays
    ['pageLoadTime', 'apiLatency', 'memoryUsage'].forEach(metric => {
      const values = this.metrics[metric];
      if (values && values.length > 0) {
        summary[metric] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          last: values[values.length - 1]
        };
      }
    });
    
    return summary;
  }
  
  // Add listener
  addListener(callback) {
    this.listeners.add(callback);
  }
  
  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  // Notify listeners
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Monitoring listener error:', error);
      }
    });
  }
  
  // Get current status
  getStatus() {
    const summary = this.getMetricsSummary();
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    
    let status = 'healthy';
    if (activeAlerts.length > 0) {
      status = 'warning';
    }
    if (this.metrics.errorRate > this.thresholds.errorRate) {
      status = 'critical';
    }
    
    return {
      status,
      metrics: summary,
      alerts: activeAlerts,
      uptime: this.getUptime()
    };
  }
  
  // Get uptime
  getUptime() {
    if (typeof window !== 'undefined' && window.performance) {
      return Date.now() - window.performance.timing.navigationStart;
    }
    return 0;
  }
  
  // Create dashboard data
  getDashboardData() {
    return {
      status: this.getStatus(),
      metrics: this.metrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const monitoring = new MonitoringSystem();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.synthexMonitoring = monitoring;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => monitoring.init());
  } else {
    monitoring.init();
  }
}