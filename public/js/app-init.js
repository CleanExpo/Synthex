/**
 * App Initialization Script
 * Registers service worker and initializes performance optimizations
 */

(function() {
    'use strict';

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                    
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute
                    
                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available
                                if (confirm('New version available! Reload to update?')) {
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                    window.location.reload();
                                }
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('ServiceWorker registration failed:', error);
                });
        });
    }

    // Preload critical resources
    function preloadResources() {
        const criticalResources = [
            { href: '/css/synthex-unified.css', as: 'style' },
            { href: '/js/auth-api.js', as: 'script' },
            { href: '/js/theme-manager.js', as: 'script' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
    }

    // Lazy load non-critical CSS
    function loadDeferredStyles() {
        const deferredStyles = [
            '/css/components/analytics-dashboard.css',
            '/css/components/notifications.css',
            '/css/micro-interactions.css'
        ];

        deferredStyles.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.media = 'print';
            link.onload = function() {
                this.media = 'all';
            };
            document.head.appendChild(link);
        });
    }

    // Progressive enhancement for forms
    function enhanceForms() {
        document.querySelectorAll('form').forEach(form => {
            // Add loading states
            form.addEventListener('submit', function(e) {
                const submitBtn = this.querySelector('[type="submit"]');
                if (submitBtn) {
                    submitBtn.classList.add('loading');
                    submitBtn.disabled = true;
                }
            });

            // Add validation feedback
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            inputs.forEach(input => {
                input.addEventListener('blur', function() {
                    if (this.validity.valid) {
                        this.classList.remove('error');
                        this.classList.add('valid');
                    } else {
                        this.classList.remove('valid');
                        this.classList.add('error');
                    }
                });
            });
        });
    }

    // Optimize images
    function optimizeImages() {
        // Convert images to WebP where supported
        if ('loading' in HTMLImageElement.prototype) {
            document.querySelectorAll('img').forEach(img => {
                if (!img.loading) {
                    img.loading = 'lazy';
                }
            });
        } else {
            // Fallback lazy loading
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/lazysizes@5/lazysizes.min.js';
            document.body.appendChild(script);
        }
    }

    // Monitor performance metrics
    function monitorPerformance() {
        if ('PerformanceObserver' in window) {
            // Log Web Vitals
            const vitals = {};
            
            // Largest Contentful Paint
            try {
                const lcpObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                // LCP API not supported in this browser
                console.debug('[Web Vitals] LCP observer not supported:', e.message);
            }

            // First Input Delay
            try {
                const fidObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        vitals.fid = entry.processingStart - entry.startTime;
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                // FID API not supported in this browser
                console.debug('[Web Vitals] FID observer not supported:', e.message);
            }

            // Cumulative Layout Shift
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            vitals.cls = clsValue;
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                // CLS API not supported in this browser
                console.debug('[Web Vitals] CLS observer not supported:', e.message);
            }

            // Report metrics after page load
            window.addEventListener('load', () => {
                setTimeout(() => {
                    console.log('Web Vitals:', vitals);
                    
                    // Send to analytics if available
                    if (window.gtag) {
                        Object.entries(vitals).forEach(([metric, value]) => {
                            gtag('event', metric, {
                                value: Math.round(metric === 'cls' ? value * 1000 : value),
                                event_category: 'Web Vitals',
                                non_interaction: true
                            });
                        });
                    }
                }, 3000);
            });
        }
    }

    // Initialize network information API
    function initNetworkAPI() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            // Adjust quality based on connection
            function adjustQuality() {
                const slowConnection = connection.saveData || 
                                      connection.effectiveType === 'slow-2g' || 
                                      connection.effectiveType === '2g';
                
                if (slowConnection) {
                    document.body.classList.add('low-bandwidth');
                    // Disable auto-play videos
                    document.querySelectorAll('video[autoplay]').forEach(video => {
                        video.removeAttribute('autoplay');
                    });
                } else {
                    document.body.classList.remove('low-bandwidth');
                }
            }
            
            adjustQuality();
            connection.addEventListener('change', adjustQuality);
        }
    }

    // Prefetch likely navigation targets
    function setupPrefetch() {
        if ('IntersectionObserver' in window && 'requestIdleCallback' in window) {
            const prefetched = new Set();
            
            const linkObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const link = entry.target;
                        const href = link.href;
                        
                        if (!prefetched.has(href)) {
                            requestIdleCallback(() => {
                                const prefetchLink = document.createElement('link');
                                prefetchLink.rel = 'prefetch';
                                prefetchLink.href = href;
                                document.head.appendChild(prefetchLink);
                                prefetched.add(href);
                            });
                        }
                    }
                });
            }, {
                rootMargin: '0px 0px 100px 0px'
            });
            
            // Observe internal links
            document.querySelectorAll('a[href^="/"]').forEach(link => {
                linkObserver.observe(link);
            });
        }
    }

    // Initialize all optimizations
    function init() {
        preloadResources();
        requestAnimationFrame(() => {
            loadDeferredStyles();
            enhanceForms();
            optimizeImages();
            initNetworkAPI();
            setupPrefetch();
            monitorPerformance();
        });
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for dynamic loading
    window.AppInit = {
        loadCSS: function(href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
            return new Promise((resolve, reject) => {
                link.onload = resolve;
                link.onerror = reject;
            });
        },
        loadScript: function(src) {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            document.body.appendChild(script);
            return new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
        },
        prefetch: function(url) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        }
    };
})();