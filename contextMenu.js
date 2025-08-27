class ContextMenu {
    constructor() {
        this.menu = document.getElementById('contextMenu');
        this.currentContext = null;
        this.currentTarget = null;
        this.isVisible = false;
        this.longPressTimer = null;
        this.longPressDelay = 500; // 500ms for long press
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMenuItems();
    }

    setupEventListeners() {
        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Hide menu on scroll
        document.addEventListener('scroll', () => {
            this.hide();
        });

        // Hide menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        // Prevent default context menu on the entire document
        document.addEventListener('contextmenu', (e) => {
            // Only prevent default if we're handling it
            if (this.shouldHandleContextMenu(e.target)) {
                e.preventDefault();
            }
        });

        // Setup long press for mobile
        this.setupLongPress();
    }

    setupLongPress() {
        // Add long press support for mobile devices
        document.addEventListener('touchstart', (e) => {
            if (this.shouldHandleContextMenu(e.target)) {
                this.longPressTimer = setTimeout(() => {
                    this.show(e, this.getContextType(e.target));
                    // Prevent default touch behavior
                    e.preventDefault();
                }, this.longPressDelay);
            }
        });

        document.addEventListener('touchend', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });

        document.addEventListener('touchmove', () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
    }

    setupMenuItems() {
        const menuItems = this.menu.querySelectorAll('.context-item');
        
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.executeAction(action);
                this.hide();
            });
        });
    }

    shouldHandleContextMenu(target) {
        // Check if the target is within an area we handle context menus for
        return target.closest('.CodeMirror') || 
               target.closest('.file-item') || 
               target.closest('.folder-item') ||
               target.closest('.editor-container');
    }

    getContextType(target) {
        if (target.closest('.CodeMirror') || target.closest('.editor-container')) {
            return 'editor';
        } else if (target.closest('.file-item')) {
            return 'file';
        } else if (target.closest('.folder-item')) {
            return 'folder';
        }
        return 'general';
    }

    show(event, context = 'general') {
        this.currentContext = context;
        this.currentTarget = event.target;
        
        // Update menu items based on context
        this.updateMenuItems(context);
        
        // Position the menu
        this.positionMenu(event);
        
        // Show the menu
        this.menu.style.display = 'block';
        this.isVisible = true;
        
        // Add animation
        this.menu.style.opacity = '0';
        this.menu.style.transform = 'scale(0.95)';
        
        requestAnimationFrame(() => {
            this.menu.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
            this.menu.style.opacity = '1';
            this.menu.style.transform = 'scale(1)';
        });
    }

    hide() {
        if (!this.isVisible) return;
        
        this.menu.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        this.menu.style.opacity = '0';
        this.menu.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            this.menu.style.display = 'none';
            this.isVisible = false;
            this.currentContext = null;
            this.currentTarget = null;
        }, 150);
    }

    positionMenu(event) {
        const menuRect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = event.clientX || (event.touches && event.touches[0].clientX) || 0;
        let y = event.clientY || (event.touches && event.touches[0].clientY) || 0;
        
        // Adjust position to keep menu within viewport
        if (x + menuRect.width > viewportWidth) {
            x = viewportWidth - menuRect.width - 10;
        }
        
        if (y + menuRect.height > viewportHeight) {
            y = viewportHeight - menuRect.height - 10;
        }
        
        // Ensure minimum distance from edges
        x = Math.max(10, x);
        y = Math.max(10, y);
        
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
    }

    updateMenuItems(context) {
        const items = this.menu.querySelectorAll('.context-item');
        
        items.forEach(item => {
            const action = item.dataset.action;
            let visible = true;
            let enabled = true;
            
            switch (context) {
                case 'editor':
                    visible = ['cut', 'copy', 'paste', 'selectAll', 'delete'].includes(action);
                    if (action === 'cut' || action === 'copy' || action === 'delete') {
                        enabled = window.editor && window.editor.codeMirror && 
                                window.editor.codeMirror.somethingSelected();
                    }
                    break;
                    
                case 'file':
                    visible = ['copy', 'delete'].includes(action);
                    break;
                    
                case 'folder':
                    visible = ['delete'].includes(action);
                    break;
                    
                default:
                    visible = ['paste', 'selectAll'].includes(action);
                    break;
            }
            
            item.style.display = visible ? 'flex' : 'none';
            item.classList.toggle('disabled', !enabled);
        });
    }

    async executeAction(action) {
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
                case 'selectAll':
                    this.selectAll();
                    break;
                case 'delete':
                    await this.delete();
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        } catch (error) {
            console.error('Failed to execute action:', action, error);
        }
    }

    async cut() {
        if (this.currentContext === 'editor' && window.editor) {
            window.editor.cut();
        }
    }

    async copy() {
        if (this.currentContext === 'editor' && window.editor) {
            window.editor.copy();
        } else if (this.currentContext === 'file') {
            // Copy file path or content
            const fileItem = this.currentTarget.closest('.file-item');
            if (fileItem) {
                const fileName = fileItem.querySelector('.item-name').textContent;
                await navigator.clipboard.writeText(fileName);
            }
        }
    }

    async paste() {
        if (this.currentContext === 'editor' && window.editor) {
            await window.editor.paste();
        }
    }

    selectAll() {
        if (this.currentContext === 'editor' && window.editor) {
            window.editor.selectAll();
        }
    }

    async delete() {
        if (this.currentContext === 'editor' && window.editor) {
            window.editor.delete();
        } else if (this.currentContext === 'file' || this.currentContext === 'folder') {
            // Delete file or folder
            const item = this.currentTarget.closest('.file-item, .folder-item');
            if (item && window.fileManager) {
                const isFile = item.classList.contains('file-item');
                const name = item.querySelector('.item-name').textContent;
                const path = isFile ? 
                    window.fileManager.selectedFile?.path : 
                    '/' + name; // Simplified path logic
                
                if (path) {
                    const itemData = {
                        type: isFile ? 'file' : 'folder',
                        name: name,
                        path: path
                    };
                    await window.fileManager.deleteItem(itemData);
                }
            }
        }
    }

    // Public method to show context menu programmatically
    showAt(x, y, context = 'general') {
        const fakeEvent = {
            clientX: x,
            clientY: y,
            preventDefault: () => {}
        };
        this.show(fakeEvent, context);
    }

    // Check if menu is currently visible
    isOpen() {
        return this.isVisible;
    }

    // Get current context
    getContext() {
        return this.currentContext;
    }
}

// Add context menu styles for disabled items
const contextMenuStyles = `
.context-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.context-menu {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

/* Mobile touch improvements */
@media (max-width: 768px) {
    .context-menu {
        min-width: 180px;
    }
    
    .context-item {
        padding: 12px 16px;
        font-size: 16px;
    }
    
    .context-item i {
        margin-right: 12px;
        width: 20px;
    }
}

/* Animation improvements */
.context-menu {
    transform-origin: top left;
    will-change: opacity, transform;
}
`;

// Inject context menu styles
const contextStyleSheet = document.createElement('style');
contextStyleSheet.textContent = contextMenuStyles;
document.head.appendChild(contextStyleSheet);

// Initialize context menu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.contextMenu = new ContextMenu();
});

