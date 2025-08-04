// Unified Footer Component for Synthex
class SynthexFooter {
    constructor() {
        this.currentYear = new Date().getFullYear();
    }

    createFooterHTML() {
        return `
            <footer class="synthex-footer">
                <div class="footer-container">
                    <div class="footer-content">
                        <div class="footer-section">
                            <div class="footer-logo">
                                <img src="/logo.png" alt="Synthex Logo" class="footer-logo-img">
                                <h3>SYNTHEX</h3>
                            </div>
                            <p class="footer-tagline">AI-Powered Marketing Mastery Platform</p>
                            <p class="footer-description">Transform your marketing with intelligent content generation and optimization.</p>
                        </div>
                        
                        <div class="footer-section">
                            <h4>Quick Links</h4>
                            <ul class="footer-links">
                                <li><a href="/index-new.html">Home</a></li>
                                <li><a href="/app.html">Application</a></li>
                                <li><a href="/dashboard.html">Dashboard</a></li>
                                <li><a href="/index.html">Classic View</a></li>
                            </ul>
                        </div>
                        
                        <div class="footer-section">
                            <h4>Features</h4>
                            <ul class="footer-links">
                                <li><a href="/app.html#generate">Content Generation</a></li>
                                <li><a href="/app.html#optimize">Platform Optimization</a></li>
                                <li><a href="/app.html#analytics">Analytics</a></li>
                                <li><a href="/dashboard.html#api-keys">API Configuration</a></li>
                            </ul>
                        </div>
                        
                        <div class="footer-section">
                            <h4>Support</h4>
                            <ul class="footer-links">
                                <li><a href="#" onclick="showHelp(); return false;">Help Center</a></li>
                                <li><a href="#" onclick="showDocs(); return false;">Documentation</a></li>
                                <li><a href="#" onclick="showAPIStatus(); return false;">API Status</a></li>
                                <li><a href="mailto:support@synthex.ai">Contact Support</a></li>
                            </ul>
                        </div>
                        
                        <div class="footer-section">
                            <h4>Connect</h4>
                            <div class="social-links">
                                <a href="#" aria-label="Twitter" class="social-link">
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                                    </svg>
                                </a>
                                <a href="#" aria-label="GitHub" class="social-link">
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                </a>
                                <a href="#" aria-label="LinkedIn" class="social-link">
                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer-bottom">
                        <div class="footer-bottom-content">
                            <p>&copy; ${this.currentYear} Synthex. All rights reserved.</p>
                            <div class="footer-bottom-links">
                                <a href="#" onclick="showPrivacy(); return false;">Privacy Policy</a>
                                <a href="#" onclick="showTerms(); return false;">Terms of Service</a>
                                <a href="#" onclick="showCookies(); return false;">Cookie Policy</a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }

    createFooterStyles() {
        if (document.getElementById('footer-styles')) return;
        
        const styles = `
            <style id="footer-styles">
                .synthex-footer {
                    background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 1) 100%);
                    color: #e2e8f0;
                    padding: 60px 0 0;
                    margin-top: 80px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                }
                
                .synthex-footer::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #4f46e5, transparent);
                    animation: shimmer 3s infinite;
                }
                
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                
                .footer-container {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                
                .footer-content {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 40px;
                }
                
                .footer-section h3 {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 12px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .footer-section h4 {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: #fff;
                }
                
                .footer-logo {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                
                .footer-logo-img {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                }
                
                .footer-tagline {
                    font-size: 14px;
                    color: #a5b4fc;
                    margin-bottom: 8px;
                    font-weight: 500;
                }
                
                .footer-description {
                    font-size: 14px;
                    color: #94a3b8;
                    line-height: 1.6;
                }
                
                .footer-links {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .footer-links li {
                    margin-bottom: 12px;
                }
                
                .footer-links a {
                    color: #94a3b8;
                    text-decoration: none;
                    font-size: 14px;
                    transition: color 0.2s;
                }
                
                .footer-links a:hover {
                    color: #a5b4fc;
                }
                
                .social-links {
                    display: flex;
                    gap: 16px;
                }
                
                .social-link {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    color: #94a3b8;
                    transition: all 0.2s;
                }
                
                .social-link:hover {
                    background: rgba(79, 70, 229, 0.2);
                    color: #a5b4fc;
                    transform: translateY(-2px);
                }
                
                .footer-bottom {
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 24px 0;
                }
                
                .footer-bottom-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                }
                
                .footer-bottom-content p {
                    margin: 0;
                    color: #64748b;
                    font-size: 14px;
                }
                
                .footer-bottom-links {
                    display: flex;
                    gap: 24px;
                }
                
                .footer-bottom-links a {
                    color: #64748b;
                    text-decoration: none;
                    font-size: 14px;
                    transition: color 0.2s;
                }
                
                .footer-bottom-links a:hover {
                    color: #a5b4fc;
                }
                
                /* Light theme adjustments */
                .light-mode .synthex-footer,
                [data-theme="light"] .synthex-footer {
                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
                    color: #475569;
                    border-top: 1px solid #e2e8f0;
                }
                
                .light-mode .footer-section h4,
                [data-theme="light"] .footer-section h4 {
                    color: #1e293b;
                }
                
                .light-mode .footer-links a,
                [data-theme="light"] .footer-links a {
                    color: #64748b;
                }
                
                .light-mode .footer-links a:hover,
                [data-theme="light"] .footer-links a:hover {
                    color: #4f46e5;
                }
                
                .light-mode .social-link,
                [data-theme="light"] .social-link {
                    background: rgba(0, 0, 0, 0.05);
                    color: #64748b;
                }
                
                .light-mode .social-link:hover,
                [data-theme="light"] .social-link:hover {
                    background: rgba(79, 70, 229, 0.1);
                    color: #4f46e5;
                }
                
                /* Mobile responsiveness */
                @media (max-width: 1024px) {
                    .footer-content {
                        grid-template-columns: repeat(3, 1fr);
                    }
                    
                    .footer-section:first-child {
                        grid-column: span 3;
                    }
                }
                
                @media (max-width: 640px) {
                    .footer-content {
                        grid-template-columns: 1fr;
                        gap: 32px;
                    }
                    
                    .footer-section:first-child {
                        grid-column: span 1;
                    }
                    
                    .footer-bottom-content {
                        flex-direction: column;
                        text-align: center;
                    }
                    
                    .footer-bottom-links {
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    insertFooter() {
        this.createFooterStyles();
        const footerHTML = this.createFooterHTML();
        
        // Check if footer already exists
        const existingFooter = document.querySelector('.synthex-footer');
        if (existingFooter) {
            existingFooter.remove();
        }
        
        // Insert before closing body tag
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
}

// Global functions for footer links
window.showHelp = function() {
    alert('Help Center coming soon! For now, please email support@synthex.ai');
};

window.showDocs = function() {
    alert('Documentation is being prepared. Check back soon!');
};

window.showAPIStatus = function() {
    window.location.href = '/api/openrouter/status';
};

window.showPrivacy = function() {
    alert('Privacy Policy will be available soon.');
};

window.showTerms = function() {
    alert('Terms of Service will be available soon.');
};

window.showCookies = function() {
    alert('Cookie Policy will be available soon.');
};

// Auto-initialize footer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.synthexFooter = new SynthexFooter();
        window.synthexFooter.insertFooter();
    });
} else {
    window.synthexFooter = new SynthexFooter();
    window.synthexFooter.insertFooter();
}