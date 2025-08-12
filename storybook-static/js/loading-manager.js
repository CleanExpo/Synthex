/**
 * SYNTHEX Loading Manager v1.0
 * Advanced loading state management with progressive enhancement
 * Includes lazy loading, progressive images, smart preloading, and optimistic UI
 */

class SynthexLoadingManager {
  constructor(options = {}) {
    this.options = {
      // Intersection Observer options
      rootMargin: '50px 0px',
      threshold: 0.1,
      
      // Progressive image options
      placeholderQuality: 10,
      blurRadius: 20,
      
      // Network detection
      slowConnectionThreshold: 2000, // ms
      
      // Stagger animation timing
      staggerDelay: 100, // ms
      
      // Retry options
      maxRetries: 3,
      retryDelay: 1000, // ms
      
      // Cache options
      imageCacheSize: 50,
      preloadDistance: 2, // screens
      
      ...options
    };
    
    this.observers = new Map();
    this.imageCache = new Map();
    this.loadingStates = new Map();
    this.networkStatus = 'online';
    this.connectionSpeed = 'fast';
    this.retryAttempts = new Map();
    
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    this.init();
  }

  init() {
    this.initIntersectionObservers();
    this.initProgressiveImages();
    this.initLazyLoading();
    this.initStaggeredAnimations();
    this.initNetworkDetection();
    this.initOptimisticUI();
    this.initSmartPreloading();
    this.initErrorHandling();
    
    console.log('SYNTHEX Loading Manager initialized');
  }

  /* ===== INTERSECTION OBSERVER SETUP ===== */
  initIntersectionObservers() {
    // Main lazy loading observer
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadLazyElement(entry.target);
          lazyObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: this.options.rootMargin,
      threshold: this.options.threshold
    });

    // Progressive image observer
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadProgressiveImage(entry.target);
          imageObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: this.options.rootMargin,
      threshold: 0.1
    });

    // Stagger animation observer
    const staggerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.triggerStaggerAnimation(entry.target);
          staggerObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '100px 0px',
      threshold: 0.1
    });

    this.observers.set('lazy', lazyObserver);
    this.observers.set('images', imageObserver);
    this.observers.set('stagger', staggerObserver);

    // Observe initial elements
    this.observeElements();
  }

  observeElements() {
    // Lazy loading elements
    document.querySelectorAll('.lazy-load:not(.loaded)').forEach(el => {
      this.observers.get('lazy').observe(el);
    });

    // Progressive images
    document.querySelectorAll('.progressive-image:not(.loaded)').forEach(el => {
      this.observers.get('images').observe(el);
    });

    // Stagger containers
    document.querySelectorAll('.stagger-container:not(.loaded)').forEach(el => {
      this.observers.get('stagger').observe(el);
    });
  }

  /* ===== PROGRESSIVE IMAGE LOADING ===== */
  initProgressiveImages() {
    // Setup progressive images that are already in viewport
    document.querySelectorAll('.progressive-image').forEach(container => {
      const rect = container.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        this.loadProgressiveImage(container);
      }
    });
  }

  async loadProgressiveImage(container) {
    const mainImg = container.querySelector('.progressive-image-main');
    const placeholder = container.querySelector('.progressive-image-placeholder');
    const overlay = container.querySelector('.progressive-image-overlay');
    
    if (!mainImg || container.classList.contains('loaded')) return;

    const imageSrc = mainImg.dataset.src || mainImg.src;
    if (!imageSrc) return;

    this.setLoadingState(container, 'loading');

    try {
      // Check cache first
      if (this.imageCache.has(imageSrc)) {
        this.displayCachedImage(container, mainImg, this.imageCache.get(imageSrc));
        return;
      }

      // Create loading indicator
      if (overlay) {
        const loadingSpinner = this.createLoadingSpinner();
        overlay.appendChild(loadingSpinner);
      }

      // Load the image
      const img = new Image();
      
      // Add loading progress if supported
      if ('loading' in HTMLImageElement.prototype) {
        img.loading = 'lazy';
      }

      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          // Cache the image
          this.addToImageCache(imageSrc, img.src);
          
          // Display the image
          mainImg.src = img.src;
          
          // Trigger transition
          requestAnimationFrame(() => {
            container.classList.add('loaded');
            this.setLoadingState(container, 'loaded');
          });
          
          resolve(img);
        };
        
        img.onerror = () => {
          this.handleImageError(container, imageSrc);
          reject(new Error(`Failed to load image: ${imageSrc}`));
        };
      });

      img.src = imageSrc;
      await loadPromise;

    } catch (error) {
      console.warn('Progressive image failed to load:', error);
      this.setLoadingState(container, 'error');
    }
  }

  displayCachedImage(container, mainImg, cachedSrc) {
    mainImg.src = cachedSrc;
    requestAnimationFrame(() => {
      container.classList.add('loaded');
      this.setLoadingState(container, 'loaded');
    });
  }

  handleImageError(container, imageSrc) {
    const retryKey = `img_${imageSrc}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;

    if (attempts < this.options.maxRetries) {
      this.retryAttempts.set(retryKey, attempts + 1);
      
      // Add retry button
      const retryButton = this.createRetryButton(() => {
        this.retryImageLoad(container, imageSrc);
      });

      const overlay = container.querySelector('.progressive-image-overlay');
      if (overlay) {
        overlay.innerHTML = '';
        overlay.appendChild(retryButton);
      }
    } else {
      // Show error state
      this.showImageError(container);
    }
  }

  retryImageLoad(container, imageSrc) {
    container.classList.remove('loaded');
    setTimeout(() => {
      this.loadProgressiveImage(container);
    }, this.options.retryDelay);
  }

  showImageError(container) {
    const overlay = container.querySelector('.progressive-image-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div class="image-error">
          <div class="image-error-icon">⚠️</div>
          <div class="image-error-text">Failed to load image</div>
        </div>
      `;
    }
  }

  /* ===== LAZY LOADING ===== */
  loadLazyElement(element) {
    if (element.classList.contains('loaded')) return;

    this.setLoadingState(element, 'loading');

    // Handle different types of lazy content
    if (element.dataset.src) {
      // Image lazy loading
      this.loadLazyImage(element);
    } else if (element.dataset.content) {
      // Content lazy loading
      this.loadLazyContent(element);
    } else if (element.dataset.component) {
      // Component lazy loading
      this.loadLazyComponent(element);
    } else {
      // Default lazy loading (reveal with animation)
      this.revealLazyElement(element);
    }
  }

  loadLazyImage(element) {
    const img = new Image();
    img.onload = () => {
      if (element.tagName === 'IMG') {
        element.src = img.src;
      } else {
        element.style.backgroundImage = `url(${img.src})`;
      }
      this.revealLazyElement(element);
    };
    
    img.onerror = () => {
      this.handleLazyLoadError(element, 'image');
    };
    
    img.src = element.dataset.src;
  }

  loadLazyContent(element) {
    const contentUrl = element.dataset.content;
    
    fetch(contentUrl)
      .then(response => response.text())
      .then(html => {
        element.innerHTML = html;
        this.revealLazyElement(element);
        
        // Re-observe any new lazy elements
        this.observeElements();
      })
      .catch(() => {
        this.handleLazyLoadError(element, 'content');
      });
  }

  loadLazyComponent(element) {
    const componentName = element.dataset.component;
    const componentData = element.dataset.componentData;
    
    // This would integrate with your component system
    // For now, we'll simulate component loading
    setTimeout(() => {
      element.innerHTML = `<div class="lazy-component">${componentName} component loaded</div>`;
      this.revealLazyElement(element);
    }, 500);
  }

  revealLazyElement(element) {
    requestAnimationFrame(() => {
      element.classList.add('loaded');
      this.setLoadingState(element, 'loaded');
    });
  }

  handleLazyLoadError(element, type) {
    const retryKey = `lazy_${element.dataset.src || element.dataset.content}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;

    if (attempts < this.options.maxRetries) {
      this.retryAttempts.set(retryKey, attempts + 1);
      
      const retryButton = this.createRetryButton(() => {
        this.loadLazyElement(element);
      });
      
      element.innerHTML = '';
      element.appendChild(retryButton);
    } else {
      element.innerHTML = `
        <div class="lazy-load-error">
          <div class="lazy-load-error-icon">⚠️</div>
          <div class="lazy-load-error-text">Failed to load ${type}</div>
        </div>
      `;
    }
    
    this.setLoadingState(element, 'error');
  }

  /* ===== STAGGERED ANIMATIONS ===== */
  initStaggeredAnimations() {
    // Initial check for containers already in viewport
    document.querySelectorAll('.stagger-container').forEach(container => {
      const rect = container.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        this.triggerStaggerAnimation(container);
      }
    });
  }

  triggerStaggerAnimation(container) {
    if (container.classList.contains('loaded') || this.isReducedMotion) {
      container.classList.add('loaded');
      return;
    }

    const items = container.querySelectorAll('.stagger-item');
    const delay = parseInt(container.dataset.staggerDelay) || this.options.staggerDelay;

    items.forEach((item, index) => {
      setTimeout(() => {
        item.style.transitionDelay = `${index * delay}ms`;
      }, index * 50); // Small delay to ensure proper cascade
    });

    // Trigger the animation
    requestAnimationFrame(() => {
      container.classList.add('loaded');
    });
  }

  /* ===== NETWORK DETECTION ===== */
  initNetworkDetection() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.showNetworkStatus('Back online', 'online');
      this.retryFailedRequests();
    });

    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
      this.showNetworkStatus('No internet connection', 'offline');
    });

    // Monitor connection speed (if supported)
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      const updateConnectionSpeed = () => {
        const effectiveType = connection.effectiveType;
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          this.connectionSpeed = 'slow';
          this.showNetworkStatus('Slow connection detected', 'slow');
        } else if (effectiveType === '3g') {
          this.connectionSpeed = 'medium';
        } else {
          this.connectionSpeed = 'fast';
        }
        
        this.adaptToConnectionSpeed();
      };

      connection.addEventListener('change', updateConnectionSpeed);
      updateConnectionSpeed();
    }

    // Measure actual loading times to detect slow connections
    this.measureConnectionSpeed();
  }

  measureConnectionSpeed() {
    const startTime = performance.now();
    
    // Create a small test image
    const testImg = new Image();
    testImg.onload = () => {
      const loadTime = performance.now() - startTime;
      
      if (loadTime > this.options.slowConnectionThreshold) {
        this.connectionSpeed = 'slow';
        this.adaptToConnectionSpeed();
      }
    };
    
    // Use a small, cacheable image for testing
    testImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  adaptToConnectionSpeed() {
    const body = document.body;
    
    // Remove existing speed classes
    body.classList.remove('connection-slow', 'connection-medium', 'connection-fast');
    
    // Add current speed class
    body.classList.add(`connection-${this.connectionSpeed}`);
    
    // Adjust loading behavior based on connection speed
    if (this.connectionSpeed === 'slow') {
      // Reduce animation complexity
      this.options.staggerDelay = 50;
      
      // Disable non-essential animations
      body.classList.add('reduced-animations');
      
      // Load smaller images
      this.adaptImageQuality('low');
    } else {
      body.classList.remove('reduced-animations');
      this.adaptImageQuality('high');
    }
  }

  adaptImageQuality(quality) {
    const images = document.querySelectorAll('.progressive-image-main[data-src-low]');
    
    images.forEach(img => {
      if (quality === 'low' && img.dataset.srcLow) {
        img.dataset.src = img.dataset.srcLow;
      } else if (quality === 'high' && img.dataset.srcHigh) {
        img.dataset.src = img.dataset.srcHigh;
      }
    });
  }

  showNetworkStatus(message, type) {
    // Remove existing status
    const existing = document.querySelector('.network-status');
    if (existing) existing.remove();

    // Create status indicator
    const status = document.createElement('div');
    status.className = `network-status ${type}`;
    status.textContent = message;
    
    document.body.appendChild(status);
    
    // Show the status
    requestAnimationFrame(() => {
      status.classList.add('show');
    });

    // Auto hide after 3 seconds
    setTimeout(() => {
      status.classList.remove('show');
      setTimeout(() => status.remove(), 300);
    }, 3000);
  }

  /* ===== OPTIMISTIC UI ===== */
  initOptimisticUI() {
    // Set up optimistic UI handlers
    document.addEventListener('click', (e) => {
      const optimisticElement = e.target.closest('[data-optimistic]');
      if (optimisticElement) {
        this.handleOptimisticAction(optimisticElement, e);
      }
    });

    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.hasAttribute('data-optimistic')) {
        this.handleOptimisticForm(form, e);
      }
    });
  }

  handleOptimisticAction(element, event) {
    const action = element.dataset.optimistic;
    const optimisticState = element.dataset.optimisticState;
    
    // Apply optimistic state immediately
    element.classList.add('optimistic-update', 'pending');
    
    if (optimisticState) {
      element.classList.add(optimisticState);
    }

    // Simulate the action (replace with actual API call)
    this.performOptimisticAction(action, element)
      .then(() => {
        element.classList.remove('pending');
        element.classList.add('optimistic-success');
        
        setTimeout(() => {
          element.classList.remove('optimistic-update', 'optimistic-success');
          if (optimisticState) element.classList.remove(optimisticState);
        }, 600);
      })
      .catch(() => {
        element.classList.remove('pending');
        element.classList.add('optimistic-error');
        
        setTimeout(() => {
          element.classList.remove('optimistic-update', 'optimistic-error');
          if (optimisticState) element.classList.remove(optimisticState);
        }, 600);
      });
  }

  async performOptimisticAction(action, element) {
    // This would be replaced with actual API calls
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Action failed'));
        }
      }, 1000);
    });
  }

  /* ===== SMART PRELOADING ===== */
  initSmartPreloading() {
    // Preload images that are likely to be viewed
    this.preloadNearbyImages();
    
    // Preload on hover
    document.addEventListener('mouseenter', (e) => {
      const link = e.target.closest('a[href]');
      if (link && !link.dataset.preloaded) {
        this.preloadLink(link);
      }
    }, true);

    // Preload critical resources
    this.preloadCriticalResources();
  }

  preloadNearbyImages() {
    const images = document.querySelectorAll('.progressive-image:not(.loaded)');
    const viewportHeight = window.innerHeight;
    const preloadDistance = viewportHeight * this.options.preloadDistance;
    
    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      const distanceFromViewport = rect.top - viewportHeight;
      
      if (distanceFromViewport < preloadDistance && distanceFromViewport > -viewportHeight) {
        this.preloadImage(img);
      }
    });
  }

  preloadImage(container) {
    const mainImg = container.querySelector('.progressive-image-main');
    if (!mainImg || this.imageCache.has(mainImg.dataset.src)) return;

    const img = new Image();
    img.onload = () => {
      this.addToImageCache(mainImg.dataset.src, img.src);
    };
    img.src = mainImg.dataset.src;
  }

  preloadLink(link) {
    link.dataset.preloaded = 'true';
    
    // Create prefetch link
    const prefetch = document.createElement('link');
    prefetch.rel = 'prefetch';
    prefetch.href = link.href;
    document.head.appendChild(prefetch);
  }

  preloadCriticalResources() {
    // Preload fonts
    const fonts = [
      '/fonts/SF-Pro-Display-Regular.woff2',
      '/fonts/SF-Pro-Display-Medium.woff2',
      '/fonts/SF-Pro-Display-Semibold.woff2'
    ];

    fonts.forEach(fontUrl => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = fontUrl;
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  /* ===== ERROR HANDLING ===== */
  initErrorHandling() {
    // Global error handler for failed requests
    window.addEventListener('unhandledrejection', (event) => {
      console.warn('Unhandled promise rejection:', event.reason);
      
      // Show user-friendly error message
      this.showGlobalError('Something went wrong. Please try again.');
    });
  }

  showGlobalError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'global-error';
    errorContainer.innerHTML = `
      <div class="global-error-content">
        <div class="global-error-icon">⚠️</div>
        <div class="global-error-message">${message}</div>
        <button class="btn btn-secondary global-error-dismiss">Dismiss</button>
      </div>
    `;

    document.body.appendChild(errorContainer);

    // Handle dismiss
    errorContainer.querySelector('.global-error-dismiss').addEventListener('click', () => {
      errorContainer.remove();
    });

    // Auto dismiss after 10 seconds
    setTimeout(() => {
      if (errorContainer.parentNode) {
        errorContainer.remove();
      }
    }, 10000);
  }

  retryFailedRequests() {
    // Retry failed lazy loads
    document.querySelectorAll('.lazy-load:not(.loaded)').forEach(element => {
      if (this.loadingStates.get(element) === 'error') {
        this.loadLazyElement(element);
      }
    });

    // Retry failed images
    document.querySelectorAll('.progressive-image:not(.loaded)').forEach(container => {
      if (this.loadingStates.get(container) === 'error') {
        this.loadProgressiveImage(container);
      }
    });
  }

  /* ===== UTILITY METHODS ===== */
  setLoadingState(element, state) {
    this.loadingStates.set(element, state);
    element.setAttribute('data-loading-state', state);
    
    // Update aria-busy for accessibility
    if (state === 'loading') {
      element.setAttribute('aria-busy', 'true');
    } else {
      element.removeAttribute('aria-busy');
    }
  }

  addToImageCache(src, cachedSrc) {
    if (this.imageCache.size >= this.options.imageCacheSize) {
      // Remove oldest entry
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    
    this.imageCache.set(src, cachedSrc);
  }

  createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
      <div class="spinner-ring"></div>
      <span class="sr-only">Loading...</span>
    `;
    return spinner;
  }

  createRetryButton(onRetry) {
    const button = document.createElement('button');
    button.className = 'btn btn-secondary retry-button';
    button.innerHTML = `
      <span class="retry-text">Retry</span>
      <div class="retry-spinner"></div>
    `;
    
    button.addEventListener('click', async () => {
      button.classList.add('loading');
      
      try {
        await onRetry();
      } finally {
        button.classList.remove('loading');
      }
    });
    
    return button;
  }

  /* ===== PUBLIC API ===== */
  
  // Add new elements to be observed
  observe(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.classList.contains('lazy-load')) {
        this.observers.get('lazy').observe(el);
      }
      if (el.classList.contains('progressive-image')) {
        this.observers.get('images').observe(el);
      }
      if (el.classList.contains('stagger-container')) {
        this.observers.get('stagger').observe(el);
      }
    });
  }

  // Force load an element
  forceLoad(element) {
    if (element.classList.contains('lazy-load')) {
      this.loadLazyElement(element);
    } else if (element.classList.contains('progressive-image')) {
      this.loadProgressiveImage(element);
    }
  }

  // Update loading progress
  updateProgress(element, progress) {
    const progressBar = element.querySelector('.loading-progress');
    if (progressBar) {
      const fill = progressBar.querySelector('.progress-fill');
      if (fill) {
        fill.style.width = `${progress}%`;
      }
    }
  }

  // Show skeleton loading
  showSkeleton(element, type = 'default') {
    element.innerHTML = this.getSkeletonHTML(type);
    element.classList.add('skeleton-loading');
  }

  // Hide skeleton loading
  hideSkeleton(element, content) {
    element.classList.remove('skeleton-loading');
    if (content) {
      element.innerHTML = content;
    }
  }

  getSkeletonHTML(type) {
    const skeletons = {
      card: `
        <div class="skeleton-card">
          <div class="skeleton-card-header">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-card-content">
              <div class="skeleton skeleton-text-title"></div>
              <div class="skeleton skeleton-text-short"></div>
            </div>
          </div>
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-card-actions">
            <div class="skeleton skeleton-button"></div>
            <div class="skeleton skeleton-button"></div>
          </div>
        </div>
      `,
      list: `
        <div class="skeleton-list">
          <div class="skeleton-list-item">
            <div class="skeleton skeleton-avatar"></div>
            <div class="skeleton-list-item-content">
              <div class="skeleton skeleton-text-medium"></div>
              <div class="skeleton skeleton-text-short"></div>
            </div>
          </div>
        </div>
      `,
      table: `
        <div class="skeleton-table">
          <div class="skeleton-table-header">
            <div class="skeleton skeleton-table-header-cell"></div>
            <div class="skeleton skeleton-table-header-cell"></div>
            <div class="skeleton skeleton-table-header-cell"></div>
          </div>
          <div class="skeleton-table-row">
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
          </div>
        </div>
      `,
      default: `
        <div class="skeleton skeleton-text-title"></div>
        <div class="skeleton skeleton-text-long"></div>
        <div class="skeleton skeleton-text-medium"></div>
      `
    };

    return skeletons[type] || skeletons.default;
  }

  /* ===== CLEANUP ===== */
  destroy() {
    // Disconnect all observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    // Clear caches
    this.imageCache.clear();
    this.loadingStates.clear();
    this.retryAttempts.clear();

    console.log('SYNTHEX Loading Manager destroyed');
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.synthexLoadingManager = new SynthexLoadingManager();
  });
} else {
  window.synthexLoadingManager = new SynthexLoadingManager();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynthexLoadingManager;
}