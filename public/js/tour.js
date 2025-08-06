// Interactive Feature Tour System

class FeatureTour {
    constructor() {
        this.currentStep = 0;
        this.steps = [];
        this.isActive = false;
        this.overlay = null;
        this.tooltip = null;
        
        // Tour completion tracking
        this.tourKey = 'synthex_tour_completed';
        this.tourVersion = '1.0';
        
        this.init();
    }
    
    init() {
        // Add tour styles
        this.addTourStyles();
        
        // Check if tour should be shown
        if (this.shouldShowTour()) {
            // Wait a bit for page to load
            setTimeout(() => {
                this.startTour();
            }, 2000);
        }
    }
    
    shouldShowTour() {
        const completed = localStorage.getItem(this.tourKey);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const preferences = user.preferences || {};
        
        // Show tour if:
        // 1. User just completed onboarding
        // 2. Tour hasn't been completed before
        // 3. We're on the dashboard page
        return (
            preferences.onboardingCompleted &&
            !completed &&
            (window.location.pathname.includes('app-new.html') || 
             window.location.pathname.includes('dashboard'))
        );
    }
    
    addTourStyles() {
        const styles = `
            .tour-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                pointer-events: none;
            }
            
            .tour-spotlight {
                position: absolute;
                border: 3px solid var(--primary);
                border-radius: 8px;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
                pointer-events: none;
                transition: all 0.3s ease;
            }
            
            .tour-tooltip {
                position: absolute;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-xl);
                padding: var(--space-lg);
                max-width: 320px;
                z-index: 10000;
                backdrop-filter: blur(20px);
                pointer-events: auto;
            }
            
            .tour-tooltip::before {
                content: '';
                position: absolute;
                width: 0;
                height: 0;
                border-style: solid;
            }
            
            .tour-tooltip.bottom::before {
                top: -8px;
                left: 50%;
                transform: translateX(-50%);
                border-width: 0 8px 8px 8px;
                border-color: transparent transparent var(--border-color) transparent;
            }
            
            .tour-tooltip.top::before {
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                border-width: 8px 8px 0 8px;
                border-color: var(--border-color) transparent transparent transparent;
            }
            
            .tour-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--space-sm);
            }
            
            .tour-description {
                color: var(--text-secondary);
                line-height: 1.5;
                margin-bottom: var(--space-lg);
            }
            
            .tour-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .tour-progress {
                display: flex;
                gap: var(--space-xs);
                align-items: center;
            }
            
            .tour-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                transition: all var(--transition-base);
            }
            
            .tour-dot.active {
                background: var(--primary);
                transform: scale(1.2);
            }
            
            .tour-buttons {
                display: flex;
                gap: var(--space-sm);
            }
            
            .tour-btn {
                padding: var(--space-sm) var(--space-md);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                background: transparent;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all var(--transition-base);
                font-size: 0.875rem;
            }
            
            .tour-btn:hover {
                color: var(--text-primary);
                border-color: var(--border-color-hover);
            }
            
            .tour-btn.primary {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }
            
            .tour-btn.primary:hover {
                background: var(--primary-dark);
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .tour-pulse {
                animation: pulse 2s infinite;
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    startTour() {
        // Define tour steps based on current page
        this.steps = this.getTourSteps();
        
        if (this.steps.length === 0) return;
        
        this.isActive = true;
        this.currentStep = 0;
        this.showStep(this.currentStep);
    }
    
    getTourSteps() {
        const pathname = window.location.pathname;
        
        if (pathname.includes('app-new.html') || pathname.includes('dashboard')) {
            return [
                {
                    selector: '.stats-grid',
                    title: 'Performance Overview',
                    description: 'Here you can see your key metrics at a glance - total reach, engagement, and campaign performance.',
                    position: 'bottom'
                },
                {
                    selector: '.sidebar .nav-item[href="/content-studio.html"]',
                    title: 'Content Studio',
                    description: 'Create amazing content with AI assistance. Generate posts, captions, and hashtags for any platform.',
                    position: 'right'
                },
                {
                    selector: '.sidebar .nav-item[href="/schedule.html"]',
                    title: 'Smart Scheduling',
                    description: 'Plan and schedule your content across multiple platforms with our calendar interface.',
                    position: 'right'
                },
                {
                    selector: '.sidebar .nav-item[href="/analytics.html"]',
                    title: 'Advanced Analytics',
                    description: 'Deep dive into your performance data with detailed charts and exportable reports.',
                    position: 'right'
                },
                {
                    selector: '.header-right .notification-bell',
                    title: 'Notifications',
                    description: 'Stay updated with real-time notifications about your campaigns and performance.',
                    position: 'bottom'
                }
            ];
        }
        
        return [];
    }
    
    showStep(stepIndex) {
        if (stepIndex >= this.steps.length) {
            this.completeTour();
            return;
        }
        
        const step = this.steps[stepIndex];
        const element = document.querySelector(step.selector);
        
        if (!element) {
            console.warn(`Tour element not found: ${step.selector}`);
            this.nextStep();
            return;
        }
        
        // Create or update overlay
        this.updateOverlay();
        
        // Create spotlight around element
        this.createSpotlight(element);
        
        // Show tooltip
        this.showTooltip(step, element);
        
        // Add pulse animation to the element
        element.classList.add('tour-pulse');
        
        // Remove pulse after animation
        setTimeout(() => {
            element.classList.remove('tour-pulse');
        }, 3000);
    }
    
    updateOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'tour-overlay';
            document.body.appendChild(this.overlay);
        }
    }
    
    createSpotlight(element) {
        // Remove existing spotlight
        const existingSpotlight = document.querySelector('.tour-spotlight');
        if (existingSpotlight) {
            existingSpotlight.remove();
        }
        
        const rect = element.getBoundingClientRect();
        const spotlight = document.createElement('div');
        spotlight.className = 'tour-spotlight';
        
        // Position spotlight around the element
        const padding = 10;
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        
        document.body.appendChild(spotlight);
    }
    
    showTooltip(step, element) {
        // Remove existing tooltip
        if (this.tooltip) {
            this.tooltip.remove();
        }
        
        const rect = element.getBoundingClientRect();
        this.tooltip = document.createElement('div');
        this.tooltip.className = `tour-tooltip ${step.position}`;
        
        // Position tooltip
        this.positionTooltip(this.tooltip, rect, step.position);
        
        // Add content
        this.tooltip.innerHTML = `
            <div class="tour-title">${step.title}</div>
            <div class="tour-description">${step.description}</div>
            <div class="tour-actions">
                <div class="tour-progress">
                    ${this.steps.map((_, index) => 
                        `<div class="tour-dot ${index === this.currentStep ? 'active' : ''}"></div>`
                    ).join('')}
                    <span style="margin-left: var(--space-sm); font-size: 0.75rem; color: var(--text-muted);">
                        ${this.currentStep + 1} of ${this.steps.length}
                    </span>
                </div>
                <div class="tour-buttons">
                    ${this.currentStep > 0 ? '<button class="tour-btn" onclick="window.featureTour.previousStep()">Previous</button>' : ''}
                    <button class="tour-btn" onclick="window.featureTour.skipTour()">Skip</button>
                    <button class="tour-btn primary" onclick="window.featureTour.nextStep()">
                        ${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.tooltip);
    }
    
    positionTooltip(tooltip, elementRect, position) {
        const tooltipWidth = 320;
        const tooltipHeight = 200; // Estimated
        
        switch (position) {
            case 'bottom':
                tooltip.style.top = `${elementRect.bottom + 20}px`;
                tooltip.style.left = `${elementRect.left + elementRect.width / 2 - tooltipWidth / 2}px`;
                break;
            case 'top':
                tooltip.style.top = `${elementRect.top - tooltipHeight - 20}px`;
                tooltip.style.left = `${elementRect.left + elementRect.width / 2 - tooltipWidth / 2}px`;
                break;
            case 'right':
                tooltip.style.top = `${elementRect.top + elementRect.height / 2 - tooltipHeight / 2}px`;
                tooltip.style.left = `${elementRect.right + 20}px`;
                break;
            case 'left':
                tooltip.style.top = `${elementRect.top + elementRect.height / 2 - tooltipHeight / 2}px`;
                tooltip.style.left = `${elementRect.left - tooltipWidth - 20}px`;
                break;
        }
        
        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > viewportWidth) {
            tooltip.style.left = `${viewportWidth - tooltipWidth - 20}px`;
        }
        if (tooltipRect.left < 0) {
            tooltip.style.left = '20px';
        }
        if (tooltipRect.bottom > viewportHeight) {
            tooltip.style.top = `${viewportHeight - tooltipHeight - 20}px`;
        }
        if (tooltipRect.top < 0) {
            tooltip.style.top = '20px';
        }
    }
    
    nextStep() {
        this.currentStep++;
        this.showStep(this.currentStep);
    }
    
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }
    
    skipTour() {
        if (confirm('Are you sure you want to skip the tour? You can always start it again from the help menu.')) {
            this.completeTour();
        }
    }
    
    completeTour() {
        // Mark tour as completed
        localStorage.setItem(this.tourKey, this.tourVersion);
        
        // Clean up
        this.cleanup();
        
        // Show completion message
        if (window.notificationSystem) {
            window.notificationSystem.addNotification({
                type: 'success',
                title: 'Tour Complete!',
                message: 'You\'re all set! Start creating amazing content with SYNTHEX.'
            });
        }
    }
    
    cleanup() {
        this.isActive = false;
        
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        
        const spotlight = document.querySelector('.tour-spotlight');
        if (spotlight) {
            spotlight.remove();
        }
        
        // Remove pulse animations
        document.querySelectorAll('.tour-pulse').forEach(el => {
            el.classList.remove('tour-pulse');
        });
    }
    
    // Public method to restart tour
    restart() {
        localStorage.removeItem(this.tourKey);
        this.startTour();
    }
}

// Global function to start tour
function startFeatureTour() {
    if (window.featureTour) {
        window.featureTour.restart();
    } else {
        window.featureTour = new FeatureTour();
    }
}

// Initialize tour when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only start tour automatically if user preferences indicate they want it
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const preferences = user.preferences || {};
    
    if (preferences.onboardingCompleted) {
        window.featureTour = new FeatureTour();
    }
});

// Expose to window for global access
window.startFeatureTour = startFeatureTour;