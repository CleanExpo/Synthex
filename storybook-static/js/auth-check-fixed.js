// Authentication Check for Protected Pages
(function() {
    'use strict';
    
    // List of pages that require authentication
    const protectedPages = [
        'dashboard.html',
        'campaigns.html',
        'content.html',
        'calendar.html',
        'analytics.html',
        'settings.html',
        'team.html'
    ];
    
    // Check if current page requires authentication
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
    
    // Development mode check
    const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.search.includes('demo=true');
    
    if (isProtectedPage) {
        // Check authentication
        const token = localStorage.getItem('synthex_token') || localStorage.getItem('token');
        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        
        if (!token && !isAuthenticated && !isDevelopment) {
            // Not authenticated - redirect to login
            console.log('Authentication required. Redirecting to login...');
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        } else if (isDevelopment && !token) {
            // Development mode - create mock authentication
            console.log('🔓 Development mode - bypassing authentication');
            
            const mockUser = {
                id: 'dev-user-001',
                email: 'demo@synthex.dev',
                name: 'Demo User',
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('synthex_user', JSON.stringify(mockUser));
            localStorage.setItem('user', JSON.stringify(mockUser));
            localStorage.setItem('synthex_token', 'dev-token-' + Date.now());
            localStorage.setItem('token', 'dev-token-' + Date.now());
            localStorage.setItem('isAuthenticated', 'true');
        }
        
        // Verify token validity (mock in development)
        if (token && !isDevelopment) {
            fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(response => {
                if (!response.ok) {
                    // Token invalid - clear and redirect
                    localStorage.removeItem('token');
                    localStorage.removeItem('synthex_token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('synthex_user');
                    localStorage.removeItem('isAuthenticated');
                    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
                }
            }).catch(error => {
                console.error('Token verification failed:', error);
                // In development, allow access even if verification fails
                if (!isDevelopment) {
                    window.location.href = '/login.html';
                }
            });
        }
    }
    
    // Add logout functionality
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('synthex_token');
        localStorage.removeItem('user');
        localStorage.removeItem('synthex_user');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '/login.html';
    };
})();