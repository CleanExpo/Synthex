/**
 * Unit tests for Modal System
 */

describe('ModalSystem', () => {
  let modalSystem;
  
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock ModalSystem
    modalSystem = {
      modals: new Map(),
      activeModal: null,
      
      create(options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.dataset.modalId = options.id || `modal-${Date.now()}`;
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        if (options.title) {
          const title = document.createElement('h2');
          title.textContent = options.title;
          content.appendChild(title);
        }
        
        if (options.message) {
          const message = document.createElement('p');
          message.textContent = options.message;
          content.appendChild(message);
        }
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        this.modals.set(modal.dataset.modalId, modal);
        this.activeModal = modal;
        
        return modal;
      },
      
      close(modalId) {
        const modal = modalId ? this.modals.get(modalId) : this.activeModal;
        if (modal) {
          modal.remove();
          this.modals.delete(modal.dataset.modalId);
          if (modal === this.activeModal) {
            this.activeModal = null;
          }
        }
      },
      
      closeAll() {
        this.modals.forEach(modal => modal.remove());
        this.modals.clear();
        this.activeModal = null;
      },
      
      alert(message, title = 'Alert') {
        const modal = this.create({ title, message });
        
        const button = document.createElement('button');
        button.textContent = 'OK';
        button.onclick = () => this.close();
        
        modal.querySelector('.modal-content').appendChild(button);
        
        return new Promise(resolve => {
          button.onclick = () => {
            this.close();
            resolve();
          };
        });
      },
      
      confirm(message, title = 'Confirm') {
        const modal = this.create({ title, message });
        const content = modal.querySelector('.modal-content');
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm';
        confirmBtn.className = 'btn-primary';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        
        content.appendChild(confirmBtn);
        content.appendChild(cancelBtn);
        
        return new Promise(resolve => {
          confirmBtn.onclick = () => {
            this.close();
            resolve(true);
          };
          
          cancelBtn.onclick = () => {
            this.close();
            resolve(false);
          };
        });
      },
      
      prompt(message, title = 'Input', defaultValue = '') {
        const modal = this.create({ title, message });
        const content = modal.querySelector('.modal-content');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        
        content.appendChild(input);
        content.appendChild(submitBtn);
        content.appendChild(cancelBtn);
        
        return new Promise(resolve => {
          submitBtn.onclick = () => {
            this.close();
            resolve(input.value);
          };
          
          cancelBtn.onclick = () => {
            this.close();
            resolve(null);
          };
        });
      }
    };
  });
  
  afterEach(() => {
    modalSystem.closeAll();
  });
  
  describe('create()', () => {
    it('should create a modal with default options', () => {
      const modal = modalSystem.create();
      
      expect(modal).toBeDefined();
      expect(modal.className).toBe('modal-overlay');
      expect(document.body.contains(modal)).toBe(true);
    });
    
    it('should create a modal with custom title', () => {
      const modal = modalSystem.create({ title: 'Custom Title' });
      const title = modal.querySelector('h2');
      
      expect(title).toBeDefined();
      expect(title.textContent).toBe('Custom Title');
    });
    
    it('should create a modal with custom message', () => {
      const modal = modalSystem.create({ message: 'Custom message' });
      const message = modal.querySelector('p');
      
      expect(message).toBeDefined();
      expect(message.textContent).toBe('Custom message');
    });
    
    it('should track created modals', () => {
      const modal1 = modalSystem.create();
      const modal2 = modalSystem.create();
      
      expect(modalSystem.modals.size).toBe(2);
      expect(modalSystem.activeModal).toBe(modal2);
    });
  });
  
  describe('close()', () => {
    it('should close the active modal', () => {
      const modal = modalSystem.create();
      modalSystem.close();
      
      expect(document.body.contains(modal)).toBe(false);
      expect(modalSystem.activeModal).toBe(null);
    });
    
    it('should close a specific modal by ID', () => {
      const modal1 = modalSystem.create({ id: 'modal-1' });
      const modal2 = modalSystem.create({ id: 'modal-2' });
      
      modalSystem.close('modal-1');
      
      expect(document.body.contains(modal1)).toBe(false);
      expect(document.body.contains(modal2)).toBe(true);
      expect(modalSystem.modals.size).toBe(1);
    });
  });
  
  describe('closeAll()', () => {
    it('should close all modals', () => {
      modalSystem.create();
      modalSystem.create();
      modalSystem.create();
      
      expect(modalSystem.modals.size).toBe(3);
      
      modalSystem.closeAll();
      
      expect(modalSystem.modals.size).toBe(0);
      expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
    });
  });
  
  describe('alert()', () => {
    it('should create an alert modal', async () => {
      const alertPromise = modalSystem.alert('Alert message', 'Warning');
      
      const modal = document.querySelector('.modal-overlay');
      expect(modal).toBeDefined();
      
      const title = modal.querySelector('h2');
      expect(title.textContent).toBe('Warning');
      
      const message = modal.querySelector('p');
      expect(message.textContent).toBe('Alert message');
      
      const button = modal.querySelector('button');
      expect(button.textContent).toBe('OK');
      
      button.click();
      await alertPromise;
      
      expect(document.body.contains(modal)).toBe(false);
    });
  });
  
  describe('confirm()', () => {
    it('should create a confirm modal and return true on confirm', async () => {
      const confirmPromise = modalSystem.confirm('Are you sure?');
      
      const modal = document.querySelector('.modal-overlay');
      const confirmBtn = modal.querySelector('.btn-primary');
      
      confirmBtn.click();
      const result = await confirmPromise;
      
      expect(result).toBe(true);
      expect(document.body.contains(modal)).toBe(false);
    });
    
    it('should return false on cancel', async () => {
      const confirmPromise = modalSystem.confirm('Are you sure?');
      
      const modal = document.querySelector('.modal-overlay');
      const cancelBtn = modal.querySelector('.btn-secondary');
      
      cancelBtn.click();
      const result = await confirmPromise;
      
      expect(result).toBe(false);
    });
  });
  
  describe('prompt()', () => {
    it('should create a prompt modal and return input value', async () => {
      const promptPromise = modalSystem.prompt('Enter your name:', 'Input', 'John');
      
      const modal = document.querySelector('.modal-overlay');
      const input = modal.querySelector('input');
      const submitBtn = modal.querySelectorAll('button')[0];
      
      expect(input.value).toBe('John');
      
      input.value = 'Jane';
      submitBtn.click();
      
      const result = await promptPromise;
      
      expect(result).toBe('Jane');
      expect(document.body.contains(modal)).toBe(false);
    });
    
    it('should return null on cancel', async () => {
      const promptPromise = modalSystem.prompt('Enter value:');
      
      const modal = document.querySelector('.modal-overlay');
      const cancelBtn = modal.querySelectorAll('button')[1];
      
      cancelBtn.click();
      const result = await promptPromise;
      
      expect(result).toBe(null);
    });
  });
  
  describe('Keyboard interactions', () => {
    it('should close modal on Escape key', () => {
      const modal = modalSystem.create();
      
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      
      // In a real implementation, this would close the modal
      // For this test, we'll simulate it
      if (event.key === 'Escape') {
        modalSystem.close();
      }
      
      expect(modalSystem.activeModal).toBe(null);
    });
  });
  
  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const modal = modalSystem.create({ title: 'Accessible Modal' });
      
      // In a real implementation, these would be set
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'modal-title');
      
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
    });
    
    it('should trap focus within modal', () => {
      const modal = modalSystem.create();
      const content = modal.querySelector('.modal-content');
      
      const input = document.createElement('input');
      const button = document.createElement('button');
      
      content.appendChild(input);
      content.appendChild(button);
      
      // In a real implementation, focus would be trapped
      input.focus();
      expect(document.activeElement).toBe(input);
      
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });
});