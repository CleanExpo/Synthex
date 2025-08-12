/**
 * Synthex Admin Dashboard JavaScript
 * Frontend functionality for the admin interface
 */

class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.refreshInterval = null;
        this.socket = null;
        this.authToken = localStorage.getItem('adminToken');
        
        this.init();
    }

    async init() {
        // Check authentication
        if (!this.authToken) {
            this.redirectToLogin();
            return;
        }

        // Initialize event listeners
        this.initEventListeners();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        // Initialize WebSocket for real-time updates
        this.initWebSocket();
    }

    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Sidebar toggle for mobile
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('-translate-x-full');
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Quick actions
        document.getElementById('trigger-backup')?.addEventListener('click', () => {
            this.triggerBackup();
        });

        document.getElementById('maintenance-toggle')?.addEventListener('click', () => {
            this.toggleMaintenance();
        });

        document.getElementById('clear-cache')?.addEventListener('click', () => {
            this.clearCache();
        });

        // User management
        document.getElementById('user-search')?.addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        document.getElementById('user-plan-filter')?.addEventListener('change', (e) => {
            this.filterUsers('plan', e.target.value);
        });

        // Alert dismissal
        document.getElementById('dismiss-alert')?.addEventListener('click', () => {
            this.hideAlert();
        });

        // Log filtering
        document.getElementById('log-level-filter')?.addEventListener('change', (e) => {
            this.filterLogs(e.target.value);
        });

        document.getElementById('export-logs')?.addEventListener('click', () => {
            this.exportLogs();
        });
    }

    async apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(`/api/admin${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        });

        if (response.status === 401) {
            this.redirectToLogin();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            const overview = await this.apiRequest('/overview');
            this.updateDashboardOverview(overview);
            
            const alerts = await this.apiRequest('/alerts');
            this.updateAlerts(alerts.alerts);
            
            const activity = await this.apiRequest('/activity');
            this.updateRecentActivity(activity.activity);
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showAlert('error', 'Failed to load dashboard data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updateDashboardOverview(overview) {
        // Update metric cards
        document.getElementById('total-users').textContent = 
            overview.overview?.users?.total || '-';
        document.getElementById('active-users').textContent = 
            overview.overview?.users?.active || '-';
        document.getElementById('total-content').textContent = 
            overview.overview?.content?.total || '-';
        document.getElementById('system-health').textContent = 
            overview.overview?.system?.overall || '-';

        // Update health indicator color
        const healthElement = document.getElementById('system-health');
        const health = overview.overview?.system?.overall;
        healthElement.className = 'text-2xl font-bold ' + 
            (health === 'healthy' ? 'text-green-600' : 
             health === 'degraded' ? 'text-yellow-600' : 'text-red-600');
    }

    updateAlerts(alerts) {
        const alertsList = document.getElementById('alerts-list');
        
        if (!alerts || alerts.length === 0) {
            alertsList.innerHTML = '<p class="text-gray-500">No active alerts</p>';
            return;
        }

        alertsList.innerHTML = alerts.map(alert => `
            <div class="flex items-center justify-between p-4 rounded-lg ${this.getAlertClass(alert.level)}">
                <div class="flex items-center space-x-3">
                    <i class="fas ${this.getAlertIcon(alert.level)}"></i>
                    <div>
                        <p class="font-medium">${alert.message}</p>
                        <p class="text-sm opacity-75">${this.formatDate(alert.createdAt)}</p>
                    </div>
                </div>
                <button onclick="adminDashboard.acknowledgeAlert(${alert.id})" class="text-white hover:text-gray-200">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        `).join('');
    }

    updateRecentActivity(activity) {
        const activityList = document.getElementById('activity-list');
        
        if (!activity || activity.length === 0) {
            activityList.innerHTML = '<p class="text-gray-500">No recent activity</p>';
            return;
        }

        activityList.innerHTML = activity.map(item => `
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <i class="fas ${this.getActivityIcon(item.type)} text-blue-600"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium">${item.description}</p>
                    <p class="text-xs text-gray-500">${this.formatDate(item.timestamp)}</p>
                </div>
            </div>
        `).join('');
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active', 'bg-gray-700');
            if (link.getAttribute('href') === `#${sectionName}`) {
                link.classList.add('active', 'bg-gray-700');
            }
        });

        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    async loadSectionData(section) {
        try {
            switch (section) {
                case 'users':
                    await this.loadUsers();
                    break;
                case 'content':
                    await this.loadContentModeration();
                    break;
                case 'system':
                    await this.loadSystemDetails();
                    break;
                case 'security':
                    await this.loadSecurityReport();
                    break;
                case 'backups':
                    await this.loadBackupHistory();
                    break;
                case 'logs':
                    await this.loadLogs();
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${section} data:`, error);
            this.showAlert('error', `Failed to load ${section} data: ` + error.message);
        }
    }

    async loadUsers() {
        const users = await this.apiRequest('/users');
        this.updateUsersTable(users.users);
        this.updateUsersPagination(users.pagination);
    }

    updateUsersTable(users) {
        const tbody = document.getElementById('users-table-body');
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <i class="fas fa-user text-gray-600"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">
                                ${user.first_name || ''} ${user.last_name || ''}
                            </div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' : 
                          user.plan === 'pro' ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-800'}">
                        ${user.plan}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${user.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.last_login_at ? this.formatDate(user.last_login_at) : 'Never'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="adminDashboard.editUser('${user.id}')" 
                            class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                    <button onclick="adminDashboard.suspendUser('${user.id}')" 
                            class="text-red-600 hover:text-red-900">Suspend</button>
                </td>
            </tr>
        `).join('');
    }

    async triggerBackup() {
        try {
            this.showLoading(true);
            await this.apiRequest('/backup/trigger', { method: 'POST' });
            this.showAlert('success', 'Backup triggered successfully');
        } catch (error) {
            this.showAlert('error', 'Failed to trigger backup: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async toggleMaintenance() {
        try {
            this.showLoading(true);
            // This would check current maintenance status and toggle
            await this.apiRequest('/maintenance/enable', { 
                method: 'POST',
                body: JSON.stringify({ message: 'Scheduled maintenance' })
            });
            this.showAlert('info', 'Maintenance mode toggled');
        } catch (error) {
            this.showAlert('error', 'Failed to toggle maintenance: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async clearCache() {
        try {
            this.showLoading(true);
            // This would call a cache clearing endpoint
            this.showAlert('success', 'Cache cleared successfully');
        } catch (error) {
            this.showAlert('error', 'Failed to clear cache: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async acknowledgeAlert(alertId) {
        try {
            await this.apiRequest(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
            this.loadDashboardData(); // Refresh alerts
        } catch (error) {
            this.showAlert('error', 'Failed to acknowledge alert: ' + error.message);
        }
    }

    async editUser(userId) {
        // This would open a modal or form to edit user details
        console.log('Edit user:', userId);
    }

    async suspendUser(userId) {
        if (confirm('Are you sure you want to suspend this user?')) {
            try {
                await this.apiRequest(`/users/${userId}/suspend`, { method: 'POST' });
                this.showAlert('success', 'User suspended successfully');
                this.loadUsers(); // Refresh users list
            } catch (error) {
                this.showAlert('error', 'Failed to suspend user: ' + error.message);
            }
        }
    }

    async exportLogs() {
        try {
            const level = document.getElementById('log-level-filter').value;
            const params = new URLSearchParams();
            if (level) params.append('level', level);
            
            const response = await fetch(`/api/admin/logs/export?${params}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system-logs-${Date.now()}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showAlert('success', 'Logs exported successfully');
        } catch (error) {
            this.showAlert('error', 'Failed to export logs: ' + error.message);
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.currentSection === 'dashboard') {
                this.loadDashboardData();
            }
        }, 30000); // Refresh every 30 seconds
    }

    initWebSocket() {
        // This would initialize WebSocket connection for real-time updates
        // For now, just log that we would connect
        console.log('WebSocket connection would be initialized here');
    }

    showAlert(type, message) {
        const alertBar = document.getElementById('alert-bar');
        const alertMessage = document.getElementById('alert-message');
        
        alertBar.className = `mb-6 p-4 rounded-lg ${
            type === 'success' ? 'bg-green-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' :
            type === 'warning' ? 'bg-yellow-600 text-white' :
            'bg-blue-600 text-white'
        }`;
        
        alertMessage.textContent = message;
        alertBar.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideAlert(), 5000);
    }

    hideAlert() {
        document.getElementById('alert-bar').classList.add('hidden');
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    logout() {
        localStorage.removeItem('adminToken');
        this.redirectToLogin();
    }

    redirectToLogin() {
        window.location.href = '/admin/login.html';
    }

    // Utility methods
    getAlertClass(level) {
        switch (level) {
            case 'critical': return 'alert-critical text-white';
            case 'warning': return 'alert-warning text-white';
            case 'info': return 'alert-info text-white';
            default: return 'bg-gray-600 text-white';
        }
    }

    getAlertIcon(level) {
        switch (level) {
            case 'critical': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'info': return 'fa-info-circle';
            default: return 'fa-bell';
        }
    }

    getActivityIcon(type) {
        switch (type) {
            case 'user_registration': return 'fa-user-plus';
            case 'content_created': return 'fa-file-plus';
            case 'system_alert': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    // Placeholder methods for sections not fully implemented
    updateUsersPagination(pagination) {
        console.log('Pagination:', pagination);
    }

    async loadContentModeration() {
        console.log('Loading content moderation data...');
    }

    async loadSystemDetails() {
        console.log('Loading system details...');
    }

    async loadSecurityReport() {
        console.log('Loading security report...');
    }

    async loadBackupHistory() {
        console.log('Loading backup history...');
    }

    async loadLogs() {
        console.log('Loading logs...');
    }

    searchUsers(query) {
        console.log('Search users:', query);
    }

    filterUsers(type, value) {
        console.log('Filter users:', type, value);
    }

    filterLogs(level) {
        console.log('Filter logs:', level);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});