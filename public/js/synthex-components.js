/**
 * SYNTHEX Unified Components Library
 * Reusable JavaScript components for consistent UI/UX
 */

class SynthexComponents {
  constructor() {
    this.init();
  }

  init() {
    this.initThemeToggle();
    this.initNavigation();
    this.initModals();
    this.initTooltips();
    this.initForms();
    this.initAnimations();
    this.initScrollEffects();
  }

  // Theme Management - Default to dark for glassmorphic design
  initThemeToggle() {
    const savedTheme = localStorage.getItem('synthex-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('synthex-theme', newTheme);
        this.updateThemeIcon(newTheme);
      });
    }
  }

  updateThemeIcon(theme) {
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  // Navigation
  initNavigation() {
    // Mobile menu toggle
    const menuToggle = document.querySelector('[data-menu-toggle], #menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        menuToggle.classList.toggle('active');
      });
    }

    // Sticky navigation
    const nav = document.querySelector('.nav');
    if (nav) {
      let lastScroll = 0;
      window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
          nav.classList.add('scrolled');
          
          if (currentScroll > lastScroll) {
            nav.classList.add('hidden');
          } else {
            nav.classList.remove('hidden');
          }
        } else {
          nav.classList.remove('scrolled', 'hidden');
        }
        
        lastScroll = currentScroll;
      });
    }

    // Active link highlighting
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;
    
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
  }

  // Modals
  initModals() {
    // Open modal
    document.querySelectorAll('[data-modal-trigger]').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const modalId = trigger.getAttribute('data-modal-trigger');
        this.openModal(modalId);
      });
    });

    // Close modal
    document.querySelectorAll('[data-modal-close]').forEach(closeBtn => {
      closeBtn.addEventListener('click', () => {
        const modal = closeBtn.closest('.modal-backdrop');
        if (modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(backdrop.id);
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-backdrop.active');
        if (activeModal) {
          this.closeModal(activeModal.id);
        }
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Tooltips
  initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    
    tooltips.forEach(element => {
      const tooltipText = element.getAttribute('data-tooltip');
      const tooltipPosition = element.getAttribute('data-tooltip-position') || 'top';
      
      const tooltip = document.createElement('div');
      tooltip.className = `tooltip-content tooltip-${tooltipPosition}`;
      tooltip.textContent = tooltipText;
      
      element.classList.add('tooltip');
      element.appendChild(tooltip);
    });
  }

  // Forms
  initForms() {
    // Form validation
    document.querySelectorAll('form[data-validate]').forEach(form => {
      form.addEventListener('submit', (e) => {
        if (!this.validateForm(form)) {
          e.preventDefault();
        }
      });
    });

    // Input animations
    document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
      });
      
      input.addEventListener('blur', () => {
        if (!input.value) {
          input.parentElement.classList.remove('focused');
        }
      });
    });

    // Character counter
    document.querySelectorAll('[data-max-length]').forEach(input => {
      const maxLength = parseInt(input.getAttribute('data-max-length'));
      const counter = document.createElement('div');
      counter.className = 'character-counter';
      input.parentElement.appendChild(counter);
      
      const updateCounter = () => {
        const remaining = maxLength - input.value.length;
        counter.textContent = `${remaining} characters remaining`;
        counter.classList.toggle('warning', remaining < 20);
        counter.classList.toggle('error', remaining < 0);
      };
      
      input.addEventListener('input', updateCounter);
      updateCounter();
    });
  }

  validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      const errorMsg = field.parentElement.querySelector('.error-message');
      
      if (!field.value.trim()) {
        isValid = false;
        field.classList.add('error');
        
        if (!errorMsg) {
          const error = document.createElement('div');
          error.className = 'error-message';
          error.textContent = 'This field is required';
          field.parentElement.appendChild(error);
        }
      } else {
        field.classList.remove('error');
        if (errorMsg) {
          errorMsg.remove();
        }
      }
    });
    
    return isValid;
  }

  // Animations
  initAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    document.querySelectorAll('[data-animate]').forEach(element => {
      observer.observe(element);
    });

    // Parallax scrolling
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    if (parallaxElements.length > 0) {
      window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
          const speed = element.getAttribute('data-parallax') || 0.5;
          const yPos = -(scrolled * speed);
          element.style.transform = `translateY(${yPos}px)`;
        });
      });
    }
  }

  // Scroll Effects
  initScrollEffects() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        
        if (target) {
          const offset = 80; // Navigation height
          const targetPosition = target.offsetTop - offset;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });

    // Scroll to top button
    const scrollTopBtn = document.getElementById('scroll-top');
    
    if (scrollTopBtn) {
      window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
          scrollTopBtn.classList.add('visible');
        } else {
          scrollTopBtn.classList.remove('visible');
        }
      });
      
      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    // Progress bar
    const progressBar = document.getElementById('progress-bar');
    
    if (progressBar) {
      window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
      });
    }
  }

  // Utility Methods
  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.removeNotification(notification);
    });
    
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, duration);
    }
  }

  removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }

  // Loading states
  showLoading(element) {
    element.classList.add('loading');
    element.setAttribute('data-original-content', element.innerHTML);
    element.innerHTML = '<span class="spinner"></span>';
  }

  hideLoading(element) {
    element.classList.remove('loading');
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
      element.removeAttribute('data-original-content');
    }
  }

  // Copy to clipboard
  copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.showNotification('Copied to clipboard!', 'success');
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.synthexComponents = new SynthexComponents();
  });
} else {
  window.synthexComponents = new SynthexComponents();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynthexComponents;
}
