/**
 * Unified API Client for Synthex v2
 * Integrates all frontend pages with the new API structure
 */

class SynthexAPIClient {
  constructor() {
    this.baseURL = window.location.origin + '/api/v2';
    this.token = localStorage.getItem('synthex_token');
    this.locale = localStorage.getItem('synthex_locale') || 'en';
    this.sessionId = this.generateSessionId();
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create device ID
   */
  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('synthex_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('synthex_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('synthex_token', token);
  }

  /**
   * Clear authentication
   */
  clearAuth() {
    this.token = null;
    localStorage.removeItem('synthex_token');
  }

  /**
   * Set locale
   */
  setLocale(locale) {
    this.locale = locale;
    localStorage.setItem('synthex_locale', locale);
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Session-ID': this.sessionId,
      'X-Device-ID': this.deviceId,
      'X-Locale': this.locale,
      'X-Platform': 'web',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Please retry after ${retryAfter} seconds`);
      }

      // Handle authentication errors
      if (response.status === 401) {
        this.clearAuth();
        window.location.href = '/login.html';
        throw new Error('Authentication required');
      }

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(fullEndpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, body = {}) {
    return this.request(endpoint, { method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PATCH', body });
  }

  // ============================================
  // Authentication API
  // ============================================

  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async register(userData) {
    const response = await this.post('/auth/register', userData);
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout() {
    await this.post('/auth/logout');
    this.clearAuth();
  }

  async resetPassword(email) {
    return this.post('/auth/reset-password', { email });
  }

  async verifyToken(token) {
    return this.post('/auth/verify-token', { token });
  }

  // ============================================
  // Analytics API
  // ============================================

  async getAnalytics(platform, dateRange) {
    return this.get('/analytics', { platform, ...dateRange });
  }

  async getRealtimeAnalytics(platform) {
    return this.get('/analytics/realtime', { platform });
  }

  async getInsights() {
    return this.get('/analytics/insights');
  }

  async getPlatformPerformance(platform) {
    return this.get('/analytics/performance', { platform });
  }

  // ============================================
  // Content Generation API
  // ============================================

  async generateContent(params) {
    return this.post('/ai-content/generate', params);
  }

  async optimizeContent(content, platform) {
    return this.post('/ai-content/optimize', { content, platform });
  }

  async generateHashtags(content) {
    return this.post('/ai-content/hashtags', { content });
  }

  async translateContent(content, targetLocale) {
    return this.post('/ai-content/translate', { content, targetLocale });
  }

  // ============================================
  // A/B Testing API
  // ============================================

  async createABTest(testData) {
    return this.post('/ab-testing/tests', testData);
  }

  async getABTests() {
    return this.get('/ab-testing/tests');
  }

  async getABTestResults(testId) {
    return this.get(`/ab-testing/tests/${testId}/results`);
  }

  // ============================================
  // Team Collaboration API
  // ============================================

  async getTeamMembers() {
    return this.get('/teams/members');
  }

  async inviteTeamMember(email, role) {
    return this.post('/teams/invite', { email, role });
  }

  async updateTeamMember(memberId, updates) {
    return this.patch(`/teams/members/${memberId}`, updates);
  }

  // ============================================
  // Scheduler API
  // ============================================

  async schedulePost(postData) {
    return this.post('/scheduler/posts', postData);
  }

  async getScheduledPosts() {
    return this.get('/scheduler/posts');
  }

  async updateScheduledPost(postId, updates) {
    return this.patch(`/scheduler/posts/${postId}`, updates);
  }

  async deleteScheduledPost(postId) {
    return this.delete(`/scheduler/posts/${postId}`);
  }

  // ============================================
  // Content Library API
  // ============================================

  async getContentLibrary(filters = {}) {
    return this.get('/library/content', filters);
  }

  async saveToLibrary(content) {
    return this.post('/library/content', content);
  }

  async getContentItem(contentId) {
    return this.get(`/library/content/${contentId}`);
  }

  // ============================================
  // Competitor Analysis API
  // ============================================

  async getCompetitors() {
    return this.get('/competitors');
  }

  async addCompetitor(competitorData) {
    return this.post('/competitors', competitorData);
  }

  async analyzeCompetitor(competitorId) {
    return this.post(`/competitors/${competitorId}/analyze`);
  }

  // ============================================
  // Reporting API
  // ============================================

  async generateReport(reportConfig) {
    return this.post('/reporting/generate', reportConfig);
  }

  async getReports() {
    return this.get('/reporting/reports');
  }

  async downloadReport(reportId, format = 'pdf') {
    return this.get(`/reporting/reports/${reportId}/download`, { format });
  }

  // ============================================
  // White Label API
  // ============================================

  async getWhiteLabelConfig() {
    return this.get('/white-label/config');
  }

  async updateWhiteLabelConfig(config) {
    return this.put('/white-label/config', config);
  }

  // ============================================
  // Mobile API
  // ============================================

  async getMobileConfig() {
    return this.get('/mobile/config');
  }

  async syncMobileData(data) {
    return this.post('/mobile/sync', data);
  }

  // ============================================
  // User Management API
  // ============================================

  async getProfile() {
    return this.get('/users/profile');
  }

  async updateProfile(updates) {
    return this.patch('/users/profile', updates);
  }

  async changePassword(currentPassword, newPassword) {
    return this.post('/users/change-password', { currentPassword, newPassword });
  }

  async deleteAccount() {
    return this.delete('/users/account');
  }

  // ============================================
  // Notifications API
  // ============================================

  async getNotifications() {
    return this.get('/notifications');
  }

  async markNotificationRead(notificationId) {
    return this.patch(`/notifications/${notificationId}/read`);
  }

  async updateNotificationSettings(settings) {
    return this.put('/notifications/settings', settings);
  }

  // ============================================
  // Performance API
  // ============================================

  async getPerformanceMetrics() {
    return this.get('/performance/metrics');
  }

  async getSystemHealth() {
    return this.get('/health');
  }

  // ============================================
  // Feature Flags API
  // ============================================

  async getFeatureFlags() {
    return this.get('/features');
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Upload file
   */
  async uploadFile(file, endpoint = '/upload') {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'X-Session-ID': this.sessionId,
        'X-Device-ID': this.deviceId
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    return response.json();
  }

  /**
   * Download file
   */
  async downloadFile(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'X-Session-ID': this.sessionId,
        'X-Device-ID': this.deviceId
      }
    });

    if (!response.ok) {
      throw new Error('File download failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = endpoint.split('/').pop();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * WebSocket connection for real-time updates
   */
  connectWebSocket() {
    const wsUrl = this.baseURL.replace('http', 'ws').replace('/api/v2', '/ws');
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: this.token,
        sessionId: this.sessionId
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(data) {
    // Dispatch custom events based on message type
    const event = new CustomEvent(`synthex:${data.type}`, { detail: data });
    window.dispatchEvent(event);
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Create global instance
window.synthexAPI = new SynthexAPIClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SynthexAPIClient;
}
