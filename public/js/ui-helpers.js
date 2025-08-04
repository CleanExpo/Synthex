// UI Helpers: Loading States and Error Handling
class UIHelpers {
    constructor() {
        this.activeLoaders = new Map();
        this.initStyles();
    }

    initStyles() {
        if (document.getElementById('ui-helper-styles')) return;
        
        const styles = `
            <style id="ui-helper-styles">
                /* Loading States */
                .synthex-loader-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    opacity: 0;
                    animation: fadeIn 0.3s forwards;
                }
                
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
                
                .synthex-loader {
                    background: white;
                    border-radius: 16px;
                    padding: 32px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    min-width: 280px;
                }
                
                .dark-mode .synthex-loader,
                [data-theme="dark"] .synthex-loader {
                    background: #1e293b;
                    color: white;
                }
                
                .loader-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(79, 70, 229, 0.2);
                    border-top-color: #4f46e5;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .loader-text {
                    font-size: 16px;
                    font-weight: 500;
                    color: #475569;
                }
                
                .dark-mode .loader-text,
                [data-theme="dark"] .loader-text {
                    color: #cbd5e1;
                }
                
                .loader-subtext {
                    font-size: 14px;
                    color: #94a3b8;
                    text-align: center;
                }
                
                /* Inline Loading */
                .synthex-inline-loader {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: rgba(79, 70, 229, 0.1);
                    border-radius: 8px;
                    font-size: 14px;
                    color: #4f46e5;
                }
                
                .inline-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(79, 70, 229, 0.3);
                    border-top-color: #4f46e5;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                /* Button Loading State */
                .btn-loading {
                    position: relative;
                    pointer-events: none;
                    opacity: 0.7;
                }
                
                .btn-loading::after {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    top: 50%;
                    left: 50%;
                    margin-left: -8px;
                    margin-top: -8px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                .btn-loading .btn-text {
                    visibility: hidden;
                }
                
                /* Error Messages */
                .synthex-error {
                    background: #fee2e2;
                    border: 1px solid #fecaca;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 16px 0;
                    display: flex;
                    align-items: start;
                    gap: 12px;
                    animation: slideDown 0.3s ease-out;
                }
                
                .dark-mode .synthex-error,
                [data-theme="dark"] .synthex-error {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.3);
                }
                
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
                
                .error-icon {
                    flex-shrink: 0;
                    width: 20px;
                    height: 20px;
                    color: #dc2626;
                }
                
                .error-content {
                    flex: 1;
                }
                
                .error-title {
                    font-weight: 600;
                    color: #991b1b;
                    margin-bottom: 4px;
                }
                
                .dark-mode .error-title,
                [data-theme="dark"] .error-title {
                    color: #fca5a5;
                }
                
                .error-message {
                    color: #7f1d1d;
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .dark-mode .error-message,
                [data-theme="dark"] .error-message {
                    color: #fecaca;
                }
                
                .error-actions {
                    margin-top: 12px;
                    display: flex;
                    gap: 8px;
                }
                
                .error-action-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid #dc2626;
                    background: white;
                    color: #dc2626;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .error-action-btn:hover {
                    background: #dc2626;
                    color: white;
                }
                
                /* Success Messages */
                .synthex-success {
                    background: #dcfce7;
                    border: 1px solid #bbf7d0;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 16px 0;
                    display: flex;
                    align-items: start;
                    gap: 12px;
                    animation: slideDown 0.3s ease-out;
                }
                
                .dark-mode .synthex-success,
                [data-theme="dark"] .synthex-success {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.3);
                }
                
                .success-icon {
                    flex-shrink: 0;
                    width: 20px;
                    height: 20px;
                    color: #16a34a;
                }
                
                /* Toast Notifications */
                .synthex-toast-container {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .synthex-toast {
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 300px;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                }
                
                .dark-mode .synthex-toast,
                [data-theme="dark"] .synthex-toast {
                    background: #1e293b;
                    color: white;
                }
                
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                .toast-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: #4f46e5;
                    border-radius: 0 0 12px 12px;
                    animation: progress 3s linear;
                }
                
                @keyframes progress {
                    from { width: 100%; }
                    to { width: 0; }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Show loading overlay
    showLoading(message = 'Loading...', subtext = '') {
        const id = Date.now().toString();
        
        const loaderHTML = `
            <div class="synthex-loader-overlay" data-loader-id="${id}">
                <div class="synthex-loader">
                    <div class="loader-spinner"></div>
                    <div class="loader-text">${message}</div>
                    ${subtext ? `<div class="loader-subtext">${subtext}</div>` : ''}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
        this.activeLoaders.set(id, true);
        
        return id;
    }

    // Hide loading overlay
    hideLoading(id) {
        const loader = document.querySelector(`[data-loader-id="${id}"]`);
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
            this.activeLoaders.delete(id);
        }
    }

    // Hide all loading overlays
    hideAllLoading() {
        document.querySelectorAll('.synthex-loader-overlay').forEach(loader => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        });
        this.activeLoaders.clear();
    }

    // Show inline loading
    showInlineLoading(element, text = 'Loading...') {
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        element.innerHTML = `
            <div class="synthex-inline-loader">
                <div class="inline-spinner"></div>
                <span>${text}</span>
            </div>
        `;
        return originalContent;
    }

    // Hide inline loading
    hideInlineLoading(element) {
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
    }

    // Add loading state to button
    setButtonLoading(button, loading = true) {
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.classList.add('btn-loading');
            button.innerHTML = `<span class="btn-text">${button.innerHTML}</span>`;
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
            button.disabled = false;
        }
    }

    // Show error message
    showError(message, title = 'Error', container = null, actions = []) {
        const errorHTML = `
            <div class="synthex-error">
                <svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="error-content">
                    <div class="error-title">${title}</div>
                    <div class="error-message">${message}</div>
                    ${actions.length > 0 ? `
                        <div class="error-actions">
                            ${actions.map(action => `
                                <button class="error-action-btn" onclick="${action.onclick}">
                                    ${action.label}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        if (container) {
            const targetElement = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;
            if (targetElement) {
                targetElement.insertAdjacentHTML('beforeend', errorHTML);
            }
        } else {
            this.showToast(message, 'error');
        }
    }

    // Show success message
    showSuccess(message, title = 'Success', container = null) {
        const successHTML = `
            <div class="synthex-success">
                <svg class="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="error-content">
                    <div class="error-title">${title}</div>
                    <div class="error-message">${message}</div>
                </div>
            </div>
        `;
        
        if (container) {
            const targetElement = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;
            if (targetElement) {
                targetElement.insertAdjacentHTML('beforeend', successHTML);
                setTimeout(() => {
                    const successElement = targetElement.querySelector('.synthex-success');
                    if (successElement) successElement.remove();
                }, 5000);
            }
        } else {
            this.showToast(message, 'success');
        }
    }

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        // Create container if it doesn't exist
        let container = document.querySelector('.synthex-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'synthex-toast-container';
            document.body.appendChild(container);
        }
        
        const icons = {
            success: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#16a34a"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            error: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#dc2626"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            info: '<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4f46e5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
        };
        
        const toastHTML = `
            <div class="synthex-toast">
                ${icons[type] || icons.info}
                <span>${message}</span>
                <div class="toast-progress"></div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', toastHTML);
        const toast = container.lastElementChild;
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Handle API errors with user-friendly messages
    handleAPIError(error, customMessages = {}) {
        const defaultMessages = {
            400: 'Invalid request. Please check your input and try again.',
            401: 'Authentication required. Please log in to continue.',
            403: 'You don\'t have permission to perform this action.',
            404: 'The requested resource was not found.',
            429: 'Too many requests. Please wait a moment and try again.',
            500: 'Server error. Our team has been notified.',
            503: 'Service temporarily unavailable. Please try again later.',
            network: 'Network error. Please check your connection.',
            default: 'An unexpected error occurred. Please try again.'
        };
        
        const messages = { ...defaultMessages, ...customMessages };
        
        let message;
        if (error.response) {
            const status = error.response.status;
            message = messages[status] || messages.default;
        } else if (error.request) {
            message = messages.network;
        } else {
            message = error.message || messages.default;
        }
        
        this.showError(message);
        return message;
    }

    // Wrap async function with loading state
    async withLoading(asyncFn, loadingMessage = 'Processing...', button = null) {
        const loaderId = this.showLoading(loadingMessage);
        if (button) this.setButtonLoading(button, true);
        
        try {
            const result = await asyncFn();
            this.hideLoading(loaderId);
            if (button) this.setButtonLoading(button, false);
            return result;
        } catch (error) {
            this.hideLoading(loaderId);
            if (button) this.setButtonLoading(button, false);
            this.handleAPIError(error);
            throw error;
        }
    }
}

// Initialize global UI helper instance
window.uiHelpers = new UIHelpers();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIHelpers;
}