// Breadcrumb Navigation Component
class BreadcrumbNavigation {
    constructor() {
        this.currentPath = window.location.pathname;
        this.currentPage = this.detectCurrentPage();
    }

    detectCurrentPage() {
        const filename = this.currentPath.split('/').pop() || 'index.html';
        const pageName = filename.replace('.html', '').replace('-', ' ');
        
        const pageMap = {
            'index': 'Classic Dashboard',
            'index new': 'Home',
            'app': 'Application',
            'dashboard': 'User Dashboard'
        };
        
        return pageMap[pageName] || pageName;
    }

    generateBreadcrumbData() {
        const paths = {
            'index.html': [
                { label: 'Home', url: '/index-new.html' },
                { label: 'Classic Dashboard', url: '/index.html', active: true }
            ],
            'index-new.html': [
                { label: 'Home', url: '/index-new.html', active: true }
            ],
            'app.html': [
                { label: 'Home', url: '/index-new.html' },
                { label: 'Application', url: '/app.html', active: true }
            ],
            'dashboard.html': [
                { label: 'Home', url: '/index-new.html' },
                { label: 'User Dashboard', url: '/dashboard.html', active: true }
            ]
        };

        const filename = this.currentPath.split('/').pop() || 'index-new.html';
        return paths[filename] || paths['index-new.html'];
    }

    createBreadcrumbHTML() {
        const breadcrumbs = this.generateBreadcrumbData();
        
        const html = `
            <nav aria-label="breadcrumb" class="synthex-breadcrumb">
                <ol class="breadcrumb-list">
                    ${breadcrumbs.map((item, index) => `
                        <li class="breadcrumb-item ${item.active ? 'active' : ''}">
                            ${item.active 
                                ? `<span>${item.label}</span>`
                                : `<a href="${item.url}">${item.label}</a>`
                            }
                            ${index < breadcrumbs.length - 1 ? '<span class="separator">/</span>' : ''}
                        </li>
                    `).join('')}
                </ol>
            </nav>
        `;
        
        return html;
    }

    createBreadcrumbStyles() {
        if (document.getElementById('breadcrumb-styles')) return;
        
        const styles = `
            <style id="breadcrumb-styles">
                .synthex-breadcrumb {
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                
                .dark-mode .synthex-breadcrumb,
                [data-theme="dark"] .synthex-breadcrumb {
                    background: rgba(30, 30, 30, 0.95);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .breadcrumb-list {
                    display: flex;
                    align-items: center;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    font-size: 14px;
                }
                
                .breadcrumb-item {
                    display: flex;
                    align-items: center;
                    color: #666;
                }
                
                .dark-mode .breadcrumb-item,
                [data-theme="dark"] .breadcrumb-item {
                    color: #999;
                }
                
                .breadcrumb-item a {
                    color: #4F46E5;
                    text-decoration: none;
                    transition: color 0.2s;
                    font-weight: 500;
                }
                
                .breadcrumb-item a:hover {
                    color: #6366F1;
                    text-decoration: underline;
                }
                
                .dark-mode .breadcrumb-item a,
                [data-theme="dark"] .breadcrumb-item a {
                    color: #818CF8;
                }
                
                .dark-mode .breadcrumb-item a:hover,
                [data-theme="dark"] .breadcrumb-item a:hover {
                    color: #A5B4FC;
                }
                
                .breadcrumb-item.active {
                    color: #111;
                    font-weight: 600;
                }
                
                .dark-mode .breadcrumb-item.active,
                [data-theme="dark"] .breadcrumb-item.active {
                    color: #fff;
                }
                
                .breadcrumb-item .separator {
                    margin: 0 12px;
                    color: #999;
                    font-weight: 400;
                }
                
                .dark-mode .breadcrumb-item .separator,
                [data-theme="dark"] .breadcrumb-item .separator {
                    color: #666;
                }
                
                /* Mobile responsiveness */
                @media (max-width: 640px) {
                    .synthex-breadcrumb {
                        padding: 8px 16px;
                    }
                    
                    .breadcrumb-list {
                        font-size: 12px;
                    }
                    
                    .breadcrumb-item .separator {
                        margin: 0 8px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    insertBreadcrumb(targetSelector = 'body', position = 'afterbegin') {
        this.createBreadcrumbStyles();
        const breadcrumbHTML = this.createBreadcrumbHTML();
        
        const target = document.querySelector(targetSelector);
        if (target) {
            // Check if breadcrumb already exists
            const existingBreadcrumb = document.querySelector('.synthex-breadcrumb');
            if (existingBreadcrumb) {
                existingBreadcrumb.remove();
            }
            
            target.insertAdjacentHTML(position, breadcrumbHTML);
        }
    }

    // Method to update breadcrumb dynamically
    updateBreadcrumb(newPath) {
        this.currentPath = newPath;
        this.currentPage = this.detectCurrentPage();
        this.insertBreadcrumb();
    }
}

// Auto-initialize breadcrumb when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.breadcrumbNav = new BreadcrumbNavigation();
        window.breadcrumbNav.insertBreadcrumb();
    });
} else {
    window.breadcrumbNav = new BreadcrumbNavigation();
    window.breadcrumbNav.insertBreadcrumb();
}