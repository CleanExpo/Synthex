/**
 * SYNTHEX UI Component Library
 * Consistent glassmorphic components with advanced animations
 * Version: 2.0.0
 */

class SynthexUI {
    constructor() {
        this.theme = this.loadTheme();
        this.animations = new AnimationController();
        this.components = new ComponentRegistry();
        this.init();
    }

    init() {
        this.applyTheme();
        this.initializeComponents();
        this.setupEventListeners();
        this.startAnimations();
    }

    /**
     * Theme Management
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('synthex_theme');
        return savedTheme ? JSON.parse(savedTheme) : {
            mode: 'dark',
            primaryColor: '#6366f1',
            accentColor: '#ec4899',
            glassIntensity: 'medium'
        };
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme.mode);
        document.documentElement.style.setProperty('--synthex-primary', this.theme.primaryColor);
        document.documentElement.style.setProperty('--synthex-accent', this.theme.accentColor);
        
        // Adjust glass intensity
        const blurValues = {
            light: '8px',
            medium: '12px',
            heavy: '20px'
        };
        document.documentElement.style.setProperty('--synthex-glass-blur', blurValues[this.theme.glassIntensity]);
    }

    /**
     * Component Creation Methods
     */
    
    // Create Glass Card
    createGlassCard(options = {}) {
        const defaults = {
            title: '',
            content: '',
            icon: null,
            actions: [],
            animate: true,
            glow: false,
            className: ''
        };
        
        const config = { ...defaults, ...options };
        
        const card = document.createElement('div');
        card.className = `glass-card ${config.className} ${config.glow ? 'glow' : ''} ${config.animate ? 'fade-in-up' : ''}`;
        
        let html = '';
        
        if (config.icon || config.title) {
            html += '<div class="card-header">';
            if (config.icon) {
                html += `<span class="card-icon">${config.icon}</span>`;
            }
            if (config.title) {
                html += `<h3 class="card-title">${config.title}</h3>`;
            }
            html += '</div>';
        }
        
        if (config.content) {
            html += `<div class="card-content">${config.content}</div>`;
        }
        
        if (config.actions.length > 0) {
            html += '<div class="card-actions">';
            config.actions.forEach(action => {
                html += `<button class="glass-button ${action.className || ''}" data-action="${action.id}">${action.label}</button>`;
            });
            html += '</div>';
        }
        
        card.innerHTML = html;
        
        // Add event listeners for actions
        config.actions.forEach(action => {
            const btn = card.querySelector(`[data-action="${action.id}"]`);
            if (btn && action.handler) {
                btn.addEventListener('click', action.handler);
            }
        });
        
        return card;
    }

    // Create Glass Modal
    createModal(options = {}) {
        const defaults = {
            title: '',
            content: '',
            size: 'medium',
            closable: true,
            actions: [],
            backdrop: true,
            animate: true
        };
        
        const config = { ...defaults, ...options };
        
        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';
        
        // Create backdrop
        if (config.backdrop) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            if (config.animate) {
                backdrop.classList.add('fade-in');
            }
            modalContainer.appendChild(backdrop);
            
            if (config.closable) {
                backdrop.addEventListener('click', () => this.closeModal(modalContainer));
            }
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = `glass-modal modal-${config.size} ${config.animate ? 'scale-in' : ''}`;
        
        let html = '';
        
        // Modal header
        html += '<div class="modal-header">';
        if (config.title) {
            html += `<h2 class="modal-title">${config.title}</h2>`;
        }
        if (config.closable) {
            html += '<button class="modal-close">&times;</button>';
        }
        html += '</div>';
        
        // Modal content
        html += `<div class="modal-content">${config.content}</div>`;
        
        // Modal actions
        if (config.actions.length > 0) {
            html += '<div class="modal-actions">';
            config.actions.forEach(action => {
                const btnClass = action.primary ? 'btn-primary' : 'glass-button';
                html += `<button class="${btnClass} ${action.className || ''}" data-action="${action.id}">${action.label}</button>`;
            });
            html += '</div>';
        }
        
        modal.innerHTML = html;
        modalContainer.appendChild(modal);
        
        // Add event listeners
        if (config.closable) {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal(modalContainer));
            }
        }
        
        config.actions.forEach(action => {
            const btn = modal.querySelector(`[data-action="${action.id}"]`);
            if (btn && action.handler) {
                btn.addEventListener('click', (e) => {
                    action.handler(e);
                    if (action.closeModal !== false) {
                        this.closeModal(modalContainer);
                    }
                });
            }
        });
        
        return modalContainer;
    }

    showModal(modal) {
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // Trigger animation
        requestAnimationFrame(() => {
            modal.classList.add('modal-active');
        });
    }

    closeModal(modal) {
        modal.classList.add('modal-closing');
        document.body.style.overflow = '';
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    // Create Toast Notification
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `glass-toast toast-${type} slide-in-right`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        // Get or create toast container
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        
        // Auto dismiss
        const dismiss = () => {
            toast.classList.add('slide-out-right');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        };
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', dismiss);
        
        if (duration > 0) {
            setTimeout(dismiss, duration);
        }
        
        return toast;
    }

    // Create Dropdown
    createDropdown(trigger, options = {}) {
        const defaults = {
            items: [],
            position: 'bottom',
            align: 'start',
            closeOnClick: true
        };
        
        const config = { ...defaults, ...options };
        
        const dropdown = document.createElement('div');
        dropdown.className = `glass-dropdown dropdown-${config.position} dropdown-align-${config.align}`;
        
        config.items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'dropdown-divider';
                dropdown.appendChild(divider);
            } else {
                const itemEl = document.createElement('div');
                itemEl.className = `glass-dropdown-item ${item.className || ''}`;
                
                if (item.icon) {
                    itemEl.innerHTML = `<span class="dropdown-icon">${item.icon}</span>`;
                }
                
                itemEl.innerHTML += `<span class="dropdown-label">${item.label}</span>`;
                
                if (item.badge) {
                    itemEl.innerHTML += `<span class="dropdown-badge">${item.badge}</span>`;
                }
                
                if (item.handler) {
                    itemEl.addEventListener('click', (e) => {
                        item.handler(e);
                        if (config.closeOnClick) {
                            this.closeDropdown(dropdown);
                        }
                    });
                }
                
                dropdown.appendChild(itemEl);
            }
        });
        
        // Position dropdown
        this.positionDropdown(trigger, dropdown, config);
        
        // Click outside to close
        const clickOutside = (e) => {
            if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
                this.closeDropdown(dropdown);
                document.removeEventListener('click', clickOutside);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', clickOutside);
        }, 0);
        
        return dropdown;
    }

    positionDropdown(trigger, dropdown, config) {
        const triggerRect = trigger.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        
        let top = 0;
        let left = 0;
        
        // Vertical position
        switch (config.position) {
            case 'top':
                top = triggerRect.top - dropdownRect.height - 8;
                break;
            case 'bottom':
            default:
                top = triggerRect.bottom + 8;
                break;
        }
        
        // Horizontal alignment
        switch (config.align) {
            case 'end':
                left = triggerRect.right - dropdownRect.width;
                break;
            case 'center':
                left = triggerRect.left + (triggerRect.width - dropdownRect.width) / 2;
                break;
            case 'start':
            default:
                left = triggerRect.left;
                break;
        }
        
        // Adjust if off screen
        if (left + dropdownRect.width > window.innerWidth) {
            left = window.innerWidth - dropdownRect.width - 16;
        }
        if (left < 16) {
            left = 16;
        }
        
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${top}px`;
        dropdown.style.left = `${left}px`;
    }

    closeDropdown(dropdown) {
        dropdown.classList.add('fade-out');
        setTimeout(() => {
            if (dropdown.parentNode) {
                dropdown.parentNode.removeChild(dropdown);
            }
        }, 200);
    }

    // Create Progress Bar
    createProgressBar(options = {}) {
        const defaults = {
            value: 0,
            max: 100,
            label: '',
            showPercentage: true,
            animated: true,
            gradient: true
        };
        
        const config = { ...defaults, ...options };
        
        const container = document.createElement('div');
        container.className = 'progress-container';
        
        if (config.label) {
            const label = document.createElement('div');
            label.className = 'progress-label';
            label.textContent = config.label;
            if (config.showPercentage) {
                label.innerHTML += ` <span class="progress-percentage">${Math.round((config.value / config.max) * 100)}%</span>`;
            }
            container.appendChild(label);
        }
        
        const progressBar = document.createElement('div');
        progressBar.className = 'glass-progress';
        
        const progressFill = document.createElement('div');
        progressFill.className = `progress-fill ${config.animated ? 'animated' : ''} ${config.gradient ? 'gradient' : ''}`;
        progressFill.style.width = `${(config.value / config.max) * 100}%`;
        
        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);
        
        // Update method
        container.updateProgress = (newValue) => {
            const percentage = Math.round((newValue / config.max) * 100);
            progressFill.style.width = `${percentage}%`;
            
            if (config.showPercentage) {
                const percentageEl = container.querySelector('.progress-percentage');
                if (percentageEl) {
                    percentageEl.textContent = `${percentage}%`;
                }
            }
        };
        
        return container;
    }

    // Create Tabs
    createTabs(options = {}) {
        const defaults = {
            tabs: [],
            activeTab: 0,
            animate: true
        };
        
        const config = { ...defaults, ...options };
        
        const container = document.createElement('div');
        container.className = 'tabs-container';
        
        // Tab headers
        const tabHeaders = document.createElement('div');
        tabHeaders.className = 'glass-tabs';
        
        config.tabs.forEach((tab, index) => {
            const tabHeader = document.createElement('button');
            tabHeader.className = `tab-header ${index === config.activeTab ? 'active' : ''}`;
            tabHeader.innerHTML = tab.icon ? `<span class="tab-icon">${tab.icon}</span>` : '';
            tabHeader.innerHTML += `<span class="tab-label">${tab.label}</span>`;
            
            if (tab.badge) {
                tabHeader.innerHTML += `<span class="tab-badge">${tab.badge}</span>`;
            }
            
            tabHeader.addEventListener('click', () => {
                this.switchTab(container, index);
            });
            
            tabHeaders.appendChild(tabHeader);
        });
        
        container.appendChild(tabHeaders);
        
        // Tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content-container';
        
        config.tabs.forEach((tab, index) => {
            const content = document.createElement('div');
            content.className = `tab-content ${index === config.activeTab ? 'active' : ''} ${config.animate ? 'fade-in' : ''}`;
            content.innerHTML = tab.content;
            tabContent.appendChild(content);
        });
        
        container.appendChild(tabContent);
        
        return container;
    }

    switchTab(container, index) {
        // Update headers
        container.querySelectorAll('.tab-header').forEach((header, i) => {
            header.classList.toggle('active', i === index);
        });
        
        // Update content
        container.querySelectorAll('.tab-content').forEach((content, i) => {
            content.classList.toggle('active', i === index);
        });
    }

    // Create Loading Spinner
    createLoader(options = {}) {
        const defaults = {
            size: 'medium',
            text: '',
            overlay: false
        };
        
        const config = { ...defaults, ...options };
        
        const loader = document.createElement('div');
        loader.className = `loader-container loader-${config.size} ${config.overlay ? 'loader-overlay' : ''}`;
        
        const spinner = document.createElement('div');
        spinner.className = 'glass-spinner';
        spinner.innerHTML = `
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
        `;
        
        loader.appendChild(spinner);
        
        if (config.text) {
            const text = document.createElement('div');
            text.className = 'loader-text';
            text.textContent = config.text;
            loader.appendChild(text);
        }
        
        return loader;
    }

    // Create Tooltip
    createTooltip(element, content, options = {}) {
        const defaults = {
            position: 'top',
            trigger: 'hover',
            delay: 200
        };
        
        const config = { ...defaults, ...options };
        
        let tooltip = null;
        let timeout = null;
        
        const show = () => {
            if (tooltip) return;
            
            tooltip = document.createElement('div');
            tooltip.className = `glass-tooltip tooltip-${config.position} fade-in`;
            tooltip.textContent = content;
            
            document.body.appendChild(tooltip);
            
            // Position tooltip
            const elementRect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let top = 0;
            let left = 0;
            
            switch (config.position) {
                case 'top':
                    top = elementRect.top - tooltipRect.height - 8;
                    left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
                    break;
                case 'bottom':
                    top = elementRect.bottom + 8;
                    left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
                    break;
                case 'left':
                    top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
                    left = elementRect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
                    left = elementRect.right + 8;
                    break;
            }
            
            tooltip.style.position = 'fixed';
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        };
        
        const hide = () => {
            if (tooltip) {
                tooltip.classList.add('fade-out');
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
            
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };
        
        if (config.trigger === 'hover') {
            element.addEventListener('mouseenter', () => {
                timeout = setTimeout(show, config.delay);
            });
            
            element.addEventListener('mouseleave', hide);
        } else if (config.trigger === 'click') {
            element.addEventListener('click', () => {
                if (tooltip) {
                    hide();
                } else {
                    show();
                }
            });
        }
        
        return { show, hide };
    }
}

/**
 * Animation Controller
 */
class AnimationController {
    constructor() {
        this.observers = new Map();
        this.initIntersectionObserver();
        this.initParallax();
        this.initCursorEffects();
    }

    initIntersectionObserver() {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    
                    // Stagger animations for children
                    const children = entry.target.querySelectorAll('[data-animate]');
                    children.forEach((child, index) => {
                        setTimeout(() => {
                            child.classList.add('animated');
                        }, index * 100);
                    });
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        // Observe all animatable elements
        document.querySelectorAll('[data-animate], .animate-on-scroll').forEach(el => {
            this.intersectionObserver.observe(el);
        });
    }

    initParallax() {
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        
        if (parallaxElements.length > 0) {
            window.addEventListener('scroll', () => {
                const scrolled = window.pageYOffset;
                
                parallaxElements.forEach(el => {
                    const speed = el.dataset.parallax || 0.5;
                    const yPos = -(scrolled * speed);
                    el.style.transform = `translateY(${yPos}px)`;
                });
            });
        }
    }

    initCursorEffects() {
        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);
        
        const cursorDot = document.createElement('div');
        cursorDot.className = 'cursor-dot';
        document.body.appendChild(cursorDot);
        
        let mouseX = 0;
        let mouseY = 0;
        let cursorX = 0;
        let cursorY = 0;
        
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        });
        
        const animateCursor = () => {
            const dx = mouseX - cursorX;
            const dy = mouseY - cursorY;
            
            cursorX += dx * 0.1;
            cursorY += dy * 0.1;
            
            cursor.style.left = `${cursorX}px`;
            cursor.style.top = `${cursorY}px`;
            
            requestAnimationFrame(animateCursor);
        };
        
        animateCursor();
        
        // Cursor interactions
        document.querySelectorAll('a, button, [data-cursor]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.classList.add('cursor-hover');
                const cursorType = el.dataset.cursor;
                if (cursorType) {
                    cursor.classList.add(`cursor-${cursorType}`);
                }
            });
            
            el.addEventListener('mouseleave', () => {
                cursor.classList.remove('cursor-hover');
                cursor.className = 'custom-cursor';
            });
        });
    }

    // Ripple effect for buttons
    addRipple(element) {
        element.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }

    // Typewriter effect
    typewriter(element, text, speed = 50) {
        let index = 0;
        element.textContent = '';
        
        const type = () => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(type, speed);
            }
        };
        
        type();
    }

    // Count up animation
    countUp(element, start, end, duration = 2000) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            
            element.textContent = Math.round(current).toLocaleString();
        }, 16);
    }
}

/**
 * Component Registry
 */
class ComponentRegistry {
    constructor() {
        this.components = new Map();
        this.init();
    }

    init() {
        this.registerStandardComponents();
        this.autoInitialize();
    }

    registerStandardComponents() {
        // Register all glass components
        this.register('glass-card', '.glass-card');
        this.register('glass-button', '.glass-button, .btn-primary');
        this.register('glass-input', '.glass-input');
        this.register('glass-nav', '.glass-nav');
    }

    register(name, selector) {
        this.components.set(name, {
            selector,
            elements: document.querySelectorAll(selector)
        });
    }

    autoInitialize() {
        // Add ripple effects to all buttons
        document.querySelectorAll('button, .btn').forEach(btn => {
            if (!btn.classList.contains('no-ripple')) {
                new AnimationController().addRipple(btn);
            }
        });
        
        // Initialize tooltips
        document.querySelectorAll('[data-tooltip]').forEach(el => {
            const content = el.dataset.tooltip;
            const position = el.dataset.tooltipPosition || 'top';
            new SynthexUI().createTooltip(el, content, { position });
        });
        
        // Initialize animations
        document.querySelectorAll('[data-count-up]').forEach(el => {
            const end = parseInt(el.dataset.countUp);
            const duration = parseInt(el.dataset.duration) || 2000;
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        new AnimationController().countUp(el, 0, end, duration);
                        observer.unobserve(el);
                    }
                });
            });
            
            observer.observe(el);
        });
    }

    get(name) {
        return this.components.get(name);
    }

    getAll() {
        return this.components;
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.synthexUI = new SynthexUI();
    });
} else {
    window.synthexUI = new SynthexUI();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SynthexUI;
}