/**
 * Inline Edit Module
 * Provides inline editing functionality for queue items
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

class InlineEditManager {
    constructor() {
        this.currentEditElement = null;
        this.originalValue = null;
        this.editingIndex = null;
        this.editingField = null;
    }

    /**
     * Initialize inline editing for a queue item
     * @param {HTMLElement} queueItem - The queue item element
     * @param {number} index - The index in the queue
     */
    initializeQueueItem(queueItem, index) {
        // Find editable fields
        const editableFields = [
            { selector: '.queue-booth', field: 'boothName' },
            { selector: '.queue-person', field: 'personName' },
            { selector: '.queue-comment', field: 'aiComment' }
        ];

        editableFields.forEach(({ selector, field }) => {
            const element = queueItem.querySelector(selector);
            if (!element) return;

            // Add editable class and data attribute
            element.classList.add('inline-editable');
            element.dataset.field = field;
            element.dataset.index = index;

            // Add hover icon indicator
            this.addEditIcon(element);

            // Add double-click listener
            element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startEdit(element, index, field);
            });
        });
    }

    /**
     * Add edit icon that appears on hover
     * @param {HTMLElement} element - The editable element
     */
    addEditIcon(element) {
        // Check if icon already exists
        if (element.querySelector('.inline-edit-icon')) return;

        const icon = document.createElement('span');
        icon.className = 'inline-edit-icon';
        icon.textContent = '✏️';
        icon.title = 'ダブルクリックで編集';
        element.appendChild(icon);
    }

    /**
     * Start inline editing mode
     * @param {HTMLElement} element - The element to edit
     * @param {number} index - The queue item index
     * @param {string} field - The field name
     */
    startEdit(element, index, field) {
        // If already editing, save current edit first
        if (this.currentEditElement) {
            this.saveEdit();
        }

        this.currentEditElement = element;
        this.editingIndex = index;
        this.editingField = field;

        // Get current value (remove "未設定" or default text)
        let currentValue = element.textContent.trim();

        // Remove edit icon from text
        currentValue = currentValue.replace('✏️', '').trim();

        // Remove default text patterns
        if (currentValue === '未設定' || currentValue === '名前未設定' || currentValue === 'コメント未設定') {
            currentValue = '';
        }

        // For person name, remove " さん" suffix
        if (field === 'personName' && currentValue.endsWith(' さん')) {
            currentValue = currentValue.slice(0, -3).trim();
        }

        this.originalValue = currentValue;

        // Create input element
        const input = this.createInputElement(field, currentValue);

        // Replace element content with input
        element.innerHTML = '';
        element.appendChild(input);
        element.classList.add('editing');

        // Focus and select
        input.focus();
        input.select();

        // Add event listeners
        input.addEventListener('blur', () => this.saveEdit());
        input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Prevent click from opening edit modal
        element.addEventListener('click', (e) => e.stopPropagation(), { once: true });
    }

    /**
     * Create appropriate input element based on field type
     * @param {string} field - The field name
     * @param {string} value - The current value
     * @returns {HTMLElement} The input element
     */
    createInputElement(field, value) {
        let input;

        if (field === 'aiComment') {
            // Use textarea for comments
            input = document.createElement('textarea');
            input.className = 'inline-edit-textarea';
            input.rows = 2;
        } else {
            // Use input for other fields
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'inline-edit-input';
        }

        input.value = value;
        return input;
    }

    /**
     * Handle keyboard events during editing
     * @param {KeyboardEvent} e - The keyboard event
     */
    handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Enter saves (unless Shift+Enter for textarea)
            e.preventDefault();
            this.saveEdit();
        } else if (e.key === 'Escape') {
            // Escape cancels
            e.preventDefault();
            this.cancelEdit();
        }
    }

    /**
     * Save the inline edit
     */
    saveEdit() {
        if (!this.currentEditElement) return;

        const input = this.currentEditElement.querySelector('input, textarea');
        if (!input) return;

        const newValue = input.value.trim();

        // Update the queue item
        if (typeof updateQueueItem === 'function' && this.editingIndex !== null) {
            const updates = {};
            updates[this.editingField] = newValue;
            updateQueueItem(this.editingIndex, updates);
        }

        // Restore display
        this.restoreDisplay(newValue);

        // Show toast
        if (typeof showToast === 'function') {
            showToast('変更を保存しました', 'success');
        }

        this.cleanup();
    }

    /**
     * Cancel the inline edit
     */
    cancelEdit() {
        if (!this.currentEditElement) return;

        // Restore original display
        this.restoreDisplay(this.originalValue);

        this.cleanup();
    }

    /**
     * Restore the display of the element
     * @param {string} value - The value to display
     */
    restoreDisplay(value) {
        if (!this.currentEditElement) return;

        const element = this.currentEditElement;
        element.classList.remove('editing');

        // Format display value based on field
        let displayValue = value || '未設定';

        if (this.editingField === 'boothName' && !value) {
            displayValue = '未設定';
        } else if (this.editingField === 'personName') {
            displayValue = value ? `${value} さん` : '名前未設定';
        } else if (this.editingField === 'aiComment' && !value) {
            displayValue = 'コメント未設定';
        }

        // Restore content with edit icon
        element.textContent = displayValue;
        this.addEditIcon(element);
    }

    /**
     * Cleanup after editing
     */
    cleanup() {
        this.currentEditElement = null;
        this.originalValue = null;
        this.editingIndex = null;
        this.editingField = null;
    }

    /**
     * Check if currently editing
     * @returns {boolean}
     */
    isEditing() {
        return this.currentEditElement !== null;
    }
}

// Create global instance
const inlineEditManager = new InlineEditManager();

// Export for use in other modules
export { InlineEditManager, inlineEditManager };

// Browser global
if (typeof window !== 'undefined') {
    window.InlineEditManager = InlineEditManager;
    window.inlineEditManager = inlineEditManager;
}
