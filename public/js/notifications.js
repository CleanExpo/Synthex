// Notification System

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.container = null;
        this.bellIcon = null;
        this.init();
    }

    init() {
        // Create notification container
        this.createNotificationContainer();
        
        // Update notification bell if it exists
        this.updateBellIcon();

        // Delegated click: ensure bell always toggles dropdown
        document.addEventListener('click', (e) => {
            const el = e.target;
            if (el && el.closest && el.closest('.notification-bell')) {
                e.stopPropagation();
                this.toggleNotifications();
            }
        });
        
        // Load notifications
        this.loadNotifications();
        
        // Set up WebSocket or polling for real-time updates
        this.setupRealTimeUpdates();
        
        // Check for performance alerts every 5 minutes
        setInterval(() => this.checkPerformanceAlerts(), 5 * 60 * 1000);
    }

    createNotificationContainer() {
        // Create notification dropdown container
        const container = document.createElement('div');
        container.className = 'notification-dropdown';
        container.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            width: 380px;
            max-height: 500px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-xl);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            display: none;
            z-index: 2000;
            overflow: hidden;
        `;
        
        container.innerHTML = `
            <div class="notification-header" style="padding: 20px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.125rem;">Notifications</h3>
                    <button class="mark-all-read" style="font-size: 0.875rem; color: var(--primary); background: none; border: none; cursor: pointer;">
                        Mark all as read
                    </button>
                </div>
            </div>
            <div class="notification-list" style="max-height: 400px; overflow-y: auto;">
                <!-- Notifications will be inserted here -->
            </div>
            <div class="notification-footer" style="padding: 16px; border-top: 1px solid var(--border-color); text-align: center;">
                <a href="/notifications.html" style="color: var(--primary); text-decoration: none; font-size: 0.875rem;">
                    View all notifications
                </a>
            </div>
        `;
        
        document.body.appendChild(container);
        this.container = container;
        
        // Add click outside to close
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && !e.target.closest('.notification-bell')) {
                container.style.display = 'none';
            }
        });
        
        // Mark all as read
        container.querySelector('.mark-all-read').addEventListener('click', () => {
            this.markAllAsRead();
        });
    }

    updateBellIcon() {
        // Find all notification bell icons in the page
        const bells = document.querySelectorAll('.notification-bell');
        bells.forEach(bell => {
            bell.style.position = 'relative';
            bell.style.cursor = 'pointer';
            
            // Add badge if unread notifications
            if (this.unreadCount > 0) {
                let badge = bell.querySelector('.notification-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'notification-badge';
                    badge.style.cssText = `
                        position: absolute;
                        top: -4px;
                        right: -4px;
                        background: var(--error);
                        color: white;
                        font-size: 0.625rem;
                        font-weight: 700;
                        padding: 2px 6px;
                        border-radius: 999px;
                        min-width: 18px;
                        text-align: center;
                    `;
                    bell.appendChild(badge);
                }
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            } else {
                const badge = bell.querySelector('.notification-badge');
                if (badge) badge.remove();
            }
            
            // Add click handler
            bell.onclick = (e) => {
                e.stopPropagation();
                this.toggleNotifications();
            };
        });
    }

    toggleNotifications() {
        if (this.container.style.display === 'none' || !this.container.style.display) {
            this.container.style.display = 'block';
            this.container.style.animation = 'slideDown 0.3s ease';
        } else {
            this.container.style.display = 'none';
        }
    }

    async loadNotifications() {
        try {
            const response = await synthexAPI.getNotifications();
            if (response && response.data) {
                this.notifications = response.data;
                this.unreadCount = this.notifications.filter(n => !n.read).length;
                this.renderNotifications();
                this.updateBellIcon();
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
            // Use sample data for demo
            this.useSampleNotifications();
        }
    }

    renderNotifications() {
        const list = this.container.querySelector('.notification-list');
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.5;">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                    </svg>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.notifications.slice(0, 10).map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}" style="
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background 0.2s;
                ${notif.read ? '' : 'background: rgba(99, 102, 241, 0.05);'}
            ">
                <div style="display: flex; gap: 12px;">
                    <div class="notification-icon" style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: ${this.getIconBackground(notif.type)};
                        color: ${this.getIconColor(notif.type)};
                        flex-shrink: 0;
                    ">
                        ${this.getIcon(notif.type)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="margin: 0 0 4px; font-size: 0.875rem; font-weight: 600;">
                            ${notif.title}
                        </h4>
                        <p style="margin: 0 0 4px; font-size: 0.813rem; color: var(--text-secondary); line-height: 1.4;">
                            ${notif.message}
                        </p>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">
                            ${this.formatTime(notif.createdAt)}
                        </span>
                    </div>
                    ${notif.read ? '' : '<div style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%; flex-shrink: 0; margin-top: 6px;"></div>'}
                </div>
            </div>
        `).join('');
        
        // Add hover effect
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!item.classList.contains('unread')) {
                    item.style.background = 'rgba(255, 255, 255, 0.02)';
                }
            });
            
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('unread')) {
                    item.style.background = '';
                }
            });
            
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.markAsRead(id);
                this.handleNotificationClick(this.notifications.find(n => n.id === id));
            });
        });
    }

    getIcon(type) {
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            campaign: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>',
            content: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
            analytics: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>'
        };
        return icons[type] || icons.info;
    }

    getIconBackground(type) {
        const backgrounds = {
            success: 'rgba(16, 185, 129, 0.1)',
            warning: 'rgba(245, 158, 11, 0.1)',
            error: 'rgba(239, 68, 68, 0.1)',
            info: 'rgba(59, 130, 246, 0.1)',
            campaign: 'rgba(139, 92, 246, 0.1)',
            content: 'rgba(236, 72, 153, 0.1)',
            analytics: 'rgba(16, 185, 129, 0.1)'
        };
        return backgrounds[type] || backgrounds.info;
    }

    getIconColor(type) {
        const colors = {
            success: 'var(--accent-green)',
            warning: 'var(--accent-orange)',
            error: 'var(--error)',
            info: 'var(--accent-blue)',
            campaign: 'var(--accent-purple)',
            content: 'var(--accent-pink)',
            analytics: 'var(--accent-green)'
        };
        return colors[type] || colors.info;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            return date.toLocaleDateString();
        }
    }

    handleNotificationClick(notification) {
        // Navigate based on notification type
        switch (notification.type) {
            case 'campaign':
                if (notification.data?.campaignId) {
                    window.location.href = `/campaigns-new.html?id=${notification.data.campaignId}`;
                }
                break;
            case 'content':
                window.location.href = '/content-studio.html';
                break;
            case 'analytics':
                window.location.href = '/analytics.html';
                break;
            default:
                // Just mark as read
                break;
        }
    }

    async markAsRead(id) {
        try {
            await synthexAPI.markNotificationAsRead(id);
            const notification = this.notifications.find(n => n.id === id);
            if (notification && !notification.read) {
                notification.read = true;
                this.unreadCount--;
                this.renderNotifications();
                this.updateBellIcon();
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            await synthexAPI.markAllNotificationsAsRead();
            this.notifications.forEach(n => n.read = true);
            this.unreadCount = 0;
            this.renderNotifications();
            this.updateBellIcon();
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }

    async addNotification(notification) {
        // Add new notification to the beginning
        this.notifications.unshift({
            id: Date.now().toString(),
            ...notification,
            read: false,
            createdAt: new Date().toISOString()
        });
        
        this.unreadCount++;
        this.renderNotifications();
        this.updateBellIcon();
        
        // Show browser notification if permission granted
        if (notification.showBrowserNotification !== false) {
            this.showBrowserNotification(notification);
        }
    }

    async showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notif = new Notification(notification.title, {
                body: notification.message,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: notification.id,
                requireInteraction: notification.requireInteraction || false
            });
            
            notif.onclick = () => {
                window.focus();
                this.handleNotificationClick(notification);
                notif.close();
            };
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    setupRealTimeUpdates() {
        // In a real app, this would be WebSocket or Server-Sent Events
        // For now, we'll poll every 30 seconds
        setInterval(() => {
            this.checkForNewNotifications();
        }, 30000);
    }

    async checkForNewNotifications() {
        try {
            const response = await synthexAPI.getNotifications({ 
                since: this.notifications[0]?.createdAt 
            });
            
            if (response && response.data && response.data.length > 0) {
                // Add new notifications
                response.data.forEach(notif => {
                    if (!this.notifications.find(n => n.id === notif.id)) {
                        this.addNotification(notif);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to check for new notifications:', error);
        }
    }

    async checkPerformanceAlerts() {
        // Check campaign performance and create alerts
        try {
            const campaigns = await synthexAPI.getCampaigns({ status: 'active' });
            
            if (campaigns && campaigns.data) {
                campaigns.data.campaigns.forEach(campaign => {
                    // Check for performance milestones
                    if (campaign.analytics) {
                        const { totalReach, engagement } = campaign.analytics;
                        
                        // High engagement alert
                        if (engagement > 10) {
                            this.addNotification({
                                type: 'success',
                                title: 'High Engagement Alert! 🎉',
                                message: `Your campaign "${campaign.name}" is performing exceptionally well with ${engagement}% engagement rate!`,
                                data: { campaignId: campaign.id }
                            });
                        }
                        
                        // Milestone alerts
                        if (totalReach >= 10000 && totalReach < 10100) {
                            this.addNotification({
                                type: 'success',
                                title: 'Milestone Reached!',
                                message: `"${campaign.name}" just reached 10K people!`,
                                data: { campaignId: campaign.id }
                            });
                        }
                        
                        // Low performance warning
                        if (engagement < 2 && totalReach > 1000) {
                            this.addNotification({
                                type: 'warning',
                                title: 'Low Engagement Warning',
                                message: `Campaign "${campaign.name}" has low engagement (${engagement}%). Consider optimizing your content.`,
                                data: { campaignId: campaign.id }
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to check performance alerts:', error);
        }
    }

    useSampleNotifications() {
        this.notifications = [
            {
                id: '1',
                type: 'success',
                title: 'Campaign Published Successfully!',
                message: 'Your "Summer Sale 2024" campaign is now live across all platforms.',
                read: false,
                createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
                data: { campaignId: '1' }
            },
            {
                id: '2',
                type: 'analytics',
                title: 'Weekly Performance Report Ready',
                message: 'Your weekly analytics report is ready. Total reach increased by 23%!',
                read: false,
                createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
            },
            {
                id: '3',
                type: 'warning',
                title: 'Content Scheduling Reminder',
                message: 'You have 3 posts scheduled for tomorrow. Review them before they go live.',
                read: true,
                createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
            },
            {
                id: '4',
                type: 'success',
                title: 'Milestone Reached! 🎉',
                message: 'Your Instagram account just hit 10K followers!',
                read: true,
                createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
            },
            {
                id: '5',
                type: 'content',
                title: 'AI Content Generated',
                message: '5 new content variations are ready for your review.',
                read: true,
                createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString()
            }
        ];
        
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.renderNotifications();
        this.updateBellIcon();
    }
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .notification-item:hover {
        background: rgba(255, 255, 255, 0.02);
    }
    
    .notification-dropdown::-webkit-scrollbar {
        width: 8px;
    }
    
    .notification-dropdown::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .notification-dropdown::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }
    
    .notification-dropdown::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.15);
    }
`;
document.head.appendChild(style);

// Initialize notification system
window.notificationSystem = new NotificationSystem();

// Request permission on first interaction
document.addEventListener('click', function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        window.notificationSystem.requestNotificationPermission();
        document.removeEventListener('click', requestPermission);
    }
}, { once: true });
