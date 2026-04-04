/**
 * SYNTHEX Interactions JavaScript v1.0
 * Advanced micro-interactions, animations, and smooth behaviors
 * Optimized for performance and accessibility
 */

class SynthexInteractions {
  constructor() {
    this.observers = new Map();
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    this.init();
  }

  init() {
    // Initialize all interaction modules
    this.initMagneticButtons();
    this.initRippleEffects();
    this.initCardTilt();
    this.initScrollAnimations();
    this.initSmoothScroll();
    this.initParallax();
    this.initFormAnimations();
    this.initTooltips();
    this.initNotifications();
    this.initModalSystem();
    this.initDropdowns();
    this.initProgressBars();
    this.initTypingAnimation();
    this.initPageTransitions();
    
    // Handle reduced motion preferences
    this.handleAccessibility();
    
    console.log('SYNTHEX Interactions initialized');
  }

  /* ===== MAGNETIC BUTTON EFFECTS ===== */
  initMagneticButtons() {
    const magneticButtons = document.querySelectorAll('.btn-magnetic');
    
    magneticButtons.forEach(button => {
      let rect = button.getBoundingClientRect();
      
      const handleMouseMove = (e) => {
        if (this.isReducedMotion) return;
        
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        const distance = Math.sqrt(x * x + y * y);
        const maxDistance = 50;
        
        if (distance < maxDistance) {
          const strength = (maxDistance - distance) / maxDistance;
          const moveX = x * strength * 0.3;
          const moveY = y * strength * 0.3;
          
          button.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.02)`;
        }
      };
      
      const handleMouseLeave = () => {
        button.style.transform = 'translate(0, 0) scale(1)';
      };
      
      const updateRect = () => {
        rect = button.getBoundingClientRect();
      };
      
      button.addEventListener('mouseenter', updateRect);
      button.addEventListener('mousemove', handleMouseMove);
      button.addEventListener('mouseleave', handleMouseLeave);
      
      // Update rect on window resize
      window.addEventListener('resize', updateRect);
    });
  }

  /* ===== RIPPLE EFFECTS ===== */
  initRippleEffects() {
    const rippleElements = document.querySelectorAll('.btn-ripple, .card-ripple');
    
    rippleElements.forEach(element => {
      element.addEventListener('click', (e) => {
        if (this.isReducedMotion) return;
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          transform: scale(0);
          animation: ripple 0.6s ease-out;
          pointer-events: none;
          z-index: 1;
        `;
        
        element.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
    
    // Add CSS animation for ripple effect
    if (!document.getElementById('ripple-styles')) {
      const style = document.createElement('style');
      style.id = 'ripple-styles';
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* ===== CARD TILT EFFECTS ===== */
  initCardTilt() {
    const tiltCards = document.querySelectorAll('.card-tilt');
    
    tiltCards.forEach(card => {
      let rect = card.getBoundingClientRect();
      
      const handleMouseMove = (e) => {
        if (this.isReducedMotion) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / centerY * -10;
        const rotateY = (x - centerX) / centerX * 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      };
      
      const handleMouseLeave = () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      };
      
      const updateRect = () => {
        rect = card.getBoundingClientRect();
      };
      
      card.addEventListener('mouseenter', updateRect);
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
      
      window.addEventListener('resize', updateRect);
    });
  }

  /* ===== SCROLL ANIMATIONS ===== */
  initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    if (animatedElements.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
    
    this.observers.set('scroll-animations', observer);
  }

  /* ===== SMOOTH SCROLL ===== */
  initSmoothScroll() {
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    
    smoothScrollLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          e.preventDefault();
          
          const headerOffset = 80;
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  /* ===== PARALLAX EFFECTS ===== */
  initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax');
    
    if (parallaxElements.length === 0 || this.isReducedMotion) return;
    
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      
      parallaxElements.forEach(element => {
        const rate = scrolled * -0.5;
        element.style.transform = `translateY(${rate}px)`;
      });
    };
    
    window.addEventListener('scroll', this.throttle(handleScroll, 16));
  }

  /* ===== FORM ANIMATIONS ===== */
  initFormAnimations() {
    // Floating labels
    const floatingInputs = document.querySelectorAll('.form-input-floating');
    
    floatingInputs.forEach(input => {
      const handleFocus = () => {
        input.classList.add('focused');
      };
      
      const handleBlur = () => {
        if (!input.value) {
          input.classList.remove('focused');
        }
      };
      
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      
      // Check initial state
      if (input.value) {
        input.classList.add('focused');
      }
    });
    
    // Form validation animations
    const validateInput = (input, isValid) => {
      input.classList.remove('form-input-success', 'form-input-error');
      
      if (isValid) {
        input.classList.add('form-input-success');
      } else {
        input.classList.add('form-input-error');
      }
    };
    
    // Export validation function globally
    window.SynthexValidation = { validateInput };
  }

  /* ===== TOOLTIP SYSTEM ===== */
  initTooltips() {
    const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
    
    tooltipTriggers.forEach(trigger => {
      const tooltipText = trigger.getAttribute('data-tooltip');
      const position = trigger.getAttribute('data-tooltip-position') || 'top';
      
      const tooltip = document.createElement('div');
      tooltip.className = `tooltip tooltip-${position}`;
      tooltip.textContent = tooltipText;
      
      trigger.style.position = 'relative';
      trigger.appendChild(tooltip);
      
      let timeout;
      
      const showTooltip = () => {
        clearTimeout(timeout);
        tooltip.classList.add('show');
      };
      
      const hideTooltip = () => {
        timeout = setTimeout(() => {
          tooltip.classList.remove('show');
        }, 100);
      };
      
      trigger.addEventListener('mouseenter', showTooltip);
      trigger.addEventListener('mouseleave', hideTooltip);
      trigger.addEventListener('focus', showTooltip);
      trigger.addEventListener('blur', hideTooltip);
    });
  }

  /* ===== NOTIFICATION SYSTEM ===== */
  initNotifications() {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(notificationContainer);
    
    window.showNotification = (message, type = 'info', duration = 5000) => {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.style.cssText = `
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin-bottom: var(--space-3);
        box-shadow: var(--shadow-xl);
        border-left: 4px solid var(--color-${type === 'info' ? 'primary' : type});
        transform: translateX(400px);
        transition: transform 0.3s ease;
        pointer-events: auto;
        max-width: 300px;
        word-wrap: break-word;
      `;
      notification.textContent = message;
      
      notificationContainer.appendChild(notification);
      
      // Trigger animation
      requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
      });
      
      // Auto remove
      setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, duration);
      
      // Click to dismiss
      notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
          notification.remove();
        }, 300);
      });
    };
  }

  /* ===== MODAL SYSTEM ===== */
  initModalSystem() {
    window.showModal = (content, options = {}) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'modal-content';
      modal.style.cssText = `
        background: var(--color-surface);
        border-radius: var(--radius-xl);
        padding: var(--space-6);
        max-width: ${options.maxWidth || '500px'};
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      `;
      
      if (typeof content === 'string') {
        modal.innerHTML = content;
      } else {
        modal.appendChild(content);
      }
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Trigger animations
      requestAnimationFrame(() => {
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9998;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
        `;
        modal.style.transform = 'scale(1)';
      });
      
      // Close handlers
      const closeModal = () => {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
          overlay.remove();
        }, 300);
      };
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
      });
      
      return closeModal;
    };
  }

  /* ===== DROPDOWN SYSTEM ===== */
  initDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
      const trigger = dropdown.querySelector('.dropdown-trigger');
      const content = dropdown.querySelector('.dropdown-content');
      
      if (!trigger || !content) return;
      
      let isOpen = false;
      
      const toggleDropdown = () => {
        isOpen = !isOpen;
        content.classList.toggle('show', isOpen);
        trigger.setAttribute('aria-expanded', isOpen);
      };
      
      const closeDropdown = () => {
        isOpen = false;
        content.classList.remove('show');
        trigger.setAttribute('aria-expanded', false);
      };
      
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
      
      document.addEventListener('click', closeDropdown);
      
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  /* ===== PROGRESS BARS ===== */
  initProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar');
    
    const animateProgress = (bar) => {
      const fill = bar.querySelector('.progress-fill');
      const targetWidth = bar.getAttribute('data-progress') || '0';
      
      if (fill) {
        fill.style.width = `${targetWidth}%`;
      }
    };
    
    // Animate progress bars when they come into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateProgress(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    progressBars.forEach(bar => {
      observer.observe(bar);
    });
    
    // Global progress bar update function
    window.updateProgress = (selector, progress) => {
      const bar = document.querySelector(selector);
      if (bar) {
        bar.setAttribute('data-progress', progress);
        animateProgress(bar);
      }
    };
  }

  /* ===== TYPING ANIMATION ===== */
  initTypingAnimation() {
    const typeElements = document.querySelectorAll('.typing-animation');
    
    typeElements.forEach(element => {
      const text = element.textContent;
      const speed = parseInt(element.getAttribute('data-speed')) || 50;
      
      element.textContent = '';
      element.style.borderRight = '2px solid var(--color-primary)';
      element.style.animation = 'blink 1s infinite';
      
      let i = 0;
      const typeWriter = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          setTimeout(typeWriter, speed);
        } else {
          element.style.borderRight = 'none';
          element.style.animation = 'none';
        }
      };
      
      // Start typing when element comes into view
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            typeWriter();
            observer.unobserve(entry.target);
          }
        });
      });
      
      observer.observe(element);
    });
    
    // Add blink animation CSS
    if (!document.getElementById('typing-styles')) {
      const style = document.createElement('style');
      style.id = 'typing-styles';
      style.textContent = `
        @keyframes blink {
          0%, 50% { border-color: var(--color-primary); }
          51%, 100% { border-color: transparent; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* ===== PAGE TRANSITIONS ===== */
  initPageTransitions() {
    const transitionLinks = document.querySelectorAll('.page-transition');
    
    transitionLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (this.isReducedMotion) return;
        
        e.preventDefault();
        const href = link.getAttribute('href');
        
        // Create transition overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--color-primary);
          z-index: 9999;
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        `;
        
        document.body.appendChild(overlay);
        
        // Animate overlay
        requestAnimationFrame(() => {
          overlay.style.transform = 'translateX(0)';
        });
        
        // Navigate after animation
        setTimeout(() => {
          window.location.href = href;
        }, 300);
      });
    });
  }

  /* ===== ACCESSIBILITY HANDLING ===== */
  handleAccessibility() {
    // Listen for preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    motionQuery.addListener((e) => {
      this.isReducedMotion = e.matches;
      document.body.classList.toggle('reduced-motion', this.isReducedMotion);
    });
    
    contrastQuery.addListener((e) => {
      this.isHighContrast = e.matches;
      document.body.classList.toggle('high-contrast', this.isHighContrast);
    });
    
    // Apply initial classes
    document.body.classList.toggle('reduced-motion', this.isReducedMotion);
    document.body.classList.toggle('high-contrast', this.isHighContrast);
  }

  /* ===== UTILITY FUNCTIONS ===== */
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  debounce(func, delay) {
    let timeoutId;
    
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /* ===== CLEANUP ===== */
  destroy() {
    // Clean up observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    
    // Remove event listeners would go here if needed
    console.log('SYNTHEX Interactions destroyed');
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.synthexInteractions = new SynthexInteractions();
  });
} else {
  window.synthexInteractions = new SynthexInteractions();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynthexInteractions;
}