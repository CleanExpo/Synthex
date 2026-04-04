/**
 * SYNTHEX JavaScript SDK
 * Official SDK for integrating with the SYNTHEX AI-powered marketing platform
 * @version 1.0.0
 * @license MIT
 */

class SynthexSDK {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.SYNTHEX_API_KEY;
        this.baseURL = config.baseURL || 'https://synthex.social/api/v1';
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
        this.debug = config.debug || false;
        this.webhookSecret = config.webhookSecret;
        
        // Initialize service modules
        this.auth = new AuthService(this);
        this.posts = new PostsService(this);
        this.analytics = new AnalyticsService(this);
        this.users = new UsersService(this);
        this.teams = new TeamsService(this);
        this.webhooks = new WebhooksService(this);
        this.campaigns = new CampaignsService(this);
        this.content = new ContentService(this);
        this.platforms = new PlatformsService(this);
        this.ai = new AIService(this);
        
        // Rate limiting
        this.rateLimiter = new RateLimiter(config.rateLimit || {
            maxRequests: 100,
            windowMs: 60000
        });
        
        // Event emitter for webhooks
        this.events = new EventEmitter();
        
        // Request interceptors
        this.interceptors = {
            request: [],
            response: []
        };
    }
    
    /**
     * Make authenticated API request
     */
    async request(method, endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SYNTHEX-SDK/1.0.0',
            ...options.headers
        };
        
        // Apply request interceptors
        let config = { method, url, headers, ...options };
        for (const interceptor of this.interceptors.request) {
            config = await interceptor(config);
        }
        
        // Check rate limiting
        await this.rateLimiter.checkLimit();
        
        // Make request with retry logic
        let lastError;
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                if (this.debug) {
                    console.log(`[SYNTHEX SDK] ${method} ${url}`, options.body);
                }
                
                const response = await this.fetchWithTimeout(url, {
                    method,
                    headers: config.headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    ...options.fetchOptions
                });
                
                // Apply response interceptors
                let result = await this.handleResponse(response);
                for (const interceptor of this.interceptors.response) {
                    result = await interceptor(result, response);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx)
                if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
                    throw error;
                }
                
                // Exponential backoff for retries
                if (attempt < this.retryAttempts - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await this.sleep(delay);
                    continue;
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    }
    
    /**
     * Handle API response
     */
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        const data = isJson ? await response.json() : await response.text();
        
        if (!response.ok) {
            const error = new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            error.statusCode = response.status;
            error.response = data;
            throw error;
        }
        
        return data;
    }
    
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }
    
    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }
    
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Paginate through results
     */
    async *paginate(endpoint, options = {}) {
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const response = await this.request('GET', endpoint, {
                params: {
                    ...options.params,
                    page,
                    limit: options.limit || 100
                }
            });
            
            yield* response.data;
            
            hasMore = response.hasMore || (response.data.length === (options.limit || 100));
            page++;
        }
    }
    
    /**
     * Upload file
     */
    async uploadFile(endpoint, file, options = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional fields
        for (const [key, value] of Object.entries(options.fields || {})) {
            formData.append(key, value);
        }
        
        return this.request('POST', endpoint, {
            body: formData,
            headers: {
                'Content-Type': undefined // Let browser set it
            }
        });
    }
}

/**
 * Auth Service
 */
class AuthService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async login(email, password) {
        return this.sdk.request('POST', '/auth/login', {
            body: { email, password }
        });
    }
    
    async register(userData) {
        return this.sdk.request('POST', '/auth/register', {
            body: userData
        });
    }
    
    async logout() {
        return this.sdk.request('POST', '/auth/logout');
    }
    
    async refreshToken() {
        return this.sdk.request('POST', '/auth/refresh');
    }
    
    async forgotPassword(email) {
        return this.sdk.request('POST', '/auth/forgot-password', {
            body: { email }
        });
    }
    
    async resetPassword(token, password) {
        return this.sdk.request('POST', '/auth/reset-password', {
            body: { token, password }
        });
    }
    
    async verifyEmail(token) {
        return this.sdk.request('POST', '/auth/verify-email', {
            body: { token }
        });
    }
    
    async enable2FA() {
        return this.sdk.request('POST', '/auth/2fa/enable');
    }
    
    async disable2FA(code) {
        return this.sdk.request('POST', '/auth/2fa/disable', {
            body: { code }
        });
    }
    
    async verify2FA(code) {
        return this.sdk.request('POST', '/auth/2fa/verify', {
            body: { code }
        });
    }
}

/**
 * Posts Service
 */
class PostsService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async create(postData) {
        return this.sdk.request('POST', '/posts', {
            body: postData
        });
    }
    
    async createBulk(posts) {
        return this.sdk.request('POST', '/posts/bulk', {
            body: { posts }
        });
    }
    
    async get(postId) {
        return this.sdk.request('GET', `/posts/${postId}`);
    }
    
    async list(options = {}) {
        return this.sdk.request('GET', '/posts', {
            params: options
        });
    }
    
    async update(postId, updates) {
        return this.sdk.request('PATCH', `/posts/${postId}`, {
            body: updates
        });
    }
    
    async delete(postId) {
        return this.sdk.request('DELETE', `/posts/${postId}`);
    }
    
    async publish(postId) {
        return this.sdk.request('POST', `/posts/${postId}/publish`);
    }
    
    async schedule(postId, scheduledAt) {
        return this.sdk.request('POST', `/posts/${postId}/schedule`, {
            body: { scheduledAt }
        });
    }
    
    async duplicate(postId) {
        return this.sdk.request('POST', `/posts/${postId}/duplicate`);
    }
    
    async analytics(postId, options = {}) {
        return this.sdk.request('GET', `/posts/${postId}/analytics`, {
            params: options
        });
    }
    
    async addMedia(postId, media) {
        return this.sdk.uploadFile(`/posts/${postId}/media`, media);
    }
    
    async removeMedia(postId, mediaId) {
        return this.sdk.request('DELETE', `/posts/${postId}/media/${mediaId}`);
    }
    
    async preview(postData) {
        return this.sdk.request('POST', '/posts/preview', {
            body: postData
        });
    }
}

/**
 * Analytics Service
 */
class AnalyticsService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async getOverview(options = {}) {
        return this.sdk.request('GET', '/analytics/overview', {
            params: options
        });
    }
    
    async getEngagement(options = {}) {
        return this.sdk.request('GET', '/analytics/engagement', {
            params: options
        });
    }
    
    async getReach(options = {}) {
        return this.sdk.request('GET', '/analytics/reach', {
            params: options
        });
    }
    
    async getConversions(options = {}) {
        return this.sdk.request('GET', '/analytics/conversions', {
            params: options
        });
    }
    
    async getAudience(options = {}) {
        return this.sdk.request('GET', '/analytics/audience', {
            params: options
        });
    }
    
    async getContent(options = {}) {
        return this.sdk.request('GET', '/analytics/content', {
            params: options
        });
    }
    
    async getPlatforms(options = {}) {
        return this.sdk.request('GET', '/analytics/platforms', {
            params: options
        });
    }
    
    async getCustomReport(reportConfig) {
        return this.sdk.request('POST', '/analytics/custom-report', {
            body: reportConfig
        });
    }
    
    async exportReport(format, options = {}) {
        return this.sdk.request('POST', '/analytics/export', {
            body: { format, ...options }
        });
    }
    
    async getRealtime() {
        return this.sdk.request('GET', '/analytics/realtime');
    }
    
    async compare(periods) {
        return this.sdk.request('POST', '/analytics/compare', {
            body: { periods }
        });
    }
    
    async getInsights(options = {}) {
        return this.sdk.request('GET', '/analytics/insights', {
            params: options
        });
    }
}

/**
 * Users Service
 */
class UsersService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async getProfile() {
        return this.sdk.request('GET', '/users/profile');
    }
    
    async updateProfile(updates) {
        return this.sdk.request('PATCH', '/users/profile', {
            body: updates
        });
    }
    
    async uploadAvatar(file) {
        return this.sdk.uploadFile('/users/avatar', file);
    }
    
    async deleteAvatar() {
        return this.sdk.request('DELETE', '/users/avatar');
    }
    
    async getPreferences() {
        return this.sdk.request('GET', '/users/preferences');
    }
    
    async updatePreferences(preferences) {
        return this.sdk.request('PUT', '/users/preferences', {
            body: preferences
        });
    }
    
    async getNotifications(options = {}) {
        return this.sdk.request('GET', '/users/notifications', {
            params: options
        });
    }
    
    async markNotificationRead(notificationId) {
        return this.sdk.request('PUT', `/users/notifications/${notificationId}/read`);
    }
    
    async markAllNotificationsRead() {
        return this.sdk.request('PUT', '/users/notifications/read-all');
    }
    
    async getSessions() {
        return this.sdk.request('GET', '/users/sessions');
    }
    
    async revokeSession(sessionId) {
        return this.sdk.request('DELETE', `/users/sessions/${sessionId}`);
    }
    
    async getApiKeys() {
        return this.sdk.request('GET', '/users/api-keys');
    }
    
    async createApiKey(name, scopes = []) {
        return this.sdk.request('POST', '/users/api-keys', {
            body: { name, scopes }
        });
    }
    
    async revokeApiKey(keyId) {
        return this.sdk.request('DELETE', `/users/api-keys/${keyId}`);
    }
}

/**
 * Teams Service
 */
class TeamsService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async create(teamData) {
        return this.sdk.request('POST', '/teams', {
            body: teamData
        });
    }
    
    async get(teamId) {
        return this.sdk.request('GET', `/teams/${teamId}`);
    }
    
    async list(options = {}) {
        return this.sdk.request('GET', '/teams', {
            params: options
        });
    }
    
    async update(teamId, updates) {
        return this.sdk.request('PATCH', `/teams/${teamId}`, {
            body: updates
        });
    }
    
    async delete(teamId) {
        return this.sdk.request('DELETE', `/teams/${teamId}`);
    }
    
    async getMembers(teamId, options = {}) {
        return this.sdk.request('GET', `/teams/${teamId}/members`, {
            params: options
        });
    }
    
    async inviteMember(teamId, email, role = 'member') {
        return this.sdk.request('POST', `/teams/${teamId}/invite`, {
            body: { email, role }
        });
    }
    
    async removeMember(teamId, userId) {
        return this.sdk.request('DELETE', `/teams/${teamId}/members/${userId}`);
    }
    
    async updateMemberRole(teamId, userId, role) {
        return this.sdk.request('PATCH', `/teams/${teamId}/members/${userId}`, {
            body: { role }
        });
    }
    
    async getActivity(teamId, options = {}) {
        return this.sdk.request('GET', `/teams/${teamId}/activity`, {
            params: options
        });
    }
    
    async getPermissions(teamId) {
        return this.sdk.request('GET', `/teams/${teamId}/permissions`);
    }
    
    async updatePermissions(teamId, permissions) {
        return this.sdk.request('PUT', `/teams/${teamId}/permissions`, {
            body: permissions
        });
    }
}

/**
 * Webhooks Service
 */
class WebhooksService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async create(webhookData) {
        return this.sdk.request('POST', '/webhooks', {
            body: webhookData
        });
    }
    
    async get(webhookId) {
        return this.sdk.request('GET', `/webhooks/${webhookId}`);
    }
    
    async list(options = {}) {
        return this.sdk.request('GET', '/webhooks', {
            params: options
        });
    }
    
    async update(webhookId, updates) {
        return this.sdk.request('PATCH', `/webhooks/${webhookId}`, {
            body: updates
        });
    }
    
    async delete(webhookId) {
        return this.sdk.request('DELETE', `/webhooks/${webhookId}`);
    }
    
    async test(webhookId) {
        return this.sdk.request('POST', `/webhooks/${webhookId}/test`);
    }
    
    async getLogs(webhookId, options = {}) {
        return this.sdk.request('GET', `/webhooks/${webhookId}/logs`, {
            params: options
        });
    }
    
    async verify(payload, signature) {
        if (!this.sdk.webhookSecret) {
            throw new Error('Webhook secret not configured');
        }
        
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.sdk.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === expectedSignature;
    }
    
    on(event, handler) {
        this.sdk.events.on(event, handler);
    }
    
    off(event, handler) {
        this.sdk.events.off(event, handler);
    }
    
    emit(event, data) {
        this.sdk.events.emit(event, data);
    }
}

/**
 * Campaigns Service
 */
class CampaignsService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async create(campaignData) {
        return this.sdk.request('POST', '/campaigns', {
            body: campaignData
        });
    }
    
    async get(campaignId) {
        return this.sdk.request('GET', `/campaigns/${campaignId}`);
    }
    
    async list(options = {}) {
        return this.sdk.request('GET', '/campaigns', {
            params: options
        });
    }
    
    async update(campaignId, updates) {
        return this.sdk.request('PATCH', `/campaigns/${campaignId}`, {
            body: updates
        });
    }
    
    async delete(campaignId) {
        return this.sdk.request('DELETE', `/campaigns/${campaignId}`);
    }
    
    async start(campaignId) {
        return this.sdk.request('POST', `/campaigns/${campaignId}/start`);
    }
    
    async pause(campaignId) {
        return this.sdk.request('POST', `/campaigns/${campaignId}/pause`);
    }
    
    async stop(campaignId) {
        return this.sdk.request('POST', `/campaigns/${campaignId}/stop`);
    }
    
    async duplicate(campaignId) {
        return this.sdk.request('POST', `/campaigns/${campaignId}/duplicate`);
    }
    
    async getAnalytics(campaignId, options = {}) {
        return this.sdk.request('GET', `/campaigns/${campaignId}/analytics`, {
            params: options
        });
    }
    
    async getPosts(campaignId, options = {}) {
        return this.sdk.request('GET', `/campaigns/${campaignId}/posts`, {
            params: options
        });
    }
    
    async addPost(campaignId, postId) {
        return this.sdk.request('POST', `/campaigns/${campaignId}/posts`, {
            body: { postId }
        });
    }
    
    async removePost(campaignId, postId) {
        return this.sdk.request('DELETE', `/campaigns/${campaignId}/posts/${postId}`);
    }
}

/**
 * Content Service
 */
class ContentService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async generateWithAI(prompt, options = {}) {
        return this.sdk.request('POST', '/content/generate', {
            body: { prompt, ...options }
        });
    }
    
    async optimize(content, platform) {
        return this.sdk.request('POST', '/content/optimize', {
            body: { content, platform }
        });
    }
    
    async analyze(content) {
        return this.sdk.request('POST', '/content/analyze', {
            body: { content }
        });
    }
    
    async getSuggestions(content, options = {}) {
        return this.sdk.request('POST', '/content/suggestions', {
            body: { content, ...options }
        });
    }
    
    async checkCompliance(content, platforms = []) {
        return this.sdk.request('POST', '/content/compliance', {
            body: { content, platforms }
        });
    }
    
    async translate(content, targetLanguage) {
        return this.sdk.request('POST', '/content/translate', {
            body: { content, targetLanguage }
        });
    }
    
    async generateHashtags(content, count = 10) {
        return this.sdk.request('POST', '/content/hashtags', {
            body: { content, count }
        });
    }
    
    async generateCaption(mediaUrl, options = {}) {
        return this.sdk.request('POST', '/content/caption', {
            body: { mediaUrl, ...options }
        });
    }
    
    async shortenUrl(url, customAlias) {
        return this.sdk.request('POST', '/content/shorten-url', {
            body: { url, customAlias }
        });
    }
    
    async expandUrl(shortUrl) {
        return this.sdk.request('GET', '/content/expand-url', {
            params: { url: shortUrl }
        });
    }
}

/**
 * Platforms Service
 */
class PlatformsService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async list() {
        return this.sdk.request('GET', '/platforms');
    }
    
    async connect(platform, credentials) {
        return this.sdk.request('POST', `/platforms/${platform}/connect`, {
            body: credentials
        });
    }
    
    async disconnect(platform) {
        return this.sdk.request('DELETE', `/platforms/${platform}/disconnect`);
    }
    
    async getStatus(platform) {
        return this.sdk.request('GET', `/platforms/${platform}/status`);
    }
    
    async getAccounts(platform) {
        return this.sdk.request('GET', `/platforms/${platform}/accounts`);
    }
    
    async getProfile(platform, accountId) {
        return this.sdk.request('GET', `/platforms/${platform}/accounts/${accountId}`);
    }
    
    async getInsights(platform, accountId, options = {}) {
        return this.sdk.request('GET', `/platforms/${platform}/accounts/${accountId}/insights`, {
            params: options
        });
    }
    
    async getLimits(platform) {
        return this.sdk.request('GET', `/platforms/${platform}/limits`);
    }
    
    async validatePost(platform, postData) {
        return this.sdk.request('POST', `/platforms/${platform}/validate`, {
            body: postData
        });
    }
}

/**
 * AI Service
 */
class AIService {
    constructor(sdk) {
        this.sdk = sdk;
    }
    
    async generateContent(prompt, options = {}) {
        return this.sdk.request('POST', '/ai/generate', {
            body: { prompt, ...options }
        });
    }
    
    async improveContent(content, options = {}) {
        return this.sdk.request('POST', '/ai/improve', {
            body: { content, ...options }
        });
    }
    
    async analyzeSentiment(text) {
        return this.sdk.request('POST', '/ai/sentiment', {
            body: { text }
        });
    }
    
    async extractKeywords(text, count = 10) {
        return this.sdk.request('POST', '/ai/keywords', {
            body: { text, count }
        });
    }
    
    async summarize(text, maxLength = 280) {
        return this.sdk.request('POST', '/ai/summarize', {
            body: { text, maxLength }
        });
    }
    
    async detectLanguage(text) {
        return this.sdk.request('POST', '/ai/detect-language', {
            body: { text }
        });
    }
    
    async moderateContent(content) {
        return this.sdk.request('POST', '/ai/moderate', {
            body: { content }
        });
    }
    
    async generateImage(prompt, options = {}) {
        return this.sdk.request('POST', '/ai/generate-image', {
            body: { prompt, ...options }
        });
    }
    
    async analyzeImage(imageUrl) {
        return this.sdk.request('POST', '/ai/analyze-image', {
            body: { imageUrl }
        });
    }
    
    async transcribeAudio(audioUrl) {
        return this.sdk.request('POST', '/ai/transcribe', {
            body: { audioUrl }
        });
    }
}

/**
 * Rate Limiter
 */
class RateLimiter {
    constructor(config) {
        this.maxRequests = config.maxRequests;
        this.windowMs = config.windowMs;
        this.requests = [];
    }
    
    async checkLimit() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Remove old requests outside the window
        this.requests = this.requests.filter(time => time > windowStart);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + this.windowMs - now;
            
            if (waitTime > 0) {
                await this.sleep(waitTime);
            }
        }
        
        this.requests.push(now);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Simple Event Emitter
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, handler) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(handler);
    }
    
    off(event, handler) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(h => h !== handler);
        }
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(handler => handler(data));
        }
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SynthexSDK;
} else if (typeof window !== 'undefined') {
    window.SynthexSDK = SynthexSDK;
}

// TypeScript type definitions can be added in a separate .d.ts file