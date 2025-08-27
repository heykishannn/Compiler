// Main Web IDE Application
class WebIDE {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.settings = {
            theme: 'dracula',
            fontSize: 14,
            autoSave: true,
            livePreview: true,
            showLineNumbers: true,
            wordWrap: true
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing Web IDE...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize storage first
            await this.initializeStorage();
            
            // Initialize all components
            await this.initializeComponents();
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Load user settings
            await this.loadSettings();
            
            // Apply initial theme and settings
            this.applySettings();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('✅ Web IDE initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Failed to initialize Web IDE:', error);
            this.showErrorMessage('Failed to initialize IDE: ' + error.message);
        }
    }

    async initializeStorage() {
        if (!window.storage) {
            throw new Error('Storage manager not available');
        }
        
        // Wait for storage to be ready
        let attempts = 0;
        while (!window.storage.db && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.storage.db) {
            throw new Error('Storage initialization timeout');
        }
        
        console.log('💾 Storage initialized');
    }

    async initializeComponents() {
        // Wait for all components to be available
        const components = ['fileManager', 'editor', 'preview', 'consoleManager', 'contextMenu'];
        
        for (const componentName of components) {
            let attempts = 0;
            while (!window[componentName] && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window[componentName]) {
                throw new Error(`Component ${componentName} not available`);
            }
            
            this.components[componentName] = window[componentName];
        }
        
        console.log('🧩 All components initialized');
    }

    setupGlobalEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
        });

        // Window events
        window.addEventListener('beforeunload', (e) => {
            this.handleBeforeUnload(e);
        });

        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        // Prevent default drag and drop on the document
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });

        console.log('⌨️ Global event listeners setup');
    }

    handleGlobalKeyboard(e) {
        // Global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveCurrentFile();
                    break;
                case 'o':
                    e.preventDefault();
                    this.openFileDialog();
                    break;
                case 'n':
                    e.preventDefault();
                    this.createNewFile();
                    break;
                case 'w':
                    e.preventDefault();
                    this.closeCurrentTab();
                    break;
                case 'r':
                    e.preventDefault();
                    this.refreshPreview();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.togglePreviewMode();
                    break;
            }
        }

        // Function keys
        switch (e.key) {
            case 'F5':
                e.preventDefault();
                this.refreshPreview();
                break;
            case 'F11':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'F12':
                e.preventDefault();
                this.toggleConsole();
                break;
        }
    }

    handleBeforeUnload(e) {
        // Check for unsaved changes
        if (this.components.editor && this.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    }

    handleWindowResize() {
        // Refresh components that need to handle resize
        if (this.components.editor) {
            this.components.editor.refresh();
        }
        if (this.components.preview) {
            this.components.preview.updateScaling();
        }
    }

    async handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            try {
                await this.components.fileManager.handleFileImport(files);
                this.showSuccessMessage(`Imported ${files.length} file(s)`);
            } catch (error) {
                this.showErrorMessage('Failed to import files: ' + error.message);
            }
        }
    }

    // File operations
    async saveCurrentFile() {
        if (this.components.editor) {
            await this.components.editor.saveCurrentFile();
        }
    }

    openFileDialog() {
        document.getElementById('fileInput').click();
    }

    createNewFile() {
        if (this.components.fileManager) {
            this.components.fileManager.createNewFile();
        }
    }

    closeCurrentTab() {
        if (this.components.editor && this.components.editor.activeTab) {
            this.components.editor.closeTab(this.components.editor.activeTab);
        }
    }

    refreshPreview() {
        if (this.components.preview) {
            this.components.preview.refreshPreview();
        }
    }

    togglePreviewMode() {
        if (this.components.preview) {
            this.components.preview.toggleViewMode();
        }
    }

    toggleFullscreen() {
        if (this.components.editor) {
            this.components.editor.toggleFullscreen();
        }
    }

    toggleConsole() {
        if (this.components.consoleManager) {
            this.components.consoleManager.toggle();
        }
    }

    hasUnsavedChanges() {
        if (!this.components.editor) return false;
        
        for (const [filePath, tabData] of this.components.editor.openTabs) {
            if (tabData.modified) {
                return true;
            }
        }
        return false;
    }

    // Settings management
    async loadSettings() {
        try {
            const savedSettings = await window.storage.getSetting('ideSettings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    async saveSettings() {
        try {
            await window.storage.setSetting('ideSettings', this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    applySettings() {
        // Apply theme
        if (this.components.editor && this.components.editor.codeMirror) {
            this.components.editor.codeMirror.setOption('theme', this.settings.theme);
            this.components.editor.codeMirror.setOption('lineNumbers', this.settings.showLineNumbers);
            this.components.editor.codeMirror.setOption('lineWrapping', this.settings.wordWrap);
        }

        // Apply font size
        document.documentElement.style.setProperty('--editor-font-size', this.settings.fontSize + 'px');
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.applySettings();
        this.saveSettings();
    }

    // UI feedback methods
    showWelcomeMessage() {
        if (this.components.consoleManager) {
            this.components.consoleManager.info('🎉 Welcome to Web IDE! Start coding by creating a new file or opening an existing one.');
            this.components.consoleManager.info('💡 Tip: Use Ctrl+S to save, Ctrl+R to refresh preview, and F12 to toggle console.');
        }
    }

    showSuccessMessage(message) {
        if (this.components.consoleManager) {
            this.components.consoleManager.info('✅ ' + message);
        }
        console.log('✅', message);
    }

    showErrorMessage(message) {
        if (this.components.consoleManager) {
            this.components.consoleManager.error('❌ ' + message);
        }
        console.error('❌', message);
    }

    showWarningMessage(message) {
        if (this.components.consoleManager) {
            this.components.consoleManager.warn('⚠️ ' + message);
        }
        console.warn('⚠️', message);
    }

    // Utility methods
    getStats() {
        const stats = {
            filesOpen: this.components.editor ? this.components.editor.openTabs.size : 0,
            totalFiles: 0,
            totalFolders: 0,
            consoleOpen: this.components.consoleManager ? this.components.consoleManager.isConsoleOpen() : false,
            previewMode: this.components.preview ? this.components.preview.getCurrentMode() : 'desktop'
        };

        return stats;
    }

    async exportProject() {
        try {
            await window.storage.exportProject();
            this.showSuccessMessage('Project exported successfully');
        } catch (error) {
            this.showErrorMessage('Failed to export project: ' + error.message);
        }
    }

    async importProject(file) {
        try {
            const success = await window.storage.importProject(file);
            if (success) {
                // Reload file tree
                await this.components.fileManager.loadFileTree();
                this.showSuccessMessage('Project imported successfully');
            } else {
                this.showErrorMessage('Failed to import project');
            }
        } catch (error) {
            this.showErrorMessage('Failed to import project: ' + error.message);
        }
    }

    // Development helpers
    debug() {
        console.log('🔍 Web IDE Debug Info:');
        console.log('- Initialized:', this.isInitialized);
        console.log('- Settings:', this.settings);
        console.log('- Components:', Object.keys(this.components));
        console.log('- Stats:', this.getStats());
        
        if (this.components.consoleManager) {
            console.log('- Console Stats:', this.components.consoleManager.getStats());
        }
    }

    // Public API
    getAPI() {
        return {
            // File operations
            saveFile: () => this.saveCurrentFile(),
            createFile: () => this.createNewFile(),
            openFile: () => this.openFileDialog(),
            closeFile: () => this.closeCurrentTab(),
            
            // Preview operations
            refreshPreview: () => this.refreshPreview(),
            togglePreviewMode: () => this.togglePreviewMode(),
            
            // UI operations
            toggleConsole: () => this.toggleConsole(),
            toggleFullscreen: () => this.toggleFullscreen(),
            
            // Project operations
            exportProject: () => this.exportProject(),
            importProject: (file) => this.importProject(file),
            
            // Settings
            getSetting: (key) => this.settings[key],
            setSetting: (key, value) => this.updateSetting(key, value),
            
            // Stats and debug
            getStats: () => this.getStats(),
            debug: () => this.debug()
        };
    }
}

// Initialize the IDE when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.webIDE = new WebIDE();
    
    // Expose API globally for console access
    window.IDE = window.webIDE.getAPI();
    
    console.log('🌟 Web IDE API available as window.IDE');
    console.log('💡 Try: IDE.debug() to see debug info');
});

// Handle any uncaught errors
window.addEventListener('error', (e) => {
    console.error('💥 Uncaught error:', e.error);
    if (window.webIDE && window.webIDE.components.consoleManager) {
        window.webIDE.components.consoleManager.error(`Uncaught error: ${e.error.message}`);
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('💥 Unhandled promise rejection:', e.reason);
    if (window.webIDE && window.webIDE.components.consoleManager) {
        window.webIDE.components.consoleManager.error(`Unhandled promise rejection: ${e.reason}`);
    }
});

