/**
 * Performance Optimization Module
 * Handles lazy loading, code splitting, and resource optimization
 */

class PerformanceOptimizer {
    constructor() {
        this.lazyLoadQueue = new Set();
        this.loadedResources = new Set();
        this.criticalCSS = null;
        this.prefetchQueue = [];
        this.init();
    }

    init() {
        // Set up Intersection Observer for lazy loading
        this.setupLazyLoading();
        
        // Optimize images
        this.optimizeImages();
        
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Set up resource hints
        this.setupResourceHints();
        
        // Monitor performance
        this.monitorPerformance();
    }

    /**
     * Set up lazy loading for images and components
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                            observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });

            // Lazy load components
            const componentObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const component = entry.target;
                        if (component.dataset.component) {
                            this.loadComponent(component.dataset.component);
                            observer.unobserve(component);
                        }
                    }
                });
            }, {
                rootMargin: '100px 0px',
                threshold: 0.01
            });

            document.querySelectorAll('[data-component]').forEach(component => {
                componentObserver.observe(component);
            });
        }
    }

    /**
     * Optimize images with responsive loading
     */
    optimizeImages() {
        const images = document.querySelectorAll('img:not([data-optimized])');
        
        images.forEach(img => {
            // Add loading attribute for native lazy loading
            if (!img.loading) {
                img.loading = 'lazy';
            }
            
            // Add responsive sizing
            if (img.dataset.sizes) {
                img.sizes = img.dataset.sizes;
            }
            
            // Mark as optimized
            img.dataset.optimized = 'true';
        });
    }

    /**
     * Preload critical resources
     */
    preloadCriticalResources() {
        const criticalResources = [
            { href: '/css/critical.css', as: 'style' },
            { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: true }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            if (resource.type) link.type = resource.type;
            if (resource.crossorigin) link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    /**
     * Set up resource hints for better performance
     */
    setupResourceHints() {
        // DNS prefetch for external domains
        const dnsPrefetchDomains = [
            'https://fonts.googleapis.com',
            'https://cdn.jsdelivr.net',
            'https://api.synthex.social'
        ];

        dnsPrefetchDomains.forEach(domain => {
            const link = document.createElement('link');
            link.rel = 'dns-prefetch';
            link.href = domain;
            document.head.appendChild(link);
        });

        // Preconnect to critical domains
        const preconnectDomains = [
            'https://fonts.gstatic.com'
        ];

        preconnectDomains.forEach(domain => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = domain;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    /**
     * Load component dynamically
     */
    async loadComponent(componentName) {
        if (this.loadedResources.has(componentName)) {
            return;
        }

        try {
            const module = await import(`./components/${componentName}.js`);
            if (module.default && typeof module.default.init === 'function') {
                module.default.init();
            }
            this.loadedResources.add(componentName);
        } catch (error) {
            console.error(`Failed to load component: ${componentName}`, error);
        }
    }

    /**
     * Load CSS dynamically
     */
    loadCSS(href, options = {}) {
        return new Promise((resolve, reject) => {
            if (this.loadedResources.has(href)) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            
            if (options.media) {
                link.media = options.media;
            }
            
            link.onload = () => {
                this.loadedResources.add(href);
                resolve();
            };
            
            link.onerror = reject;
            
            document.head.appendChild(link);
        });
    }

    /**
     * Load JavaScript dynamically
     */
    loadScript(src, options = {}) {
        return new Promise((resolve, reject) => {
            if (this.loadedResources.has(src)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            
            if (options.async) script.async = true;
            if (options.defer) script.defer = true;
            if (options.module) script.type = 'module';
            
            script.onload = () => {
                this.loadedResources.add(src);
                resolve();
            };
            
            script.onerror = reject;
            
            document.body.appendChild(script);
        });
    }

    /**
     * Prefetch resources for future navigation
     */
    prefetchResource(url) {
        if (this.loadedResources.has(url) || this.prefetchQueue.includes(url)) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
        
        this.prefetchQueue.push(url);
    }

    /**
     * Monitor and report performance metrics
     */
    monitorPerformance() {
        if ('PerformanceObserver' in window) {
            // Monitor Largest Contentful Paint
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                // LCP not supported
            }

            // Monitor First Input Delay
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        console.log('FID:', entry.processingStart - entry.startTime);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                // FID not supported
            }

            // Monitor Cumulative Layout Shift
            try {
                let clsScore = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsScore += entry.value;
                        }
                    }
                    console.log('CLS:', clsScore);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                // CLS not supported
            }
        }

        // Report Web Vitals
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = window.performance.timing;
                    const metrics = {
                        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                        loadComplete: timing.loadEventEnd - timing.navigationStart,
                        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
                    };
                    
                    console.log('Performance Metrics:', metrics);
                    
                    // Send metrics to analytics if needed
                    if (window.analytics) {
                        window.analytics.track('Performance Metrics', metrics);
                    }
                }, 0);
            });
        }
    }

    /**
     * Optimize bundle by removing unused code
     */
    treeShake() {
        // Mark used features
        const usedFeatures = new Set();
        
        // Scan DOM for used features
        if (document.querySelector('.modal')) usedFeatures.add('modal');
        if (document.querySelector('.toast')) usedFeatures.add('toast');
        if (document.querySelector('[data-theme-toggle]')) usedFeatures.add('theme');
        if (document.querySelector('form[data-validate]')) usedFeatures.add('validation');
        
        return usedFeatures;
    }

    /**
     * Compress and minify inline styles
     */
    optimizeInlineStyles() {
        const styleElements = document.querySelectorAll('style:not([data-optimized])');
        
        styleElements.forEach(style => {
            let css = style.innerHTML;
            
            // Remove comments
            css = css.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // Remove unnecessary whitespace
            css = css.replace(/\s+/g, ' ');
            css = css.replace(/:\s+/g, ':');
            css = css.replace(/;\s+/g, ';');
            css = css.replace(/\{\s+/g, '{');
            css = css.replace(/\}\s+/g, '}');
            
            style.innerHTML = css;
            style.dataset.optimized = 'true';
        });
    }

    /**
     * Cache API responses
     */
    setupResponseCache() {
        const cache = new Map();
        const maxCacheSize = 50;
        const cacheTime = 5 * 60 * 1000; // 5 minutes
        
        // Override fetch to add caching
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            
            // Only cache GET requests
            if (options.method && options.method !== 'GET') {
                return originalFetch.apply(this, args);
            }
            
            const cacheKey = url.toString();
            const cached = cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < cacheTime) {
                return Promise.resolve(cached.response.clone());
            }
            
            return originalFetch.apply(this, args).then(response => {
                // Only cache successful responses
                if (response.ok) {
                    // Maintain cache size
                    if (cache.size >= maxCacheSize) {
                        const firstKey = cache.keys().next().value;
                        cache.delete(firstKey);
                    }
                    
                    cache.set(cacheKey, {
                        response: response.clone(),
                        timestamp: Date.now()
                    });
                }
                
                return response;
            });
        };
    }

    /**
     * Debounce function for performance
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function for performance
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Initialize performance optimizer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.performanceOptimizer = new PerformanceOptimizer();
    });
} else {
    window.performanceOptimizer = new PerformanceOptimizer();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}