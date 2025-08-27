class WebIDEApp {
    constructor() {
        this.isInitialized = false;
        this.fullscreenBtn = document.getElementById('fullscreenToggle');
        
        this.init();
    }

    async init() {
        try {
            // Wait for storage to be ready
            await this.waitForStorage();
            
            // Initialize all managers (they're already created as globals)
            this.setupGlobalEventListeners();
            this.setupFullscreenHandling();
            this.setupResponsiveHandling();
            
            // Enable auto-save
            if (window.editorManager) {
                window.editorManager.enableAutoSave();
            }
            
            // Show welcome message
            this.showWelcomeMessage();
            
            this.isInitialized = true;
            console.log('Web IDE initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Web IDE:', error);
            this.showErrorMessage('Failed to initialize IDE: ' + error.message);
        }
    }

    async waitForStorage() {
        // Wait for storage manager to be ready
        let attempts = 0;
        while (!window.storageManager || !window.storageManager.db) {
            if (attempts > 50) { // 5 seconds timeout
                throw new Error('Storage initialization timeout');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    setupGlobalEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent default browser shortcuts that might interfere
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        if (window.editorManager) {
                            window.editorManager.saveCurrentFile();
                        }
                        break;
                    case 'o':
                        e.preventDefault();
                        // Could implement file open dialog
                        break;
                    case 'n':
                        e.preventDefault();
                        if (window.fileExplorerManager) {
                            window.fileExplorerManager.createNewFile();
                        }
                        break;
                }
            }
        });

        // Handle window beforeunload
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && window.editorManager && window.editorManager.currentEditor) {
                // Refresh editor when tab becomes visible
                setTimeout(() => {
                    window.editorManager.currentEditor.refresh();
                }, 100);
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    setupFullscreenHandling() {
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenButton();
        });
    }

    setupResponsiveHandling() {
        // Handle mobile/desktop layout changes
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        mediaQuery.addListener((e) => {
            this.handleResponsiveChange(e.matches);
        });
        
        // Initial check
        this.handleResponsiveChange(mediaQuery.matches);
    }

    handleResponsiveChange(isMobile) {
        if (isMobile) {
            // Mobile layout adjustments
            const previewPanel = document.querySelector('.preview-panel');
            if (previewPanel) {
                previewPanel.style.display = 'none';
            }
            
            // Auto-hide file explorer on mobile
            const explorer = document.getElementById('fileExplorer');
            if (explorer && !explorer.classList.contains('hidden')) {
                explorer.classList.add('hidden');
            }
        } else {
            // Desktop layout
            const previewPanel = document.querySelector('.preview-panel');
            if (previewPanel) {
                previewPanel.style.display = 'flex';
            }
        }
    }

    handleResize() {
        // Refresh editors on resize
        if (window.editorManager && window.editorManager.currentEditor) {
            setTimeout(() => {
                window.editorManager.currentEditor.refresh();
            }, 100);
        }

        // Update preview scaling
        if (window.previewManager) {
            window.previewManager.updateScaling();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('Error attempting to exit fullscreen:', err);
            });
        }
    }

    updateFullscreenButton() {
        const icon = this.fullscreenBtn.querySelector('i');
        if (document.fullscreenElement) {
            icon.className = 'fas fa-compress';
            this.fullscreenBtn.title = 'Exit Fullscreen';
        } else {
            icon.className = 'fas fa-expand';
            this.fullscreenBtn.title = 'Enter Fullscreen';
        }
    }

    hasUnsavedChanges() {
        if (!window.editorManager) return false;
        
        // Check if any tabs have unsaved changes
        const tabs = document.querySelectorAll('.tab.modified');
        return tabs.length > 0;
    }

    showWelcomeMessage() {
        if (window.consoleManager) {
            window.consoleManager.addMessage('info', '🚀 Welcome to Web IDE! Your project is ready.');
            window.consoleManager.addMessage('info', '💡 Tip: Right-click in the editor for context menu options.');
            window.consoleManager.addMessage('info', '⌨️ Use Ctrl+S to save, Ctrl+Shift+J to toggle console.');
        }
    }

    showErrorMessage(message) {
        // Show error in console and as alert
        if (window.consoleManager) {
            window.consoleManager.addMessage('error', message);
        }
        
        // Also show browser alert for critical errors
        alert(message);
    }

    // Public API methods
    async openProject(projectData) {
        try {
            // Clear current project
            await this.clearProject();
            
            // Load new project files
            for (const file of projectData.files) {
                await window.storageManager.createFile(file.path, file.content, file.type);
            }
            
            // Refresh file tree
            if (window.fileExplorerManager) {
                await window.fileExplorerManager.refreshFileTree();
            }
            
            console.log('Project loaded successfully');
        } catch (error) {
            console.error('Error loading project:', error);
            this.showErrorMessage('Failed to load project: ' + error.message);
        }
    }

    async clearProject() {
        try {
            // Close all open tabs
            if (window.editorManager) {
                const tabs = Array.from(window.editorManager.tabs.keys());
                for (const path of tabs) {
                    await window.editorManager.closeTab(path);
                }
            }
            
            // Clear storage
            const files = await window.storageManager.getAllFiles();
            for (const file of files) {
                await window.storageManager.deleteFile(file.path);
            }
            
            console.log('Project cleared');
        } catch (error) {
            console.error('Error clearing project:', error);
        }
    }

    async exportProject() {
        try {
            const files = await window.storageManager.getAllFiles();
            const projectData = {
                name: 'Web IDE Project',
                created: new Date().toISOString(),
                files: files
            };
            
            const blob = new Blob([JSON.stringify(projectData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'web-ide-project.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Project exported successfully');
        } catch (error) {
            console.error('Error exporting project:', error);
            this.showErrorMessage('Failed to export project: ' + error.message);
        }
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        // Monitor memory usage
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                const used = Math.round(memory.usedJSHeapSize / 1048576);
                const total = Math.round(memory.totalJSHeapSize / 1048576);
                
                if (used > 100) { // Alert if using more than 100MB
                    console.warn(`High memory usage: ${used}MB / ${total}MB`);
                }
            }, 60000); // Check every minute
        }
    }

    // Theme management
    setTheme(theme) {
        document.body.className = theme;
        localStorage.setItem('webide-theme', theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('webide-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    // Settings management
    saveSettings(settings) {
        localStorage.setItem('webide-settings', JSON.stringify(settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('webide-settings');
        return saved ? JSON.parse(saved) : this.getDefaultSettings();
    }

    getDefaultSettings() {
        return {
            theme: 'dark',
            fontSize: 14,
            tabSize: 2,
            autoSave: true,
            autoSaveInterval: 30000,
            showLineNumbers: true,
            wordWrap: true
        };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.webIDEApp = new WebIDEApp();
});

// Export for external use
window.WebIDEApp = WebIDEApp;

