class StorageManager {
    constructor() {
        this.dbName = 'WebIDE';
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create files store
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', { keyPath: 'path' });
                    filesStore.createIndex('parentPath', 'parentPath', { unique: false });
                    filesStore.createIndex('name', 'name', { unique: false });
                }

                // Create folders store
                if (!db.objectStoreNames.contains('folders')) {
                    const foldersStore = db.createObjectStore('folders', { keyPath: 'path' });
                    foldersStore.createIndex('parentPath', 'parentPath', { unique: false });
                    foldersStore.createIndex('name', 'name', { unique: false });
                }

                // Create project settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async createFile(path, content = '', parentPath = '/') {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        const file = {
            path: path,
            name: path.split('/').pop(),
            content: content,
            parentPath: parentPath,
            type: this.getFileType(path),
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(file);
            request.onsuccess = () => resolve(file);
            request.onerror = () => reject(request.error);
        });
    }

    async updateFile(path, content) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(path);
            getRequest.onsuccess = () => {
                const file = getRequest.result;
                if (file) {
                    file.content = content;
                    file.modifiedAt = new Date().toISOString();
                    
                    const updateRequest = store.put(file);
                    updateRequest.onsuccess = () => resolve(file);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('File not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getFile(path) {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.get(path);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(path) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(path);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async createFolder(path, parentPath = '/') {
        const transaction = this.db.transaction(['folders'], 'readwrite');
        const store = transaction.objectStore('folders');
        
        const folder = {
            path: path,
            name: path.split('/').pop(),
            parentPath: parentPath,
            createdAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(folder);
            request.onsuccess = () => resolve(folder);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFolder(path) {
        const transaction = this.db.transaction(['folders', 'files'], 'readwrite');
        const foldersStore = transaction.objectStore('folders');
        const filesStore = transaction.objectStore('files');
        
        return new Promise(async (resolve, reject) => {
            try {
                // Delete all files in the folder
                const files = await this.getFilesInFolder(path);
                for (const file of files) {
                    await this.deleteFile(file.path);
                }

                // Delete all subfolders
                const subfolders = await this.getFoldersInFolder(path);
                for (const subfolder of subfolders) {
                    await this.deleteFolder(subfolder.path);
                }

                // Delete the folder itself
                const request = foldersStore.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getFilesInFolder(folderPath) {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('parentPath');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(folderPath);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getFoldersInFolder(folderPath) {
        const transaction = this.db.transaction(['folders'], 'readonly');
        const store = transaction.objectStore('folders');
        const index = store.index('parentPath');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(folderPath);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFiles() {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFolders() {
        const transaction = this.db.transaction(['folders'], 'readonly');
        const store = transaction.objectStore('folders');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async importFiles(files) {
        const results = [];
        for (const file of files) {
            try {
                const content = await this.readFileContent(file);
                const filePath = '/' + file.name;
                const savedFile = await this.createFile(filePath, content, '/');
                results.push(savedFile);
            } catch (error) {
                console.error('Failed to import file:', file.name, error);
            }
        }
        return results;
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    async exportProject() {
        const files = await this.getAllFiles();
        const folders = await this.getAllFolders();
        
        const project = {
            files: files,
            folders: folders,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project-export.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    async importProject(file) {
        try {
            const content = await this.readFileContent(file);
            const project = JSON.parse(content);
            
            // Clear existing data
            await this.clearAll();
            
            // Import folders first
            for (const folder of project.folders || []) {
                await this.createFolder(folder.path, folder.parentPath);
            }
            
            // Import files
            for (const file of project.files || []) {
                await this.createFile(file.path, file.content, file.parentPath);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import project:', error);
            return false;
        }
    }

    async clearAll() {
        const transaction = this.db.transaction(['files', 'folders'], 'readwrite');
        const filesStore = transaction.objectStore('files');
        const foldersStore = transaction.objectStore('folders');
        
        return Promise.all([
            new Promise((resolve, reject) => {
                const request = filesStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = foldersStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    }

    getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const typeMap = {
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'js': 'javascript',
            'json': 'json',
            'xml': 'xml',
            'md': 'markdown',
            'txt': 'text'
        };
        return typeMap[extension] || 'text';
    }

    async setSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }
}

// Global storage instance
window.storage = new StorageManager();

class FileManager {
    constructor() {
        this.fileTree = document.getElementById('fileTree');
        this.fileInput = document.getElementById('fileInput');
        this.currentPath = '/';
        this.expandedFolders = new Set(['/']);
        this.selectedFile = null;
        
        this.init();
    }

    async init() {
        // Wait for storage to be ready
        if (!window.storage.db) {
            await window.storage.init();
        }

        this.setupEventListeners();
        await this.loadFileTree();
        await this.initializeDefaultProject();
    }

    setupEventListeners() {
        // New file button
        document.getElementById('newFile').addEventListener('click', () => {
            this.createNewFile();
        });

        // New folder button
        document.getElementById('newFolder').addEventListener('click', () => {
            this.createNewFolder();
        });

        // Import file button
        document.getElementById('importFile').addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e.target.files);
        });

        // File explorer toggle
        document.getElementById('toggleExplorer').addEventListener('click', () => {
            this.toggleExplorer();
        });
    }

    async loadFileTree() {
        try {
            const files = await window.storage.getAllFiles();
            const folders = await window.storage.getAllFolders();
            
            this.renderFileTree(files, folders);
        } catch (error) {
            console.error('Failed to load file tree:', error);
        }
    }

    renderFileTree(files, folders) {
        this.fileTree.innerHTML = '';
        
        // Create root structure
        const rootItems = this.buildTreeStructure(files, folders);
        this.renderTreeItems(rootItems, this.fileTree, '/');
    }

    buildTreeStructure(files, folders) {
        const structure = {};
        
        // Add folders
        folders.forEach(folder => {
            const parts = folder.path.split('/').filter(p => p);
            let current = structure;
            
            parts.forEach((part, index) => {
                const path = '/' + parts.slice(0, index + 1).join('/');
                if (!current[part]) {
                    current[part] = {
                        type: 'folder',
                        path: path,
                        name: part,
                        children: {}
                    };
                }
                current = current[part].children;
            });
        });

        // Add files
        files.forEach(file => {
            const parts = file.path.split('/').filter(p => p);
            if (parts.length === 1) {
                // Root level file
                structure[file.name] = {
                    type: 'file',
                    path: file.path,
                    name: file.name,
                    content: file.content,
                    fileType: file.type
                };
            } else {
                // File in folder
                let current = structure;
                const folderParts = parts.slice(0, -1);
                const fileName = parts[parts.length - 1];
                
                folderParts.forEach(part => {
                    if (current[part] && current[part].children) {
                        current = current[part].children;
                    }
                });
                
                current[fileName] = {
                    type: 'file',
                    path: file.path,
                    name: file.name,
                    content: file.content,
                    fileType: file.type
                };
            }
        });

        return structure;
    }

    renderTreeItems(items, container, parentPath) {
        Object.keys(items).sort((a, b) => {
            const aItem = items[a];
            const bItem = items[b];
            
            // Folders first, then files
            if (aItem.type !== bItem.type) {
                return aItem.type === 'folder' ? -1 : 1;
            }
            
            return a.localeCompare(b);
        }).forEach(key => {
            const item = items[key];
            const element = this.createTreeItem(item, parentPath);
            container.appendChild(element);
            
            if (item.type === 'folder' && this.expandedFolders.has(item.path)) {
                const childContainer = element.querySelector('.folder-contents');
                if (childContainer && item.children) {
                    this.renderTreeItems(item.children, childContainer, item.path);
                }
            }
        });
    }

    createTreeItem(item, parentPath) {
        const element = document.createElement('div');
        
        if (item.type === 'folder') {
            element.className = 'folder-item';
            if (this.expandedFolders.has(item.path)) {
                element.classList.add('expanded');
            }
            
            element.innerHTML = `
                <i class="fas fa-chevron-right"></i>
                <i class="fas fa-folder"></i>
                <span class="item-name">${item.name}</span>
                <div class="folder-contents"></div>
            `;
            
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFolder(item.path, element);
            });
        } else {
            element.className = 'file-item';
            const icon = this.getFileIcon(item.fileType);
            
            element.innerHTML = `
                <i class="${icon}"></i>
                <span class="item-name">${item.name}</span>
            `;
            
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectFile(item, element);
            });
        }
        
        // Add context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showItemContextMenu(e, item);
        });
        
        return element;
    }

    getFileIcon(fileType) {
        const iconMap = {
            'html': 'fab fa-html5',
            'css': 'fab fa-css3-alt',
            'javascript': 'fab fa-js-square',
            'json': 'fas fa-code',
            'xml': 'fas fa-code',
            'markdown': 'fab fa-markdown',
            'text': 'fas fa-file-alt'
        };
        return iconMap[fileType] || 'fas fa-file';
    }

    async toggleFolder(path, element) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
            element.classList.remove('expanded');
            element.querySelector('.folder-contents').innerHTML = '';
        } else {
            this.expandedFolders.add(path);
            element.classList.add('expanded');
            
            try {
                const files = await window.storage.getFilesInFolder(path);
                const folders = await window.storage.getFoldersInFolder(path);
                const structure = this.buildTreeStructure(files, folders);
                const container = element.querySelector('.folder-contents');
                this.renderTreeItems(structure, container, path);
            } catch (error) {
                console.error('Failed to load folder contents:', error);
            }
        }
    }

    selectFile(item, element) {
        // Remove previous selection
        document.querySelectorAll('.file-item.active').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add selection to current item
        element.classList.add('active');
        this.selectedFile = item;
        
        // Notify editor to open file
        if (window.editor) {
            window.editor.openFile(item);
        }
    }

    async createNewFile() {
        const name = prompt('Enter file name:');
        if (!name) return;
        
        const path = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
        
        try {
            const file = await window.storage.createFile(path, '', this.currentPath);
            await this.loadFileTree();
            
            // Auto-select the new file
            setTimeout(() => {
                const fileElement = this.findFileElement(path);
                if (fileElement) {
                    this.selectFile(file, fileElement);
                }
            }, 100);
        } catch (error) {
            alert('Failed to create file: ' + error.message);
        }
    }

    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (!name) return;
        
        const path = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
        
        try {
            await window.storage.createFolder(path, this.currentPath);
            await this.loadFileTree();
        } catch (error) {
            alert('Failed to create folder: ' + error.message);
        }
    }

    async handleFileImport(files) {
        try {
            const importedFiles = await window.storage.importFiles(files);
            await this.loadFileTree();
            
            if (importedFiles.length > 0) {
                // Auto-select the first imported file
                setTimeout(() => {
                    const fileElement = this.findFileElement(importedFiles[0].path);
                    if (fileElement) {
                        this.selectFile(importedFiles[0], fileElement);
                    }
                }, 100);
            }
        } catch (error) {
            alert('Failed to import files: ' + error.message);
        }
    }

    findFileElement(path) {
        const elements = document.querySelectorAll('.file-item');
        for (const element of elements) {
            const nameSpan = element.querySelector('.item-name');
            if (nameSpan && path.endsWith(nameSpan.textContent)) {
                return element;
            }
        }
        return null;
    }

    toggleExplorer() {
        const explorer = document.getElementById('fileExplorer');
        const mainContainer = document.querySelector('.main-container');
        const toggleBtn = document.getElementById('toggleExplorer');
        
        explorer.classList.toggle('collapsed');
        mainContainer.classList.toggle('explorer-open');
        toggleBtn.classList.toggle('active');
    }

    showItemContextMenu(event, item) {
        // This will be implemented with the context menu system
        console.log('Context menu for:', item);
    }

    async deleteItem(item) {
        if (!confirm(`Are you sure you want to delete ${item.name}?`)) {
            return;
        }
        
        try {
            if (item.type === 'file') {
                await window.storage.deleteFile(item.path);
            } else {
                await window.storage.deleteFolder(item.path);
            }
            await this.loadFileTree();
        } catch (error) {
            alert('Failed to delete item: ' + error.message);
        }
    }

    async initializeDefaultProject() {
        try {
            const files = await window.storage.getAllFiles();
            if (files.length === 0) {
                // Create default project files
                await this.createDefaultProject();
                await this.loadFileTree();
            }
        } catch (error) {
            console.error('Failed to initialize default project:', error);
        }
    }

    async createDefaultProject() {
        console.log('Creating default project with animated Indian flag...');
        
        // Create HTML file
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vande Mataram - Animated Indian Flag</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">🇮🇳 Vande Mataram 🇮🇳</h1>
            <p class="subtitle">I bow to thee, Mother India</p>
        </header>
        
        <div class="flag-container">
            <div class="flag">
                <div class="stripe saffron"></div>
                <div class="stripe white">
                    <div class="chakra">
                        <div class="chakra-center"></div>
                        <div class="spokes"></div>
                    </div>
                </div>
                <div class="stripe green"></div>
            </div>
            <div class="flagpole"></div>
        </div>
        
        <div class="content">
            <div class="verse">
                <p class="sanskrit">वन्दे मातरम्</p>
                <p class="translation">I bow to thee, Mother</p>
            </div>
            
            <div class="message">
                <p>This animated Indian flag represents the pride, unity, and diversity of our great nation.</p>
                <p>The saffron represents courage and sacrifice, white represents truth and peace, and green represents faith and chivalry.</p>
                <p>The Ashoka Chakra in the center symbolizes the eternal wheel of law.</p>
            </div>
        </div>
        
        <div class="particles"></div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;

        // Create CSS file
        const cssContent = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Georgia', serif;
    background: linear-gradient(135deg, #ff9933 0%, #ffffff 50%, #138808 100%);
    min-height: 100vh;
    overflow-x: hidden;
    position: relative;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
    position: relative;
    z-index: 2;
}

.header {
    margin-bottom: 40px;
    animation: fadeInDown 1s ease-out;
}

.title {
    font-size: 3.5rem;
    color: #2c3e50;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    margin-bottom: 10px;
    animation: glow 2s ease-in-out infinite alternate;
}

.subtitle {
    font-size: 1.5rem;
    color: #34495e;
    font-style: italic;
    opacity: 0.8;
}

.flag-container {
    position: relative;
    display: inline-block;
    margin: 40px 0;
    animation: slideInUp 1.5s ease-out;
}

.flag {
    width: 400px;
    height: 267px;
    border: 3px solid #2c3e50;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    position: relative;
    animation: wave 3s ease-in-out infinite;
    transform-origin: left center;
}

.stripe {
    width: 100%;
    height: 33.33%;
    position: relative;
    overflow: hidden;
}

.saffron {
    background: linear-gradient(90deg, #ff9933, #ff7700, #ff9933);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
}

.white {
    background: linear-gradient(90deg, #ffffff, #f8f9fa, #ffffff);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite 0.5s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.green {
    background: linear-gradient(90deg, #138808, #0d5f0d, #138808);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite 1s;
}

.chakra {
    width: 60px;
    height: 60px;
    border: 3px solid #000080;
    border-radius: 50%;
    position: relative;
    animation: rotate 10s linear infinite;
}

.chakra-center {
    width: 8px;
    height: 8px;
    background: #000080;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.spokes {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
}

.spokes::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 2px;
    height: 100%;
    background: #000080;
    transform: translateX(-50%);
    box-shadow: 
        0 0 0 0 #000080,
        0 0 0 0 #000080;
}

.spokes::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 2px;
    background: #000080;
    transform: translateY(-50%);
}

.flagpole {
    width: 8px;
    height: 400px;
    background: linear-gradient(to bottom, #8b4513, #654321);
    position: absolute;
    left: -8px;
    top: -50px;
    border-radius: 4px;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.3);
}

.content {
    margin-top: 60px;
    animation: fadeInUp 2s ease-out 1s both;
}

.verse {
    margin-bottom: 40px;
    padding: 30px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 15px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

.sanskrit {
    font-size: 2.5rem;
    color: #d35400;
    font-weight: bold;
    margin-bottom: 15px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
}

.translation {
    font-size: 1.3rem;
    color: #2c3e50;
    font-style: italic;
}

.message {
    background: rgba(255, 255, 255, 0.8);
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(5px);
}

.message p {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #2c3e50;
    margin-bottom: 15px;
}

.particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

/* Animations */
@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(100px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes wave {
    0%, 100% {
        transform: perspective(400px) rotateY(0deg);
    }
    25% {
        transform: perspective(400px) rotateY(-5deg);
    }
    75% {
        transform: perspective(400px) rotateY(5deg);
    }
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

@keyframes rotate {
    from {
        transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
        transform: translate(-50%, -50%) rotate(360deg);
    }
}

@keyframes glow {
    from {
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }
    to {
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 153, 51, 0.5);
    }
}

@keyframes float {
    0%, 100% {
        transform: translateY(0px);
    }
    50% {
        transform: translateY(-20px);
    }
}

/* Responsive Design */
@media (max-width: 768px) {
    .title {
        font-size: 2.5rem;
    }
    
    .subtitle {
        font-size: 1.2rem;
    }
    
    .flag {
        width: 300px;
        height: 200px;
    }
    
    .chakra {
        width: 45px;
        height: 45px;
    }
    
    .sanskrit {
        font-size: 2rem;
    }
    
    .translation {
        font-size: 1.1rem;
    }
    
    .message p {
        font-size: 1rem;
    }
}

@media (max-width: 480px) {
    .container {
        padding: 15px;
    }
    
    .title {
        font-size: 2rem;
    }
    
    .flag {
        width: 250px;
        height: 167px;
    }
    
    .chakra {
        width: 35px;
        height: 35px;
    }
    
    .verse, .message {
        padding: 20px;
    }
}`;

        // Create JavaScript file
        const jsContent = `// Animated Indian Flag with Particles
class FlagAnimation {
    constructor() {
        this.particles = [];
        this.particleContainer = document.querySelector('.particles');
        this.colors = ['#ff9933', '#ffffff', '#138808', '#000080'];
        this.init();
    }

    init() {
        this.createParticles();
        this.animateParticles();
        this.addInteractivity();
        this.createSpokes();
        this.addPatrioticQuotes();
    }

    createParticles() {
        for (let i = 0; i < 50; i++) {
            this.createParticle();
        }
    }

    createParticle() {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 6 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = this.colors[Math.floor(Math.random() * this.colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.opacity = Math.random() * 0.7 + 0.3;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.pointerEvents = 'none';
        
        // Add animation
        particle.style.animation = \`float \${Math.random() * 3 + 2}s ease-in-out infinite\`;
        particle.style.animationDelay = Math.random() * 2 + 's';
        
        this.particleContainer.appendChild(particle);
        this.particles.push({
            element: particle,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2
        });
    }

    animateParticles() {
        setInterval(() => {
            this.particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                // Bounce off edges
                if (particle.x <= 0 || particle.x >= window.innerWidth) {
                    particle.vx *= -1;
                }
                if (particle.y <= 0 || particle.y >= window.innerHeight) {
                    particle.vy *= -1;
                }
                
                particle.element.style.left = particle.x + 'px';
                particle.element.style.top = particle.y + 'px';
            });
        }, 50);
    }

    createSpokes() {
        const chakra = document.querySelector('.chakra');
        if (!chakra) return;
        
        // Create 24 spokes for the Ashoka Chakra
        for (let i = 0; i < 24; i++) {
            const spoke = document.createElement('div');
            spoke.style.position = 'absolute';
            spoke.style.width = '2px';
            spoke.style.height = '25px';
            spoke.style.background = '#000080';
            spoke.style.top = '50%';
            spoke.style.left = '50%';
            spoke.style.transformOrigin = '1px 0px';
            spoke.style.transform = \`translate(-50%, -100%) rotate(\${i * 15}deg)\`;
            chakra.appendChild(spoke);
        }
    }

    addInteractivity() {
        const flag = document.querySelector('.flag');
        const title = document.querySelector('.title');
        
        // Flag hover effect
        flag.addEventListener('mouseenter', () => {
            flag.style.animation = 'wave 1s ease-in-out infinite';
            flag.style.transform = 'scale(1.05)';
            flag.style.transition = 'transform 0.3s ease';
        });
        
        flag.addEventListener('mouseleave', () => {
            flag.style.animation = 'wave 3s ease-in-out infinite';
            flag.style.transform = 'scale(1)';
        });
        
        // Title click effect
        title.addEventListener('click', () => {
            this.showPatrioticMessage();
        });
        
        // Add click sound effect (visual feedback)
        document.addEventListener('click', (e) => {
            this.createClickEffect(e.clientX, e.clientY);
        });
    }

    createClickEffect(x, y) {
        const effect = document.createElement('div');
        effect.style.position = 'fixed';
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        effect.style.width = '20px';
        effect.style.height = '20px';
        effect.style.background = 'radial-gradient(circle, #ff9933, transparent)';
        effect.style.borderRadius = '50%';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '9999';
        effect.style.animation = 'clickEffect 0.6s ease-out forwards';
        
        document.body.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 600);
    }

    showPatrioticMessage() {
        const messages = [
            'Unity in Diversity - Our Strength!',
            'Satyameva Jayate - Truth Alone Triumphs!',
            'Jai Hind! Victory to India!',
            'Incredible India - Land of Dreams!',
            'Vasudhaiva Kutumbakam - The World is One Family!'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        // Create floating message
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.position = 'fixed';
        messageEl.style.top = '20%';
        messageEl.style.left = '50%';
        messageEl.style.transform = 'translateX(-50%)';
        messageEl.style.background = 'rgba(255, 255, 255, 0.95)';
        messageEl.style.padding = '15px 25px';
        messageEl.style.borderRadius = '25px';
        messageEl.style.fontSize = '1.2rem';
        messageEl.style.fontWeight = 'bold';
        messageEl.style.color = '#2c3e50';
        messageEl.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
        messageEl.style.zIndex = '10000';
        messageEl.style.animation = 'messageFloat 3s ease-out forwards';
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    addPatrioticQuotes() {
        const quotes = [
            'Freedom is not given, it is taken. - Netaji Subhas Chandra Bose',
            'In a gentle way, you can shake the world. - Mahatma Gandhi',
            'You must be the change you wish to see in the world. - Mahatma Gandhi',
            'Arise, awake and stop not until the goal is reached. - Swami Vivekananda',
            'The best way to find yourself is to lose yourself in the service of others. - Mahatma Gandhi'
        ];
        
        let quoteIndex = 0;
        
        setInterval(() => {
            console.log('🇮🇳 ' + quotes[quoteIndex]);
            quoteIndex = (quoteIndex + 1) % quotes.length;
        }, 10000);
    }
}

// Additional CSS animations via JavaScript
const additionalStyles = \`
@keyframes clickEffect {
    0% {
        transform: translate(-50%, -50%) scale(0);
        opacity: 1;
    }
    100% {
        transform: translate(-50%, -50%) scale(3);
        opacity: 0;
    }
}

@keyframes messageFloat {
    0% {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
    }
    20% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
    80% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
    100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
    }
}
\`;

// Inject additional styles
const additionalStyleSheet = document.createElement('style');
additionalStyleSheet.textContent = additionalStyles;
document.head.appendChild(additionalStyleSheet);

// Initialize the animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FlagAnimation();
    
    // Welcome message
    console.log('🇮🇳 Welcome to the Animated Indian Flag Demo!');
    console.log('🎯 Click on the title for patriotic messages!');
    console.log('🌟 Hover over the flag to see it wave!');
    console.log('✨ Vande Mataram! Jai Hind!');
});

// Export for potential use
window.FlagAnimation = FlagAnimation;`;

        try {
            // Create the default project files
            await window.storage.createFile('/index.html', htmlContent, '/');
            await window.storage.createFile('/styles.css', cssContent, '/');
            await window.storage.createFile('/script.js', jsContent, '/');
            
            console.log('Default project created successfully!');
        } catch (error) {
            console.error('Failed to create default project:', error);
        }
    }
}

// Initialize file manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManager();
});

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

class Preview {
    constructor() {
        this.previewContainer = document.getElementById('previewContainer');
        this.desktopView = document.getElementById('desktopView');
        this.mobileView = document.getElementById('mobileView');
        this.previewFrame = document.getElementById('previewFrame');
        this.mobilePreviewFrame = document.getElementById('mobilePreviewFrame');
        this.currentMode = 'desktop';
        this.isFullscreen = false;
        this.updateTimeout = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIframeHandlers();
        this.updatePreview();
    }

    setupEventListeners() {
        // View mode toggle
        document.getElementById('toggleViewMode').addEventListener('click', () => {
            this.toggleViewMode();
        });

        // Fullscreen toggle
        document.getElementById('toggleFullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Refresh preview
        document.getElementById('refreshPreview').addEventListener('click', () => {
            this.refreshPreview();
        });

        // Handle window resize for scaling
        window.addEventListener('resize', () => {
            this.updateScaling();
        });
    }

    setupIframeHandlers() {
        // Setup message handling for console capture
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'console') {
                if (window.consoleManager) {
                    window.consoleManager.addLog(event.data.level, event.data.message);
                }
            }
        });

        // Setup iframe load handlers
        this.previewFrame.addEventListener('load', () => {
            this.injectConsoleCapture(this.previewFrame);
            this.updateScaling();
        });

        this.mobilePreviewFrame.addEventListener('load', () => {
            this.injectConsoleCapture(this.mobilePreviewFrame);
        });
    }

    injectConsoleCapture(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Inject console capture script
            const script = iframeDoc.createElement('script');
            script.textContent = `
                (function() {
                    const originalLog = console.log;
                    const originalError = console.error;
                    const originalWarn = console.warn;
                    const originalInfo = console.info;
                    
                    function sendToParent(level, args) {
                        const message = Array.from(args).map(arg => {
                            if (typeof arg === 'object') {
                                try {
                                    return JSON.stringify(arg, null, 2);
                                } catch (e) {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        }).join(' ');
                        
                        window.parent.postMessage({
                            type: 'console',
                            level: level,
                            message: message
                        }, '*');
                    }
                    
                    console.log = function(...args) {
                        originalLog.apply(console, args);
                        sendToParent('log', args);
                    };
                    
                    console.error = function(...args) {
                        originalError.apply(console, args);
                        sendToParent('error', args);
                    };
                    
                    console.warn = function(...args) {
                        originalWarn.apply(console, args);
                        sendToParent('warn', args);
                    };
                    
                    console.info = function(...args) {
                        originalInfo.apply(console, args);
                        sendToParent('info', args);
                    };
                    
                    // Capture errors
                    window.addEventListener('error', function(e) {
                        sendToParent('error', [e.message + ' at ' + e.filename + ':' + e.lineno]);
                    });
                    
                    // Capture unhandled promise rejections
                    window.addEventListener('unhandledrejection', function(e) {
                        sendToParent('error', ['Unhandled promise rejection:', e.reason]);
                    });
                })();
            `;
            
            iframeDoc.head.appendChild(script);
        } catch (error) {
            console.error('Failed to inject console capture:', error);
        }
    }

    async updatePreview() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(async () => {
            await this.generatePreview();
        }, 300); // Debounce updates
    }

    async generatePreview() {
        try {
            const files = await window.storage.getAllFiles();
            const htmlContent = this.buildPreviewHTML(files);
            
            // Update both iframes
            this.updateIframe(this.previewFrame, htmlContent);
            this.updateIframe(this.mobilePreviewFrame, htmlContent);
            
        } catch (error) {
            console.error('Failed to generate preview:', error);
        }
    }

    buildPreviewHTML(files) {
        let htmlFile = files.find(f => f.name.endsWith('.html') || f.type === 'html');
        let cssFiles = files.filter(f => f.type === 'css');
        let jsFiles = files.filter(f => f.type === 'javascript');
        
        // If no HTML file, create a basic structure
        if (!htmlFile) {
            htmlFile = {
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
</head>
<body>
    <h1>No HTML file found</h1>
    <p>Create an HTML file to see the preview.</p>
</body>
</html>`
            };
        }
        
        let html = htmlFile.content;
        
        // Inject CSS
        if (cssFiles.length > 0) {
            const cssContent = cssFiles.map(f => f.content).join('\n');
            const styleTag = `<style>\n${cssContent}\n</style>`;
            
            if (html.includes('</head>')) {
                html = html.replace('</head>', `${styleTag}\n</head>`);
            } else {
                html = `<style>\n${cssContent}\n</style>\n${html}`;
            }
        }
        
        // Inject JavaScript
        if (jsFiles.length > 0) {
            const jsContent = jsFiles.map(f => f.content).join('\n');
            const scriptTag = `<script>\n${jsContent}\n</script>`;
            
            if (html.includes('</body>')) {
                html = html.replace('</body>', `${scriptTag}\n</body>`);
            } else {
                html = `${html}\n<script>\n${jsContent}\n</script>`;
            }
        }
        
        return html;
    }

    updateIframe(iframe, content) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(content);
            doc.close();
        } catch (error) {
            console.error('Failed to update iframe:', error);
        }
    }

    toggleViewMode() {
        const toggleBtn = document.getElementById('toggleViewMode');
        const icon = toggleBtn.querySelector('i');
        
        if (this.currentMode === 'desktop') {
            this.currentMode = 'mobile';
            this.desktopView.style.display = 'none';
            this.mobileView.style.display = 'flex';
            icon.className = 'fas fa-mobile-alt';
            toggleBtn.title = 'Switch to Desktop View';
        } else {
            this.currentMode = 'desktop';
            this.desktopView.style.display = 'block';
            this.mobileView.style.display = 'none';
            icon.className = 'fas fa-desktop';
            toggleBtn.title = 'Switch to Mobile View';
            this.updateScaling();
        }
    }

    updateScaling() {
        if (this.currentMode !== 'desktop') return;
        
        const container = this.desktopView;
        const iframe = this.previewFrame;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const targetWidth = 1280;
        const targetHeight = 720;
        
        const scaleX = containerWidth / targetWidth;
        const scaleY = containerHeight / targetHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        iframe.style.width = `${targetWidth}px`;
        iframe.style.height = `${targetHeight}px`;
        iframe.style.transform = `scale(${scale})`;
        iframe.style.transformOrigin = 'top left';
        
        // Adjust container to center the scaled iframe
        const scaledWidth = targetWidth * scale;
        const scaledHeight = targetHeight * scale;
        
        if (scaledWidth < containerWidth) {
            iframe.style.left = `${(containerWidth - scaledWidth) / 2}px`;
        } else {
            iframe.style.left = '0px';
        }
        
        if (scaledHeight < containerHeight) {
            iframe.style.top = `${(containerHeight - scaledHeight) / 2}px`;
        } else {
            iframe.style.top = '0px';
        }
    }

    toggleFullscreen() {
        const previewPanel = document.querySelector('.preview-panel');
        const toggleBtn = document.getElementById('toggleFullscreen');
        const icon = toggleBtn.querySelector('i');
        
        if (!this.isFullscreen) {
            previewPanel.classList.add('fullscreen');
            icon.className = 'fas fa-compress';
            toggleBtn.title = 'Exit Fullscreen';
            this.isFullscreen = true;
            document.body.style.overflow = 'hidden';
        } else {
            previewPanel.classList.remove('fullscreen');
            icon.className = 'fas fa-expand';
            toggleBtn.title = 'Toggle Fullscreen';
            this.isFullscreen = false;
            document.body.style.overflow = '';
        }
        
        // Update scaling after fullscreen change
        setTimeout(() => {
            this.updateScaling();
        }, 100);
    }

    refreshPreview() {
        this.generatePreview();
        
        // Visual feedback
        const refreshBtn = document.getElementById('refreshPreview');
        const icon = refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        
        setTimeout(() => {
            icon.classList.remove('fa-spin');
        }, 1000);
    }

    clearPreview() {
        const emptyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
</head>
<body>
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; color: #666;">
        <p>No file selected</p>
    </div>
</body>
</html>`;
        
        this.updateIframe(this.previewFrame, emptyHTML);
        this.updateIframe(this.mobilePreviewFrame, emptyHTML);
    }

    getCurrentMode() {
        return this.currentMode;
    }

    setMode(mode) {
        if (mode !== this.currentMode) {
            this.toggleViewMode();
        }
    }
}

// Add fullscreen styles
const fullscreenStyles = `
.preview-panel.fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
    border: none !important;
}

.editor-panel.fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999 !important;
}
`;

// Inject fullscreen styles
const fullscreenStyleSheet = document.createElement('style');
fullscreenStyleSheet.textContent = fullscreenStyles;
document.head.appendChild(fullscreenStyleSheet);

// Initialize preview when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.preview = new Preview();
});

class ConsoleManager {
    constructor() {
        this.console = document.getElementById('console');
        this.consoleOutput = document.getElementById('consoleOutput');
        this.isOpen = false;
        this.logs = [];
        this.maxLogs = 1000; // Maximum number of logs to keep
        this.autoScroll = true;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.addWelcomeMessage();
    }

    setupEventListeners() {
        // Console toggle button
        document.getElementById('toggleConsole').addEventListener('click', () => {
            this.toggle();
        });

        // Clear console button
        document.getElementById('clearConsole').addEventListener('click', () => {
            this.clear();
        });

        // Auto-scroll toggle on scroll
        this.consoleOutput.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this.consoleOutput;
            this.autoScroll = scrollTop + clientHeight >= scrollHeight - 10;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + ` to toggle console
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                this.toggle();
            }
            
            // Ctrl/Cmd + K to clear console (when console is focused)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && this.isOpen) {
                e.preventDefault();
                this.clear();
            }
        });

        // Handle window resize to adjust console height
        window.addEventListener('resize', () => {
            this.adjustHeight();
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.console.classList.add('open');
        this.isOpen = true;
        
        // Update toggle button
        const toggleBtn = document.getElementById('toggleConsole');
        toggleBtn.classList.add('active');
        
        // Scroll to bottom if auto-scroll is enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Adjust main container height
        this.adjustMainContainer();
    }

    close() {
        this.console.classList.remove('open');
        this.isOpen = false;
        
        // Update toggle button
        const toggleBtn = document.getElementById('toggleConsole');
        toggleBtn.classList.remove('active');
        
        // Restore main container height
        this.adjustMainContainer();
    }

    adjustMainContainer() {
        const mainContainer = document.querySelector('.main-container');
        if (this.isOpen) {
            mainContainer.style.height = 'calc(100vh - 48px - 200px)';
        } else {
            mainContainer.style.height = 'calc(100vh - 48px)';
        }
        
        // Refresh editor and preview
        if (window.editor) {
            setTimeout(() => window.editor.refresh(), 100);
        }
        if (window.preview) {
            setTimeout(() => window.preview.updateScaling(), 100);
        }
    }

    adjustHeight() {
        if (this.isOpen) {
            this.adjustMainContainer();
        }
    }

    addLog(level, message, timestamp = new Date()) {
        const logEntry = {
            level: level,
            message: message,
            timestamp: timestamp,
            id: Date.now() + Math.random()
        };
        
        this.logs.push(logEntry);
        
        // Remove old logs if we exceed the maximum
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Add to DOM
        this.renderLog(logEntry);
        
        // Auto-scroll if enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Auto-open console on errors
        if (level === 'error' && !this.isOpen) {
            this.open();
        }
    }

    renderLog(logEntry) {
        const logElement = document.createElement('div');
        logElement.className = `console-log ${logEntry.level}`;
        logElement.dataset.id = logEntry.id;
        
        const timestamp = this.formatTimestamp(logEntry.timestamp);
        const levelIcon = this.getLevelIcon(logEntry.level);
        
        logElement.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-level">${levelIcon}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;
        
        this.consoleOutput.appendChild(logElement);
        
        // Limit DOM elements to prevent performance issues
        const logElements = this.consoleOutput.children;
        if (logElements.length > this.maxLogs) {
            logElements[0].remove();
        }
    }

    getLevelIcon(level) {
        const icons = {
            'log': '📝',
            'info': 'ℹ️',
            'warn': '⚠️',
            'error': '❌'
        };
        return icons[level] || '📝';
    }

    formatTimestamp(timestamp) {
        return timestamp.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clear() {
        this.logs = [];
        this.consoleOutput.innerHTML = '';
        this.addWelcomeMessage();
        
        // Visual feedback
        const clearBtn = document.getElementById('clearConsole');
        const originalIcon = clearBtn.innerHTML;
        clearBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            clearBtn.innerHTML = originalIcon;
        }, 1000);
    }

    scrollToBottom() {
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    addWelcomeMessage() {
        this.addLog('info', 'Console ready. Logs from the preview will appear here.');
    }

    // Public methods for external logging
    log(message) {
        this.addLog('log', message);
    }

    info(message) {
        this.addLog('info', message);
    }

    warn(message) {
        this.addLog('warn', message);
    }

    error(message) {
        this.addLog('error', message);
    }

    // Export logs functionality
    exportLogs() {
        const logsText = this.logs.map(log => {
            return `[${this.formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`;
        }).join('\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Filter logs by level
    filterLogs(level) {
        const logElements = this.consoleOutput.querySelectorAll('.console-log');
        
        logElements.forEach(element => {
            if (level === 'all' || element.classList.contains(level)) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Search logs
    searchLogs(query) {
        const logElements = this.consoleOutput.querySelectorAll('.console-log');
        const searchTerm = query.toLowerCase();
        
        logElements.forEach(element => {
            const message = element.querySelector('.log-message').textContent.toLowerCase();
            if (!query || message.includes(searchTerm)) {
                element.style.display = 'block';
                
                // Highlight search term
                if (query) {
                    this.highlightText(element.querySelector('.log-message'), query);
                }
            } else {
                element.style.display = 'none';
            }
        });
    }

    highlightText(element, searchTerm) {
        const text = element.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlightedText = text.replace(regex, '<mark>$1</mark>');
        element.innerHTML = highlightedText;
    }

    // Get console statistics
    getStats() {
        const stats = {
            total: this.logs.length,
            log: 0,
            info: 0,
            warn: 0,
            error: 0
        };
        
        this.logs.forEach(log => {
            stats[log.level]++;
        });
        
        return stats;
    }

    // Check if console is open
    isConsoleOpen() {
        return this.isOpen;
    }

    // Set auto-scroll behavior
    setAutoScroll(enabled) {
        this.autoScroll = enabled;
    }
}

// Add console-specific styles
const consoleStyles = `
.console-log {
    display: flex;
    align-items: flex-start;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
}

.log-timestamp {
    color: #666;
    margin-right: 8px;
    min-width: 70px;
    font-size: 11px;
}

.log-level {
    margin-right: 8px;
    min-width: 20px;
}

.log-message {
    flex: 1;
    word-break: break-word;
    white-space: pre-wrap;
}

.console-log.error .log-message {
    color: #f48771;
}

.console-log.warn .log-message {
    color: #dcdcaa;
}

.console-log.info .log-message {
    color: #9cdcfe;
}

.console-log.log .log-message {
    color: #d4d4d4;
}

/* Highlight for search results */
.log-message mark {
    background: #ffd700;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
}

/* Console animation improvements */
.console {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.console.open {
    transform: translateY(0);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
    .console {
        height: 150px;
    }
    
    .console.open ~ .main-container {
        height: calc(100vh - 48px - 150px) !important;
    }
    
    .log-timestamp {
        display: none;
    }
    
    .console-log {
        font-size: 11px;
    }
}
`;

// Inject console styles
const consoleStyleSheet = document.createElement('style');
consoleStyleSheet.textContent = consoleStyles;
document.head.appendChild(consoleStyleSheet);

// Initialize console manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.consoleManager = new ConsoleManager();
});

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


