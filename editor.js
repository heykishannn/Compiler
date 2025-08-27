class EditorManager {
    constructor() {
        this.editors = new Map(); // path -> editor instance
        this.tabs = new Map(); // path -> tab element
        this.activeTab = null;
        this.currentEditor = null;
        this.tabsContainer = document.getElementById('editorTabs');
        this.editorContainer = document.getElementById('editorContainer');
        this.noFileMessage = this.editorContainer.querySelector('.no-file-message');
        
        this.initializeEditor();
        this.setupEventListeners();
    }

    initializeEditor() {
        // CodeMirror configuration
        this.editorConfig = {
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 2,
            tabSize: 2,
            indentWithTabs: false,
            extraKeys: {
                'Ctrl-S': () => this.saveCurrentFile(),
                'Ctrl-Z': 'undo',
                'Ctrl-Y': 'redo',
                'Ctrl-/': 'toggleComment',
                'Ctrl-F': 'findPersistent',
                'Ctrl-H': 'replace',
                'F11': () => this.toggleFullscreen(),
                'Esc': () => this.exitFullscreen()
            },
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
        };
    }

    setupEventListeners() {
        // Tab container click handling
        this.tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (!tab) return;

            const closeBtn = e.target.closest('.close');
            if (closeBtn) {
                e.stopPropagation();
                this.closeTab(tab.dataset.path);
            } else {
                this.switchToTab(tab.dataset.path);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'w':
                        e.preventDefault();
                        if (this.activeTab) {
                            this.closeTab(this.activeTab);
                        }
                        break;
                    case 'Tab':
                        e.preventDefault();
                        this.switchToNextTab(e.shiftKey ? -1 : 1);
                        break;
                }
            }
        });
    }

    async openFile(path) {
        // Check if file is already open
        if (this.tabs.has(path)) {
            this.switchToTab(path);
            return;
        }

        try {
            const fileData = await window.storageManager.getFile(path);
            if (!fileData || fileData.type === 'folder') {
                console.error('Cannot open folder or non-existent file:', path);
                return;
            }

            // Create tab
            const tab = this.createTab(path, fileData.name);
            this.tabs.set(path, tab);

            // Create editor
            const editor = this.createEditor(fileData.content, this.getFileMode(path));
            this.editors.set(path, editor);

            // Set up change listener
            editor.on('change', () => {
                this.markTabAsModified(path);
                this.updatePreview();
            });

            // Switch to new tab
            this.switchToTab(path);

        } catch (error) {
            console.error('Error opening file:', error);
            this.showError('Failed to open file: ' + path);
        }
    }

    createTab(path, name) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.path = path;
        tab.innerHTML = `
            <span class="name" title="${path}">${name}</span>
            <span class="close">×</span>
        `;
        
        this.tabsContainer.appendChild(tab);
        return tab;
    }

    createEditor(content, mode) {
        const editorElement = document.createElement('div');
        editorElement.className = 'editor-instance';
        editorElement.style.display = 'none';
        this.editorContainer.appendChild(editorElement);

        const config = {
            ...this.editorConfig,
            value: content,
            mode: mode
        };

        const editor = CodeMirror(editorElement, config);
        
        // Ensure proper sizing
        setTimeout(() => {
            editor.refresh();
        }, 100);

        return editor;
    }

    switchToTab(path) {
        // Hide current editor
        if (this.currentEditor) {
            this.currentEditor.getWrapperElement().parentElement.style.display = 'none';
        }

        // Update tab states
        this.tabs.forEach((tab, tabPath) => {
            tab.classList.toggle('active', tabPath === path);
        });

        // Show new editor
        const editor = this.editors.get(path);
        if (editor) {
            const editorElement = editor.getWrapperElement().parentElement;
            editorElement.style.display = 'block';
            editor.refresh();
            editor.focus();
            
            this.currentEditor = editor;
            this.activeTab = path;
            
            // Hide no-file message
            this.noFileMessage.style.display = 'none';
        }
    }

    async closeTab(path) {
        const tab = this.tabs.get(path);
        const editor = this.editors.get(path);
        
        if (!tab || !editor) return;

        // Check if file is modified
        if (tab.classList.contains('modified')) {
            const shouldSave = confirm('File has unsaved changes. Save before closing?');
            if (shouldSave) {
                await this.saveFile(path);
            }
        }

        // Remove tab and editor
        tab.remove();
        editor.getWrapperElement().parentElement.remove();
        
        this.tabs.delete(path);
        this.editors.delete(path);

        // Switch to another tab or show no-file message
        if (this.activeTab === path) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                this.activeTab = null;
                this.currentEditor = null;
                this.noFileMessage.style.display = 'flex';
            }
        }
    }

    switchToNextTab(direction = 1) {
        const tabPaths = Array.from(this.tabs.keys());
        if (tabPaths.length <= 1) return;

        const currentIndex = tabPaths.indexOf(this.activeTab);
        let nextIndex = currentIndex + direction;
        
        if (nextIndex >= tabPaths.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = tabPaths.length - 1;
        
        this.switchToTab(tabPaths[nextIndex]);
    }

    markTabAsModified(path) {
        const tab = this.tabs.get(path);
        if (tab) {
            tab.classList.add('modified');
        }
    }

    markTabAsSaved(path) {
        const tab = this.tabs.get(path);
        if (tab) {
            tab.classList.remove('modified');
        }
    }

    async saveCurrentFile() {
        if (!this.activeTab || !this.currentEditor) return;
        await this.saveFile(this.activeTab);
    }

    async saveFile(path) {
        try {
            const editor = this.editors.get(path);
            if (!editor) return;

            const content = editor.getValue();
            await window.storageManager.updateFile(path, content);
            
            this.markTabAsSaved(path);
            this.updatePreview();
            
            console.log('File saved:', path);
        } catch (error) {
            console.error('Error saving file:', error);
            this.showError('Failed to save file: ' + path);
        }
    }

    getFileMode(path) {
        const extension = path.split('.').pop().toLowerCase();
        
        const modeMap = {
            'html': 'htmlmixed',
            'htm': 'htmlmixed',
            'css': 'css',
            'js': 'javascript',
            'json': 'application/json',
            'xml': 'xml',
            'svg': 'xml',
            'md': 'markdown',
            'txt': 'text/plain'
        };

        return modeMap[extension] || 'text/plain';
    }

    updatePreview() {
        // Trigger preview update
        if (window.previewManager) {
            window.previewManager.refresh();
        }
    }

    toggleFullscreen() {
        const editorPanel = document.querySelector('.editor-panel');
        if (editorPanel.classList.contains('fullscreen')) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        const editorPanel = document.querySelector('.editor-panel');
        const fileExplorer = document.querySelector('.file-explorer');
        const previewPanel = document.querySelector('.preview-panel');
        
        editorPanel.classList.add('fullscreen');
        fileExplorer.style.display = 'none';
        previewPanel.style.display = 'none';
        
        if (this.currentEditor) {
            setTimeout(() => this.currentEditor.refresh(), 100);
        }
    }

    exitFullscreen() {
        const editorPanel = document.querySelector('.editor-panel');
        const fileExplorer = document.querySelector('.file-explorer');
        const previewPanel = document.querySelector('.preview-panel');
        
        editorPanel.classList.remove('fullscreen');
        fileExplorer.style.display = 'flex';
        previewPanel.style.display = 'flex';
        
        if (this.currentEditor) {
            setTimeout(() => this.currentEditor.refresh(), 100);
        }
    }

    getCurrentContent() {
        return this.currentEditor ? this.currentEditor.getValue() : '';
    }

    getCurrentPath() {
        return this.activeTab;
    }

    insertText(text) {
        if (this.currentEditor) {
            const cursor = this.currentEditor.getCursor();
            this.currentEditor.replaceRange(text, cursor);
            this.currentEditor.focus();
        }
    }

    getSelectedText() {
        return this.currentEditor ? this.currentEditor.getSelection() : '';
    }

    replaceSelection(text) {
        if (this.currentEditor) {
            this.currentEditor.replaceSelection(text);
            this.currentEditor.focus();
        }
    }

    selectAll() {
        if (this.currentEditor) {
            this.currentEditor.execCommand('selectAll');
        }
    }

    cut() {
        if (this.currentEditor) {
            const selection = this.currentEditor.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection);
                this.currentEditor.replaceSelection('');
            }
        }
    }

    copy() {
        if (this.currentEditor) {
            const selection = this.currentEditor.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection);
            }
        }
    }

    async paste() {
        if (this.currentEditor) {
            try {
                const text = await navigator.clipboard.readText();
                this.currentEditor.replaceSelection(text);
            } catch (error) {
                console.error('Failed to paste:', error);
            }
        }
    }

    delete() {
        if (this.currentEditor) {
            const selection = this.currentEditor.getSelection();
            if (selection) {
                this.currentEditor.replaceSelection('');
            } else {
                // Delete character at cursor
                const cursor = this.currentEditor.getCursor();
                const nextPos = { line: cursor.line, ch: cursor.ch + 1 };
                this.currentEditor.replaceRange('', cursor, nextPos);
            }
        }
    }

    showError(message) {
        // Show error in console
        if (window.consoleManager) {
            window.consoleManager.addMessage('error', message);
        } else {
            console.error(message);
        }
    }

    // Auto-save functionality
    enableAutoSave(interval = 30000) { // 30 seconds
        setInterval(() => {
            if (this.activeTab && this.currentEditor) {
                const tab = this.tabs.get(this.activeTab);
                if (tab && tab.classList.contains('modified')) {
                    this.saveFile(this.activeTab);
                }
            }
        }, interval);
    }
}

// Global editor instance
window.editorManager = new EditorManager();

