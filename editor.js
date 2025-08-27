class Editor {
    constructor() {
        this.editorContainer = document.getElementById('editor');
        this.tabsContainer = document.getElementById('editorTabs');
        this.codeMirror = null;
        this.openTabs = new Map();
        this.activeTab = null;
        this.autoSaveTimeout = null;
        
        this.init();
    }

    init() {
        this.setupCodeMirror();
        this.setupEventListeners();
    }

    setupCodeMirror() {
        this.codeMirror = CodeMirror(this.editorContainer, {
            theme: 'dracula',
            lineNumbers: true,
            mode: 'htmlmixed',
            indentUnit: 2,
            tabSize: 2,
            lineWrapping: true,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchBrackets: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: {
                'Ctrl-S': () => this.saveCurrentFile(),
                'Cmd-S': () => this.saveCurrentFile(),
                'Ctrl-/': 'toggleComment',
                'Cmd-/': 'toggleComment',
                'F11': () => this.toggleFullscreen(),
                'Esc': () => this.exitFullscreen()
            }
        });

        // Auto-save on content change
        this.codeMirror.on('change', () => {
            if (this.activeTab) {
                this.markTabAsModified(this.activeTab);
                this.scheduleAutoSave();
            }
            
            // Live preview update
            if (window.preview) {
                window.preview.updatePreview();
            }
        });

        // Handle context menu
        this.codeMirror.on('contextmenu', (cm, event) => {
            event.preventDefault();
            if (window.contextMenu) {
                window.contextMenu.show(event, 'editor');
            }
        });
    }

    setupEventListeners() {
        // Handle tab clicks
        this.tabsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                const filePath = e.target.dataset.path;
                this.switchToTab(filePath);
            } else if (e.target.classList.contains('tab-close')) {
                e.stopPropagation();
                const tab = e.target.closest('.tab');
                const filePath = tab.dataset.path;
                this.closeTab(filePath);
            }
        });
    }

    async openFile(file) {
        if (this.openTabs.has(file.path)) {
            // File already open, just switch to it
            this.switchToTab(file.path);
            return;
        }

        // Create new tab
        const tab = this.createTab(file);
        this.openTabs.set(file.path, {
            file: file,
            element: tab,
            modified: false,
            originalContent: file.content
        });

        // Switch to the new tab
        this.switchToTab(file.path);
    }

    createTab(file) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.path = file.path;
        
        tab.innerHTML = `
            <span class="tab-name">${file.name}</span>
            <span class="tab-close">×</span>
        `;
        
        this.tabsContainer.appendChild(tab);
        return tab;
    }

    switchToTab(filePath) {
        const tabData = this.openTabs.get(filePath);
        if (!tabData) return;

        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        tabData.element.classList.add('active');
        
        this.activeTab = filePath;
        
        // Update editor content and mode
        this.codeMirror.setValue(tabData.file.content);
        this.setEditorMode(tabData.file.type);
        
        // Focus editor
        this.codeMirror.focus();
        
        // Update preview
        if (window.preview) {
            window.preview.updatePreview();
        }
    }

    closeTab(filePath) {
        const tabData = this.openTabs.get(filePath);
        if (!tabData) return;

        // Check if file is modified
        if (tabData.modified) {
            if (!confirm(`${tabData.file.name} has unsaved changes. Close anyway?`)) {
                return;
            }
        }

        // Remove tab element
        tabData.element.remove();
        this.openTabs.delete(filePath);

        // If this was the active tab, switch to another tab or clear editor
        if (this.activeTab === filePath) {
            const remainingTabs = Array.from(this.openTabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                this.activeTab = null;
                this.codeMirror.setValue('');
                if (window.preview) {
                    window.preview.clearPreview();
                }
            }
        }
    }

    markTabAsModified(filePath) {
        const tabData = this.openTabs.get(filePath);
        if (!tabData || tabData.modified) return;

        tabData.modified = true;
        const tabName = tabData.element.querySelector('.tab-name');
        tabName.textContent = tabData.file.name + ' •';
        tabData.element.classList.add('modified');
    }

    markTabAsSaved(filePath) {
        const tabData = this.openTabs.get(filePath);
        if (!tabData) return;

        tabData.modified = false;
        const tabName = tabData.element.querySelector('.tab-name');
        tabName.textContent = tabData.file.name;
        tabData.element.classList.remove('modified');
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveCurrentFile();
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    async saveCurrentFile() {
        if (!this.activeTab) return;

        const tabData = this.openTabs.get(this.activeTab);
        if (!tabData) return;

        try {
            const content = this.codeMirror.getValue();
            await window.storage.updateFile(this.activeTab, content);
            
            // Update tab data
            tabData.file.content = content;
            tabData.originalContent = content;
            this.markTabAsSaved(this.activeTab);
            
            console.log('File saved:', tabData.file.name);
        } catch (error) {
            console.error('Failed to save file:', error);
            alert('Failed to save file: ' + error.message);
        }
    }

    async saveAllFiles() {
        const savePromises = [];
        
        for (const [filePath, tabData] of this.openTabs) {
            if (tabData.modified) {
                const content = filePath === this.activeTab ? 
                    this.codeMirror.getValue() : 
                    tabData.file.content;
                
                savePromises.push(
                    window.storage.updateFile(filePath, content)
                        .then(() => {
                            tabData.file.content = content;
                            tabData.originalContent = content;
                            this.markTabAsSaved(filePath);
                        })
                );
            }
        }
        
        try {
            await Promise.all(savePromises);
            console.log('All files saved');
        } catch (error) {
            console.error('Failed to save some files:', error);
        }
    }

    setEditorMode(fileType) {
        const modeMap = {
            'html': 'htmlmixed',
            'css': 'css',
            'javascript': 'javascript',
            'json': { name: 'javascript', json: true },
            'xml': 'xml',
            'markdown': 'markdown',
            'text': 'text/plain'
        };
        
        const mode = modeMap[fileType] || 'text/plain';
        this.codeMirror.setOption('mode', mode);
    }

    getCurrentContent() {
        return this.codeMirror ? this.codeMirror.getValue() : '';
    }

    getCurrentFile() {
        if (!this.activeTab) return null;
        const tabData = this.openTabs.get(this.activeTab);
        return tabData ? tabData.file : null;
    }

    // Context menu actions
    cut() {
        if (this.codeMirror.somethingSelected()) {
            const selection = this.codeMirror.getSelection();
            navigator.clipboard.writeText(selection);
            this.codeMirror.replaceSelection('');
        }
    }

    copy() {
        if (this.codeMirror.somethingSelected()) {
            const selection = this.codeMirror.getSelection();
            navigator.clipboard.writeText(selection);
        }
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            this.codeMirror.replaceSelection(text);
        } catch (error) {
            console.error('Failed to paste:', error);
        }
    }

    selectAll() {
        this.codeMirror.selectAll();
    }

    delete() {
        if (this.codeMirror.somethingSelected()) {
            this.codeMirror.replaceSelection('');
        }
    }

    toggleFullscreen() {
        const editorPanel = document.querySelector('.editor-panel');
        editorPanel.classList.toggle('fullscreen');
        
        if (editorPanel.classList.contains('fullscreen')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        
        // Refresh CodeMirror to handle size changes
        setTimeout(() => {
            this.codeMirror.refresh();
        }, 100);
    }

    exitFullscreen() {
        const editorPanel = document.querySelector('.editor-panel');
        editorPanel.classList.remove('fullscreen');
        document.body.style.overflow = '';
        
        setTimeout(() => {
            this.codeMirror.refresh();
        }, 100);
    }

    focus() {
        if (this.codeMirror) {
            this.codeMirror.focus();
        }
    }

    refresh() {
        if (this.codeMirror) {
            this.codeMirror.refresh();
        }
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new Editor();
});

