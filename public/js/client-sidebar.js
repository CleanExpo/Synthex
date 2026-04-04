/**
 * SYNTHEX Client Sidebar Component
 * Modern glassmorphic sidebar with consistent design
 * Version: 2.0.0
 */

class ClientSidebar {
    constructor(options = {}) {
        this.defaults = {
            container: document.body,
            position: 'left',
            width: 280,
            collapsedWidth: 64,
            collapsible: true,
            overlay: true,
            pushContent: true,
            localStorage: true,
            animations: true
        };
        
        this.config = { ...this.defaults, ...options };
        this.isOpen = true;
        this.isCollapsed = false;
        this.activeSection = null;
        this.menuItems = [];
        
        this.init();
    }
    
    init() {
        this.createSidebar();
        this.loadState();
        this.loadUserData();
        this.setupEventListeners();
        this.applyAnimations();
    }
    
    createSidebar() {
        // Create sidebar container
        this.sidebar = document.createElement('aside');
        this.sidebar.className = 'client-sidebar glass-container';
        this.sidebar.setAttribute('data-position', this.config.position);
        
        // Create sidebar content structure
        this.sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <img src="/logo.png" alt="SYNTHEX" class="logo-image float">
                    <span class="logo-text gradient-text">SYNTHEX</span>
                </div>
                <button class="sidebar-toggle glass-button">
                    <svg class="toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            
            <div class="sidebar-search">
                <div class="search-container glass-input">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input type="text" class="search-input" placeholder="Search...">
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <div class="nav-section" data-section="main">
                    <div class="nav-section-title">
                        <span>MAIN MENU</span>
                        <button class="section-collapse">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="nav-items"></div>
                </div>
                
                <div class="nav-section" data-section="workspace">
                    <div class="nav-section-title">
                        <span>WORKSPACE</span>
                        <button class="section-collapse">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="nav-items"></div>
                </div>
                
                <div class="nav-section" data-section="tools">
                    <div class="nav-section-title">
                        <span>TOOLS</span>
                        <button class="section-collapse">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="nav-items"></div>
                </div>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-profile glass-card">
                    <img src="https://via.placeholder.com/40" alt="User" class="user-avatar">
                    <div class="user-info">
                        <div class="user-name" id="sidebar-user-name">Loading...</div>
                        <div class="user-role" id="sidebar-user-role">Member</div>
                    </div>
                    <button class="profile-menu-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="sidebar-actions">
                    <button class="action-btn glass-button" data-tooltip="Settings">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span class="action-label">Settings</span>
                    </button>
                    <button class="action-btn glass-button" data-tooltip="Help">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="action-label">Help</span>
                    </button>
                </div>
            </div>
        `;
        
        // Add overlay if configured
        if (this.config.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'sidebar-overlay';
            this.config.container.appendChild(this.overlay);
        }
        
        // Add sidebar to container
        this.config.container.appendChild(this.sidebar);
        
        // Apply initial styles
        this.applyStyles();
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .client-sidebar {
                position: fixed;
                top: 0;
                ${this.config.position}: 0;
                width: ${this.config.width}px;
                height: 100vh;
                background: var(--synthex-glass-bg);
                backdrop-filter: blur(var(--synthex-glass-blur-heavy));
                border-${this.config.position === 'left' ? 'right' : 'left'}: 1px solid var(--synthex-glass-border);
                display: flex;
                flex-direction: column;
                z-index: 1000;
                transition: transform var(--synthex-transition-base), width var(--synthex-transition-base);
                overflow: hidden;
            }
            
            .client-sidebar.collapsed {
                width: ${this.config.collapsedWidth}px;
            }
            
            .client-sidebar.closed {
                transform: translateX(${this.config.position === 'left' ? '-100%' : '100%'});
            }
            
            .sidebar-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 999;
                opacity: 0;
                visibility: hidden;
                transition: opacity var(--synthex-transition-base), visibility var(--synthex-transition-base);
            }
            
            .sidebar-overlay.active {
                opacity: 1;
                visibility: visible;
            }
            
            .sidebar-header {
                padding: var(--synthex-space-4);
                border-bottom: 1px solid var(--synthex-glass-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .sidebar-logo {
                display: flex;
                align-items: center;
                gap: var(--synthex-space-3);
                transition: opacity var(--synthex-transition-base);
            }
            
            .collapsed .sidebar-logo .logo-text {
                opacity: 0;
                width: 0;
                overflow: hidden;
            }
            
            .logo-image {
                width: 36px;
                height: 36px;
                filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.5));
            }
            
            .logo-text {
                font-size: var(--synthex-text-xl);
                font-weight: var(--synthex-font-bold);
                transition: opacity var(--synthex-transition-base), width var(--synthex-transition-base);
            }
            
            .sidebar-toggle {
                width: 32px;
                height: 32px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--synthex-radius-md);
            }
            
            .sidebar-search {
                padding: var(--synthex-space-4);
                border-bottom: 1px solid var(--synthex-glass-border);
            }
            
            .collapsed .sidebar-search {
                padding: var(--synthex-space-2);
            }
            
            .search-container {
                position: relative;
                display: flex;
                align-items: center;
                gap: var(--synthex-space-2);
                padding: var(--synthex-space-2) var(--synthex-space-3);
            }
            
            .search-icon {
                opacity: 0.6;
                flex-shrink: 0;
            }
            
            .search-input {
                background: transparent;
                border: none;
                color: var(--synthex-white);
                outline: none;
                flex: 1;
                font-size: var(--synthex-text-sm);
            }
            
            .collapsed .search-input {
                width: 0;
                opacity: 0;
            }
            
            .sidebar-nav {
                flex: 1;
                overflow-y: auto;
                padding: var(--synthex-space-4);
            }
            
            .collapsed .sidebar-nav {
                padding: var(--synthex-space-2);
            }
            
            .nav-section {
                margin-bottom: var(--synthex-space-6);
            }
            
            .nav-section-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: var(--synthex-text-xs);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: rgba(255, 255, 255, 0.4);
                margin-bottom: var(--synthex-space-3);
                padding: 0 var(--synthex-space-2);
            }
            
            .collapsed .nav-section-title span {
                display: none;
            }
            
            .section-collapse {
                background: transparent;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 4px;
                transition: transform var(--synthex-transition-fast);
            }
            
            .nav-section.collapsed .section-collapse {
                transform: rotate(-90deg);
            }
            
            .nav-section.collapsed .nav-items {
                display: none;
            }
            
            .nav-item {
                display: flex;
                align-items: center;
                gap: var(--synthex-space-3);
                padding: var(--synthex-space-3) var(--synthex-space-3);
                margin-bottom: var(--synthex-space-1);
                border-radius: var(--synthex-radius-lg);
                color: rgba(255, 255, 255, 0.7);
                text-decoration: none;
                transition: all var(--synthex-transition-fast);
                cursor: pointer;
                position: relative;
            }
            
            .nav-item:hover {
                background: var(--synthex-glass-bg-hover);
                color: var(--synthex-white);
                transform: translateX(4px);
            }
            
            .nav-item.active {
                background: var(--synthex-gradient-primary);
                color: var(--synthex-white);
                font-weight: var(--synthex-font-medium);
            }
            
            .nav-item.active::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 70%;
                background: var(--synthex-white);
                border-radius: 0 3px 3px 0;
            }
            
            .nav-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }
            
            .nav-label {
                flex: 1;
                font-size: var(--synthex-text-sm);
                transition: opacity var(--synthex-transition-base);
            }
            
            .collapsed .nav-label {
                opacity: 0;
                width: 0;
                overflow: hidden;
            }
            
            .nav-badge {
                padding: 2px 8px;
                background: var(--synthex-accent);
                border-radius: var(--synthex-radius-full);
                font-size: var(--synthex-text-xs);
                font-weight: var(--synthex-font-semibold);
            }
            
            .collapsed .nav-badge {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 2px 4px;
                min-width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .sidebar-footer {
                padding: var(--synthex-space-4);
                border-top: 1px solid var(--synthex-glass-border);
            }
            
            .user-profile {
                display: flex;
                align-items: center;
                gap: var(--synthex-space-3);
                padding: var(--synthex-space-3);
                margin-bottom: var(--synthex-space-3);
                position: relative;
            }
            
            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: var(--synthex-radius-full);
                flex-shrink: 0;
            }
            
            .user-info {
                flex: 1;
                transition: opacity var(--synthex-transition-base);
            }
            
            .collapsed .user-info {
                opacity: 0;
                width: 0;
                overflow: hidden;
            }
            
            .user-name {
                font-weight: var(--synthex-font-semibold);
                font-size: var(--synthex-text-sm);
            }
            
            .user-role {
                font-size: var(--synthex-text-xs);
                color: rgba(255, 255, 255, 0.6);
            }
            
            .profile-menu-btn {
                background: transparent;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                cursor: pointer;
                padding: 4px;
                transition: color var(--synthex-transition-fast);
            }
            
            .profile-menu-btn:hover {
                color: var(--synthex-white);
            }
            
            .collapsed .profile-menu-btn {
                display: none;
            }
            
            .sidebar-actions {
                display: flex;
                gap: var(--synthex-space-2);
            }
            
            .collapsed .sidebar-actions {
                flex-direction: column;
            }
            
            .action-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--synthex-space-2);
                padding: var(--synthex-space-2);
                font-size: var(--synthex-text-sm);
            }
            
            .collapsed .action-label {
                display: none;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .client-sidebar {
                    width: ${this.config.width}px !important;
                }
                
                .client-sidebar.closed {
                    transform: translateX(${this.config.position === 'left' ? '-100%' : '100%'});
                }
                
                .sidebar-overlay {
                    display: block;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    addMenuItem(section, item) {
        const navSection = this.sidebar.querySelector(`[data-section="${section}"] .nav-items`);
        if (!navSection) return;
        
        const navItem = document.createElement('a');
        navItem.className = 'nav-item';
        navItem.href = item.href || '#';
        navItem.innerHTML = `
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
            ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
        `;
        
        if (item.active) {
            navItem.classList.add('active');
        }
        
        navItem.addEventListener('click', (e) => {
            if (item.onClick) {
                e.preventDefault();
                item.onClick(e);
            }
            
            // Update active state
            this.sidebar.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active');
            });
            navItem.classList.add('active');
        });
        
        navSection.appendChild(navItem);
        this.menuItems.push({ section, element: navItem, config: item });
    }
    
    setupEventListeners() {
        // Toggle button
        const toggleBtn = this.sidebar.querySelector('.sidebar-toggle');
        toggleBtn.addEventListener('click', () => this.toggle());
        
        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }
        
        // Section collapse
        this.sidebar.querySelectorAll('.section-collapse').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.nav-section');
                section.classList.toggle('collapsed');
            });
        });
        
        // Search functionality
        const searchInput = this.sidebar.querySelector('.search-input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Profile menu
        const profileBtn = this.sidebar.querySelector('.profile-menu-btn');
        profileBtn.addEventListener('click', () => this.showProfileMenu());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '\\') {
                this.toggle();
            }
        });
    }
    
    handleSearch(query) {
        const lowerQuery = query.toLowerCase();
        
        this.menuItems.forEach(item => {
            const label = item.config.label.toLowerCase();
            if (label.includes(lowerQuery) || !query) {
                item.element.style.display = 'flex';
            } else {
                item.element.style.display = 'none';
            }
        });
    }
    
    showProfileMenu() {
        const menu = window.synthexUI.createDropdown(
            this.sidebar.querySelector('.profile-menu-btn'),
            {
                items: [
                    { icon: '👤', label: 'Profile', handler: () => console.log('Profile') },
                    { icon: '⚙️', label: 'Settings', handler: () => console.log('Settings') },
                    { divider: true },
                    { icon: '🚪', label: 'Logout', handler: () => console.log('Logout') }
                ],
                position: 'top',
                align: 'end'
            }
        );
        
        document.body.appendChild(menu);
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.sidebar.classList.remove('closed');
        if (this.overlay) {
            this.overlay.classList.add('active');
        }
        this.isOpen = true;
        this.saveState();
    }
    
    close() {
        this.sidebar.classList.add('closed');
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
        this.isOpen = false;
        this.saveState();
    }
    
    collapse() {
        this.sidebar.classList.add('collapsed');
        this.isCollapsed = true;
        this.saveState();
    }
    
    expand() {
        this.sidebar.classList.remove('collapsed');
        this.isCollapsed = false;
        this.saveState();
    }
    
    saveState() {
        if (this.config.localStorage) {
            localStorage.setItem('synthex-sidebar-state', JSON.stringify({
                isOpen: this.isOpen,
                isCollapsed: this.isCollapsed
            }));
        }
    }
    
    loadUserData() {
        // Load user data from localStorage or session
        try {
            const nameElement = document.getElementById('sidebar-user-name');
            const roleElement = document.getElementById('sidebar-user-role');
            
            // First check for logged-in user data
            const loginUser = localStorage.getItem('user');
            if (loginUser) {
                const user = JSON.parse(loginUser);
                if (nameElement) {
                    nameElement.textContent = user.name || user.email || 'User';
                }
                if (roleElement) {
                    roleElement.textContent = 'Pro Member';
                }
                return;
            }
            
            // Then check onboarding data
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                if (nameElement) {
                    nameElement.textContent = user.companyName || user.name || 'User';
                }
                if (roleElement) {
                    roleElement.textContent = user.userType || 'Pro Member';
                }
                return;
            }
            
            // Default fallback
            if (nameElement) {
                nameElement.textContent = 'Guest';
            }
        } catch (error) {
            console.log('Could not load user data:', error);
        }
    }
    
    loadState() {
        if (this.config.localStorage) {
            const state = localStorage.getItem('synthex-sidebar-state');
            if (state) {
                const { isOpen, isCollapsed } = JSON.parse(state);
                if (!isOpen) this.close();
                if (isCollapsed) this.collapse();
            }
        }
    }
    
    applyAnimations() {
        if (!this.config.animations) return;
        
        // Add entrance animation
        this.sidebar.style.animation = 'slideInLeft 0.3s ease';
        
        // Add hover effects to nav items
        this.sidebar.querySelectorAll('.nav-item').forEach((item, index) => {
            item.style.animationDelay = `${index * 0.05}s`;
            item.classList.add('animate-on-scroll');
        });
    }
    
    destroy() {
        this.sidebar.remove();
        if (this.overlay) {
            this.overlay.remove();
        }
    }
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.clientSidebar = new ClientSidebar();
    });
} else {
    window.clientSidebar = new ClientSidebar();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientSidebar;
}