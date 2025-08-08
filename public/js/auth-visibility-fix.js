// Auto-show auth for production
const isProduction = !window.location.hostname.includes('localhost');
const hasToken = localStorage.getItem('token');

if (isProduction && !hasToken) {
    // Add login/signup buttons to header
    const header = document.querySelector('header, nav, .navigation');
    if (header) {
        const authDiv = document.createElement('div');
        authDiv.className = 'auth-buttons-container';
        authDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999;';
        authDiv.innerHTML = `
            <button onclick="showAuthModal('login')" style="
                padding: 10px 20px;
                margin: 5px;
                background: #4F46E5;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Login</button>
            <button onclick="showAuthModal('signup')" style="
                padding: 10px 20px;
                margin: 5px;
                background: #10B981;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Sign Up</button>
        `;
        document.body.appendChild(authDiv);
    }
    
    // Auto-show auth modal after 2 seconds if no action
    setTimeout(() => {
        if (!localStorage.getItem('token')) {
            const modal = document.getElementById('authModal');
            if (modal) modal.style.display = 'flex';
        }
    }, 2000);
}

// Global function to show auth modal
window.showAuthModal = function(type = 'login') {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'flex';
        // Switch to correct form
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        if (type === 'signup' && signupForm) {
            if (loginForm) loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        } else if (type === 'login' && loginForm) {
            if (signupForm) signupForm.style.display = 'none';
            loginForm.style.display = 'block';
        }
    }
};