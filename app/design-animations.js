// SYNTHEX Design Animations
// Handles scroll-triggered animations, sequence animations, and interactive effects

class DesignAnimations {
  constructor() {
    this.init();
  }

  init() {
    this.setupScrollAnimations();
    this.setupSequenceAnimations();
    this.setupLetterAnimations();
    this.setupWordAnimations();
    this.setupBlobAnimations();
    this.setupParallaxEffects();
  }

  // Scroll-triggered animations with Intersection Observer
  setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          
          // Add stagger delay for children
          const children = entry.target.querySelectorAll('.stagger-child');
          children.forEach((child, index) => {
            setTimeout(() => {
              child.classList.add('revealed');
            }, index * 100);
          });
        }
      });
    }, observerOptions);

    // Observe all scroll-reveal elements
    document.querySelectorAll('.scroll-reveal').forEach(el => {
      scrollObserver.observe(el);
    });
  }

  // Sequence animations for hero sections
  setupSequenceAnimations() {
    const sequenceElements = document.querySelectorAll('[data-sequence]');
    
    sequenceElements.forEach((element, index) => {
      const delay = element.dataset.sequenceDelay || index * 200;
      const animation = element.dataset.sequenceAnimation || 'fade-in';
      
      setTimeout(() => {
        element.classList.add(`sequence-${animation}`);
      }, delay);
    });
  }

  // Letter-by-letter animations
  setupLetterAnimations() {
    const letterElements = document.querySelectorAll('.letter-animation');
    
    letterElements.forEach(element => {
      const text = element.innerText;
      element.innerHTML = '';
      
      [...text].forEach((letter, index) => {
        const span = document.createElement('span');
        span.textContent = letter === ' ' ? '\u00A0' : letter;
        span.style.animationDelay = `${index * 50}ms`;
        span.style.transform = 'translateY(20px)';
        element.appendChild(span);
      });
    });
  }

  // Word-by-word animations
  setupWordAnimations() {
    const wordElements = document.querySelectorAll('.word-animation');
    
    wordElements.forEach(element => {
      const text = element.innerText;
      const words = text.split(' ');
      element.innerHTML = '';
      
      words.forEach((word, index) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        span.style.animationDelay = `${index * 150}ms`;
        element.appendChild(span);
        
        // Add space between words
        if (index < words.length - 1) {
          element.appendChild(document.createTextNode(' '));
        }
      });
    });
  }

  // Dynamic blob animations
  setupBlobAnimations() {
    const blobContainer = document.querySelector('.blob-background');
    
    if (blobContainer) {
      // Create animated blobs
      for (let i = 0; i < 3; i++) {
        const blob = document.createElement('div');
        blob.className = 'blob';
        blob.style.left = `${Math.random() * 100}%`;
        blob.style.top = `${Math.random() * 100}%`;
        blobContainer.appendChild(blob);
      }

      // Mouse movement effect
      document.addEventListener('mousemove', (e) => {
        const blobs = document.querySelectorAll('.blob');
        const x = (e.clientX / window.innerWidth - 0.5) * 100;
        const y = (e.clientY / window.innerHeight - 0.5) * 100;
        
        blobs.forEach((blob, index) => {
          const speed = (index + 1) * 0.5;
          blob.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
      });
    }
  }

  // Parallax scrolling effects
  setupParallaxEffects() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      
      parallaxElements.forEach(element => {
        const speed = element.dataset.parallaxSpeed || 0.5;
        const yPos = -(scrolled * speed);
        element.style.transform = `translateY(${yPos}px)`;
      });
    });
  }

  // Liquid glass mouse follow effect
  setupLiquidGlassEffect() {
    const glassElements = document.querySelectorAll('.liquid-glass');
    
    glassElements.forEach(element => {
      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const angleX = (x - centerX) / centerX;
        const angleY = (y - centerY) / centerY;
        
        element.style.transform = `
          perspective(1000px)
          rotateY(${angleX * 10}deg)
          rotateX(${-angleY * 10}deg)
        `;
      });
      
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
      });
    });
  }

  // Smooth scroll with easing
  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
          const startPosition = window.pageYOffset;
          const distance = targetPosition - startPosition;
          const duration = 1000;
          let start = null;
          
          const ease = (t, b, c, d) => {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
          };
          
          const animation = (currentTime) => {
            if (start === null) start = currentTime;
            const timeElapsed = currentTime - start;
            const run = ease(timeElapsed, startPosition, distance, duration);
            window.scrollTo(0, run);
            if (timeElapsed < duration) requestAnimationFrame(animation);
          };
          
          requestAnimationFrame(animation);
        }
      });
    });
  }

  // Button hover effects with ripple
  setupButtonEffects() {
    document.querySelectorAll('.btn-ripple').forEach(button => {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }

  // Magnetic cursor effect
  setupMagneticCursor() {
    const magneticElements = document.querySelectorAll('[data-magnetic]');
    
    magneticElements.forEach(element => {
      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        element.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      });
      
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'translate(0, 0)';
      });
    });
  }
}

// Initialize on DOM load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new DesignAnimations();
    });
  } else {
    new DesignAnimations();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DesignAnimations;
}