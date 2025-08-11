/**
 * Celebration animations for achievements and milestones
 */

// Confetti animation
export const confetti = () => {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // Create confetti elements
    createConfettiParticles(particleCount);
  }, 250);
};

function createConfettiParticles(count: number) {
  const colors = ['#9333EA', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981'];
  const container = document.body;
  
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    particle.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      transform: rotate(${Math.random() * 360}deg);
      animation: confetti-fall 3s ease-out forwards;
      z-index: 9999;
      pointer-events: none;
    `;
    
    container.appendChild(particle);
    
    // Remove after animation
    setTimeout(() => particle.remove(), 3000);
  }
}

// Emoji burst animation
export const emojiBurst = (emoji: string = '🎉') => {
  const container = document.body;
  const count = 20;
  
  for (let i = 0; i < count; i++) {
    const emojiEl = document.createElement('div');
    emojiEl.textContent = emoji;
    emojiEl.style.cssText = `
      position: fixed;
      font-size: 2rem;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: emoji-burst 1s ease-out forwards;
      animation-delay: ${i * 0.05}s;
      z-index: 9999;
      pointer-events: none;
      --angle: ${(360 / count) * i}deg;
    `;
    
    container.appendChild(emojiEl);
    setTimeout(() => emojiEl.remove(), 1500);
  }
};

// Success checkmark animation
export const successCheck = () => {
  const container = document.body;
  const checkmark = document.createElement('div');
  
  checkmark.innerHTML = `
    <svg width="100" height="100" viewBox="0 0 100 100" style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      pointer-events: none;
    ">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" stroke-width="4" 
              stroke-dasharray="283" stroke-dashoffset="283"
              style="animation: circle-draw 0.5s ease-out forwards"/>
      <path d="M 30 50 L 45 65 L 70 35" fill="none" stroke="#10B981" stroke-width="4"
            stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="60" stroke-dashoffset="60"
            style="animation: check-draw 0.3s 0.5s ease-out forwards"/>
    </svg>
  `;
  
  container.appendChild(checkmark);
  setTimeout(() => checkmark.remove(), 2000);
};

// Streak counter animation
export const streakAnimation = (days: number) => {
  const container = document.body;
  const streak = document.createElement('div');
  
  streak.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem 3rem;
    border-radius: 1rem;
    font-size: 1.5rem;
    font-weight: bold;
    z-index: 9999;
    animation: streak-pop 0.5s ease-out forwards;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  `;
  
  streak.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔥</div>
      <div>${days} Day Streak!</div>
      <div style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">Keep it going!</div>
    </div>
  `;
  
  container.appendChild(streak);
  setTimeout(() => streak.remove(), 3000);
};

// Level up animation
export const levelUp = (level: number) => {
  const container = document.body;
  const levelUpEl = document.createElement('div');
  
  levelUpEl.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    opacity: 0;
    animation: level-up 2s ease-out forwards;
    z-index: 9999;
    pointer-events: none;
  `;
  
  levelUpEl.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem 2rem;
      border-radius: 50px;
      font-weight: bold;
      font-size: 1.25rem;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    ">
      <span style="font-size: 1.5rem;">⭐</span>
      LEVEL ${level}
      <span style="font-size: 1.5rem;">⭐</span>
    </div>
  `;
  
  container.appendChild(levelUpEl);
  setTimeout(() => levelUpEl.remove(), 2500);
  
  // Also trigger confetti
  setTimeout(confetti, 200);
};

// Add required CSS animations
export const injectCelebrationStyles = () => {
  if (document.getElementById('celebration-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'celebration-styles';
  style.textContent = `
    @keyframes confetti-fall {
      to {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
    
    @keyframes emoji-burst {
      to {
        transform: translate(-50%, -50%) 
                  translate(calc(cos(var(--angle)) * 200px), calc(sin(var(--angle)) * 200px))
                  scale(0);
        opacity: 0;
      }
    }
    
    @keyframes circle-draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    
    @keyframes check-draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    
    @keyframes streak-pop {
      0% {
        transform: translate(-50%, -50%) scale(0) rotate(-10deg);
      }
      50% {
        transform: translate(-50%, -50%) scale(1.2) rotate(5deg);
      }
      100% {
        transform: translate(-50%, -50%) scale(1) rotate(0);
      }
    }
    
    @keyframes level-up {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      50% {
        opacity: 1;
        transform: translateX(-50%) translateY(-10px);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-100px) scale(0.8);
      }
    }
  `;
  
  document.head.appendChild(style);
};

// Initialize on load
if (typeof window !== 'undefined') {
  injectCelebrationStyles();
}