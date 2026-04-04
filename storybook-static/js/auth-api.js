/**
 * SYNTHEX Authentication API Client
 * Handles all authentication-related API calls with retry logic and error handling
 */

class AuthAPI {
    constructor() {
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api/v1' 
            : '/api/v1';
        this.token = localStorage.getItem('synthex_token');
        this.refreshToken = localStorage.getItem('synthex_refresh_token');
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Set authorization headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, try to refresh
                const refreshed = await this.refreshAccessToken();
                if (!refreshed) {
                    this.logout();
                    window.location.href = '/login';
                }
                throw new Error('Token refreshed, please retry');
            }
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    }

    /**
     * Make API request with retry logic
     */
    async makeRequest(url, options = {}, retryCount = 0) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: this.getHeaders()
            });
            
            return await this.handleResponse(response);
        } catch (error) {
            if (retryCount < this.maxRetries && error.message === 'Token refreshed, please retry') {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.makeRequest(url, options, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(email, password, rememberMe = false) {
        try {
            const data = await this.makeRequest(`${this.baseURL}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password, rememberMe })
            });
            
            if (data.token) {
                this.token = data.token;
                this.refreshToken = data.refreshToken;
                
                if (rememberMe) {
                    localStorage.setItem('synthex_token', data.token);
                    localStorage.setItem('synthex_refresh_token', data.refreshToken);
                } else {
                    sessionStorage.setItem('synthex_token', data.token);
                    sessionStorage.setItem('synthex_refresh_token', data.refreshToken);
                }
                
                localStorage.setItem('synthex_user', JSON.stringify(data.user));
            }
            
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(userData) {
        try {
            const data = await this.makeRequest(`${this.baseURL}/auth/register`, {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            if (data.token) {
                this.token = data.token;
                this.refreshToken = data.refreshToken;
                localStorage.setItem('synthex_token', data.token);
                localStorage.setItem('synthex_refresh_token', data.refreshToken);
                localStorage.setItem('synthex_user', JSON.stringify(data.user));
            }
            
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await this.makeRequest(`${this.baseURL}/auth/logout`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage regardless of API response
            this.token = null;
            this.refreshToken = null;
            localStorage.removeItem('synthex_token');
            localStorage.removeItem('synthex_refresh_token');
            localStorage.removeItem('synthex_user');
            sessionStorage.removeItem('synthex_token');
            sessionStorage.removeItem('synthex_refresh_token');
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) return false;
        
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.token = data.token;
                localStorage.setItem('synthex_token', data.token);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    }

    /**
     * Verify user email
     */
    async verifyEmail(token) {
        return this.makeRequest(`${this.baseURL}/auth/verify-email`, {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        return this.makeRequest(`${this.baseURL}/auth/forgot-password`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    /**
     * Reset password with token
     */
    async resetPassword(token, newPassword) {
        return this.makeRequest(`${this.baseURL}/auth/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ token, newPassword })
        });
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        if (!this.token) return null;
        
        try {
            return await this.makeRequest(`${this.baseURL}/auth/me`);
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userData) {
        return this.makeRequest(`${this.baseURL}/auth/profile`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Google OAuth login
     */
    async googleLogin(googleToken) {
        try {
            const data = await this.makeRequest(`${this.baseURL}/auth/google`, {
                method: 'POST',
                body: JSON.stringify({ token: googleToken })
            });
            
            if (data.token) {
                this.token = data.token;
                this.refreshToken = data.refreshToken;
                localStorage.setItem('synthex_token', data.token);
                localStorage.setItem('synthex_refresh_token', data.refreshToken);
                localStorage.setItem('synthex_user', JSON.stringify(data.user));
            }
            
            return data;
        } catch (error) {
            console.error('Google login error:', error);
            throw error;
        }
    }

    /**
     * Enable two-factor authentication
     */
    async enable2FA() {
        return this.makeRequest(`${this.baseURL}/auth/2fa/enable`, {
            method: 'POST'
        });
    }

    /**
     * Verify 2FA code
     */
    async verify2FA(code) {
        return this.makeRequest(`${this.baseURL}/auth/2fa/verify`, {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }

    /**
     * Disable two-factor authentication
     */
    async disable2FA(code) {
        return this.makeRequest(`${this.baseURL}/auth/2fa/disable`, {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }
}

// Create global instance
window.authAPI = new AuthAPI();

// Auto-refresh token before expiry
setInterval(async () => {
    if (window.authAPI.isAuthenticated()) {
        const tokenData = JSON.parse(atob(window.authAPI.token.split('.')[1]));
        const expiryTime = tokenData.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000) {
            await window.authAPI.refreshAccessToken();
        }
    }
}, 60000); // Check every minute