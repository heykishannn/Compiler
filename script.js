// Web Code Compiler - Main JavaScript File
class WebCodeCompiler {
    constructor() {
        this.currentFile = null;
        this.files = new Map();
        this.folders = new Map();
        this.fileTree = [];
        this.isConsoleVisible = false;
        this.isSidebarVisible = true;
        this.previewMode = 'pc';
        this.miniPreviewMode = 'pc';
        
        this.initializeDB();
        this.initializeEventListeners();
        this.loadFromStorage();
        this.updateLineNumbers();
    }

    // IndexedDB Management
    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WebCodeCompilerDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', { keyPath: 'id' });
                    filesStore.createIndex('path', 'path', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('folders')) {
                    const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
                    foldersStore.createIndex('path', 'path', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async saveToStorage() {
        if (!this.db) return;
        
        const transaction = this.db.transaction(['files', 'folders', 'settings'], 'readwrite');
        
        // Save files
        const filesStore = transaction.objectStore('files');
        for (const [id, file] of this.files) {
            await filesStore.put(file);
        }
        
        // Save folders
        const foldersStore = transaction.objectStore('folders');
        for (const [id, folder] of this.folders) {
            await foldersStore.put(folder);
        }
        
        // Save settings
        const settingsStore = transaction.objectStore('settings');
        await settingsStore.put({
            key: 'currentFile',
            value: this.currentFile
        });
        await settingsStore.put({
            key: 'fileTree',
            value: this.fileTree
        });
    }

    async loadFromStorage() {
        if (!this.db) return;
        
        const transaction = this.db.transaction(['files', 'folders', 'settings'], 'readonly');
        
        // Load files
        const filesStore = transaction.objectStore('files');
        const filesRequest = filesStore.getAll();
        filesRequest.onsuccess = () => {
            filesRequest.result.forEach(file => {
                this.files.set(file.id, file);
            });
            this.renderFileTree();
        };
        
        // Load folders
        const foldersStore = transaction.objectStore('folders');
        const foldersRequest = foldersStore.getAll();
        foldersRequest.onsuccess = () => {
            foldersRequest.result.forEach(folder => {
                this.folders.set(folder.id, folder);
            });
        };
        
        // Load settings
        const settingsStore = transaction.objectStore('settings');
        const currentFileRequest = settingsStore.get('currentFile');
        currentFileRequest.onsuccess = () => {
            if (currentFileRequest.result) {
                this.currentFile = currentFileRequest.result.value;
            }
        };
        
        const fileTreeRequest = settingsStore.get('fileTree');
        fileTreeRequest.onsuccess = () => {
            if (fileTreeRequest.result) {
                this.fileTree = fileTreeRequest.result.value;
                this.renderFileTree();
            }
        };
    }

    // Event Listeners
    initializeEventListeners() {
        // Top bar buttons
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('console-btn').addEventListener('click', () => this.toggleConsole());
        document.getElementById('run-btn').addEventListener('click', () => this.runCode());
        document.getElementById('fullscreen-pc-btn').addEventListener('click', () => this.openFullscreenPreview('pc'));
        document.getElementById('pc-preview-btn').addEventListener('click', () => this.setPreviewMode('pc'));
        document.getElementById('mobile-preview-btn').addEventListener('click', () => this.setPreviewMode('mobile'));
        document.getElementById('fullscreen-mobile-btn').addEventListener('click', () => this.openFullscreenPreview('mobile'));
        
        // Sidebar buttons
        document.getElementById('new-file-btn').addEventListener('click', () => this.showNewFileDialog());
        document.getElementById('new-folder-btn').addEventListener('click', () => this.showNewFolderDialog());
        document.getElementById('import-btn').addEventListener('click', () => this.importFiles());
        
        // Editor
        const editor = document.getElementById('code-editor');
        editor.addEventListener('input', () => this.onEditorChange());
        editor.addEventListener('scroll', () => this.syncLineNumbers());
        editor.addEventListener('keydown', (e) => this.handleEditorKeydown(e));
        
        // Mini preview mode toggle
        document.getElementById('mini-pc-btn').addEventListener('click', () => this.setMiniPreviewMode('pc'));
        document.getElementById('mini-mobile-btn').addEventListener('click', () => this.setMiniPreviewMode('mobile'));
        
        // Console
        document.getElementById('clear-console-btn').addEventListener('click', () => this.clearConsole());
        
        // Fullscreen preview
        document.getElementById('close-fullscreen-btn').addEventListener('click', () => this.closeFullscreenPreview());
        
        // Modal
        document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-confirm-btn').addEventListener('click', () => this.confirmModal());
        
        // File input
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileImport(e));
        
        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    // File Management
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    createFile(name, content = '', parentId = null) {
        const id = this.generateId();
        const file = {
            id,
            name,
            content,
            type: 'file',
            parentId,
            path: this.getFullPath(name, parentId),
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        
        this.files.set(id, file);
        this.addToFileTree(file);
        this.saveToStorage();
        this.renderFileTree();
        return file;
    }

    createFolder(name, parentId = null) {
        const id = this.generateId();
        const folder = {
            id,
            name,
            type: 'folder',
            parentId,
            path: this.getFullPath(name, parentId),
            children: [],
            expanded: false,
            createdAt: new Date()
        };
        
        this.folders.set(id, folder);
        this.addToFileTree(folder);
        this.saveToStorage();
        this.renderFileTree();
        return folder;
    }

    getFullPath(name, parentId) {
        if (!parentId) return name;
        
        const parent = this.folders.get(parentId);
        if (!parent) return name;
        
        return parent.path + '/' + name;
    }

    addToFileTree(item) {
        if (!item.parentId) {
            this.fileTree.push(item);
        } else {
            const parent = this.folders.get(item.parentId);
            if (parent) {
                parent.children.push(item);
            }
        }
    }

    deleteItem(id) {
        const file = this.files.get(id);
        const folder = this.folders.get(id);
        
        if (file) {
            this.files.delete(id);
            this.removeFromFileTree(id);
            if (this.currentFile === id) {
                this.currentFile = null;
                this.updateEditor();
            }
        } else if (folder) {
            // Delete all children recursively
            this.deleteFolder(folder);
            this.folders.delete(id);
            this.removeFromFileTree(id);
        }
        
        this.saveToStorage();
        this.renderFileTree();
    }

    deleteFolder(folder) {
        folder.children.forEach(child => {
            if (child.type === 'file') {
                this.files.delete(child.id);
                if (this.currentFile === child.id) {
                    this.currentFile = null;
                    this.updateEditor();
                }
            } else {
                const childFolder = this.folders.get(child.id);
                if (childFolder) {
                    this.deleteFolder(childFolder);
                    this.folders.delete(child.id);
                }
            }
        });
    }

    removeFromFileTree(id) {
        const removeFromArray = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i].id === id) {
                    arr.splice(i, 1);
                    return true;
                }
                if (arr[i].children && removeFromArray(arr[i].children)) {
                    return true;
                }
            }
            return false;
        };
        
        removeFromArray(this.fileTree);
    }

    renameItem(id, newName) {
        const file = this.files.get(id);
        const folder = this.folders.get(id);
        
        if (file) {
            file.name = newName;
            file.path = this.getFullPath(newName, file.parentId);
            file.modifiedAt = new Date();
        } else if (folder) {
            folder.name = newName;
            folder.path = this.getFullPath(newName, folder.parentId);
            // Update paths of all children
            this.updateChildrenPaths(folder);
        }
        
        this.saveToStorage();
        this.renderFileTree();
    }

    updateChildrenPaths(folder) {
        folder.children.forEach(child => {
            if (child.type === 'file') {
                const file = this.files.get(child.id);
                if (file) {
                    file.path = this.getFullPath(file.name, folder.id);
                }
            } else {
                const childFolder = this.folders.get(child.id);
                if (childFolder) {
                    childFolder.path = this.getFullPath(childFolder.name, folder.id);
                    this.updateChildrenPaths(childFolder);
                }
            }
        });
    }

    // File Tree Rendering
    renderFileTree() {
        const container = document.getElementById('file-tree');
        container.innerHTML = '';
        
        this.fileTree.forEach(item => {
            container.appendChild(this.createFileTreeElement(item));
        });
    }

    createFileTreeElement(item) {
        const element = document.createElement('div');
        element.className = item.type === 'file' ? 'file-item' : 'folder-item';
        element.dataset.id = item.id;
        
        if (item.type === 'folder') {
            element.innerHTML = `
                <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"></path>
                </svg>
                <span>${item.name}</span>
            `;
            
            element.addEventListener('click', () => this.toggleFolder(item.id));
            
            if (item.expanded) {
                element.classList.add('expanded');
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                
                item.children.forEach(child => {
                    childrenContainer.appendChild(this.createFileTreeElement(child));
                });
                
                element.appendChild(childrenContainer);
            }
        } else {
            const fileIcon = this.getFileIcon(item.name);
            element.innerHTML = `
                ${fileIcon}
                <span>${item.name}</span>
            `;
            
            element.addEventListener('click', () => this.openFile(item.id));
            
            if (this.currentFile === item.id) {
                element.classList.add('active');
            }
        }
        
        return element;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        switch (ext) {
            case 'html':
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e34c26" stroke-width="2"><polyline points="16,18 22,12 16,6"></polyline><polyline points="8,6 2,12 8,18"></polyline></svg>';
            case 'css':
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1572b6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M8 12h8"></path><path d="M8 16h8"></path></svg>';
            case 'js':
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>';
            case 'json':
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg>';
            default:
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg>';
        }
    }

    toggleFolder(id) {
        const folder = this.folders.get(id);
        if (folder) {
            folder.expanded = !folder.expanded;
            this.saveToStorage();
            this.renderFileTree();
        }
    }

    openFile(id) {
        this.currentFile = id;
        this.updateEditor();
        this.saveToStorage();
        this.renderFileTree();
        this.runCode();
    }

    // Editor Management
    updateEditor() {
        const editor = document.getElementById('code-editor');
        const currentFileSpan = document.getElementById('current-file');
        
        if (this.currentFile) {
            const file = this.files.get(this.currentFile);
            if (file) {
                editor.value = file.content;
                currentFileSpan.textContent = file.name;
                this.applySyntaxHighlighting();
            }
        } else {
            editor.value = '';
            currentFileSpan.textContent = 'No file selected';
        }
        
        this.updateLineNumbers();
    }

    onEditorChange() {
        if (this.currentFile) {
            const editor = document.getElementById('code-editor');
            const file = this.files.get(this.currentFile);
            if (file) {
                file.content = editor.value;
                file.modifiedAt = new Date();
                this.saveToStorage();
                this.applySyntaxHighlighting();
                this.updateLineNumbers();
                
                // Auto-run if it's an HTML file
                if (file.name.endsWith('.html')) {
                    this.runCode();
                }
            }
        }
    }

    updateLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lineNumbers = document.getElementById('line-numbers');
        
        const lines = editor.value.split('\n');
        const lineNumbersText = lines.map((_, index) => index + 1).join('\n');
        lineNumbers.textContent = lineNumbersText;
    }

    syncLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lineNumbers = document.getElementById('line-numbers');
        lineNumbers.scrollTop = editor.scrollTop;
    }

    applySyntaxHighlighting() {
        // This is a simplified syntax highlighting
        // In a real implementation, you might use a library like Prism.js or CodeMirror
        const editor = document.getElementById('code-editor');
        const content = editor.value;
        
        // For now, we'll just handle basic error detection
        this.detectErrors(content);
    }

    detectErrors(content) {
        const errors = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Basic HTML tag matching
            if (line.includes('<') && !line.includes('>')) {
                errors.push({
                    line: index + 1,
                    message: 'Unclosed HTML tag',
                    type: 'error'
                });
            }
            
            // Basic JavaScript syntax errors
            if (line.includes('function') && !line.includes('(')) {
                errors.push({
                    line: index + 1,
                    message: 'Invalid function syntax',
                    type: 'error'
                });
            }
        });
        
        this.displayErrors(errors);
    }

    displayErrors(errors) {
        // Clear previous errors
        this.clearConsole();
        
        if (errors.length > 0) {
            errors.forEach(error => {
                this.logToConsole(`Line ${error.line}: ${error.message}`, 'error');
            });
        }
    }

    handleEditorKeydown(e) {
        // Handle custom keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveCurrentFile();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAllText();
                    break;
                case 'c':
                    // Let default copy behavior work
                    break;
                case 'v':
                    // Let default paste behavior work
                    break;
                case 'x':
                    // Let default cut behavior work
                    break;
            }
        }
        
        // Handle tab indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const editor = e.target;
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
            
            this.onEditorChange();
        }
    }

    selectAllText() {
        const editor = document.getElementById('code-editor');
        editor.select();
    }

    saveCurrentFile() {
        if (this.currentFile) {
            this.saveToStorage();
            this.logToConsole('File saved successfully', 'info');
        }
    }

    // Console Management
    toggleConsole() {
        this.isConsoleVisible = !this.isConsoleVisible;
        const consoleSection = document.getElementById('console-section');
        
        if (this.isConsoleVisible) {
            consoleSection.classList.remove('hidden');
        } else {
            consoleSection.classList.add('hidden');
        }
    }

    logToConsole(message, type = 'log') {
        const consoleOutput = document.getElementById('console-output');
        const logElement = document.createElement('div');
        logElement.className = `console-${type}`;
        logElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        consoleOutput.appendChild(logElement);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    clearConsole() {
        const consoleOutput = document.getElementById('console-output');
        consoleOutput.innerHTML = '';
    }

    // Preview Management
    runCode() {
        if (!this.currentFile) {
            this.logToConsole('No file selected', 'warn');
            return;
        }
        
        const file = this.files.get(this.currentFile);
        if (!file) {
            this.logToConsole('File not found', 'error');
            return;
        }
        
        try {
            let htmlContent = '';
            
            if (file.name.endsWith('.html')) {
                htmlContent = file.content;
            } else if (file.name.endsWith('.js')) {
                htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>JavaScript Preview</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            .output { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
                        </style>
                    </head>
                    <body>
                        <h2>JavaScript Output</h2>
                        <div id="output" class="output"></div>
                        <script>
                            const originalLog = console.log;
                            console.log = function(...args) {
                                document.getElementById('output').innerHTML += args.join(' ') + '<br>';
                                originalLog.apply(console, args);
                            };
                            ${file.content}
                        </script>
                    </body>
                    </html>
                `;
            } else if (file.name.endsWith('.css')) {
                htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>CSS Preview</title>
                        <style>
                            ${file.content}
                        </style>
                    </head>
                    <body>
                        <h1>CSS Preview</h1>
                        <p>This is a sample paragraph to demonstrate your CSS styles.</p>
                        <div class="sample-div">Sample div element</div>
                        <button class="sample-button">Sample button</button>
                    </body>
                    </html>
                `;
            } else {
                htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>File Preview</title>
                        <style>
                            body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
                        </style>
                    </head>
                    <body>${file.content}</body>
                    </html>
                `;
            }
            
            this.updatePreview(htmlContent);
            this.logToConsole('Code executed successfully', 'info');
            
        } catch (error) {
            this.logToConsole(`Error: ${error.message}`, 'error');
        }
    }

    updatePreview(htmlContent) {
        const miniPreview = document.getElementById('mini-preview');
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        miniPreview.src = url;
        
        // Clean up previous URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    setPreviewMode(mode) {
        this.previewMode = mode;
        // Update UI to reflect the current preview mode
        this.logToConsole(`Preview mode set to ${mode}`, 'info');
    }

    setMiniPreviewMode(mode) {
        this.miniPreviewMode = mode;
        const miniPreview = document.getElementById('mini-preview');
        const pcBtn = document.getElementById('mini-pc-btn');
        const mobileBtn = document.getElementById('mini-mobile-btn');
        
        if (mode === 'pc') {
            miniPreview.className = 'mini-preview pc-mode';
            pcBtn.classList.add('active');
            mobileBtn.classList.remove('active');
        } else {
            miniPreview.className = 'mini-preview mobile-mode';
            mobileBtn.classList.add('active');
            pcBtn.classList.remove('active');
        }
    }

    openFullscreenPreview(mode) {
        const overlay = document.getElementById('fullscreen-overlay');
        const preview = document.getElementById('fullscreen-preview');
        
        if (this.currentFile) {
            const file = this.files.get(this.currentFile);
            if (file) {
                let htmlContent = file.content;
                
                if (!file.name.endsWith('.html')) {
                    htmlContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Preview</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; }
                            </style>
                        </head>
                        <body>
                            <pre>${file.content}</pre>
                        </body>
                        </html>
                    `;
                }
                
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                
                preview.src = url;
                
                if (mode === 'mobile') {
                    preview.classList.add('mobile-mode');
                } else {
                    preview.classList.remove('mobile-mode');
                }
                
                overlay.classList.remove('hidden');
                
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
    }

    closeFullscreenPreview() {
        const overlay = document.getElementById('fullscreen-overlay');
        overlay.classList.add('hidden');
    }

    // UI Management
    toggleSidebar() {
        this.isSidebarVisible = !this.isSidebarVisible;
        const sidebar = document.getElementById('file-sidebar');
        
        if (this.isSidebarVisible) {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('visible');
        } else {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('visible');
        }
    }

    // Modal Management
    showModal(title, content, onConfirm) {
        const overlay = document.getElementById('modal-overlay');
        const titleElement = document.getElementById('modal-title');
        const bodyElement = document.getElementById('modal-body');
        
        titleElement.textContent = title;
        bodyElement.innerHTML = content;
        
        this.modalConfirmCallback = onConfirm;
        overlay.classList.remove('hidden');
    }

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.add('hidden');
        this.modalConfirmCallback = null;
    }

    confirmModal() {
        if (this.modalConfirmCallback) {
            this.modalConfirmCallback();
        }
        this.closeModal();
    }

    showNewFileDialog() {
        const content = `
            <div class="form-group">
                <label class="form-label">File Name:</label>
                <input type="text" id="new-file-name" class="form-input" placeholder="index.html">
            </div>
        `;
        
        this.showModal('New File', content, () => {
            const nameInput = document.getElementById('new-file-name');
            const name = nameInput.value.trim();
            
            if (name) {
                this.createFile(name);
                this.logToConsole(`Created file: ${name}`, 'info');
            }
        });
        
        // Focus the input after modal is shown
        setTimeout(() => {
            document.getElementById('new-file-name').focus();
        }, 100);
    }

    showNewFolderDialog() {
        const content = `
            <div class="form-group">
                <label class="form-label">Folder Name:</label>
                <input type="text" id="new-folder-name" class="form-input" placeholder="assets">
            </div>
        `;
        
        this.showModal('New Folder', content, () => {
            const nameInput = document.getElementById('new-folder-name');
            const name = nameInput.value.trim();
            
            if (name) {
                this.createFolder(name);
                this.logToConsole(`Created folder: ${name}`, 'info');
            }
        });
        
        setTimeout(() => {
            document.getElementById('new-folder-name').focus();
        }, 100);
    }

    // File Import
    importFiles() {
        const fileInput = document.getElementById('file-input');
        fileInput.click();
    }

    async handleFileImport(event) {
        const files = event.target.files;
        
        for (const file of files) {
            try {
                const content = await this.readFileContent(file);
                this.createFile(file.name, content);
                this.logToConsole(`Imported file: ${file.name}`, 'info');
            } catch (error) {
                this.logToConsole(`Error importing ${file.name}: ${error.message}`, 'error');
            }
        }
        
        // Clear the input
        event.target.value = '';
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            
            if (file.type.startsWith('text/') || 
                file.name.endsWith('.html') || 
                file.name.endsWith('.css') || 
                file.name.endsWith('.js') || 
                file.name.endsWith('.json') || 
                file.name.endsWith('.md')) {
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    // Context Menu
    handleContextMenu(event) {
        const fileItem = event.target.closest('.file-item, .folder-item');
        
        if (fileItem) {
            event.preventDefault();
            this.showContextMenu(event.clientX, event.clientY, fileItem.dataset.id);
        }
    }

    showContextMenu(x, y, itemId) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.remove('hidden');
        
        this.contextMenuItemId = itemId;
        
        // Add event listeners to context menu items
        const items = contextMenu.querySelectorAll('.context-item');
        items.forEach(item => {
            item.onclick = () => this.handleContextMenuAction(item.dataset.action);
        });
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.classList.add('hidden');
    }

    handleContextMenuAction(action) {
        const itemId = this.contextMenuItemId;
        
        switch (action) {
            case 'rename':
                this.showRenameDialog(itemId);
                break;
            case 'delete':
                this.showDeleteConfirmation(itemId);
                break;
            case 'move':
                this.showMoveDialog(itemId);
                break;
            case 'duplicate':
                this.duplicateItem(itemId);
                break;
        }
        
        this.hideContextMenu();
    }

    showRenameDialog(itemId) {
        const file = this.files.get(itemId);
        const folder = this.folders.get(itemId);
        const item = file || folder;
        
        if (!item) return;
        
        const content = `
            <div class="form-group">
                <label class="form-label">New Name:</label>
                <input type="text" id="rename-input" class="form-input" value="${item.name}">
            </div>
        `;
        
        this.showModal('Rename', content, () => {
            const input = document.getElementById('rename-input');
            const newName = input.value.trim();
            
            if (newName && newName !== item.name) {
                this.renameItem(itemId, newName);
                this.logToConsole(`Renamed to: ${newName}`, 'info');
            }
        });
        
        setTimeout(() => {
            const input = document.getElementById('rename-input');
            input.focus();
            input.select();
        }, 100);
    }

    showDeleteConfirmation(itemId) {
        const file = this.files.get(itemId);
        const folder = this.folders.get(itemId);
        const item = file || folder;
        
        if (!item) return;
        
        const content = `
            <p>Are you sure you want to delete "${item.name}"?</p>
            ${item.type === 'folder' ? '<p><strong>This will delete all contents of the folder.</strong></p>' : ''}
        `;
        
        this.showModal('Delete', content, () => {
            this.deleteItem(itemId);
            this.logToConsole(`Deleted: ${item.name}`, 'info');
        });
    }

    duplicateItem(itemId) {
        const file = this.files.get(itemId);
        
        if (file) {
            const newName = this.getUniqueFileName(file.name);
            this.createFile(newName, file.content, file.parentId);
            this.logToConsole(`Duplicated: ${newName}`, 'info');
        }
    }

    getUniqueFileName(originalName) {
        const parts = originalName.split('.');
        const extension = parts.length > 1 ? '.' + parts.pop() : '';
        const baseName = parts.join('.');
        
        let counter = 1;
        let newName = `${baseName}_copy${extension}`;
        
        while (Array.from(this.files.values()).some(f => f.name === newName)) {
            counter++;
            newName = `${baseName}_copy${counter}${extension}`;
        }
        
        return newName;
    }

    // Global Event Handlers
    handleGlobalKeydown(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'n':
                    event.preventDefault();
                    this.showNewFileDialog();
                    break;
                case 'o':
                    event.preventDefault();
                    this.importFiles();
                    break;
                case 'r':
                    event.preventDefault();
                    this.runCode();
                    break;
                case '`':
                    event.preventDefault();
                    this.toggleConsole();
                    break;
            }
        }
        
        if (event.key === 'F11') {
            event.preventDefault();
            this.openFullscreenPreview(this.previewMode);
        }
    }

    handleResize() {
        // Handle responsive behavior
        const sidebar = document.getElementById('file-sidebar');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile');
        } else {
            sidebar.classList.remove('mobile');
        }
    }
}

// Initialize the compiler when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.compiler = new WebCodeCompiler();
    
    // Create a default HTML file if no files exist
    setTimeout(() => {
        if (window.compiler.files.size === 0) {
            const defaultContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Web Code Compiler</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        .feature {
            margin: 20px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to Web Code Compiler</h1>
        
        <div class="feature">
            <h3>📁 File Management</h3>
            <p>Create, import, rename, and organize your files and folders with ease.</p>
        </div>
        
        <div class="feature">
            <h3>💻 Code Editor</h3>
            <p>Write code with syntax highlighting and line numbers. Auto-run HTML files as you type!</p>
        </div>
        
        <div class="feature">
            <h3>🖥️ Live Preview</h3>
            <p>See your code in action with PC and mobile preview modes.</p>
        </div>
        
        <div class="feature">
            <h3>🔧 Console</h3>
            <p>Debug your code with the integrated console that shows errors and logs.</p>
        </div>
        
        <div class="feature">
            <h3>💾 Auto-Save</h3>
            <p>Your work is automatically saved using IndexedDB - never lose your progress!</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <button onclick="createNewFile()">Create New File</button>
            <button onclick="showFeatures()">Explore Features</button>
        </div>
    </div>
    
    <script>
        function createNewFile() {
            alert('Click the "+" button in the file sidebar to create a new file!');
        }
        
        function showFeatures() {
            alert('Try these keyboard shortcuts:\\n\\nCtrl+N: New File\\nCtrl+O: Import Files\\nCtrl+R: Run Code\\nCtrl+`: Toggle Console\\nF11: Fullscreen Preview');
        }
        
        console.log('Welcome to Web Code Compiler! 🎉');
        console.log('Start coding and see your changes live!');
    </script>
</body>
</html>`;
            
            const welcomeFile = window.compiler.createFile('welcome.html', defaultContent);
            window.compiler.openFile(welcomeFile.id);
        }
    }, 500);
});

