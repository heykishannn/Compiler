// Web Compiler App - Main JavaScript File

class WebCompiler {
    constructor() {
        this.db = null;
        this.currentFile = null;
        this.currentProject = 'default';
        this.files = new Map();
        this.folders = new Map();
        this.openTabs = [];
        this.activeTab = null;
        this.previewMode = 'pc'; // 'pc' or 'mobile'
        this.autoRun = true;
        this.clipboard = '';
        
        this.initializeApp();
    }

    async initializeApp() {
        await this.initIndexedDB();
        this.setupEventListeners();
        this.setupEditor();
        await this.loadProject();
        this.updateFileTree();
        this.createDefaultFiles();
    }

    // IndexedDB Management
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WebCompilerDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Files store
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', { keyPath: 'id' });
                    filesStore.createIndex('project', 'project', { unique: false });
                    filesStore.createIndex('path', 'path', { unique: false });
                }
                
                // Projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'name' });
                }
            };
        });
    }

    async saveFile(file) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await store.put(file);
    }

    async loadFile(id) {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        return await store.get(id);
    }

    async deleteFile(id) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await store.delete(id);
    }

    async loadProject() {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('project');
        const request = index.getAll(this.currentProject);
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const files = request.result;
                this.files.clear();
                this.folders.clear();
                
                files.forEach(file => {
                    if (file.type === 'folder') {
                        this.folders.set(file.path, file);
                    } else {
                        this.files.set(file.path, file);
                    }
                });
                resolve();
            };
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Top bar buttons
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleFileManager());
        document.getElementById('console-btn').addEventListener('click', () => this.toggleConsole());
        document.getElementById('run-btn').addEventListener('click', () => this.runCode());
        document.getElementById('fullscreen-pc-btn').addEventListener('click', () => this.openFullscreen('pc'));
        document.getElementById('pc-preview-btn').addEventListener('click', () => this.setPreviewMode('pc'));
        document.getElementById('mobile-preview-btn').addEventListener('click', () => this.setPreviewMode('mobile'));
        document.getElementById('fullscreen-mobile-btn').addEventListener('click', () => this.openFullscreen('mobile'));

        // File manager
        document.getElementById('close-file-manager').addEventListener('click', () => this.toggleFileManager());
        document.getElementById('new-file-btn').addEventListener('click', () => this.showCreateDialog('file'));
        document.getElementById('new-folder-btn').addEventListener('click', () => this.showCreateDialog('folder'));
        document.getElementById('import-file-btn').addEventListener('click', () => this.importFiles());
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileImport(e));

        // Console
        document.getElementById('close-console').addEventListener('click', () => this.toggleConsole());
        document.getElementById('clear-console').addEventListener('click', () => this.clearConsole());

        // Preview
        document.getElementById('refresh-preview').addEventListener('click', () => this.runCode());

        // Fullscreen modal
        document.getElementById('close-fullscreen').addEventListener('click', () => this.closeFullscreen());

        // Dialog
        document.getElementById('close-dialog').addEventListener('click', () => this.closeDialog());
        document.getElementById('dialog-cancel').addEventListener('click', () => this.closeDialog());
        document.getElementById('dialog-confirm').addEventListener('click', () => this.confirmDialog());

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.getElementById('context-menu').addEventListener('click', (e) => this.handleContextMenu(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window resize
        window.addEventListener('resize', () => this.updateEditor());
    }

    // Editor Setup
    setupEditor() {
        const editorElement = document.getElementById('code-editor');
        
        // Create editor structure
        editorElement.innerHTML = `
            <div class="line-numbers" id="line-numbers"></div>
            <div class="editor-content">
                <textarea id="editor-textarea" class="editor-textarea" spellcheck="false"></textarea>
            </div>
        `;

        this.editorTextarea = document.getElementById('editor-textarea');
        this.lineNumbers = document.getElementById('line-numbers');

        // Editor events
        this.editorTextarea.addEventListener('input', () => this.onEditorChange());
        this.editorTextarea.addEventListener('scroll', () => this.syncLineNumbers());
        this.editorTextarea.addEventListener('contextmenu', (e) => this.showContextMenu(e));
        this.editorTextarea.addEventListener('keydown', (e) => this.handleEditorKeydown(e));

        this.updateLineNumbers();
    }

    onEditorChange() {
        this.updateLineNumbers();
        this.applySyntaxHighlighting();
        
        if (this.currentFile) {
            this.currentFile.content = this.editorTextarea.value;
            this.currentFile.modified = new Date().toISOString();
            this.saveFile(this.currentFile);
        }

        if (this.autoRun) {
            clearTimeout(this.autoRunTimeout);
            this.autoRunTimeout = setTimeout(() => this.runCode(), 500);
        }
    }

    updateLineNumbers() {
        const lines = this.editorTextarea.value.split('\n');
        const lineNumbersHtml = lines.map((_, index) => `<div>${index + 1}</div>`).join('');
        this.lineNumbers.innerHTML = lineNumbersHtml;
    }

    syncLineNumbers() {
        this.lineNumbers.scrollTop = this.editorTextarea.scrollTop;
    }

    applySyntaxHighlighting() {
        // Basic syntax highlighting (simplified version)
        // In a real implementation, you'd use a proper syntax highlighting library
        const content = this.editorTextarea.value;
        const extension = this.currentFile ? this.currentFile.name.split('.').pop() : 'html';
        
        // This is a simplified version - real syntax highlighting would be more complex
        this.highlightSyntax(content, extension);
    }

    highlightSyntax(content, extension) {
        // Simplified syntax highlighting
        // In production, use libraries like Prism.js or CodeMirror
        const errors = this.findSyntaxErrors(content, extension);
        this.markErrors(errors);
    }

    findSyntaxErrors(content, extension) {
        const errors = [];
        
        if (extension === 'html') {
            // Check for unclosed tags
            const tagRegex = /<(\w+)(?:\s[^>]*)?>/g;
            const closeTagRegex = /<\/(\w+)>/g;
            const openTags = [];
            let match;
            
            while ((match = tagRegex.exec(content)) !== null) {
                const tag = match[1].toLowerCase();
                if (!['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag)) {
                    openTags.push({ tag, line: this.getLineNumber(content, match.index) });
                }
            }
            
            while ((match = closeTagRegex.exec(content)) !== null) {
                const tag = match[1].toLowerCase();
                const openIndex = openTags.findIndex(t => t.tag === tag);
                if (openIndex !== -1) {
                    openTags.splice(openIndex, 1);
                }
            }
            
            openTags.forEach(tag => {
                errors.push({ line: tag.line, message: `Unclosed tag: ${tag.tag}` });
            });
        }
        
        return errors;
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    markErrors(errors) {
        // Remove existing error markers
        document.querySelectorAll('.syntax-error').forEach(el => el.classList.remove('syntax-error'));
        
        // Add new error markers
        errors.forEach(error => {
            this.logToConsole(`Error on line ${error.line}: ${error.message}`, 'error');
        });
    }

    // File Management
    async createFile(name, path = '', type = 'file') {
        const id = `${this.currentProject}:${path}${name}`;
        const file = {
            id,
            name,
            path: path + name,
            type,
            project: this.currentProject,
            content: type === 'file' ? this.getDefaultContent(name) : '',
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        if (type === 'folder') {
            this.folders.set(file.path, file);
        } else {
            this.files.set(file.path, file);
        }

        await this.saveFile(file);
        this.updateFileTree();
        
        if (type === 'file') {
            this.openFile(file);
        }
    }

    getDefaultContent(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'html':
                return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <h1>Hello World!</h1>
</body>
</html>`;
            case 'css':
                return `/* CSS Styles */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
}`;
            case 'js':
                return `// JavaScript Code
console.log('Hello World!');`;
            default:
                return '';
        }
    }

    async deleteFileOrFolder(path) {
        const file = this.files.get(path) || this.folders.get(path);
        if (!file) return;

        await this.deleteFile(file.id);
        
        if (file.type === 'folder') {
            this.folders.delete(path);
            // Delete all files in folder
            for (const [filePath, fileObj] of this.files) {
                if (filePath.startsWith(path + '/')) {
                    await this.deleteFile(fileObj.id);
                    this.files.delete(filePath);
                }
            }
        } else {
            this.files.delete(path);
            this.closeTab(path);
        }

        this.updateFileTree();
    }

    openFile(file) {
        this.currentFile = file;
        this.editorTextarea.value = file.content || '';
        this.updateLineNumbers();
        this.applySyntaxHighlighting();
        
        // Update tab
        if (!this.openTabs.find(tab => tab.path === file.path)) {
            this.openTabs.push(file);
        }
        this.activeTab = file.path;
        this.updateTabs();
        
        // Update header
        document.getElementById('current-file-name').textContent = file.name;
    }

    closeTab(path) {
        const index = this.openTabs.findIndex(tab => tab.path === path);
        if (index !== -1) {
            this.openTabs.splice(index, 1);
        }
        
        if (this.activeTab === path) {
            if (this.openTabs.length > 0) {
                this.openFile(this.openTabs[this.openTabs.length - 1]);
            } else {
                this.currentFile = null;
                this.editorTextarea.value = '';
                this.updateLineNumbers();
                document.getElementById('current-file-name').textContent = 'No file open';
            }
        }
        
        this.updateTabs();
    }

    updateTabs() {
        const tabsContainer = document.querySelector('.editor-tabs');
        tabsContainer.innerHTML = '';
        
        this.openTabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = `editor-tab ${tab.path === this.activeTab ? 'active' : ''}`;
            tabElement.innerHTML = `
                ${tab.name}
                <span class="close-tab" data-path="${tab.path}">×</span>
            `;
            
            tabElement.addEventListener('click', (e) => {
                if (e.target.classList.contains('close-tab')) {
                    this.closeTab(tab.path);
                } else {
                    this.openFile(tab);
                }
            });
            
            tabsContainer.appendChild(tabElement);
        });
    }

    updateFileTree() {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '';
        
        // Sort folders first, then files
        const sortedItems = [];
        
        // Add folders
        for (const [path, folder] of this.folders) {
            sortedItems.push({ ...folder, isFolder: true });
        }
        
        // Add files
        for (const [path, file] of this.files) {
            sortedItems.push({ ...file, isFolder: false });
        }
        
        sortedItems.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
        });
        
        sortedItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = item.isFolder ? 'folder-item' : 'file-item';
            itemElement.innerHTML = `
                <span class="${item.isFolder ? 'folder-icon' : 'file-icon'}"></span>
                ${item.name}
            `;
            
            itemElement.addEventListener('click', () => {
                if (item.isFolder) {
                    // Toggle folder expansion (simplified)
                    itemElement.classList.toggle('expanded');
                } else {
                    this.openFile(item);
                    // Highlight active file
                    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                    itemElement.classList.add('active');
                }
            });
            
            itemElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFileContextMenu(e, item);
            });
            
            fileTree.appendChild(itemElement);
        });
    }

    async importFiles() {
        document.getElementById('file-input').click();
    }

    async handleFileImport(event) {
        const files = Array.from(event.target.files);
        
        for (const file of files) {
            const content = await this.readFileContent(file);
            await this.createFile(file.name, '', 'file');
            
            const createdFile = this.files.get(file.name);
            if (createdFile) {
                createdFile.content = content;
                await this.saveFile(createdFile);
            }
        }
        
        this.updateFileTree();
        event.target.value = ''; // Reset input
    }

    readFileContent(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            
            if (file.type.startsWith('text/') || file.name.match(/\.(html|css|js|json|xml|txt)$/i)) {
                reader.readAsText(file);
            } else {
                // For binary files, convert to base64
                reader.onload = (e) => {
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(e.target.result)));
                    resolve(`data:${file.type};base64,${base64}`);
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }

    // UI Controls
    toggleFileManager() {
        const fileManager = document.getElementById('file-manager');
        fileManager.classList.toggle('hidden');
    }

    toggleConsole() {
        const console = document.getElementById('console-panel');
        console.classList.toggle('hidden');
    }

    setPreviewMode(mode) {
        this.previewMode = mode;
        
        // Update button states
        document.getElementById('pc-preview-btn').classList.toggle('active', mode === 'pc');
        document.getElementById('mobile-preview-btn').classList.toggle('active', mode === 'mobile');
        
        // Update preview frame
        const previewFrame = document.getElementById('preview-frame');
        previewFrame.classList.toggle('mobile-mode', mode === 'mobile');
        
        this.runCode();
    }

    openFullscreen(mode) {
        const modal = document.getElementById('fullscreen-modal');
        const frame = document.getElementById('fullscreen-frame');
        
        frame.classList.toggle('mobile-mode', mode === 'mobile');
        modal.classList.remove('hidden');
        
        // Copy current preview content
        const previewFrame = document.getElementById('preview-frame');
        frame.src = previewFrame.src;
    }

    closeFullscreen() {
        document.getElementById('fullscreen-modal').classList.add('hidden');
    }

    // Code Execution
    runCode() {
        const htmlFile = this.files.get('index.html');
        const cssFile = this.files.get('style.css');
        const jsFile = this.files.get('script.js');
        
        let html = htmlFile ? htmlFile.content : '<h1>No HTML file found</h1>';
        const css = cssFile ? cssFile.content : '';
        const js = jsFile ? jsFile.content : '';
        
        // Inject CSS and JS into HTML
        if (css) {
            html = html.replace('</head>', `<style>${css}</style></head>`);
        }
        
        if (js) {
            html = html.replace('</body>', `<script>${js}</script></body>`);
        }
        
        // Create blob URL for preview
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Update preview frames
        document.getElementById('preview-frame').src = url;
        
        const fullscreenFrame = document.getElementById('fullscreen-frame');
        if (!document.getElementById('fullscreen-modal').classList.contains('hidden')) {
            fullscreenFrame.src = url;
        }
        
        // Clean up previous URL
        if (this.currentPreviewUrl) {
            URL.revokeObjectURL(this.currentPreviewUrl);
        }
        this.currentPreviewUrl = url;
        
        this.logToConsole('Code executed successfully', 'info');
    }

    // Console Management
    logToConsole(message, type = 'log') {
        const consoleOutput = document.getElementById('console-output');
        const logElement = document.createElement('div');
        logElement.className = `console-log console-${type}`;
        logElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        consoleOutput.appendChild(logElement);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    clearConsole() {
        document.getElementById('console-output').innerHTML = '';
    }

    // Context Menu
    showContextMenu(event) {
        event.preventDefault();
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        contextMenu.classList.remove('hidden');
    }

    showFileContextMenu(event, item) {
        // Simplified file context menu
        this.showContextMenu(event);
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
    }

    handleContextMenu(event) {
        event.stopPropagation();
        const action = event.target.dataset.action;
        
        switch (action) {
            case 'selectAll':
                this.editorTextarea.select();
                break;
            case 'copy':
                this.clipboard = this.editorTextarea.value.substring(
                    this.editorTextarea.selectionStart,
                    this.editorTextarea.selectionEnd
                );
                break;
            case 'cut':
                this.clipboard = this.editorTextarea.value.substring(
                    this.editorTextarea.selectionStart,
                    this.editorTextarea.selectionEnd
                );
                this.editorTextarea.setRangeText('');
                this.onEditorChange();
                break;
            case 'paste':
                this.editorTextarea.setRangeText(this.clipboard);
                this.onEditorChange();
                break;
        }
        
        this.hideContextMenu();
    }

    // Dialog Management
    showCreateDialog(type) {
        const dialog = document.getElementById('dialog-overlay');
        const title = document.getElementById('dialog-title');
        const input = document.getElementById('dialog-input');
        
        title.textContent = type === 'file' ? 'Create New File' : 'Create New Folder';
        input.placeholder = type === 'file' ? 'filename.html' : 'folder-name';
        input.value = '';
        
        dialog.classList.remove('hidden');
        input.focus();
        
        this.dialogType = type;
    }

    closeDialog() {
        document.getElementById('dialog-overlay').classList.add('hidden');
    }

    async confirmDialog() {
        const input = document.getElementById('dialog-input');
        const name = input.value.trim();
        
        if (!name) return;
        
        await this.createFile(name, '', this.dialogType);
        this.closeDialog();
    }

    // Keyboard Shortcuts
    handleKeyboard(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    event.preventDefault();
                    if (this.currentFile) {
                        this.saveFile(this.currentFile);
                        this.logToConsole('File saved', 'info');
                    }
                    break;
                case 'n':
                    event.preventDefault();
                    this.showCreateDialog('file');
                    break;
                case 'o':
                    event.preventDefault();
                    this.toggleFileManager();
                    break;
                case 'Enter':
                    event.preventDefault();
                    this.runCode();
                    break;
            }
        }
        
        if (event.key === 'F12') {
            event.preventDefault();
            this.toggleConsole();
        }
    }

    handleEditorKeydown(event) {
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.editorTextarea.selectionStart;
            const end = this.editorTextarea.selectionEnd;
            
            this.editorTextarea.value = 
                this.editorTextarea.value.substring(0, start) + 
                '    ' + 
                this.editorTextarea.value.substring(end);
            
            this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + 4;
            this.onEditorChange();
        }
    }

    // Initialize default files
    async createDefaultFiles() {
        if (this.files.size === 0) {
            await this.createFile('index.html');
            await this.createFile('style.css');
            await this.createFile('script.js');
            
            // Open index.html by default
            const indexFile = this.files.get('index.html');
            if (indexFile) {
                this.openFile(indexFile);
            }
        }
    }

    updateEditor() {
        this.syncLineNumbers();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.webCompiler = new WebCompiler();
});

// Handle errors
window.addEventListener('error', (event) => {
    if (window.webCompiler) {
        window.webCompiler.logToConsole(`Error: ${event.message} at line ${event.lineno}`, 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    if (window.webCompiler) {
        window.webCompiler.logToConsole(`Unhandled promise rejection: ${event.reason}`, 'error');
    }
});

