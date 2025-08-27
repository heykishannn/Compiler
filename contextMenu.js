class ContextMenuManager {
    constructor() {
        this.contextMenu = document.getElementById('contextMenu');
        this.isVisible = false;
        this.longPressTimer = null;
        this.longPressDelay = 500; // 500ms for long press
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Right-click context menu
        document.addEventListener('contextmenu', (e) => {
            // Only show context menu in editor area
            if (this.isInEditor(e.target)) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            } else {
                this.hideContextMenu();
            }
        });

        // Touch events for long press
        document.addEventListener('touchstart', (e) => {
            if (this.isInEditor(e.target)) {
                this.startLongPress(e);
            }
        });

        document.addEventListener('touchend', (e) => {
            this.cancelLongPress();
        });

        document.addEventListener('touchmove', (e) => {
            this.cancelLongPress();
        });

        // Click outside to hide menu
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Context menu item clicks
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-item');
            if (item) {
                const action = item.dataset.action;
                this.executeAction(action);
                this.hideContextMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'x':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('cut');
                        }
                        break;
                    case 'c':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('copy');
                        }
                        break;
                    case 'v':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('paste');
                        }
                        break;
                    case 'a':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('selectAll');
                        }
                        break;
                }
            } else if (e.key === 'Delete' && this.isInEditor(document.activeElement)) {
                // Let CodeMirror handle delete naturally, but we can track it
                // this.executeAction('delete');
            }
        });

        // Hide menu on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }

    isInEditor(element) {
        // Check if element is within CodeMirror editor
        return element && (
            element.closest('.CodeMirror') ||
            element.closest('.editor-container') ||
            element.classList.contains('CodeMirror-line') ||
            element.classList.contains('CodeMirror-code')
        );
    }

    startLongPress(e) {
        this.cancelLongPress();
        
        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        
        this.longPressTimer = setTimeout(() => {
            // Trigger haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            this.showContextMenu(x, y);
        }, this.longPressDelay);
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    showContextMenu(x, y) {
        // Update menu items based on current state
        this.updateMenuItems();
        
        // Position the menu
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        
        // Show the menu
        this.contextMenu.classList.add('visible');
        this.isVisible = true;
        
        // Adjust position if menu goes off-screen
        this.adjustMenuPosition();
    }

    hideContextMenu() {
        this.contextMenu.classList.remove('visible');
        this.isVisible = false;
    }

    adjustMenuPosition() {
        const rect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = parseInt(this.contextMenu.style.left);
        let top = parseInt(this.contextMenu.style.top);
        
        // Adjust horizontal position
        if (rect.right > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Adjust vertical position
        if (rect.bottom > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        if (top < 10) {
            top = 10;
        }
        
        this.contextMenu.style.left = left + 'px';
        this.contextMenu.style.top = top + 'px';
    }

    updateMenuItems() {
        const hasSelection = window.editorManager && window.editorManager.getSelectedText().length > 0;
        const hasEditor = window.editorManager && window.editorManager.currentEditor;
        
        // Enable/disable menu items based on context
        const items = this.contextMenu.querySelectorAll('.context-item');
        
        items.forEach(item => {
            const action = item.dataset.action;
            
            switch (action) {
                case 'cut':
                case 'copy':
                case 'delete':
                    item.classList.toggle('disabled', !hasSelection);
                    break;
                case 'paste':
                    item.classList.toggle('disabled', !hasEditor);
                    break;
                case 'selectAll':
                    item.classList.toggle('disabled', !hasEditor);
                    break;
            }
        });
    }

    async executeAction(action) {
        if (!window.editorManager) {
            console.warn('Editor manager not available');
            return;
        }

        try {
            switch (action) {
                case 'cut':
                    await this.cut();
                    break;
                case 'copy':
                    await this.copy();
                    break;
                case 'paste':
                    await this.paste();
                    break;
                case 'delete':
                    this.delete();
                    break;
                case 'selectAll':
                    this.selectAll();
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        } catch (error) {
            console.error('Error executing action:', action, error);
            this.showActionError(action, error.message);
        }
    }

    async cut() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            try {
                await navigator.clipboard.writeText(selectedText);
                window.editorManager.replaceSelection('');
                this.showActionFeedback('Text cut to clipboard');
            } catch (error) {
                // Fallback for browsers that don't support clipboard API
                this.fallbackCopy(selectedText);
                window.editorManager.replaceSelection('');
                this.showActionFeedback('Text cut (fallback method)');
            }
        }
    }

    async copy() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            try {
                await navigator.clipboard.writeText(selectedText);
                this.showActionFeedback('Text copied to clipboard');
            } catch (error) {
                // Fallback for browsers that don't support clipboard API
                this.fallbackCopy(selectedText);
                this.showActionFeedback('Text copied (fallback method)');
            }
        }
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            window.editorManager.replaceSelection(text);
            this.showActionFeedback('Text pasted from clipboard');
        } catch (error) {
            // Fallback - prompt user to paste manually
            const text = prompt('Paste your text here:');
            if (text !== null) {
                window.editorManager.replaceSelection(text);
                this.showActionFeedback('Text pasted');
            }
        }
    }

    delete() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            window.editorManager.replaceSelection('');
            this.showActionFeedback('Text deleted');
        } else {
            // Delete character at cursor
            window.editorManager.delete();
        }
    }

    selectAll() {
        window.editorManager.selectAll();
        this.showActionFeedback('All text selected');
    }

    fallbackCopy(text) {
        // Create a temporary textarea to copy text
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    showActionFeedback(message) {
        // Show brief feedback message
        const feedback = document.createElement('div');
        feedback.className = 'action-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0e639c;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            animation: fadeInOut 2s ease forwards;
        `;
        
        // Add animation CSS if not already present
        if (!document.querySelector('#feedback-animation-style')) {
            const style = document.createElement('style');
            style.id = 'feedback-animation-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20%, 80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }

    showActionError(action, message) {
        console.error(`Error executing ${action}:`, message);
        
        if (window.consoleManager) {
            window.consoleManager.addMessage('error', `Context menu action failed: ${action} - ${message}`);
        }
    }

    // Public methods for external use
    isMenuVisible() {
        return this.isVisible;
    }

    forceHide() {
        this.hideContextMenu();
        this.cancelLongPress();
    }
}

// Global context menu instance
window.contextMenuManager = new ContextMenuManager();

