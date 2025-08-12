/**
 * SYNTHEX Form Validation System
 * Client-side form validation with real-time feedback
 */

class FormValidator {
    constructor() {
        this.forms = new Map();
        this.validators = {
            required: (value) => {
                return value && value.toString().trim().length > 0
                    ? null
                    : 'This field is required';
            },
            email: (value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value)
                    ? null
                    : 'Please enter a valid email address';
            },
            minLength: (min) => (value) => {
                return value && value.length >= min
                    ? null
                    : `Must be at least ${min} characters`;
            },
            maxLength: (max) => (value) => {
                return value && value.length <= max
                    ? null
                    : `Must be no more than ${max} characters`;
            },
            pattern: (regex, message) => (value) => {
                return regex.test(value)
                    ? null
                    : message || 'Invalid format';
            },
            match: (fieldName) => (value, formData) => {
                return value === formData[fieldName]
                    ? null
                    : `Must match ${fieldName}`;
            },
            password: (value) => {
                const errors = [];
                if (value.length < 8) {
                    errors.push('At least 8 characters');
                }
                if (!/[A-Z]/.test(value)) {
                    errors.push('One uppercase letter');
                }
                if (!/[a-z]/.test(value)) {
                    errors.push('One lowercase letter');
                }
                if (!/[0-9]/.test(value)) {
                    errors.push('One number');
                }
                if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
                    errors.push('One special character');
                }
                return errors.length > 0 ? `Password must contain: ${errors.join(', ')}` : null;
            },
            phone: (value) => {
                const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
                return phoneRegex.test(value.replace(/\s/g, ''))
                    ? null
                    : 'Please enter a valid phone number';
            },
            url: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            },
            number: (value) => {
                return !isNaN(value) && isFinite(value)
                    ? null
                    : 'Must be a valid number';
            },
            min: (minValue) => (value) => {
                return parseFloat(value) >= minValue
                    ? null
                    : `Must be at least ${minValue}`;
            },
            max: (maxValue) => (value) => {
                return parseFloat(value) <= maxValue
                    ? null
                    : `Must be no more than ${maxValue}`;
            },
            date: (value) => {
                const date = new Date(value);
                return !isNaN(date.getTime())
                    ? null
                    : 'Please enter a valid date';
            },
            futureDate: (value) => {
                const date = new Date(value);
                return date > new Date()
                    ? null
                    : 'Date must be in the future';
            },
            pastDate: (value) => {
                const date = new Date(value);
                return date < new Date()
                    ? null
                    : 'Date must be in the past';
            },
            custom: (validatorFn) => validatorFn
        };
    }

    /**
     * Initialize form validation
     */
    init(formId, config = {}) {
        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Form with id "${formId}" not found`);
            return;
        }

        const {
            fields = {},
            onSubmit = null,
            validateOnBlur = true,
            validateOnInput = false,
            showErrorMessages = true,
            errorClass = 'error',
            successClass = 'success',
            errorMessageClass = 'error-message'
        } = config;

        this.forms.set(formId, {
            form,
            fields,
            config,
            errors: {},
            touched: {}
        });

        // Add event listeners
        Object.keys(fields).forEach(fieldName => {
            const field = form.elements[fieldName];
            if (!field) return;

            // Create error message element
            if (showErrorMessages) {
                this.createErrorElement(field, errorMessageClass);
            }

            // Blur validation
            if (validateOnBlur) {
                field.addEventListener('blur', () => {
                    this.validateField(formId, fieldName);
                    this.forms.get(formId).touched[fieldName] = true;
                });
            }

            // Input validation
            if (validateOnInput) {
                field.addEventListener('input', () => {
                    if (this.forms.get(formId).touched[fieldName]) {
                        this.validateField(formId, fieldName);
                    }
                });
            }
        });

        // Form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const isValid = await this.validateForm(formId);
            
            if (isValid && onSubmit) {
                const formData = this.getFormData(formId);
                await onSubmit(formData, form);
            }
        });

        return this;
    }

    /**
     * Create error message element
     */
    createErrorElement(field, errorMessageClass) {
        const errorElement = document.createElement('div');
        errorElement.className = errorMessageClass;
        errorElement.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
            display: none;
            animation: fadeIn 0.3s;
        `;
        field.parentElement.appendChild(errorElement);
    }

    /**
     * Validate single field
     */
    async validateField(formId, fieldName) {
        const formData = this.forms.get(formId);
        if (!formData) return false;

        const { form, fields, config } = formData;
        const field = form.elements[fieldName];
        if (!field) return false;

        const value = field.value;
        const validators = fields[fieldName];
        const allFormData = this.getFormData(formId);

        let error = null;

        // Run validators
        for (const validator of validators) {
            if (typeof validator === 'function') {
                error = await validator(value, allFormData);
            } else if (typeof validator === 'string' && this.validators[validator]) {
                error = await this.validators[validator](value, allFormData);
            } else if (validator.type && this.validators[validator.type]) {
                const validatorFn = typeof this.validators[validator.type] === 'function'
                    ? this.validators[validator.type]
                    : this.validators[validator.type](validator.value);
                error = await validatorFn(value, allFormData);
            }

            if (error) break;
        }

        // Update error state
        formData.errors[fieldName] = error;

        // Update UI
        this.updateFieldUI(field, error, config);

        return !error;
    }

    /**
     * Validate entire form
     */
    async validateForm(formId) {
        const formData = this.forms.get(formId);
        if (!formData) return false;

        const { fields } = formData;
        const validationPromises = [];

        // Mark all fields as touched
        Object.keys(fields).forEach(fieldName => {
            formData.touched[fieldName] = true;
            validationPromises.push(this.validateField(formId, fieldName));
        });

        const results = await Promise.all(validationPromises);
        return results.every(result => result === true);
    }

    /**
     * Update field UI based on validation
     */
    updateFieldUI(field, error, config) {
        const {
            showErrorMessages,
            errorClass,
            successClass,
            errorMessageClass
        } = config;

        const errorElement = field.parentElement.querySelector(`.${errorMessageClass}`);

        if (error) {
            field.classList.add(errorClass);
            field.classList.remove(successClass);
            
            if (errorElement) {
                errorElement.textContent = error;
                errorElement.style.display = 'block';
            }

            // Add shake animation
            field.style.animation = 'shake 0.5s';
            setTimeout(() => {
                field.style.animation = '';
            }, 500);
        } else {
            field.classList.remove(errorClass);
            field.classList.add(successClass);
            
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }
    }

    /**
     * Get form data
     */
    getFormData(formId) {
        const formData = this.forms.get(formId);
        if (!formData) return {};

        const { form } = formData;
        const data = {};

        Array.from(form.elements).forEach(element => {
            if (element.name) {
                if (element.type === 'checkbox') {
                    data[element.name] = element.checked;
                } else if (element.type === 'radio') {
                    if (element.checked) {
                        data[element.name] = element.value;
                    }
                } else {
                    data[element.name] = element.value;
                }
            }
        });

        return data;
    }

    /**
     * Set form errors
     */
    setErrors(formId, errors) {
        const formData = this.forms.get(formId);
        if (!formData) return;

        Object.keys(errors).forEach(fieldName => {
            formData.errors[fieldName] = errors[fieldName];
            formData.touched[fieldName] = true;
            
            const field = formData.form.elements[fieldName];
            if (field) {
                this.updateFieldUI(field, errors[fieldName], formData.config);
            }
        });
    }

    /**
     * Clear form errors
     */
    clearErrors(formId) {
        const formData = this.forms.get(formId);
        if (!formData) return;

        formData.errors = {};
        formData.touched = {};

        const { form, config } = formData;
        Array.from(form.elements).forEach(element => {
            if (element.name) {
                element.classList.remove(config.errorClass);
                element.classList.remove(config.successClass);
                
                const errorElement = element.parentElement.querySelector(`.${config.errorMessageClass}`);
                if (errorElement) {
                    errorElement.style.display = 'none';
                }
            }
        });
    }

    /**
     * Reset form
     */
    reset(formId) {
        const formData = this.forms.get(formId);
        if (!formData) return;

        formData.form.reset();
        this.clearErrors(formId);
    }

    /**
     * Check if form is valid
     */
    isValid(formId) {
        const formData = this.forms.get(formId);
        if (!formData) return false;

        return Object.values(formData.errors).every(error => !error);
    }

    /**
     * Get form errors
     */
    getErrors(formId) {
        const formData = this.forms.get(formId);
        return formData ? formData.errors : {};
    }
}

// Create global instance
window.formValidator = new FormValidator();

// Add shake animation
if (!document.getElementById('form-validator-styles')) {
    const styles = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .error {
            border-color: #ef4444 !important;
            background-color: rgba(239, 68, 68, 0.05) !important;
        }
        
        .success {
            border-color: #22c55e !important;
            background-color: rgba(34, 197, 94, 0.05) !important;
        }
        
        .error-message {
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
            animation: fadeIn 0.3s;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'form-validator-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}