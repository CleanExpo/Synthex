/**
 * Error Boundary and Safe Component Wrapper
 * Provides error handling and fallback for new components
 */

export class ErrorBoundary {
  constructor(options = {}) {
    this.fallbackComponent = options.fallback || this.defaultFallback;
    this.onError = options.onError || this.defaultErrorHandler;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }
  
  // Default fallback component
  defaultFallback(error) {
    return `
      <div class="error-boundary-fallback" style="
        padding: 20px;
        margin: 20px;
        border: 1px solid #ff6b6b;
        border-radius: 8px;
        background: #ffe0e0;
        color: #c92a2a;
      ">
        <h3 style="margin: 0 0 10px 0;">Component Error</h3>
        <p style="margin: 0;">This component failed to load. We've fallen back to a safe version.</p>
        <details style="margin-top: 10px;">
          <summary style="cursor: pointer;">Error Details</summary>
          <pre style="margin-top: 10px; font-size: 12px;">${error.message}</pre>
        </details>
        <button onclick="window.location.reload()" style="
          margin-top: 10px;
          padding: 8px 16px;
          background: #c92a2a;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Reload Page</button>
      </div>
    `;
  }
  
  // Default error handler
  defaultErrorHandler(error, errorInfo) {
    console.error('Component Error:', error);
    console.error('Error Info:', errorInfo);
    
    // Send error to monitoring service
    if (typeof window !== 'undefined' && window.synthexMonitoring) {
      window.synthexMonitoring.logError({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Wrap component with error boundary
  wrap(component, legacyComponent = null) {
    const boundary = this;
    
    return class SafeComponent {
      constructor(props) {
        this.props = props;
        this.state = {
          hasError: false,
          error: null,
          isRetrying: false
        };
      }

      setState(nextState) {
        this.state = { ...this.state, ...nextState };
      }
      
      componentDidCatch(error, errorInfo) {
        boundary.onError(error, errorInfo);
        
        this.setState({
          hasError: true,
          error: error
        });
        
        // Attempt retry if below max retries
        if (boundary.retryCount < boundary.maxRetries) {
          setTimeout(() => {
            boundary.retryCount++;
            this.retry();
          }, boundary.retryDelay * boundary.retryCount);
        }
      }
      
      retry() {
        console.log(`Retrying component (attempt ${boundary.retryCount}/${boundary.maxRetries})`);
        
        this.setState({
          hasError: false,
          error: null,
          isRetrying: true
        });
        
        setTimeout(() => {
          this.setState({ isRetrying: false });
          try {
            this.render();
          } catch (error) {
            this.componentDidCatch(error, { componentStack: '' });
          }
        }, 100);
      }
      
      render() {
        if (this.state.hasError) {
          // Try legacy component first
          if (legacyComponent) {
            try {
              return legacyComponent(this.props);
            } catch (e) {
              console.error('Legacy component also failed:', e);
            }
          }
          
          // Fall back to error display
          return boundary.fallbackComponent(this.state.error);
        }
        
        if (this.state.isRetrying) {
          return '<div class="component-retrying">Retrying...</div>';
        }
        
        try {
          return component(this.props);
        } catch (error) {
          this.componentDidCatch(error, { componentStack: '' });
          if (legacyComponent) {
            try {
              return legacyComponent(this.props);
            } catch (legacyError) {
              console.error('Legacy component also failed:', legacyError);
            }
          }

          return boundary.fallbackComponent(error);
        }
      }
    };
  }
}

// Create safe component wrapper function
export function createSafeComponent(NewComponent, LegacyComponent, options = {}) {
  const boundary = new ErrorBoundary(options);
  return boundary.wrap(NewComponent, LegacyComponent);
}

// React-like error boundary for vanilla JS
export class SafeComponentWrapper {
  constructor(container, component, options = {}) {
    this.container = container;
    this.component = component;
    this.options = options;
    this.errorBoundary = new ErrorBoundary(options);
    this.mounted = false;
  }
  
  mount() {
    try {
      this.mounted = true;
      const result = this.component();
      
      if (typeof result === 'string') {
        this.container.innerHTML = result;
      } else if (result instanceof HTMLElement) {
        this.container.appendChild(result);
      } else if (result && typeof result.then === 'function') {
        // Handle async components
        result
          .then(content => {
            if (this.mounted) {
              if (typeof content === 'string') {
                this.container.innerHTML = content;
              } else if (content instanceof HTMLElement) {
                this.container.appendChild(content);
              }
            }
          })
          .catch(error => this.handleError(error));
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  handleError(error) {
    console.error('Component mount error:', error);
    this.errorBoundary.onError(error, { container: this.container });
    
    // Display fallback
    this.container.innerHTML = this.errorBoundary.fallbackComponent(error);
    
    // Try to recover with legacy component if provided
    if (this.options.legacyComponent) {
      try {
        const legacy = this.options.legacyComponent();
        if (typeof legacy === 'string') {
          this.container.innerHTML = legacy;
        } else if (legacy instanceof HTMLElement) {
          this.container.innerHTML = '';
          this.container.appendChild(legacy);
        }
      } catch (legacyError) {
        console.error('Legacy component also failed:', legacyError);
      }
    }
  }
  
  unmount() {
    this.mounted = false;
    this.container.innerHTML = '';
  }
}

// Global error handler for uncaught component errors
export function setupGlobalErrorHandler() {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('error', (event) => {
    // Check if it's a component error
    if (event.filename && event.filename.includes('/components/')) {
      console.error('Global component error caught:', event.error);
      
      // Log to monitoring
      if (window.synthexMonitoring) {
        window.synthexMonitoring.logError({
          type: 'global_component_error',
          error: event.error.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error.stack
        });
      }
      
      // Prevent default error handling
      event.preventDefault();
      
      // Show user-friendly notification
      if (window.synthexNotifications) {
        window.synthexNotifications.show({
          type: 'error',
          message: 'A component encountered an error. Some features may be limited.',
          action: {
            label: 'Reload',
            handler: () => window.location.reload()
          }
        });
      }
    }
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.componentError) {
      console.error('Unhandled component promise rejection:', event.reason);
      
      if (window.synthexMonitoring) {
        window.synthexMonitoring.logError({
          type: 'component_promise_rejection',
          error: event.reason.message || event.reason,
          stack: event.reason.stack
        });
      }
      
      event.preventDefault();
    }
  });
}

// Export for browser
if (typeof window !== 'undefined') {
  window.synthexSafeComponent = {
    ErrorBoundary,
    createSafeComponent,
    SafeComponentWrapper,
    setupGlobalErrorHandler
  };
  
  // Auto-setup global error handler
  setupGlobalErrorHandler();
}
