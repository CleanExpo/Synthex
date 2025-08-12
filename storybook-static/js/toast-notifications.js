/**
 * SYNTHEX Toast Notification System
 * Beautiful glassmorphic toast notifications with animations
 */

class ToastNotifications {
    constructor() {
        this.toasts = new Map();
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('toast-container');
        }

        // Add styles
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('toast-styles')) return;

        const styles = `
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 420px;
            }

            @media (max-width: 640px) {
                .toast-container {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
            }

            .toast {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                pointer-events: auto;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform: translateX(400px);
                opacity: 0;
                position: relative;
                overflow: hidden;
            }

            .toast.show {
                transform: translateX(0);
                opacity: 1;
            }

            .toast.hiding {
                transform: translateX(400px);
                opacity: 0;
            }

            .toast:hover {
                transform: translateX(-5px);
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
            }

            .toast-icon {
                width: 24px;
                height: 24px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .toast-content {
                flex: 1;
                min-width: 0;
            }

            .toast-title {
                font-weight: 600;
                font-size: 14px;
                color: #ffffff;
                margin-bottom: 4px;
            }

            .toast-message {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.8);
                line-height: 1.4;
                word-wrap: break-word;
            }

            .toast-close {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
                line-height: 1;
                flex-shrink: 0;
            }

            .toast-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.1);
                color: #ffffff;
            }

            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 16px 16px;
                transition: width linear;
            }

            /* Toast types */
            .toast.toast-success {
                background: rgba(34, 197, 94, 0.15);
                border-color: rgba(34, 197, 94, 0.3);
            }

            .toast.toast-success .toast-icon {
                color: #22c55e;
            }

            .toast.toast-success .toast-progress {
                background: #22c55e;
            }

            .toast.toast-error {
                background: rgba(239, 68, 68, 0.15);
                border-color: rgba(239, 68, 68, 0.3);
            }

            .toast.toast-error .toast-icon {
                color: #ef4444;
            }

            .toast.toast-error .toast-progress {
                background: #ef4444;
            }

            .toast.toast-warning {
                background: rgba(245, 158, 11, 0.15);
                border-color: rgba(245, 158, 11, 0.3);
            }

            .toast.toast-warning .toast-icon {
                color: #f59e0b;
            }

            .toast.toast-warning .toast-progress {
                background: #f59e0b;
            }

            .toast.toast-info {
                background: rgba(59, 130, 246, 0.15);
                border-color: rgba(59, 130, 246, 0.3);
            }

            .toast.toast-info .toast-icon {
                color: #3b82f6;
            }

            .toast.toast-info .toast-progress {
                background: #3b82f6;
            }

            /* Animations */
            @keyframes toastSlideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes toastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }

            @keyframes toastShake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            .toast.shake {
                animation: toastShake 0.5s;
            }

            /* Action buttons */
            .toast-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .toast-action {
                padding: 4px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }

            .toast-action:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .toast-action.primary {
                background: linear-gradient(135deg, #667eea, #764ba2);
                border: none;
            }

            .toast-action.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'toast-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    getIcon(type) {
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        };
        return icons[type] || icons.info;
    }

    show(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = 5000,
            closable = true,
            actions = [],
            onClick = null,
            onClose = null,
            showProgress = true,
            position = 'top-right'
        } = options;

        const id = `toast-${Date.now()}`;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.dataset.toastId = id;

        // Icon
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.innerHTML = this.getIcon(type);
        toast.appendChild(icon);

        // Content
        const content = document.createElement('div');
        content.className = 'toast-content';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = message;
            content.appendChild(messageEl);
        }

        // Actions
        if (actions.length > 0) {
            const actionsEl = document.createElement('div');
            actionsEl.className = 'toast-actions';
            
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `toast-action ${action.primary ? 'primary' : ''}`;
                btn.textContent = action.text;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (action.onClick) action.onClick();
                    if (action.closeOnClick !== false) this.remove(id);
                };
                actionsEl.appendChild(btn);
            });
            
            content.appendChild(actionsEl);
        }

        toast.appendChild(content);

        // Close button
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.remove(id);
            };
            toast.appendChild(closeBtn);
        }

        // Progress bar
        if (showProgress && duration > 0) {
            const progress = document.createElement('div');
            progress.className = 'toast-progress';
            progress.style.width = '100%';
            progress.style.transitionDuration = `${duration}ms`;
            toast.appendChild(progress);

            // Start progress animation after showing
            setTimeout(() => {
                progress.style.width = '0%';
            }, 100);
        }

        // Click handler
        if (onClick) {
            toast.style.cursor = 'pointer';
            toast.onclick = () => onClick();
        }

        // Add to container
        this.container.appendChild(toast);

        // Store toast
        this.toasts.set(id, {
            element: toast,
            timeout: null,
            onClose
        });

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                this.remove(id);
            }, duration);
            this.toasts.get(id).timeout = timeoutId;
        }

        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            const toastData = this.toasts.get(id);
            if (toastData && toastData.timeout) {
                clearTimeout(toastData.timeout);
                const progress = toast.querySelector('.toast-progress');
                if (progress) {
                    progress.style.transitionDuration = '0ms';
                }
            }
        });

        toast.addEventListener('mouseleave', () => {
            if (duration > 0) {
                const timeoutId = setTimeout(() => {
                    this.remove(id);
                }, 2000);
                const toastData = this.toasts.get(id);
                if (toastData) {
                    toastData.timeout = timeoutId;
                }
            }
        });

        return id;
    }

    remove(id) {
        const toastData = this.toasts.get(id);
        if (!toastData) return;

        const { element, timeout, onClose } = toastData;

        // Clear timeout
        if (timeout) {
            clearTimeout(timeout);
        }

        // Hide animation
        element.classList.add('hiding');

        // Remove after animation
        setTimeout(() => {
            element.remove();
            this.toasts.delete(id);
            if (onClose) onClose();
        }, 300);
    }

    // Utility methods
    success(message, title = 'Success', options = {}) {
        return this.show({ ...options, type: 'success', title, message });
    }

    error(message, title = 'Error', options = {}) {
        return this.show({ ...options, type: 'error', title, message });
    }

    warning(message, title = 'Warning', options = {}) {
        return this.show({ ...options, type: 'warning', title, message });
    }

    info(message, title = 'Info', options = {}) {
        return this.show({ ...options, type: 'info', title, message });
    }

    loading(message = 'Loading...', options = {}) {
        return this.show({
            ...options,
            type: 'info',
            message,
            duration: 0,
            closable: false,
            showProgress: false
        });
    }

    clear() {
        this.toasts.forEach((_, id) => this.remove(id));
    }
}

// Create global instance
window.toastNotifications = new ToastNotifications();

// Shorthand
window.toast = {
    success: (msg, title, opts) => window.toastNotifications.success(msg, title, opts),
    error: (msg, title, opts) => window.toastNotifications.error(msg, title, opts),
    warning: (msg, title, opts) => window.toastNotifications.warning(msg, title, opts),
    info: (msg, title, opts) => window.toastNotifications.info(msg, title, opts),
    loading: (msg, opts) => window.toastNotifications.loading(msg, opts),
    show: (opts) => window.toastNotifications.show(opts),
    clear: () => window.toastNotifications.clear()
};