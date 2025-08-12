/**
 * SYNTHEX Theme Manager
 * Dark/Light mode toggle with system preference detection
 */

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    init() {
        // Apply initial theme
        this.applyTheme(this.currentTheme);

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.getStoredTheme()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        // Initialize toggle buttons
        this.initializeToggles();
    }

    getStoredTheme() {
        return localStorage.getItem('synthex-theme');
    }

    setStoredTheme(theme) {
        localStorage.setItem('synthex-theme', theme);
    }

    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        
        // Apply to HTML element
        document.documentElement.setAttribute('data-theme', theme);
        
        // Apply to body for compatibility
        document.body.setAttribute('data-theme', theme);
        
        // Update meta theme color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = theme === 'dark' ? '#0a0a0a' : '#ffffff';
        }

        // Trigger custom event
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

        // Update all toggle buttons
        this.updateToggleButtons(theme);
    }

    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setStoredTheme(newTheme);
        this.applyTheme(newTheme);
        
        // Show toast notification
        if (window.toastNotifications) {
            window.toastNotifications.info(
                `Switched to ${newTheme} mode`,
                '',
                { duration: 2000 }
            );
        }
    }

    initializeToggles() {
        // Find all theme toggle buttons
        const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle();
            });
        });

        // Update initial state
        this.updateToggleButtons(this.currentTheme);
    }

    updateToggleButtons(theme) {
        const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
        
        toggleButtons.forEach(button => {
            // Update icon if it exists
            const icon = button.querySelector('[data-theme-icon]');
            if (icon) {
                if (theme === 'dark') {
                    icon.innerHTML = this.getMoonIcon();
                } else {
                    icon.innerHTML = this.getSunIcon();
                }
            }

            // Update text if it exists
            const text = button.querySelector('[data-theme-text]');
            if (text) {
                text.textContent = theme === 'dark' ? 'Dark' : 'Light';
            }

            // Update aria-label
            button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
            button.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        });
    }

    getSunIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>`;
    }

    getMoonIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>`;
    }

    // Programmatic theme setting
    setTheme(theme) {
        if (theme === 'system') {
            localStorage.removeItem('synthex-theme');
            this.applyTheme(this.getSystemTheme());
        } else if (theme === 'dark' || theme === 'light') {
            this.setStoredTheme(theme);
            this.applyTheme(theme);
        }
    }

    // Get current theme
    getTheme() {
        return this.currentTheme;
    }

    // Check if dark mode is active
    isDark() {
        return this.currentTheme === 'dark';
    }

    // Check if light mode is active
    isLight() {
        return this.currentTheme === 'light';
    }

    // Add theme-specific class to element
    addThemeClass(element, lightClass, darkClass) {
        if (this.isDark()) {
            element.classList.remove(lightClass);
            element.classList.add(darkClass);
        } else {
            element.classList.remove(darkClass);
            element.classList.add(lightClass);
        }
    }

    // Watch for theme changes
    onChange(callback) {
        window.addEventListener('themeChanged', (e) => {
            callback(e.detail.theme);
        });
    }
}

// Create global instance
window.themeManager = new ThemeManager();

// Helper function for quick toggle
window.toggleTheme = () => window.themeManager.toggle();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager.initializeToggles();
    });
} else {
    window.themeManager.initializeToggles();
}

// Add CSS variables for smooth transitions
if (!document.getElementById('theme-transition-styles')) {
    const styles = `
        * {
            transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
        
        /* Prevent transition on page load */
        .no-transitions * {
            transition: none !important;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'theme-transition-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Disable transitions on initial load
    document.documentElement.classList.add('no-transitions');
    setTimeout(() => {
        document.documentElement.classList.remove('no-transitions');
    }, 100);
}