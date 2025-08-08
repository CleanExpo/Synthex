/**
 * Platform Optimizer Routes Configuration
 * Dynamic routing for platform optimization features
 */

import { isFeatureEnabled } from '../config/features.js';

// Define optimizer routes
export const optimizerRoutes = [
  {
    path: '/optimize/instagram',
    component: 'InstagramOptimizer',
    enabled: () => isFeatureEnabled('instagramOptimizer'),
    title: 'Instagram Optimizer',
    icon: 'instagram',
    description: 'Optimize content for Instagram engagement'
  },
  {
    path: '/optimize/facebook',
    component: 'FacebookOptimizer',
    enabled: () => isFeatureEnabled('facebookOptimizer'),
    title: 'Facebook Optimizer',
    icon: 'facebook',
    description: 'Maximize Facebook reach and engagement'
  },
  {
    path: '/optimize/twitter',
    component: 'TwitterOptimizer',
    enabled: () => isFeatureEnabled('twitterOptimizer'),
    title: 'Twitter/X Optimizer',
    icon: 'twitter',
    description: 'Craft viral tweets and threads'
  },
  {
    path: '/optimize/linkedin',
    component: 'LinkedInOptimizer',
    enabled: () => isFeatureEnabled('linkedinOptimizer'),
    title: 'LinkedIn Optimizer',
    icon: 'linkedin',
    description: 'Professional content optimization'
  },
  {
    path: '/optimize/tiktok',
    component: 'TikTokOptimizer',
    enabled: () => isFeatureEnabled('tiktokOptimizer'),
    title: 'TikTok Optimizer',
    icon: 'tiktok',
    description: 'Create trending TikTok content'
  },
  {
    path: '/optimize/pinterest',
    component: 'PinterestOptimizer',
    enabled: () => isFeatureEnabled('pinterestOptimizer'),
    title: 'Pinterest Optimizer',
    icon: 'pinterest',
    description: 'Design pin-worthy content'
  },
  {
    path: '/optimize/youtube',
    component: 'YouTubeOptimizer',
    enabled: () => isFeatureEnabled('youtubeOptimizer'),
    title: 'YouTube Optimizer',
    icon: 'youtube',
    description: 'Optimize videos for discovery'
  },
  {
    path: '/optimize/reddit',
    component: 'RedditOptimizer',
    enabled: () => isFeatureEnabled('redditOptimizer'),
    title: 'Reddit Optimizer',
    icon: 'reddit',
    description: 'Craft Reddit-worthy posts'
  }
];

// Router class for optimizer navigation
export class OptimizerRouter {
  constructor() {
    this.currentRoute = null;
    this.routes = new Map();
    this.listeners = new Set();
    this.init();
  }
  
  init() {
    // Register routes
    optimizerRoutes.forEach(route => {
      if (route.enabled()) {
        this.routes.set(route.path, route);
      }
    });
    
    // Set up browser history handling
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.handleRouteChange());
      
      // Handle initial route
      this.handleRouteChange();
    }
  }
  
  // Get enabled routes
  getEnabledRoutes() {
    return optimizerRoutes.filter(route => route.enabled());
  }
  
  // Navigate to route
  navigate(path) {
    const route = this.routes.get(path);
    
    if (!route) {
      console.error(`Route not found or disabled: ${path}`);
      return false;
    }
    
    // Update browser history
    if (typeof window !== 'undefined') {
      window.history.pushState({ path }, route.title, path);
    }
    
    this.currentRoute = route;
    this.notifyListeners(route);
    
    return true;
  }
  
  // Handle route changes
  handleRouteChange() {
    const path = window.location.pathname;
    const route = this.routes.get(path);
    
    if (route) {
      this.currentRoute = route;
      this.notifyListeners(route);
    }
  }
  
  // Add route change listener
  addListener(callback) {
    this.listeners.add(callback);
  }
  
  // Remove route change listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  // Notify listeners of route change
  notifyListeners(route) {
    this.listeners.forEach(callback => {
      try {
        callback(route);
      } catch (error) {
        console.error('Route listener error:', error);
      }
    });
  }
  
  // Generate navigation menu
  generateNavMenu() {
    const enabledRoutes = this.getEnabledRoutes();
    
    if (enabledRoutes.length === 0) {
      return '<div class="no-optimizers">No optimizers currently available</div>';
    }
    
    const menuItems = enabledRoutes.map(route => `
      <a href="${route.path}" 
         class="optimizer-nav-item ${this.currentRoute?.path === route.path ? 'active' : ''}"
         data-path="${route.path}"
         data-component="${route.component}">
        <i class="icon-${route.icon}"></i>
        <span class="nav-title">${route.title}</span>
        <span class="nav-description">${route.description}</span>
      </a>
    `).join('');
    
    return `
      <nav class="optimizer-navigation">
        <h3>Platform Optimizers</h3>
        <div class="nav-items">
          ${menuItems}
        </div>
      </nav>
    `;
  }
}

// Create singleton router instance
export const optimizerRouter = new OptimizerRouter();

// Setup route handling
export function setupOptimizerRouting() {
  if (typeof window === 'undefined') return;
  
  // Handle navigation clicks
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-path]');
    if (link) {
      event.preventDefault();
      const path = link.getAttribute('data-path');
      optimizerRouter.navigate(path);
    }
  });
  
  // Load component on route change
  optimizerRouter.addListener(async (route) => {
    if (!route) return;
    
    const container = document.getElementById('optimizer-container');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = '<div class="loading">Loading optimizer...</div>';
    
    try {
      // Dynamically import component
      const { componentLoader } = await import('./LazyComponents.js');
      const component = await componentLoader.load(route.component, () => 
        import(`./optimizers/${route.component}.js`)
      );
      
      if (component) {
        // Render component
        if (typeof component === 'function') {
          const content = await component();
          container.innerHTML = content;
        } else if (component.render) {
          component.render(container);
        }
      } else {
        container.innerHTML = '<div class="error">Failed to load optimizer</div>';
      }
    } catch (error) {
      console.error('Failed to load optimizer:', error);
      container.innerHTML = '<div class="error">Failed to load optimizer</div>';
    }
  });
}

// Export for browser
if (typeof window !== 'undefined') {
  window.synthexOptimizerRouter = {
    optimizerRouter,
    setupOptimizerRouting,
    optimizerRoutes
  };
  
  // Auto-setup on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOptimizerRouting);
  } else {
    setupOptimizerRouting();
  }
}