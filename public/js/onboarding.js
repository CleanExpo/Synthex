// Onboarding Flow Management

let currentStep = 0;
let totalSteps = 5; // 0-4 steps + completion
let onboardingData = {
    userType: null,
    selectedPlatforms: ['instagram'], // Default selection
    selectedTier: 'professional', // Default to professional tier
    apiKeys: {
        openrouter: '',
        anthropic: ''
    },
    completedAt: null
};

// Initialize onboarding
function initializeOnboarding() {
    // Make sure we have the API instance
    if (typeof synthexAPI === 'undefined') {
        window.synthexAPI = new SynthexAPI();
    }
    
    updateStepIndicators();
    updateNavigationButtons();
    
    // Check if user has already completed onboarding
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.preferences && user.preferences.onboardingCompleted) {
        // Skip onboarding and go to dashboard
        window.location.href = '/dashboard.html';
        return;
    }
    
    // Update platform count display
    updateCompletionStats();
}

// Step navigation
function nextStep() {
    if (currentStep < totalSteps) {
        // Validate current step before proceeding
        if (validateCurrentStep()) {
            currentStep++;
            showStep(currentStep);
            updateStepIndicators();
            updateNavigationButtons();
        }
    } else {
        // Complete onboarding
        completeOnboarding();
    }
}

function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
        updateStepIndicators();
        updateNavigationButtons();
    }
}

function skipOnboarding() {
    if (confirm('Are you sure you want to skip the setup? You can always configure these settings later.')) {
        completeOnboarding();
    }
}

// Step display management
function showStep(stepIndex) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    // Note: Step 5 is the completion step (index 5, but totalSteps is 5)
    const stepId = `step-${stepIndex}`;
    const currentStepElement = document.getElementById(stepId);
    if (currentStepElement) {
        currentStepElement.classList.add('active');
    }
    
    // Special handling for completion step
    if (stepIndex === totalSteps) {
        updateCompletionStats();
    }
}

function updateStepIndicators() {
    document.querySelectorAll('.step-dot').forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        
        if (index < currentStep) {
            dot.classList.add('completed');
        } else if (index === currentStep) {
            dot.classList.add('active');
        }
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const skipBtn = document.getElementById('skipBtn');
    
    // Show/hide previous button
    if (currentStep === 0) {
        prevBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'inline-flex';
    }
    
    // Update next button text and functionality
    if (currentStep === totalSteps) {
        nextBtn.textContent = 'Go to Dashboard';
        nextBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12l5 5L20 7"/>
            </svg>
            Go to Dashboard
        `;
        skipBtn.style.display = 'none';
    } else if (currentStep === totalSteps - 1) {
        // Last step before completion
        nextBtn.textContent = 'Complete Setup';
        nextBtn.innerHTML = `
            Complete Setup
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
        skipBtn.style.display = 'inline-flex';
    } else {
        nextBtn.textContent = 'Continue';
        nextBtn.innerHTML = `
            Continue
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
        skipBtn.style.display = 'inline-flex';
    }
}

// Step validation
function validateCurrentStep() {
    switch (currentStep) {
        case 0: // Welcome step - no validation needed
            return true;
            
        case 1: // User type selection
            if (!onboardingData.userType) {
                alert('Please select what best describes you to continue.');
                return false;
            }
            return true;
            
        case 2: // Platform selection
            if (onboardingData.selectedPlatforms.length === 0) {
                alert('Please select at least one platform to continue.');
                return false;
            }
            return true;
            
        case 3: // Tier selection
            if (!onboardingData.selectedTier) {
                alert('Please select a plan to continue.');
                return false;
            }
            return true;
            
        case 4: // API configuration - optional
            // Capture API keys if provided
            const openrouterKey = document.getElementById('openrouterApiKey').value;
            const anthropicKey = document.getElementById('anthropicApiKey').value;
            
            onboardingData.apiKeys.openrouter = openrouterKey;
            onboardingData.apiKeys.anthropic = anthropicKey;
            return true;
            
        default:
            return true;
    }
}

// User type selection
function selectUserType(type) {
    onboardingData.userType = type;
    
    // Update visual selection
    document.querySelectorAll('.preference-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.type === type) {
            option.classList.add('selected');
        }
    });
}

// Tier selection
function selectTier(tier) {
    onboardingData.selectedTier = tier;
    
    // Update visual selection
    document.querySelectorAll('.tier-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.tier === tier) {
            card.classList.add('selected');
        }
    });
}

// Platform selection
function togglePlatform(platform) {
    const index = onboardingData.selectedPlatforms.indexOf(platform);
    const platformElement = document.querySelector(`[data-platform="${platform}"]`);
    
    if (index === -1) {
        // Add platform
        onboardingData.selectedPlatforms.push(platform);
        platformElement.classList.add('selected');
    } else {
        // Remove platform (but ensure at least one is selected)
        if (onboardingData.selectedPlatforms.length > 1) {
            onboardingData.selectedPlatforms.splice(index, 1);
            platformElement.classList.remove('selected');
        }
    }
    
    updateCompletionStats();
}

// Update completion stats
function updateCompletionStats() {
    const platformCountElement = document.getElementById('platformCount');
    const userTypeElement = document.getElementById('userType');
    const apiStatusElement = document.getElementById('apiStatus');
    
    if (platformCountElement) {
        platformCountElement.textContent = onboardingData.selectedPlatforms.length;
    }
    
    if (userTypeElement) {
        userTypeElement.textContent = onboardingData.userType ? '100%' : '0%';
    }
    
    if (apiStatusElement) {
        const hasApiKeys = onboardingData.apiKeys.openrouter || onboardingData.apiKeys.anthropic;
        apiStatusElement.textContent = hasApiKeys ? 'Enhanced' : 'Basic';
    }
}

// Complete onboarding
async function completeOnboarding() {
    try {
        // Show loading state
        const nextBtn = document.getElementById('nextBtn');
        const originalText = nextBtn.innerHTML;
        nextBtn.disabled = true;
        nextBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            Setting up...
        `;
        
        // Save onboarding data
        onboardingData.completedAt = new Date().toISOString();
        
        // Update user profile with onboarding data
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            // Save onboarding preferences
            await synthexAPI.updateProfile({
                preferences: {
                    userType: onboardingData.userType,
                    platforms: onboardingData.selectedPlatforms,
                    tier: onboardingData.selectedTier,
                    onboardingCompleted: true,
                    onboardingCompletedAt: onboardingData.completedAt
                }
            });
            
            // Save API keys if provided
            if (onboardingData.apiKeys.openrouter || onboardingData.apiKeys.anthropic) {
                await synthexAPI.updateApiKeys(
                    onboardingData.apiKeys.openrouter,
                    onboardingData.apiKeys.anthropic
                );
            }
            
            // Update local user data
            user.preferences = user.preferences || {};
            user.preferences.userType = onboardingData.userType;
            user.preferences.platforms = onboardingData.selectedPlatforms;
            user.preferences.tier = onboardingData.selectedTier;
            user.preferences.onboardingCompleted = true;
            user.preferences.onboardingCompletedAt = onboardingData.completedAt;
            localStorage.setItem('user', JSON.stringify(user));
            
        } catch (error) {
            console.error('Error saving onboarding data:', error);
            // Continue anyway - we can save this data later
        }
        
        // Show completion animation
        if (currentStep !== totalSteps) {
            currentStep = totalSteps;
            showStep(currentStep);
            updateStepIndicators();
            updateNavigationButtons();
        }
        
        // Reset button
        nextBtn.disabled = false;
        nextBtn.innerHTML = originalText;
        
        // Add a small delay for the animation
        setTimeout(() => {
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error completing onboarding:', error);
        
        // Reset button state
        const nextBtn = document.getElementById('nextBtn');
        nextBtn.disabled = false;
        nextBtn.innerHTML = `
            Go to Dashboard
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
        
        // Still redirect to dashboard even if saving failed
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 500);
    }
}

// Quick navigation functions for completion step
function goToDashboard() {
    window.location.href = '/dashboard.html';
}

function goToContentStudio() {
    window.location.href = '/content-studio.html';
}

// Keyboard navigation
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'Enter') {
        nextStep();
    } else if (event.key === 'ArrowLeft') {
        previousStep();
    } else if (event.key === 'Escape') {
        skipOnboarding();
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeOnboarding);

// Smooth animations for step transitions
function addStepTransitionEffects() {
    const style = document.createElement('style');
    style.textContent = `
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .step-content {
            transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
        }
        
        .step-content:not(.active) {
            opacity: 0;
            transform: translateX(20px);
        }
        
        .step-content.active {
            opacity: 1;
            transform: translateX(0);
        }
    `;
    document.head.appendChild(style);
}

// Add transition effects
addStepTransitionEffects();

// Export for potential use in other scripts
window.onboardingFlow = {
    currentStep,
    onboardingData,
    nextStep,
    previousStep,
    skipOnboarding,
    completeOnboarding
};