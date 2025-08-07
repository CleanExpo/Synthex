/**
 * SYNTHEX API Client
 * Unified API communication layer
 */

class SynthexAPI {
  constructor() {
    this.baseURL = window.location.origin + '/api';
    this.token = localStorage.getItem('synthex-token');
  }

  // Helper method for API calls
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      }
    };

    // Add auth token if available
    if (this.token) {
      config.headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (response.success && response.token) {
      this.token = response.token;
      localStorage.setItem('synthex-token', response.token);
      localStorage.setItem('synthex-user', JSON.stringify(response.user));
    }

    return response;
  }

  async register(email, password, name) {
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  }

  async logout() {
    localStorage.removeItem('synthex-token');
    localStorage.removeItem('synthex-user');
    this.token = null;
    window.location.href = '/login';
  }

  getUser() {
    const userStr = localStorage.getItem('synthex-user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated() {
    return !!this.token;
  }

  // Dashboard
  async getDashboardStats() {
    return await this.request('/dashboard/stats');
  }

  // Campaigns
  async getCampaigns() {
    return await this.request('/campaigns');
  }

  async createCampaign(campaignData) {
    return await this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaignData)
    });
  }

  async getCampaign(id) {
    return await this.request(`/campaigns/${id}`);
  }

  async updateCampaign(id, updates) {
    return await this.request(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteCampaign(id) {
    return await this.request(`/campaigns/${id}`, {
      method: 'DELETE'
    });
  }

  // Content Generation
  async generateContent(prompt, platform, options = {}) {
    return await this.request('/content/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, platform, ...options })
    });
  }

  async analyzeContent(content) {
    return await this.request('/content/analyze', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  // Posts
  async getPosts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return await this.request(`/posts${params ? '?' + params : ''}`);
  }

  async createPost(postData) {
    return await this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async schedulePost(postData) {
    return await this.request('/posts/schedule', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async updatePost(id, updates) {
    return await this.request(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deletePost(id) {
    return await this.request(`/posts/${id}`, {
      method: 'DELETE'
    });
  }

  // Analytics
  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/analytics${queryString ? '?' + queryString : ''}`);
  }

  async getPlatformAnalytics(platform) {
    return await this.request(`/analytics/platforms/${platform}`);
  }

  // Settings
  async getSettings() {
    return await this.request('/settings');
  }

  async updateSettings(settings) {
    return await this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // Team Management
  async getTeamMembers() {
    return await this.request('/team');
  }

  async inviteTeamMember(email, role) {
    return await this.request('/team/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  }

  async updateTeamMember(id, updates) {
    return await this.request(`/team/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async removeTeamMember(id) {
    return await this.request(`/team/${id}`, {
      method: 'DELETE'
    });
  }

  // Notifications
  async getNotifications() {
    return await this.request('/notifications');
  }

  async markNotificationRead(id) {
    return await this.request(`/notifications/${id}/read`, {
      method: 'POST'
    });
  }

  async clearNotifications() {
    return await this.request('/notifications/clear', {
      method: 'POST'
    });
  }
}

// Create global instance
window.synthexAPI = new SynthexAPI();

// Auth state management
document.addEventListener('DOMContentLoaded', () => {
  const api = window.synthexAPI;
  
  // Check auth state
  if (api.isAuthenticated()) {
    // Update UI for authenticated state
    const user = api.getUser();
    const userElements = document.querySelectorAll('[data-user-name]');
    const userEmailElements = document.querySelectorAll('[data-user-email]');
    
    userElements.forEach(el => {
      el.textContent = user?.name || 'User';
    });
    
    userEmailElements.forEach(el => {
      el.textContent = user?.email || '';
    });
    
    // Show/hide auth-specific elements
    document.querySelectorAll('[data-auth="true"]').forEach(el => {
      el.style.display = '';
    });
    
    document.querySelectorAll('[data-auth="false"]').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    // Show/hide elements for non-authenticated users
    document.querySelectorAll('[data-auth="true"]').forEach(el => {
      el.style.display = 'none';
    });
    
    document.querySelectorAll('[data-auth="false"]').forEach(el => {
      el.style.display = '';
    });
    
    // Redirect to login if on protected page
    const protectedPaths = ['/dashboard', '/campaigns', '/analytics', '/settings', '/team'];
    if (protectedPaths.some(path => window.location.pathname.startsWith(path))) {
      window.location.href = '/login';
    }
  }
  
  // Setup logout handlers
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      api.logout();
    });
  });
});