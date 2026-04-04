/**
 * SYNTHEX Modal System
 * Reusable glassmorphic modal component with animations
 */

class ModalSystem {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.init();
    }

    init() {
        // Create modal container if it doesn't exist
        if (!document.getElementById('modal-container')) {
            const container = document.createElement('div');
            container.id = 'modal-container';
            container.className = 'modal-container';
            document.body.appendChild(container);
        }

        // Add styles
        this.injectStyles();

        // Add event listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close(this.activeModal);
            }
        });
    }

    injectStyles() {
        if (document.getElementById('modal-styles')) return;

        const styles = `
            .modal-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                pointer-events: none;
            }

            .modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                opacity: 0;
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }

            .modal-backdrop.active {
                opacity: 1;
                pointer-events: auto;
            }

            .modal-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                pointer-events: none;
            }

            .modal-wrapper.active {
                pointer-events: auto;
            }

            .modal-content {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                padding: 32px;
                max-width: 90vw;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                transform: scale(0.9) translateY(20px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .modal-content.active {
                transform: scale(1) translateY(0);
                opacity: 1;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .modal-title {
                font-size: 24px;
                font-weight: 600;
                color: #ffffff;
                margin: 0;
            }

            .modal-close {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                color: #ffffff;
            }

            .modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.1);
            }

            .modal-body {
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.6;
            }

            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 32px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .modal-btn {
                padding: 10px 24px;
                border-radius: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                font-size: 14px;
            }

            .modal-btn-primary {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }

            .modal-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
            }

            .modal-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .modal-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            /* Size variants */
            .modal-content.modal-sm {
                max-width: 400px;
            }

            .modal-content.modal-md {
                max-width: 600px;
            }

            .modal-content.modal-lg {
                max-width: 900px;
            }

            .modal-content.modal-xl {
                max-width: 1200px;
            }

            /* Animation variants */
            @keyframes modalSlideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            @keyframes modalZoomIn {
                from {
                    transform: scale(0.5);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .modal-content.slide-up {
                animation: modalSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .modal-content.fade-in {
                animation: modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .modal-content.zoom-in {
                animation: modalZoomIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = 'modal-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    create(options = {}) {
        const {
            id = `modal-${Date.now()}`,
            title = 'Modal Title',
            content = '',
            size = 'md',
            animation = 'fade-in',
            showClose = true,
            closeOnBackdrop = true,
            closeOnEscape = true,
            buttons = [],
            onOpen = () => {},
            onClose = () => {}
        } = options;

        // Create modal elements
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.dataset.modalId = id;

        const wrapper = document.createElement('div');
        wrapper.className = 'modal-wrapper';
        wrapper.dataset.modalId = id;

        const modalContent = document.createElement('div');
        modalContent.className = `modal-content modal-${size} ${animation}`;

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';

        const titleElement = document.createElement('h2');
        titleElement.className = 'modal-title';
        titleElement.textContent = title;
        header.appendChild(titleElement);

        if (showClose) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => this.close(id);
            header.appendChild(closeBtn);
        }

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else {
            body.appendChild(content);
        }

        // Footer with buttons
        if (buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';

            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `modal-btn modal-btn-${btn.type || 'secondary'}`;
                button.textContent = btn.text;
                button.onclick = () => {
                    if (btn.onClick) btn.onClick();
                    if (btn.closeOnClick !== false) this.close(id);
                };
                footer.appendChild(button);
            });

            modalContent.appendChild(header);
            modalContent.appendChild(body);
            modalContent.appendChild(footer);
        } else {
            modalContent.appendChild(header);
            modalContent.appendChild(body);
        }

        wrapper.appendChild(modalContent);

        // Add backdrop click handler
        if (closeOnBackdrop) {
            backdrop.onclick = () => this.close(id);
            wrapper.onclick = (e) => {
                if (e.target === wrapper) this.close(id);
            };
        }

        // Store modal
        this.modals.set(id, {
            backdrop,
            wrapper,
            options: { ...options, id, closeOnEscape },
            onOpen,
            onClose
        });

        return id;
    }

    open(id) {
        const modal = this.modals.get(id);
        if (!modal) return;

        const container = document.getElementById('modal-container');
        container.appendChild(modal.backdrop);
        container.appendChild(modal.wrapper);

        // Trigger animations
        requestAnimationFrame(() => {
            modal.backdrop.classList.add('active');
            modal.wrapper.classList.add('active');
            modal.wrapper.querySelector('.modal-content').classList.add('active');
        });

        this.activeModal = id;
        modal.onOpen();
    }

    close(id) {
        const modal = this.modals.get(id);
        if (!modal) return;

        modal.backdrop.classList.remove('active');
        modal.wrapper.classList.remove('active');
        modal.wrapper.querySelector('.modal-content').classList.remove('active');

        setTimeout(() => {
            modal.backdrop.remove();
            modal.wrapper.remove();
        }, 300);

        if (this.activeModal === id) {
            this.activeModal = null;
        }

        modal.onClose();
    }

    destroy(id) {
        this.close(id);
        this.modals.delete(id);
    }

    // Utility methods for common modals
    alert(message, title = 'Alert') {
        const id = this.create({
            title,
            content: `<p>${message}</p>`,
            size: 'sm',
            buttons: [
                { text: 'OK', type: 'primary' }
            ]
        });
        this.open(id);
        return id;
    }

    confirm(message, title = 'Confirm', onConfirm = () => {}, onCancel = () => {}) {
        const id = this.create({
            title,
            content: `<p>${message}</p>`,
            size: 'sm',
            buttons: [
                { text: 'Cancel', type: 'secondary', onClick: onCancel },
                { text: 'Confirm', type: 'primary', onClick: onConfirm }
            ]
        });
        this.open(id);
        return id;
    }

    prompt(message, title = 'Input', onSubmit = () => {}, defaultValue = '') {
        const inputId = `prompt-input-${Date.now()}`;
        const content = `
            <p>${message}</p>
            <input 
                type="text" 
                id="${inputId}" 
                class="modal-input" 
                value="${defaultValue}"
                style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;"
            />
        `;

        const id = this.create({
            title,
            content,
            size: 'sm',
            buttons: [
                { text: 'Cancel', type: 'secondary' },
                { 
                    text: 'Submit', 
                    type: 'primary',
                    onClick: () => {
                        const value = document.getElementById(inputId).value;
                        onSubmit(value);
                    }
                }
            ]
        });
        this.open(id);

        // Focus input
        setTimeout(() => {
            document.getElementById(inputId)?.focus();
        }, 100);

        return id;
    }
}

// Create global instance
window.modalSystem = new ModalSystem();

// Example usage:
// modalSystem.alert('This is an alert message!');
// modalSystem.confirm('Are you sure?', 'Confirmation', () => console.log('Confirmed!'));
// modalSystem.prompt('Enter your name:', 'Input', (value) => console.log('Name:', value));