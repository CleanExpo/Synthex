// Authentication Check for Protected Pages
(function() {
    const publicPages = ['/', '/index.html', '/auth.html', '/404.html', '/500.html'];
    const currentPath = window.location.pathname;
    
    // Check if current page is public
    const isPublicPage = publicPages.some(page => 
        currentPath === page || currentPath.endsWith(page)
    );
    
    // If it's a protected page, check authentication
    if (!isPublicPage) {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            // Store intended destination
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            // Redirect to login
            window.location.href = '/auth.html';
        } else {
            // Verify token is still valid
            verifyToken(token);
        }
    }
    
    // Verify token with backend
    async function verifyToken(token) {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Token is invalid
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '/auth.html';
            }
        } catch (error) {
            console.error('Token verification failed:', error);
        }
    }
    
    // Add logout functionality
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/auth.html';
    };
    
    // Add user info to window for easy access
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            window.currentUser = JSON.parse(userStr);
        } catch (e) {
            console.error('Invalid user data in localStorage');
        }
    }
})();