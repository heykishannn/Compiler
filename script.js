// Web Code Compiler - Main JavaScript File

class CodeCompiler {
    constructor() {
        this.db = null;
        this.currentFile = null;
        this.files = new Map();
        this.folders = new Map();
        this.isAutoRun = true;
        this.previewMode = 'pc';
        this.fullscreenMode = 'pc';
        
        this.init();
    }

    async init() {
        await this.initDB();
        this.initEventListeners();
        this.initEditor();
        this.loadFileTree();
        this.createDefaultFiles();
    }

    // IndexedDB Management
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CodeCompilerDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('path', 'path', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('folders')) {
                    const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
                    folderStore.createIndex('path', 'path', { unique: true });
                }
            };
        });
    }

    async saveFile(file) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await store.put(file);
        this.files.set(file.id, file);
    }

    async loadFile(id) {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(id) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await store.delete(id);
        this.files.delete(id);
    }

    async saveFolder(folder) {
        const transaction = this.db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        await store.put(folder);
        this.folders.set(folder.id, folder);
    }

    async loadAllFiles() {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const files = request.result;
                files.forEach(file => this.files.set(file.id, file));
                resolve(files);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async loadAllFolders() {
        const transaction = this.db.transaction(['folders'], 'readonly');
        const store = transaction.objectStore('folders');
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const folders = request.result;
                folders.forEach(folder => this.folders.set(folder.id, folder));
                resolve(folders);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Event Listeners
    initEventListeners() {
        // Top bar buttons
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('console-btn').addEventListener('click', () => this.toggleConsole());
        document.getElementById('run-btn').addEventListener('click', () => this.runCode());
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('pc-preview-btn').addEventListener('click', () => this.setPreviewMode('pc'));
        document.getElementById('mobile-preview-btn').addEventListener('click', () => this.setPreviewMode('mobile'));
        document.getElementById('fullscreen-preview-btn').addEventListener('click', () => this.openFullscreenPreview());

        // Sidebar buttons
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('create-file-btn').addEventListener('click', () => this.showCreateModal('file'));
        document.getElementById('create-folder-btn').addEventListener('click', () => this.showCreateModal('folder'));
        document.getElementById('import-file-btn').addEventListener('click', () => this.importFiles());

        // Console buttons
        document.getElementById('clear-console').addEventListener('click', () => this.clearConsole());
        document.getElementById('close-console').addEventListener('click', () => this.toggleConsole());

        // Preview controls
        document.getElementById('preview-pc-btn').addEventListener('click', () => this.setMiniPreviewMode('pc'));
        document.getElementById('preview-mobile-btn').addEventListener('click', () => this.setMiniPreviewMode('mobile'));

        // Fullscreen modal
        document.getElementById('close-fullscreen').addEventListener('click', () => this.closeFullscreenPreview());
        document.getElementById('fullscreen-pc-btn').addEventListener('click', () => this.setFullscreenMode('pc'));
        document.getElementById('fullscreen-mobile-btn').addEventListener('click', () => this.setFullscreenMode('mobile'));

        // Editor
        const editor = document.getElementById('code-editor');
        editor.addEventListener('input', () => this.onEditorChange());
        editor.addEventListener('scroll', () => this.updateLineNumbers());
        editor.addEventListener('contextmenu', (e) => this.showContextMenu(e));

        // Modal buttons
        document.getElementById('create-confirm').addEventListener('click', () => this.confirmCreate());
        document.getElementById('create-cancel').addEventListener('click', () => this.hideCreateModal());
        document.getElementById('rename-confirm').addEventListener('click', () => this.confirmRename());
        document.getElementById('rename-cancel').addEventListener('click', () => this.hideRenameModal());

        // File input
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileImport(e));

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        document.getElementById('context-menu').addEventListener('click', (e) => this.handleContextAction(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    // Editor Management
    initEditor() {
        const editor = document.getElementById('code-editor');
        editor.value = '<!DOCTYPE html>\n<html>\n<head>\n    <title>My App</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>';
        this.updateLineNumbers();
        this.runCode();
    }

    onEditorChange() {
        this.updateLineNumbers();
        this.applySyntaxHighlighting();
        
        if (this.currentFile) {
            this.currentFile.content = document.getElementById('code-editor').value;
            this.currentFile.lastModified = new Date().toISOString();
            this.saveFile(this.currentFile);
        }
        
        if (this.isAutoRun) {
            clearTimeout(this.autoRunTimeout);
            this.autoRunTimeout = setTimeout(() => this.runCode(), 500);
        }
    }

    updateLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lineNumbers = document.getElementById('line-numbers');
        const lines = editor.value.split('\n').length;
        
        let lineNumbersText = '';
        for (let i = 1; i <= lines; i++) {
            lineNumbersText += i + '\n';
        }
        
        lineNumbers.textContent = lineNumbersText;
        lineNumbers.scrollTop = editor.scrollTop;
    }

    applySyntaxHighlighting() {
        // Basic syntax highlighting for HTML, CSS, and JavaScript
        const editor = document.getElementById('code-editor');
        const content = editor.value;
        
        // This is a simplified version - in a real implementation,
        // you'd use a proper syntax highlighting library
        // For now, we'll just detect and log syntax errors
        this.detectSyntaxErrors(content);
    }

    detectSyntaxErrors(content) {
        const errors = [];
        
        // Basic HTML validation
        if (content.includes('<html>') && !content.includes('</html>')) {
            errors.push('Missing closing </html> tag');
        }
        
        // Basic JavaScript validation
        try {
            if (content.includes('<script>')) {
                const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/g);
                if (scriptMatch) {
                    scriptMatch.forEach(script => {
                        const jsCode = script.replace(/<\/?script>/g, '');
                        // Basic syntax check
                        new Function(jsCode);
                    });
                }
            }
        } catch (error) {
            errors.push(`JavaScript error: ${error.message}`);
        }
        
        if (errors.length > 0) {
            this.logToConsole(errors.join('\n'), 'error');
        }
    }

    // File Management
    async createDefaultFiles() {
        const defaultFile = {
            id: 'default-html',
            name: 'index.html',
            type: 'file',
            path: '/index.html',
            content: '<!DOCTYPE html>\n<html>\n<head>\n    <title>My App</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        await this.saveFile(defaultFile);
        this.currentFile = defaultFile;
        this.updateFileTree();
    }

    async loadFileTree() {
        await this.loadAllFiles();
        await this.loadAllFolders();
        this.updateFileTree();
    }

    updateFileTree() {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '';
        
        // Sort files and folders
        const sortedFiles = Array.from(this.files.values()).sort((a, b) => a.name.localeCompare(b.name));
        const sortedFolders = Array.from(this.folders.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        // Add folders first
        sortedFolders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            fileTree.appendChild(folderElement);
        });
        
        // Add files
        sortedFiles.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileTree.appendChild(fileElement);
        });
    }

    createFileElement(file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item';
        fileElement.dataset.fileId = file.id;
        
        if (this.currentFile && this.currentFile.id === file.id) {
            fileElement.classList.add('active');
        }
        
        fileElement.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
            <span>${file.name}</span>
        `;
        
        fileElement.addEventListener('click', () => this.openFile(file.id));
        fileElement.addEventListener('contextmenu', (e) => this.showFileContextMenu(e, file));
        
        return fileElement;
    }

    createFolderElement(folder) {
        const folderElement = document.createElement('div');
        folderElement.className = 'folder-item';
        folderElement.dataset.folderId = folder.id;
        
        folderElement.innerHTML = `
            <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="9,3 15,9 9,15"></polygon>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${folder.name}</span>
        `;
        
        folderElement.addEventListener('click', () => this.toggleFolder(folder.id));
        folderElement.addEventListener('contextmenu', (e) => this.showFolderContextMenu(e, folder));
        
        return folderElement;
    }

    async openFile(fileId) {
        const file = await this.loadFile(fileId);
        if (file) {
            this.currentFile = file;
            document.getElementById('code-editor').value = file.content;
            document.getElementById('current-file').textContent = file.name;
            this.updateLineNumbers();
            this.runCode();
            
            // Update active file in tree
            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
            document.querySelector(`[data-file-id="${fileId}"]`).classList.add('active');
        }
    }

    showCreateModal(type) {
        const modal = document.getElementById('create-modal');
        const title = document.getElementById('create-modal-title');
        const input = document.getElementById('create-input');
        
        title.textContent = type === 'file' ? 'Create File' : 'Create Folder';
        input.placeholder = type === 'file' ? 'Enter file name (e.g., style.css)' : 'Enter folder name';
        input.value = '';
        
        modal.classList.remove('hidden');
        modal.dataset.type = type;
        input.focus();
    }

    hideCreateModal() {
        document.getElementById('create-modal').classList.add('hidden');
    }

    async confirmCreate() {
        const modal = document.getElementById('create-modal');
        const type = modal.dataset.type;
        const name = document.getElementById('create-input').value.trim();
        
        if (!name) return;
        
        if (type === 'file') {
            await this.createFile(name);
        } else {
            await this.createFolder(name);
        }
        
        this.hideCreateModal();
        this.updateFileTree();
    }

    async createFile(name) {
        const file = {
            id: 'file-' + Date.now(),
            name: name,
            type: 'file',
            path: '/' + name,
            content: '',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        await this.saveFile(file);
    }

    async createFolder(name) {
        const folder = {
            id: 'folder-' + Date.now(),
            name: name,
            type: 'folder',
            path: '/' + name,
            created: new Date().toISOString()
        };
        
        await this.saveFolder(folder);
    }

    importFiles() {
        document.getElementById('file-input').click();
    }

    async handleFileImport(event) {
        const files = Array.from(event.target.files);
        
        for (const file of files) {
            const content = await this.readFileContent(file);
            const newFile = {
                id: 'imported-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: 'file',
                path: '/' + file.name,
                content: content,
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                originalFile: file
            };
            
            await this.saveFile(newFile);
        }
        
        this.updateFileTree();
        event.target.value = '';
    }

    readFileContent(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            if (file.type.startsWith('text/') || 
                file.name.endsWith('.html') || 
                file.name.endsWith('.css') || 
                file.name.endsWith('.js') ||
                file.name.endsWith('.json') ||
                file.name.endsWith('.xml')) {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                reader.onload = (e) => {
                    const img = `<img src="${e.target.result}" alt="${file.name}" style="max-width: 100%; height: auto;">`;
                    resolve(img);
                };
                reader.readAsDataURL(file);
            } else {
                resolve(`<!-- File: ${file.name} (${file.type}) - Binary file not displayed -->`);
            }
        });
    }

    // Preview Management
    runCode() {
        const code = document.getElementById('code-editor').value;
        const miniPreview = document.getElementById('mini-preview');
        const fullscreenPreview = document.getElementById('fullscreen-preview');
        
        try {
            // Create a blob URL for the HTML content
            const blob = new Blob([code], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            miniPreview.src = url;
            fullscreenPreview.src = url;
            
            this.logToConsole('Code executed successfully', 'info');
        } catch (error) {
            this.logToConsole(`Execution error: ${error.message}`, 'error');
        }
    }

    setPreviewMode(mode) {
        this.previewMode = mode;
        document.getElementById('pc-preview-btn').classList.toggle('active', mode === 'pc');
        document.getElementById('mobile-preview-btn').classList.toggle('active', mode === 'mobile');
    }

    setMiniPreviewMode(mode) {
        const miniPreview = document.getElementById('mini-preview');
        const pcBtn = document.getElementById('preview-pc-btn');
        const mobileBtn = document.getElementById('preview-mobile-btn');
        
        pcBtn.classList.toggle('active', mode === 'pc');
        mobileBtn.classList.toggle('active', mode === 'mobile');
        
        if (mode === 'mobile') {
            miniPreview.classList.add('mobile-mode');
        } else {
            miniPreview.classList.remove('mobile-mode');
        }
    }

    openFullscreenPreview() {
        const modal = document.getElementById('fullscreen-modal');
        modal.classList.remove('hidden');
        this.setFullscreenMode(this.previewMode);
    }

    closeFullscreenPreview() {
        document.getElementById('fullscreen-modal').classList.add('hidden');
    }

    setFullscreenMode(mode) {
        this.fullscreenMode = mode;
        const preview = document.getElementById('fullscreen-preview');
        const pcBtn = document.getElementById('fullscreen-pc-btn');
        const mobileBtn = document.getElementById('fullscreen-mobile-btn');
        
        pcBtn.classList.toggle('active', mode === 'pc');
        mobileBtn.classList.toggle('active', mode === 'mobile');
        
        if (mode === 'mobile') {
            preview.classList.add('mobile-mode');
        } else {
            preview.classList.remove('mobile-mode');
        }
    }

    // Console Management
    toggleConsole() {
        const console = document.getElementById('console-panel');
        console.classList.toggle('hidden');
    }

    clearConsole() {
        const consoleContent = document.getElementById('console-content');
        consoleContent.innerHTML = '<div class="console-message">Console cleared...</div>';
    }

    logToConsole(message, type = 'info') {
        const consoleContent = document.getElementById('console-content');
        const messageElement = document.createElement('div');
        messageElement.className = `console-message ${type}`;
        messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        consoleContent.appendChild(messageElement);
        consoleContent.scrollTop = consoleContent.scrollHeight;
    }

    // UI Management
    toggleSidebar() {
        const sidebar = document.getElementById('file-sidebar');
        const mainContent = document.querySelector('.main-content');
        
        sidebar.classList.toggle('hidden');
        mainContent.classList.toggle('sidebar-open');
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    // Context Menu
    showContextMenu(event) {
        event.preventDefault();
        const contextMenu = document.getElementById('context-menu');
        
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        contextMenu.classList.remove('hidden');
    }

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
    }

    handleContextAction(event) {
        const action = event.target.dataset.action;
        const editor = document.getElementById('code-editor');
        
        switch (action) {
            case 'select-all':
                editor.select();
                break;
            case 'copy':
                document.execCommand('copy');
                break;
            case 'cut':
                document.execCommand('cut');
                break;
            case 'paste':
                document.execCommand('paste');
                break;
        }
        
        this.hideContextMenu();
    }

    // Keyboard Shortcuts
    handleKeyboard(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    event.preventDefault();
                    this.saveCurrentFile();
                    break;
                case 'r':
                    event.preventDefault();
                    this.runCode();
                    break;
                case 'n':
                    event.preventDefault();
                    this.showCreateModal('file');
                    break;
                case '`':
                    event.preventDefault();
                    this.toggleConsole();
                    break;
            }
        }
        
        if (event.key === 'F11') {
            event.preventDefault();
            this.toggleFullscreen();
        }
    }

    async saveCurrentFile() {
        if (this.currentFile) {
            this.currentFile.content = document.getElementById('code-editor').value;
            this.currentFile.lastModified = new Date().toISOString();
            await this.saveFile(this.currentFile);
            this.logToConsole(`File saved: ${this.currentFile.name}`, 'info');
        }
    }

    // Responsive Design
    handleResize() {
        this.updateLineNumbers();
        
        // Adjust layout for mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('file-sidebar');
            const mainContent = document.querySelector('.main-content');
            
            if (!sidebar.classList.contains('hidden')) {
                mainContent.classList.remove('sidebar-open');
            }
        }
    }

    // File Context Menu
    showFileContextMenu(event, file) {
        event.preventDefault();
        event.stopPropagation();
        
        // Create custom context menu for files
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-item" data-action="open">Open</div>
            <div class="context-item" data-action="rename">Rename</div>
            <div class="context-item" data-action="delete">Delete</div>
        `;
        
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        
        document.body.appendChild(contextMenu);
        
        contextMenu.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'open':
                    this.openFile(file.id);
                    break;
                case 'rename':
                    this.showRenameModal(file);
                    break;
                case 'delete':
                    await this.deleteFile(file.id);
                    this.updateFileTree();
                    break;
            }
            
            document.body.removeChild(contextMenu);
        });
        
        // Remove context menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                }
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }

    showRenameModal(item) {
        const modal = document.getElementById('rename-modal');
        const input = document.getElementById('rename-input');
        
        input.value = item.name;
        modal.classList.remove('hidden');
        modal.dataset.itemId = item.id;
        modal.dataset.itemType = item.type;
        input.focus();
        input.select();
    }

    hideRenameModal() {
        document.getElementById('rename-modal').classList.add('hidden');
    }

    async confirmRename() {
        const modal = document.getElementById('rename-modal');
        const newName = document.getElementById('rename-input').value.trim();
        const itemId = modal.dataset.itemId;
        const itemType = modal.dataset.itemType;
        
        if (!newName) return;
        
        if (itemType === 'file') {
            const file = await this.loadFile(itemId);
            if (file) {
                file.name = newName;
                file.path = '/' + newName;
                file.lastModified = new Date().toISOString();
                await this.saveFile(file);
            }
        } else {
            const folder = this.folders.get(itemId);
            if (folder) {
                folder.name = newName;
                folder.path = '/' + newName;
                await this.saveFolder(folder);
            }
        }
        
        this.hideRenameModal();
        this.updateFileTree();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.codeCompiler = new CodeCompiler();
});

// Handle iframe console messages
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'console') {
        window.codeCompiler.logToConsole(event.data.message, event.data.level);
    }
});

// Capture console messages from preview iframe
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Override console methods to capture messages
['log', 'error', 'warn', 'info'].forEach(method => {
    console[method] = function(...args) {
        originalConsole[method].apply(console, args);
        
        if (window.codeCompiler) {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            window.codeCompiler.logToConsole(message, method === 'log' ? 'info' : method);
        }
    };
});

