/**
 * Main Application Module
 * Coordinates all modules and handles global application state
 */

class WebCompilerApp {
    constructor() {
        this.version = '1.0.0';
        this.isInitialized = false;
        this.modules = {};
        this.settings = {
            theme: 'dark',
            autoSave: true,
            autoRefresh: true,
            fontSize: 14,
            tabSize: 4,
            wordWrap: false,
            showLineNumbers: true,
            enableSyntaxHighlighting: true
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log(`Initializing Web Compiler v${this.version}...`);
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize modules in order
            await this.initializeModules();
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Load user settings
            await this.loadSettings();
            
            // Setup periodic auto-save
            this.setupAutoSave();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Setup responsive handlers
            this.setupResponsiveHandlers();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('Web Compiler initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize Web Compiler:', error);
            this.showError('Failed to initialize application');
        }
    }
    
    async initializeModules() {
        // Wait for all modules to be available
        const moduleChecks = [
            () => window.storageManager,
            () => window.codeEditor,
            () => window.fileManager,
            () => window.previewManager,
            () => window.consoleManager
        ];
        
        // Wait for modules with timeout
        for (const check of moduleChecks) {
            let attempts = 0;
            while (!check() && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!check()) {
                throw new Error('Module initialization timeout');
            }
        }
        
        // Store module references
        this.modules = {
            storage: window.storageManager,
            editor: window.codeEditor,
            fileManager: window.fileManager,
            preview: window.previewManager,
            console: window.consoleManager
        };
        
        // Wait for storage to be ready
        while (!this.modules.storage.isReady) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('All modules initialized successfully');
    }
    
    setupGlobalEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Handle window beforeunload
        window.addEventListener('beforeunload', (e) => {
            this.handleBeforeUnload(e);
        });
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });
        
        // Global error handler
        window.addEventListener('error', (e) => {
            this.handleGlobalError(e);
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (e) => {
            this.handleUnhandledRejection(e);
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S - Save current file
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveCurrentFile();
            }
            
            // Ctrl+N - New file
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.modules.fileManager.createNewFile();
            }
            
            // Ctrl+O - Open file
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.modules.fileManager.importFiles();
            }
            
            // Ctrl+Shift+N - New folder
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.modules.fileManager.createNewFolder();
            }
            
            // F5 - Refresh preview
            if (e.key === 'F5') {
                e.preventDefault();
                this.modules.preview.refresh();
            }
            
            // F11 - Toggle fullscreen
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
            
            // Ctrl+` - Toggle console
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                this.modules.console.toggleConsole();
            }
            
            // Ctrl+B - Toggle file manager
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.modules.fileManager.toggleFileManager();
            }
            
            // Ctrl+1 - Switch to PC mode
            if (e.ctrlKey && e.key === '1') {
                e.preventDefault();
                this.modules.preview.switchMode('pc');
            }
            
            // Ctrl+2 - Switch to mobile mode
            if (e.ctrlKey && e.key === '2') {
                e.preventDefault();
                this.modules.preview.switchMode('mobile');
            }
        });
    }
    
    setupResponsiveHandlers() {
        // Handle mobile/desktop layout changes
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        const handleMediaChange = (e) => {
            if (e.matches) {
                // Mobile layout
                this.handleMobileLayout();
            } else {
                // Desktop layout
                this.handleDesktopLayout();
            }
        };
        
        mediaQuery.addListener(handleMediaChange);
        handleMediaChange(mediaQuery);
    }
    
    setupAutoSave() {
        if (this.settings.autoSave) {
            setInterval(() => {
                this.autoSave();
            }, 30000); // Auto-save every 30 seconds
        }
    }
    
    async loadSettings() {
        try {
            // Load settings from storage or use defaults
            const savedSettings = localStorage.getItem('webcompiler-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }
            
            // Apply settings
            this.applySettings();
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }
    
    async saveSettings() {
        try {
            localStorage.setItem('webcompiler-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
    
    applySettings() {
        // Apply theme
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        
        // Apply editor settings
        if (this.modules.editor) {
            const editor = this.modules.editor.editor;
            if (editor) {
                editor.style.fontSize = `${this.settings.fontSize}px`;
                editor.style.tabSize = this.settings.tabSize;
                editor.style.whiteSpace = this.settings.wordWrap ? 'pre-wrap' : 'pre';
            }
        }
        
        // Apply preview settings
        if (this.modules.preview) {
            this.modules.preview.setAutoRefresh(this.settings.autoRefresh);
        }
    }
    
    handleResize() {
        // Update layout on resize
        if (this.modules.editor) {
            this.modules.editor.updateLineNumbers();
        }
    }
    
    handleBeforeUnload(e) {
        // Check for unsaved changes
        if (this.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, save current state
            this.autoSave();
        } else {
            // Page is visible, refresh preview if needed
            if (this.modules.preview) {
                this.modules.preview.refresh();
            }
        }
    }
    
    handleOnlineStatus(isOnline) {
        const message = isOnline ? 'Connection restored' : 'Connection lost';
        const level = isOnline ? 'success' : 'warn';
        
        if (this.modules.console) {
            this.modules.console.addMessage(message, level);
        }
    }
    
    handleGlobalError(e) {
        const message = `Global Error: ${e.message} at ${e.filename}:${e.lineno}`;
        console.error(message);
        
        if (this.modules.console) {
            this.modules.console.addMessage(message, 'error');
        }
    }
    
    handleUnhandledRejection(e) {
        const message = `Unhandled Promise Rejection: ${e.reason}`;
        console.error(message);
        
        if (this.modules.console) {
            this.modules.console.addMessage(message, 'error');
        }
    }
    
    handleMobileLayout() {
        // Adjust layout for mobile
        document.body.classList.add('mobile-layout');
        
        // Auto-hide file manager on mobile
        if (this.modules.fileManager) {
            this.modules.fileManager.hideFileManager();
        }
    }
    
    handleDesktopLayout() {
        // Adjust layout for desktop
        document.body.classList.remove('mobile-layout');
    }
    
    async saveCurrentFile() {
        if (this.modules.editor) {
            try {
                this.modules.editor.saveFile();
                
                if (this.modules.console) {
                    this.modules.console.addMessage('File saved successfully', 'success');
                }
            } catch (error) {
                console.error('Failed to save file:', error);
                
                if (this.modules.console) {
                    this.modules.console.addMessage('Failed to save file', 'error');
                }
            }
        }
    }
    
    async autoSave() {
        if (this.settings.autoSave && this.hasUnsavedChanges()) {
            await this.saveCurrentFile();
        }
    }
    
    hasUnsavedChanges() {
        // Check if there are unsaved changes
        // This is a simplified check - in a real app, you'd track dirty state
        return false;
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Failed to enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.warn('Failed to exit fullscreen:', err);
            });
        }
    }
    
    showWelcomeMessage() {
        if (this.modules.console) {
            this.modules.console.addMessage(
                `Welcome to Web Compiler v${this.version}! Start coding to see your live preview.`,
                'info'
            );
            
            this.modules.console.addMessage(
                'Keyboard shortcuts: Ctrl+S (Save), Ctrl+N (New File), F5 (Refresh), Ctrl+` (Console)',
                'info'
            );
        }
    }
    
    showError(message) {
        console.error(message);
        
        if (this.modules.console) {
            this.modules.console.addMessage(message, 'error');
        }
        
        // Also show as notification
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `app-notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px',
            zIndex: '1000',
            maxWidth: '300px',
            wordWrap: 'break-word',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = '#28a745';
                break;
            case 'error':
                notification.style.background = '#dc3545';
                break;
            case 'warning':
                notification.style.background = '#ffc107';
                notification.style.color = '#000';
                break;
            default:
                notification.style.background = '#007bff';
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
    
    // Public API methods
    getVersion() {
        return this.version;
    }
    
    getSettings() {
        return { ...this.settings };
    }
    
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applySettings();
        this.saveSettings();
    }
    
    getModules() {
        return this.modules;
    }
    
    isReady() {
        return this.isInitialized;
    }
    
    // Export/Import functionality
    async exportProject() {
        try {
            const files = await this.modules.storage.getAllFiles();
            const projectData = {
                version: this.version,
                timestamp: new Date().toISOString(),
                files: files,
                settings: this.settings
            };
            
            const blob = new Blob([JSON.stringify(projectData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `web-compiler-project-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Project exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export project:', error);
            this.showError('Failed to export project');
        }
    }
    
    async importProject(file) {
        try {
            const text = await file.text();
            const projectData = JSON.parse(text);
            
            // Validate project data
            if (!projectData.files || !Array.isArray(projectData.files)) {
                throw new Error('Invalid project file format');
            }
            
            // Clear existing data
            await this.modules.storage.clearAllData();
            
            // Import files
            for (const fileData of projectData.files) {
                await this.modules.storage.saveFile(
                    fileData.path,
                    fileData.content,
                    fileData
                );
            }
            
            // Import settings
            if (projectData.settings) {
                this.updateSettings(projectData.settings);
            }
            
            // Refresh UI
            await this.modules.fileManager.loadFileTree();
            this.modules.preview.refresh();
            
            this.showNotification('Project imported successfully', 'success');
        } catch (error) {
            console.error('Failed to import project:', error);
            this.showError('Failed to import project');
        }
    }
}

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    window.webCompilerApp = new WebCompilerApp();
});

// Make app globally available
window.WebCompilerApp = WebCompilerApp;

