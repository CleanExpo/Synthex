// API Configuration and Helper Functions
const API_BASE_URL = window.location.origin + '/api/v1';

// API Helper Class
class SynthexAPI {
    constructor() {
        this.token = localStorage.getItem('token');
        this.baseURL = API_BASE_URL;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : '',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            // Handle unauthorized
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/auth.html';
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async register(name, email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
    }

    async getProfile() {
        return this.request('/auth/profile');
    }

    async updateProfile(data) {
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async updateApiKeys(openrouterApiKey, anthropicApiKey) {
        return this.request('/auth/api-keys', {
            method: 'POST',
            body: JSON.stringify({ openrouterApiKey, anthropicApiKey })
        });
    }

    async getApiKeys() {
        return this.request('/auth/api-keys');
    }

    async getUsageStats() {
        return this.request('/auth/usage');
    }

    // Campaign endpoints
    async getCampaigns(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/campaigns${queryString ? '?' + queryString : ''}`);
    }

    async getCampaign(id) {
        return this.request(`/campaigns/${id}`);
    }

    async createCampaign(data) {
        return this.request('/campaigns', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateCampaign(id, data) {
        return this.request(`/campaigns/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteCampaign(id) {
        return this.request(`/campaigns/${id}`, {
            method: 'DELETE'
        });
    }

    async getCampaignPosts(campaignId) {
        return this.request(`/campaigns/${campaignId}/posts`);
    }

    // Content endpoints
    async generateContent(data) {
        // Use the full API v1 endpoint
        const url = `${window.location.origin}/api/v1/content/generate`;
        const config = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            },
            body: JSON.stringify(data)
        };
        
        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/auth.html';
                return;
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            return result;
        } catch (error) {
            console.error('Content generation error:', error);
            throw error;
        }
    }

    async saveDraft(data) {
        return this.request('/content/drafts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getDrafts() {
        return this.request('/content/drafts');
    }

    async publishContent(data) {
        return this.request('/content/publish', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async schedulePost(data) {
        return this.request('/content/schedule', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getScheduledPosts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/content/scheduled${queryString ? '?' + queryString : ''}`);
    }

    async updateScheduledPost(id, data) {
        return this.request(`/content/scheduled/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteScheduledPost(id) {
        return this.request(`/content/scheduled/${id}`, {
            method: 'DELETE'
        });
    }

    // Analytics endpoints
    async getAnalyticsOverview(range = 'week') {
        return this.request(`/analytics/overview?range=${range}`);
    }

    async getPlatformAnalytics(platform) {
        return this.request(`/analytics/platforms/${platform}`);
    }

    async getContentPerformance() {
        return this.request('/analytics/content-performance');
    }

    // Notification endpoints
    async getNotifications(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/notifications${queryString ? '?' + queryString : ''}`);
    }

    async markNotificationAsRead(id) {
        return this.request(`/notifications/${id}/read`, {
            method: 'PUT'
        });
    }

    async markAllNotificationsAsRead() {
        return this.request('/notifications/read-all', {
            method: 'PUT'
        });
    }

    // Team endpoints
    async getTeamMembers() {
        return this.request('/team/members');
    }

    async inviteTeamMember(data) {
        return this.request('/team/invite', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateTeamMemberRole(memberId, role) {
        return this.request(`/team/members/${memberId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
    }

    async removeTeamMember(memberId) {
        return this.request(`/team/members/${memberId}`, {
            method: 'DELETE'
        });
    }

    async getTeamActivity(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/team/activity${queryString ? '?' + queryString : ''}`);
    }

    async getTeamStats() {
        return this.request('/team/stats');
    }

    // Export endpoints
    async exportAnalyticsCSV(range = 'week', type = 'overview') {
        const url = `${this.baseURL}/analytics/export/csv`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            },
            body: JSON.stringify({ range, type })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Create blob and download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `analytics-${type}-${range}-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }

    async exportAnalyticsExcel(range = 'week') {
        const url = `${this.baseURL}/analytics/export/excel`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            },
            body: JSON.stringify({ range })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Create blob and download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `analytics-report-${range}-${Date.now()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }

    async exportAnalyticsPDF(range = 'week') {
        const url = `${this.baseURL}/analytics/export/pdf`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            },
            body: JSON.stringify({ range })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Create blob and download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `analytics-report-${range}-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }

    // Dashboard specific
    async getDashboardStats() {
        try {
            // Fetch multiple endpoints in parallel
            const [campaigns, analytics, profile] = await Promise.all([
                this.getCampaigns({ limit: 5 }),
                this.getAnalyticsOverview('week'),
                this.getProfile()
            ]);

            return {
                campaigns: campaigns.data || { campaigns: [], total: 0 },
                analytics: analytics.data || {
                    totalReach: 0,
                    engagement: 0,
                    totalPosts: 0,
                    clickRate: 0
                },
                user: profile.data || {}
            };
        } catch (error) {
            console.error('Dashboard stats error:', error);
            // Return default data structure
            return {
                campaigns: { campaigns: [], total: 0 },
                analytics: {
                    totalReach: 0,
                    engagement: 0,
                    totalPosts: 0,
                    clickRate: 0
                },
                user: {}
            };
        }
    }
}

// Create global API instance
window.synthexAPI = new SynthexAPI();

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

// Loading state helper
function showLoading(element) {
    element.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

function hideLoading(element, content) {
    element.innerHTML = content;
}

// Error handling helper
function showError(element, message = 'Failed to load data') {
    element.innerHTML = `
        <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto var(--space-md); opacity: 0.5;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>${message}</p>
        </div>
    `;
}

// Animation helper
function animateValue(element, start, end, duration = 2000) {
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    
    const timer = setInterval(() => {
        current += increment * Math.ceil(range / 100);
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = formatNumber(current);
    }, stepTime);
}

// Chart color palette
const chartColors = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    pink: '#ec4899'
};

// Export for use in other scripts
window.SynthexAPI = SynthexAPI;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.animateValue = animateValue;
window.chartColors = chartColors;