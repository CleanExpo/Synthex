// Development authentication bypass for SYNTHEX
// This file allows bypassing authentication in development mode

(function() {
    'use strict';
    
    // Check if we're in development or demo mode
    const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.search.includes('demo=true');
    
    if (isDevelopment) {
        // Create mock user data
        const mockUser = {
            id: 'dev-user-001',
            email: 'demo@synthex.dev',
            name: 'Demo User',
            role: 'admin',
            createdAt: new Date().toISOString(),
            preferences: {
                theme: 'light',
                notifications: true,
                platforms: ['instagram', 'twitter', 'linkedin']
            }
        };
        
        // Create mock token
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZXYtdXNlci0wMDEiLCJlbWFpbCI6ImRlbW9Ac3ludGhleC5kZXYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MjMwODk2MDAsImV4cCI6MTcyMzY5NDQwMH0.mock-signature';
        
        // Store auth data in localStorage
        localStorage.setItem('synthex_user', JSON.stringify(mockUser));
        localStorage.setItem('synthex_token', mockToken);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Override fetch for API calls
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            // Add auth header to all API calls
            if (url.includes('/api/')) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${mockToken}`
                };
                
                // Mock successful responses for auth endpoints
                if (url.includes('/api/auth/verify')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ valid: true, user: mockUser })
                    });
                }
                
                if (url.includes('/api/auth/profile')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ user: mockUser })
                    });
                }
            }
            
            return originalFetch.call(this, url, options);
        };
        
        console.log('🔓 Authentication bypass enabled for development');
        console.log('📧 Demo user:', mockUser.email);
    }
})();