class StorageManager {
    constructor() {
        this.dbName = 'WebIDEDB';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        this.readyPromise = this.init();
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
                this.isReady = true;
                console.log('IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create files store
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', { keyPath: 'path' });
                    filesStore.createIndex('parentPath', 'parentPath', { unique: false });
                    filesStore.createIndex('type', 'type', { unique: false });
                }

                // Create projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'name' });
                }
            };
        });
    }

    async waitForReady() {
        if (this.isReady) return;
        await this.readyPromise;
    }

    async createFile(path, content = '', type = 'file') {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        const parentPath = this.getParentPath(path);
        const fileName = this.getFileName(path);
        
        const fileData = {
            path: path,
            name: fileName,
            content: content,
            type: type, // 'file' or 'folder'
            parentPath: parentPath,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(fileData);
            request.onsuccess = () => resolve(fileData);
            request.onerror = () => reject(request.error);
        });
    }

    async updateFile(path, content) {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(path);
            getRequest.onsuccess = () => {
                const fileData = getRequest.result;
                if (fileData) {
                    fileData.content = content;
                    fileData.modifiedAt = new Date().toISOString();
                    
                    const updateRequest = store.put(fileData);
                    updateRequest.onsuccess = () => resolve(fileData);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('File not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getFile(path) {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.get(path);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(path) {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        // First, get all children if it's a folder
        const children = await this.getChildren(path);
        
        return new Promise((resolve, reject) => {
            // Delete all children first
            const deletePromises = children.map(child => this.deleteFile(child.path));
            
            Promise.all(deletePromises).then(() => {
                const request = store.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }).catch(reject);
        });
    }

    async getChildren(parentPath) {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('parentPath');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(parentPath);
            request.onsuccess = () => {
                const results = request.result || [];
                // Sort folders first, then files, both alphabetically
                results.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'folder' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFiles() {
        await this.waitForReady();
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async fileExists(path) {
        await this.waitForReady();
        const file = await this.getFile(path);
        return !!file;
    }

    async createProject(name, files = []) {
        const transaction = this.db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        
        const projectData = {
            name: name,
            files: files,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(projectData);
            request.onsuccess = () => resolve(projectData);
            request.onerror = () => reject(request.error);
        });
    }

    async getProject(name) {
        const transaction = this.db.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        
        return new Promise((resolve, reject) => {
            const request = store.get(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async initializeDefaultProject() {
        // Check if default project already exists
        const existingFiles = await this.getAllFiles();
        if (existingFiles.length > 0) {
            return; // Project already initialized
        }

        // Create default project structure
        await this.createFile('/', '', 'folder');
        await this.createFile('/index.html', this.getDefaultHTML(), 'file');
        await this.createFile('/style.css', this.getDefaultCSS(), 'file');
        await this.createFile('/script.js', this.getDefaultJS(), 'file');
        
        console.log('Default project initialized');
    }

    getDefaultHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vande Mataram - Indian Flag Animation</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
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
        
        <div class="text-container">
            <h1 class="main-text">वन्दे मातरम्</h1>
            <h2 class="sub-text">Vande Mataram</h2>
            <p class="description">I bow to thee, Mother</p>
        </div>
        
        <div class="particles"></div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;
    }

    getDefaultCSS() {
        return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #ff9933, #ffffff, #138808);
    background-size: 300% 300%;
    animation: gradientShift 8s ease infinite;
    min-height: 100vh;
    overflow: hidden;
}

@keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    position: relative;
    z-index: 1;
}

.flag-container {
    position: relative;
    margin-bottom: 3rem;
    animation: flagWave 3s ease-in-out infinite;
}

@keyframes flagWave {
    0%, 100% { transform: rotate(-2deg) scale(1); }
    50% { transform: rotate(2deg) scale(1.05); }
}

.flag {
    width: 300px;
    height: 200px;
    border: 3px solid #333;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    position: relative;
    animation: flagFloat 4s ease-in-out infinite;
}

@keyframes flagFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}

.stripe {
    width: 100%;
    height: 33.33%;
    position: relative;
}

.saffron {
    background: linear-gradient(90deg, #ff9933, #ffb366);
    animation: colorPulse 2s ease-in-out infinite;
}

.white {
    background: linear-gradient(90deg, #ffffff, #f0f0f0);
    display: flex;
    align-items: center;
    justify-content: center;
}

.green {
    background: linear-gradient(90deg, #138808, #16a085);
    animation: colorPulse 2s ease-in-out infinite reverse;
}

@keyframes colorPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.2); }
}

.chakra {
    width: 50px;
    height: 50px;
    border: 2px solid #000080;
    border-radius: 50%;
    position: relative;
    animation: chakraRotate 4s linear infinite;
}

@keyframes chakraRotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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
    width: 100%;
    height: 100%;
}

.spokes::before,
.spokes::after {
    content: '';
    position: absolute;
    background: #000080;
    top: 50%;
    left: 50%;
    transform-origin: center;
}

.spokes::before {
    width: 2px;
    height: 40px;
    transform: translate(-50%, -50%);
    box-shadow: 
        0 0 0 0 #000080,
        15px 0 0 0 #000080,
        -15px 0 0 0 #000080,
        0 15px 0 0 #000080,
        0 -15px 0 0 #000080,
        10px 10px 0 0 #000080,
        -10px -10px 0 0 #000080,
        10px -10px 0 0 #000080,
        -10px 10px 0 0 #000080;
}

.flagpole {
    width: 8px;
    height: 400px;
    background: linear-gradient(to bottom, #8B4513, #A0522D);
    position: absolute;
    left: -20px;
    top: -100px;
    border-radius: 4px;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.3);
}

.text-container {
    text-align: center;
    color: #333;
    animation: textGlow 3s ease-in-out infinite;
}

@keyframes textGlow {
    0%, 100% { text-shadow: 0 0 10px rgba(255, 153, 51, 0.5); }
    50% { text-shadow: 0 0 20px rgba(255, 153, 51, 0.8), 0 0 30px rgba(19, 136, 8, 0.5); }
}

.main-text {
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
    background: linear-gradient(45deg, #ff9933, #138808);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: textBounce 2s ease-in-out infinite;
}

@keyframes textBounce {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
}

.sub-text {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #000080;
    animation: fadeInOut 4s ease-in-out infinite;
}

@keyframes fadeInOut {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
}

.description {
    font-size: 1.2rem;
    font-style: italic;
    color: #666;
}

.particles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
}

@media (max-width: 768px) {
    .flag {
        width: 250px;
        height: 167px;
    }
    
    .main-text {
        font-size: 2rem;
    }
    
    .sub-text {
        font-size: 1.5rem;
    }
    
    .description {
        font-size: 1rem;
    }
}`;
    }

    getDefaultJS() {
        return `// Create animated particles
function createParticles() {
    const particlesContainer = document.querySelector('.particles');
    const colors = ['#ff9933', '#ffffff', '#138808'];
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 6 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.opacity = Math.random() * 0.8 + 0.2;
        particle.style.animation = \`particleFloat \${Math.random() * 3 + 2}s ease-in-out infinite\`;
        particle.style.animationDelay = Math.random() * 2 + 's';
        
        particlesContainer.appendChild(particle);
    }
}

// Add particle animation CSS
const style = document.createElement('style');
style.textContent = \`
    @keyframes particleFloat {
        0%, 100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 0.2;
        }
        50% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 0.8;
        }
    }
\`;
document.head.appendChild(style);

// Create additional spokes for the chakra
function enhanceChakra() {
    const chakra = document.querySelector('.chakra');
    if (!chakra) return;
    
    for (let i = 0; i < 24; i++) {
        const spoke = document.createElement('div');
        spoke.style.position = 'absolute';
        spoke.style.width = '1px';
        spoke.style.height = '20px';
        spoke.style.background = '#000080';
        spoke.style.top = '50%';
        spoke.style.left = '50%';
        spoke.style.transformOrigin = '0 0';
        spoke.style.transform = \`translate(-50%, -50%) rotate(\${i * 15}deg)\`;
        chakra.appendChild(spoke);
    }
}

// Add interactive effects
function addInteractivity() {
    const flag = document.querySelector('.flag');
    const textContainer = document.querySelector('.text-container');
    
    if (flag) {
        flag.addEventListener('mouseenter', () => {
            flag.style.transform = 'scale(1.1) rotate(5deg)';
            flag.style.transition = 'transform 0.3s ease';
        });
        
        flag.addEventListener('mouseleave', () => {
            flag.style.transform = 'scale(1) rotate(0deg)';
        });
    }
    
    if (textContainer) {
        textContainer.addEventListener('click', () => {
            textContainer.style.animation = 'none';
            setTimeout(() => {
                textContainer.style.animation = 'textGlow 3s ease-in-out infinite';
            }, 100);
        });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    enhanceChakra();
    addInteractivity();
    
    // Add a welcome message to console
    console.log('🇮🇳 Vande Mataram! Welcome to the Indian Flag Animation 🇮🇳');
    console.log('Click on the text to restart the glow animation!');
});

// Add some dynamic behavior
setInterval(() => {
    const particles = document.querySelectorAll('.particles div');
    particles.forEach(particle => {
        if (Math.random() > 0.95) {
            particle.style.backgroundColor = ['#ff9933', '#ffffff', '#138808'][Math.floor(Math.random() * 3)];
        }
    });
}, 1000);`;
    }

    getParentPath(path) {
        if (path === '/' || path === '') return null;
        const parts = path.split('/');
        parts.pop(); // Remove the last part (filename)
        return parts.join('/') || '/';
    }

    getFileName(path) {
        if (path === '/') return '/';
        return path.split('/').pop();
    }

    generateUniquePath(parentPath, baseName, extension = '') {
        let counter = 1;
        let newName = baseName + extension;
        let fullPath = parentPath === '/' ? '/' + newName : parentPath + '/' + newName;
        
        // This would need to be async in real implementation
        // For now, we'll just return the path and handle conflicts in the UI
        return fullPath;
    }
}

// Global storage instance
window.storageManager = new StorageManager();

class FileExplorerManager {
    constructor() {
        this.fileTree = document.getElementById('fileTree');
        this.toggleBtn = document.getElementById('toggleExplorer');
        this.newFileBtn = document.getElementById('newFile');
        this.newFolderBtn = document.getElementById('newFolder');
        this.importBtn = document.getElementById('importFile');
        this.fileInput = document.getElementById('fileInput');
        this.explorer = document.getElementById('fileExplorer');
        
        this.selectedItem = null;
        this.expandedFolders = new Set();
        
        this.setupEventListeners();
        this.loadFileTree();
    }

    setupEventListeners() {
        // Toggle explorer visibility
        this.toggleBtn.addEventListener('click', () => {
            this.toggleExplorer();
        });

        // New file button
        this.newFileBtn.addEventListener('click', () => {
            this.createNewFile();
        });

        // New folder button
        this.newFolderBtn.addEventListener('click', () => {
            this.createNewFolder();
        });

        // Import file button
        this.importBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e.target.files);
        });

        // File tree clicks
        this.fileTree.addEventListener('click', (e) => {
            this.handleFileTreeClick(e);
        });

        // File tree double clicks
        this.fileTree.addEventListener('dblclick', (e) => {
            this.handleFileTreeDoubleClick(e);
        });

        // Keyboard navigation
        this.fileTree.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });

        // Drag and drop
        this.setupDragAndDrop();
    }

    async loadFileTree() {
        try {
            // Initialize default project if needed
            await window.storageManager.initializeDefaultProject();
            
            // Load and display file tree
            await this.refreshFileTree();
        } catch (error) {
            console.error('Error loading file tree:', error);
        }
    }

    async refreshFileTree() {
        try {
            const files = await window.storageManager.getAllFiles();
            this.renderFileTree(files);
        } catch (error) {
            console.error('Error refreshing file tree:', error);
        }
    }

    renderFileTree(files) {
        this.fileTree.innerHTML = '';
        
        // Build tree structure
        const tree = this.buildTreeStructure(files);
        
        // Render root level
        this.renderTreeLevel(tree, this.fileTree, 0);
    }

    buildTreeStructure(files) {
        const tree = {};
        
        files.forEach(file => {
            const parts = file.path.split('/').filter(part => part !== '');
            let current = tree;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        path: '/' + parts.slice(0, i + 1).join('/'),
                        type: i === parts.length - 1 ? file.type : 'folder',
                        children: {},
                        file: i === parts.length - 1 ? file : null
                    };
                }
                current = current[part].children;
            }
        });
        
        return tree;
    }

    renderTreeLevel(tree, container, level) {
        Object.values(tree).forEach(item => {
            const element = this.createFileItem(item, level);
            container.appendChild(element);
            
            if (item.type === 'folder' && Object.keys(item.children).length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'folder-children';
                childContainer.style.display = this.expandedFolders.has(item.path) ? 'block' : 'none';
                
                this.renderTreeLevel(item.children, childContainer, level + 1);
                container.appendChild(childContainer);
            }
        });
    }

    createFileItem(item, level) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.dataset.path = item.path;
        div.dataset.type = item.type;
        div.dataset.level = level;
        div.tabIndex = 0;
        
        if (item.type === 'folder') {
            div.classList.add('folder');
        }

        const icon = this.getFileIcon(item);
        const isExpanded = this.expandedFolders.has(item.path);
        const expandIcon = item.type === 'folder' ? 
            (isExpanded ? '📂' : '📁') : '';

        div.innerHTML = `
            <span class="icon">${expandIcon || icon}</span>
            <span class="name">${item.name}</span>
            <div class="actions">
                <button class="btn-icon" data-action="rename" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" data-action="delete" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        return div;
    }

    getFileIcon(item) {
        if (item.type === 'folder') {
            return this.expandedFolders.has(item.path) ? '📂' : '📁';
        }

        const extension = item.name.split('.').pop().toLowerCase();
        const iconMap = {
            'html': '🌐',
            'css': '🎨',
            'js': '⚡',
            'json': '📋',
            'md': '📝',
            'txt': '📄',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️'
        };

        return iconMap[extension] || '📄';
    }

    handleFileTreeClick(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;

        const action = e.target.closest('[data-action]');
        if (action) {
            e.stopPropagation();
            this.handleAction(action.dataset.action, fileItem);
            return;
        }

        // Select item
        this.selectItem(fileItem);

        // Toggle folder expansion
        if (fileItem.dataset.type === 'folder') {
            this.toggleFolder(fileItem);
        }
    }

    handleFileTreeDoubleClick(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;

        if (fileItem.dataset.type === 'file') {
            this.openFile(fileItem.dataset.path);
        }
    }

    handleKeyboardNavigation(e) {
        const current = this.selectedItem;
        if (!current) return;

        switch (e.key) {
            case 'Enter':
                if (current.dataset.type === 'file') {
                    this.openFile(current.dataset.path);
                } else {
                    this.toggleFolder(current);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectPreviousItem();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.selectNextItem();
                break;
            case 'Delete':
                this.deleteItem(current.dataset.path);
                break;
            case 'F2':
                this.renameItem(current);
                break;
        }
    }

    selectItem(item) {
        // Remove previous selection
        if (this.selectedItem) {
            this.selectedItem.classList.remove('selected');
        }

        // Select new item
        item.classList.add('selected');
        this.selectedItem = item;
        item.focus();
    }

    selectPreviousItem() {
        const items = Array.from(this.fileTree.querySelectorAll('.file-item'));
        const currentIndex = items.indexOf(this.selectedItem);
        if (currentIndex > 0) {
            this.selectItem(items[currentIndex - 1]);
        }
    }

    selectNextItem() {
        const items = Array.from(this.fileTree.querySelectorAll('.file-item'));
        const currentIndex = items.indexOf(this.selectedItem);
        if (currentIndex < items.length - 1) {
            this.selectItem(items[currentIndex + 1]);
        }
    }

    toggleFolder(folderItem) {
        const path = folderItem.dataset.path;
        const childContainer = folderItem.nextElementSibling;
        
        if (this.expandedFolders.has(path)) {
            // Collapse
            this.expandedFolders.delete(path);
            if (childContainer) {
                childContainer.style.display = 'none';
            }
            folderItem.querySelector('.icon').textContent = '📁';
        } else {
            // Expand
            this.expandedFolders.add(path);
            if (childContainer) {
                childContainer.style.display = 'block';
            }
            folderItem.querySelector('.icon').textContent = '📂';
        }
    }

    async openFile(path) {
        if (window.editorManager) {
            await window.editorManager.openFile(path);
        }
    }

    async createNewFile() {
        const parentPath = this.getSelectedFolderPath() || '/';
        const fileName = prompt('Enter file name:', 'untitled.html');
        
        if (!fileName) return;

        try {
            const fullPath = parentPath === '/' ? '/' + fileName : parentPath + '/' + fileName;
            
            // Check if file already exists
            if (await window.storageManager.fileExists(fullPath)) {
                alert('File already exists!');
                return;
            }

            await window.storageManager.createFile(fullPath, '', 'file');
            await this.refreshFileTree();
            
            // Open the new file
            await this.openFile(fullPath);
        } catch (error) {
            console.error('Error creating file:', error);
            alert('Failed to create file: ' + error.message);
        }
    }

    async createNewFolder() {
        const parentPath = this.getSelectedFolderPath() || '/';
        const folderName = prompt('Enter folder name:', 'new-folder');
        
        if (!folderName) return;

        try {
            const fullPath = parentPath === '/' ? '/' + folderName : parentPath + '/' + folderName;
            
            // Check if folder already exists
            if (await window.storageManager.fileExists(fullPath)) {
                alert('Folder already exists!');
                return;
            }

            await window.storageManager.createFile(fullPath, '', 'folder');
            await this.refreshFileTree();
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('Failed to create folder: ' + error.message);
        }
    }

    getSelectedFolderPath() {
        if (!this.selectedItem) return '/';
        
        if (this.selectedItem.dataset.type === 'folder') {
            return this.selectedItem.dataset.path;
        } else {
            // Get parent folder
            const path = this.selectedItem.dataset.path;
            const parts = path.split('/');
            parts.pop(); // Remove filename
            return parts.join('/') || '/';
        }
    }

    async handleFileImport(files) {
        const parentPath = this.getSelectedFolderPath() || '/';
        
        for (const file of files) {
            try {
                const content = await this.readFileContent(file);
                const fullPath = parentPath === '/' ? '/' + file.name : parentPath + '/' + file.name;
                
                await window.storageManager.createFile(fullPath, content, 'file');
            } catch (error) {
                console.error('Error importing file:', file.name, error);
                alert(`Failed to import ${file.name}: ${error.message}`);
            }
        }
        
        await this.refreshFileTree();
        this.fileInput.value = ''; // Reset input
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    async handleAction(action, fileItem) {
        const path = fileItem.dataset.path;
        
        switch (action) {
            case 'rename':
                await this.renameItem(fileItem);
                break;
            case 'delete':
                await this.deleteItem(path);
                break;
        }
    }

    async renameItem(fileItem) {
        const oldPath = fileItem.dataset.path;
        const oldName = fileItem.querySelector('.name').textContent;
        const newName = prompt('Enter new name:', oldName);
        
        if (!newName || newName === oldName) return;

        try {
            // Get file data
            const fileData = await window.storageManager.getFile(oldPath);
            if (!fileData) return;

            // Create new path
            const pathParts = oldPath.split('/');
            pathParts[pathParts.length - 1] = newName;
            const newPath = pathParts.join('/');

            // Check if new name already exists
            if (await window.storageManager.fileExists(newPath)) {
                alert('A file with that name already exists!');
                return;
            }

            // Create new file and delete old one
            await window.storageManager.createFile(newPath, fileData.content, fileData.type);
            await window.storageManager.deleteFile(oldPath);
            
            await this.refreshFileTree();
        } catch (error) {
            console.error('Error renaming item:', error);
            alert('Failed to rename: ' + error.message);
        }
    }

    async deleteItem(path) {
        const confirmed = confirm('Are you sure you want to delete this item?');
        if (!confirmed) return;

        try {
            await window.storageManager.deleteFile(path);
            await this.refreshFileTree();
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete: ' + error.message);
        }
    }

    toggleExplorer() {
        this.explorer.classList.toggle('hidden');
        this.toggleBtn.classList.toggle('active');
    }

    setupDragAndDrop() {
        // Allow dropping files on the explorer
        this.fileTree.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.fileTree.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            this.handleFileImport(files);
        });
    }
}

// Global file explorer instance
window.fileExplorerManager = new FileExplorerManager();

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

class PreviewManager {
    constructor() {
        this.previewFrame = document.getElementById('previewFrame');
        this.mobilePreviewFrame = document.getElementById('mobilePreviewFrame');
        this.previewWrapper = document.querySelector('.preview-wrapper');
        this.mobileFrame = document.querySelector('.mobile-frame');
        this.desktopViewBtn = document.getElementById('desktopView');
        this.mobileViewBtn = document.getElementById('mobileView');
        this.refreshBtn = document.getElementById('refreshPreview');
        
        this.currentView = 'desktop';
        this.isScaled = false;
        this.refreshTimeout = null;
        
        this.setupEventListeners();
        this.initializePreview();
    }

    setupEventListeners() {
        // View mode buttons
        this.desktopViewBtn.addEventListener('click', () => {
            this.switchToDesktopView();
        });

        this.mobileViewBtn.addEventListener('click', () => {
            this.switchToMobileView();
        });

        // Refresh button
        this.refreshBtn.addEventListener('click', () => {
            this.refresh();
        });

        // Auto-refresh on window resize
        window.addEventListener('resize', () => {
            this.updateScaling();
        });

        // Listen for iframe load events to capture console messages
        this.previewFrame.addEventListener('load', () => {
            this.setupConsoleCapture(this.previewFrame);
        });

        this.mobilePreviewFrame.addEventListener('load', () => {
            this.setupConsoleCapture(this.mobilePreviewFrame);
        });
    }

    initializePreview() {
        this.updateScaling();
        this.refresh();
    }

    switchToDesktopView() {
        this.currentView = 'desktop';
        
        // Update button states
        this.desktopViewBtn.classList.add('active');
        this.mobileViewBtn.classList.remove('active');
        
        // Update view
        this.previewWrapper.style.display = 'block';
        this.mobileFrame.style.display = 'none';
        
        this.updateScaling();
        this.refresh();
    }

    switchToMobileView() {
        this.currentView = 'mobile';
        
        // Update button states
        this.mobileViewBtn.classList.add('active');
        this.desktopViewBtn.classList.remove('active');
        
        // Update view
        this.previewWrapper.style.display = 'none';
        this.mobileFrame.style.display = 'flex';
        
        this.refresh();
    }

    updateScaling() {
        if (this.currentView !== 'desktop') return;

        const container = this.previewWrapper.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const targetWidth = 1280;
        const targetHeight = 720;
        
        // Calculate scale to fit
        const scaleX = containerWidth / targetWidth;
        const scaleY = containerHeight / targetHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        if (scale < 1) {
            // Apply scaling
            this.previewWrapper.classList.add('scaled');
            this.previewFrame.style.width = targetWidth + 'px';
            this.previewFrame.style.height = targetHeight + 'px';
            this.previewWrapper.style.transform = `scale(${scale})`;
            this.previewWrapper.style.width = (targetWidth * scale) + 'px';
            this.previewWrapper.style.height = (targetHeight * scale) + 'px';
            this.isScaled = true;
        } else {
            // No scaling needed
            this.previewWrapper.classList.remove('scaled');
            this.previewFrame.style.width = '100%';
            this.previewFrame.style.height = '100%';
            this.previewWrapper.style.transform = 'none';
            this.previewWrapper.style.width = '100%';
            this.previewWrapper.style.height = '100%';
            this.isScaled = false;
        }
    }

    async refresh() {
        // Clear any pending refresh
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        try {
            const htmlContent = await this.generatePreviewHTML();
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            const targetFrame = this.currentView === 'desktop' ? this.previewFrame : this.mobilePreviewFrame;
            
            // Clean up previous URL
            if (targetFrame.src && targetFrame.src.startsWith('blob:')) {
                URL.revokeObjectURL(targetFrame.src);
            }
            
            targetFrame.src = url;
            
        } catch (error) {
            console.error('Error refreshing preview:', error);
            this.showPreviewError(error.message);
        }
    }

    async generatePreviewHTML() {
        // Get all files from storage
        const files = await window.storageManager.getAllFiles();
        
        // Find HTML file (prefer index.html)
        let htmlFile = files.find(f => f.name === 'index.html' && f.type === 'file');
        if (!htmlFile) {
            htmlFile = files.find(f => f.name.endsWith('.html') && f.type === 'file');
        }
        
        if (!htmlFile) {
            return this.getDefaultPreviewHTML();
        }

        let htmlContent = htmlFile.content;
        
        // Process CSS and JS includes
        htmlContent = await this.processIncludes(htmlContent, files);
        
        return htmlContent;
    }

    async processIncludes(htmlContent, files) {
        // Process CSS links
        htmlContent = htmlContent.replace(
            /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi,
            (match, href) => {
                const cssFile = files.find(f => f.name === href || f.path.endsWith('/' + href));
                if (cssFile && cssFile.type === 'file') {
                    return `<style>\n${cssFile.content}\n</style>`;
                }
                return match;
            }
        );

        // Process JS scripts
        htmlContent = htmlContent.replace(
            /<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/gi,
            (match, src) => {
                const jsFile = files.find(f => f.name === src || f.path.endsWith('/' + src));
                if (jsFile && jsFile.type === 'file') {
                    return `<script>\n${jsFile.content}\n</script>`;
                }
                return match;
            }
        );

        // Add console capture script
        const consoleScript = `
            <script>
                (function() {
                    const originalLog = console.log;
                    const originalError = console.error;
                    const originalWarn = console.warn;
                    const originalInfo = console.info;
                    
                    function sendToParent(type, args) {
                        try {
                            window.parent.postMessage({
                                type: 'console',
                                level: type,
                                message: Array.from(args).map(arg => 
                                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                ).join(' ')
                            }, '*');
                        } catch (e) {
                            // Ignore errors when posting to parent
                        }
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
                    
                    window.addEventListener('unhandledrejection', function(e) {
                        sendToParent('error', ['Unhandled promise rejection: ' + e.reason]);
                    });
                })();
            </script>
        `;

        // Insert console script before closing head tag or at the beginning of body
        if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', consoleScript + '\n</head>');
        } else if (htmlContent.includes('<body>')) {
            htmlContent = htmlContent.replace('<body>', '<body>\n' + consoleScript);
        } else {
            htmlContent = consoleScript + '\n' + htmlContent;
        }

        return htmlContent;
    }

    getDefaultPreviewHTML() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Preview</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                    }
                    .container {
                        max-width: 500px;
                        padding: 2rem;
                    }
                    h1 {
                        font-size: 2.5rem;
                        margin-bottom: 1rem;
                        opacity: 0;
                        animation: fadeIn 1s ease forwards;
                    }
                    p {
                        font-size: 1.2rem;
                        opacity: 0.9;
                        line-height: 1.6;
                        animation: fadeIn 1s ease 0.5s forwards;
                    }
                    .icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                        opacity: 0;
                        animation: fadeIn 1s ease 0.2s forwards;
                    }
                    @keyframes fadeIn {
                        to { opacity: 1; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">🚀</div>
                    <h1>Welcome to Web IDE</h1>
                    <p>Create or open an HTML file to see your preview here. The preview will update automatically as you edit your code.</p>
                </div>
            </body>
            </html>
        `;
    }

    showPreviewError(message) {
        const errorHTML = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Preview Error</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #1e1e1e;
                        color: #f48771;
                        text-align: center;
                        padding: 2rem;
                    }
                    .error-container {
                        max-width: 600px;
                        background: #2d2d30;
                        padding: 2rem;
                        border-radius: 8px;
                        border: 1px solid #f48771;
                    }
                    h1 {
                        color: #f48771;
                        margin-bottom: 1rem;
                    }
                    .error-message {
                        background: #3c1e1e;
                        padding: 1rem;
                        border-radius: 4px;
                        font-family: monospace;
                        text-align: left;
                        margin-top: 1rem;
                        word-break: break-word;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>⚠️ Preview Error</h1>
                    <p>There was an error generating the preview:</p>
                    <div class="error-message">${message}</div>
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([errorHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const targetFrame = this.currentView === 'desktop' ? this.previewFrame : this.mobilePreviewFrame;
        targetFrame.src = url;
    }

    setupConsoleCapture(iframe) {
        // Listen for console messages from iframe
        window.addEventListener('message', (event) => {
            if (event.source === iframe.contentWindow && event.data.type === 'console') {
                if (window.consoleManager) {
                    window.consoleManager.addMessage(event.data.level, event.data.message);
                }
            }
        });
    }

    // Debounced refresh for performance
    scheduleRefresh(delay = 500) {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.refreshTimeout = setTimeout(() => {
            this.refresh();
        }, delay);
    }

    // Get current preview URL for external access
    getCurrentPreviewURL() {
        const targetFrame = this.currentView === 'desktop' ? this.previewFrame : this.mobilePreviewFrame;
        return targetFrame.src;
    }

    // Toggle between scaled and full-size desktop view
    toggleDesktopScale() {
        if (this.currentView === 'desktop') {
            if (this.isScaled) {
                // Switch to full size
                this.previewWrapper.classList.remove('scaled');
                this.previewFrame.style.width = '100%';
                this.previewFrame.style.height = '100%';
                this.previewWrapper.style.transform = 'none';
                this.previewWrapper.style.width = '100%';
                this.previewWrapper.style.height = '100%';
                this.isScaled = false;
            } else {
                // Switch to scaled
                this.updateScaling();
            }
        }
    }
}

// Global preview instance
window.previewManager = new PreviewManager();

class ConsoleManager {
    constructor() {
        this.console = document.getElementById('console');
        this.consoleOutput = document.getElementById('consoleOutput');
        this.toggleBtn = document.getElementById('toggleConsole');
        this.clearBtn = document.getElementById('clearConsole');
        this.closeBtn = document.getElementById('closeConsole');
        
        this.isVisible = false;
        this.messages = [];
        this.maxMessages = 1000; // Limit messages to prevent memory issues
        
        this.setupEventListeners();
        this.interceptConsole();
    }

    setupEventListeners() {
        // Toggle console visibility
        this.toggleBtn.addEventListener('click', () => {
            this.toggle();
        });

        // Clear console
        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Close console
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Auto-scroll to bottom when new messages arrive
        this.consoleOutput.addEventListener('DOMNodeInserted', () => {
            this.scrollToBottom();
        });
    }

    interceptConsole() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };

        // Override console methods to capture messages
        console.log = (...args) => {
            this.originalConsole.log.apply(console, args);
            this.addMessage('log', this.formatArgs(args));
        };

        console.error = (...args) => {
            this.originalConsole.error.apply(console, args);
            this.addMessage('error', this.formatArgs(args));
        };

        console.warn = (...args) => {
            this.originalConsole.warn.apply(console, args);
            this.addMessage('warn', this.formatArgs(args));
        };

        console.info = (...args) => {
            this.originalConsole.info.apply(console, args);
            this.addMessage('info', this.formatArgs(args));
        };

        // Capture unhandled errors
        window.addEventListener('error', (e) => {
            this.addMessage('error', `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.addMessage('error', `Unhandled promise rejection: ${e.reason}`);
        });
    }

    formatArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    addMessage(level, message, timestamp = null) {
        const time = timestamp || new Date();
        const messageObj = {
            level,
            message,
            timestamp: time,
            id: Date.now() + Math.random()
        };

        this.messages.push(messageObj);

        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }

        // Create message element
        const messageElement = this.createMessageElement(messageObj);
        this.consoleOutput.appendChild(messageElement);

        // Auto-show console for errors
        if (level === 'error' && !this.isVisible) {
            this.show();
        }

        // Update toggle button to show activity
        this.updateToggleButton();
    }

    createMessageElement(messageObj) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `console-message ${messageObj.level}`;
        messageDiv.dataset.id = messageObj.id;

        const timestamp = this.formatTimestamp(messageObj.timestamp);
        const levelIcon = this.getLevelIcon(messageObj.level);
        
        messageDiv.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="level-icon">${levelIcon}</span>
            <span class="message-content">${this.escapeHtml(messageObj.message)}</span>
        `;

        // Add click to expand/collapse for long messages
        if (messageObj.message.length > 200) {
            messageDiv.classList.add('expandable');
            messageDiv.addEventListener('click', () => {
                messageDiv.classList.toggle('expanded');
            });
        }

        return messageDiv;
    }

    getLevelIcon(level) {
        const icons = {
            log: '📝',
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️'
        };
        return icons[level] || '📝';
    }

    formatTimestamp(date) {
        return date.toLocaleTimeString('en-US', {
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

    show() {
        this.console.classList.add('visible');
        this.isVisible = true;
        this.toggleBtn.classList.add('active');
        this.scrollToBottom();
        
        // Adjust main container height
        this.adjustMainContainerHeight();
    }

    hide() {
        this.console.classList.remove('visible');
        this.isVisible = false;
        this.toggleBtn.classList.remove('active');
        
        // Restore main container height
        this.adjustMainContainerHeight();
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    clear() {
        this.messages = [];
        this.consoleOutput.innerHTML = '';
        this.addMessage('info', 'Console cleared');
    }

    scrollToBottom() {
        setTimeout(() => {
            this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
        }, 10);
    }

    adjustMainContainerHeight() {
        const mainContainer = document.querySelector('.main-container');
        if (this.isVisible) {
            mainContainer.style.height = 'calc(100vh - 50px - 200px)';
        } else {
            mainContainer.style.height = 'calc(100vh - 50px)';
        }
    }

    updateToggleButton() {
        // Add visual indicator for new messages
        if (!this.isVisible) {
            this.toggleBtn.classList.add('has-new-messages');
            setTimeout(() => {
                this.toggleBtn.classList.remove('has-new-messages');
            }, 2000);
        }
    }

    // Public methods for external use
    logMessage(message) {
        this.addMessage('log', message);
    }

    errorMessage(message) {
        this.addMessage('error', message);
    }

    warnMessage(message) {
        this.addMessage('warn', message);
    }

    infoMessage(message) {
        this.addMessage('info', message);
    }

    getMessages() {
        return [...this.messages];
    }

    exportMessages() {
        const exportData = this.messages.map(msg => ({
            timestamp: msg.timestamp.toISOString(),
            level: msg.level,
            message: msg.message
        }));

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-log-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Filter messages by level
    filterByLevel(level) {
        const messages = this.consoleOutput.querySelectorAll('.console-message');
        messages.forEach(msg => {
            if (level === 'all' || msg.classList.contains(level)) {
                msg.style.display = 'block';
            } else {
                msg.style.display = 'none';
            }
        });
    }

    // Search messages
    searchMessages(query) {
        const messages = this.consoleOutput.querySelectorAll('.console-message');
        const searchTerm = query.toLowerCase();
        
        messages.forEach(msg => {
            const content = msg.textContent.toLowerCase();
            if (!query || content.includes(searchTerm)) {
                msg.style.display = 'block';
                // Highlight search term
                if (query) {
                    this.highlightSearchTerm(msg, query);
                }
            } else {
                msg.style.display = 'none';
            }
        });
    }

    highlightSearchTerm(element, term) {
        const content = element.querySelector('.message-content');
        if (content) {
            const text = content.textContent;
            const regex = new RegExp(`(${term})`, 'gi');
            const highlightedText = text.replace(regex, '<mark>$1</mark>');
            content.innerHTML = highlightedText;
        }
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        // Monitor performance and log metrics
        if (window.performance && window.performance.mark) {
            setInterval(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                if (navigation) {
                    this.addMessage('info', `Page load time: ${Math.round(navigation.loadEventEnd - navigation.loadEventStart)}ms`);
                }
            }, 30000); // Every 30 seconds
        }
    }
}

// Add console-specific CSS
const consoleStyle = document.createElement('style');
consoleStyle.textContent = `
    .console-message.expandable {
        cursor: pointer;
    }
    
    .console-message.expandable .message-content {
        max-height: 60px;
        overflow: hidden;
        position: relative;
    }
    
    .console-message.expandable.expanded .message-content {
        max-height: none;
    }
    
    .console-message.expandable:not(.expanded) .message-content::after {
        content: '...';
        position: absolute;
        bottom: 0;
        right: 0;
        background: #1e1e1e;
        padding-left: 10px;
    }
    
    .btn-icon.has-new-messages {
        animation: pulse 1s ease-in-out;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
    
    .console-message mark {
        background: #ffd700;
        color: #000;
        padding: 1px 2px;
        border-radius: 2px;
    }
    
    .level-icon {
        margin-right: 8px;
        font-size: 12px;
    }
`;
document.head.appendChild(consoleStyle);

// Global console instance
window.consoleManager = new ConsoleManager();

class ContextMenuManager {
    constructor() {
        this.contextMenu = document.getElementById('contextMenu');
        this.isVisible = false;
        this.longPressTimer = null;
        this.longPressDelay = 500; // 500ms for long press
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Right-click context menu
        document.addEventListener('contextmenu', (e) => {
            // Only show context menu in editor area
            if (this.isInEditor(e.target)) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            } else {
                this.hideContextMenu();
            }
        });

        // Touch events for long press
        document.addEventListener('touchstart', (e) => {
            if (this.isInEditor(e.target)) {
                this.startLongPress(e);
            }
        });

        document.addEventListener('touchend', (e) => {
            this.cancelLongPress();
        });

        document.addEventListener('touchmove', (e) => {
            this.cancelLongPress();
        });

        // Click outside to hide menu
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Context menu item clicks
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-item');
            if (item) {
                const action = item.dataset.action;
                this.executeAction(action);
                this.hideContextMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'x':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('cut');
                        }
                        break;
                    case 'c':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('copy');
                        }
                        break;
                    case 'v':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('paste');
                        }
                        break;
                    case 'a':
                        if (this.isInEditor(document.activeElement)) {
                            e.preventDefault();
                            this.executeAction('selectAll');
                        }
                        break;
                }
            } else if (e.key === 'Delete' && this.isInEditor(document.activeElement)) {
                // Let CodeMirror handle delete naturally, but we can track it
                // this.executeAction('delete');
            }
        });

        // Hide menu on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }

    isInEditor(element) {
        // Check if element is within CodeMirror editor
        return element && (
            element.closest('.CodeMirror') ||
            element.closest('.editor-container') ||
            element.classList.contains('CodeMirror-line') ||
            element.classList.contains('CodeMirror-code')
        );
    }

    startLongPress(e) {
        this.cancelLongPress();
        
        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        
        this.longPressTimer = setTimeout(() => {
            // Trigger haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            this.showContextMenu(x, y);
        }, this.longPressDelay);
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    showContextMenu(x, y) {
        // Update menu items based on current state
        this.updateMenuItems();
        
        // Position the menu
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        
        // Show the menu
        this.contextMenu.classList.add('visible');
        this.isVisible = true;
        
        // Adjust position if menu goes off-screen
        this.adjustMenuPosition();
    }

    hideContextMenu() {
        this.contextMenu.classList.remove('visible');
        this.isVisible = false;
    }

    adjustMenuPosition() {
        const rect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = parseInt(this.contextMenu.style.left);
        let top = parseInt(this.contextMenu.style.top);
        
        // Adjust horizontal position
        if (rect.right > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Adjust vertical position
        if (rect.bottom > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        if (top < 10) {
            top = 10;
        }
        
        this.contextMenu.style.left = left + 'px';
        this.contextMenu.style.top = top + 'px';
    }

    updateMenuItems() {
        const hasSelection = window.editorManager && window.editorManager.getSelectedText().length > 0;
        const hasEditor = window.editorManager && window.editorManager.currentEditor;
        
        // Enable/disable menu items based on context
        const items = this.contextMenu.querySelectorAll('.context-item');
        
        items.forEach(item => {
            const action = item.dataset.action;
            
            switch (action) {
                case 'cut':
                case 'copy':
                case 'delete':
                    item.classList.toggle('disabled', !hasSelection);
                    break;
                case 'paste':
                    item.classList.toggle('disabled', !hasEditor);
                    break;
                case 'selectAll':
                    item.classList.toggle('disabled', !hasEditor);
                    break;
            }
        });
    }

    async executeAction(action) {
        if (!window.editorManager) {
            console.warn('Editor manager not available');
            return;
        }

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
                case 'delete':
                    this.delete();
                    break;
                case 'selectAll':
                    this.selectAll();
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        } catch (error) {
            console.error('Error executing action:', action, error);
            this.showActionError(action, error.message);
        }
    }

    async cut() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            try {
                await navigator.clipboard.writeText(selectedText);
                window.editorManager.replaceSelection('');
                this.showActionFeedback('Text cut to clipboard');
            } catch (error) {
                // Fallback for browsers that don't support clipboard API
                this.fallbackCopy(selectedText);
                window.editorManager.replaceSelection('');
                this.showActionFeedback('Text cut (fallback method)');
            }
        }
    }

    async copy() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            try {
                await navigator.clipboard.writeText(selectedText);
                this.showActionFeedback('Text copied to clipboard');
            } catch (error) {
                // Fallback for browsers that don't support clipboard API
                this.fallbackCopy(selectedText);
                this.showActionFeedback('Text copied (fallback method)');
            }
        }
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            window.editorManager.replaceSelection(text);
            this.showActionFeedback('Text pasted from clipboard');
        } catch (error) {
            // Fallback - prompt user to paste manually
            const text = prompt('Paste your text here:');
            if (text !== null) {
                window.editorManager.replaceSelection(text);
                this.showActionFeedback('Text pasted');
            }
        }
    }

    delete() {
        const selectedText = window.editorManager.getSelectedText();
        if (selectedText) {
            window.editorManager.replaceSelection('');
            this.showActionFeedback('Text deleted');
        } else {
            // Delete character at cursor
            window.editorManager.delete();
        }
    }

    selectAll() {
        window.editorManager.selectAll();
        this.showActionFeedback('All text selected');
    }

    fallbackCopy(text) {
        // Create a temporary textarea to copy text
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    showActionFeedback(message) {
        // Show brief feedback message
        const feedback = document.createElement('div');
        feedback.className = 'action-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0e639c;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            animation: fadeInOut 2s ease forwards;
        `;
        
        // Add animation CSS if not already present
        if (!document.querySelector('#feedback-animation-style')) {
            const style = document.createElement('style');
            style.id = 'feedback-animation-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20%, 80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }

    showActionError(action, message) {
        console.error(`Error executing ${action}:`, message);
        
        if (window.consoleManager) {
            window.consoleManager.addMessage('error', `Context menu action failed: ${action} - ${message}`);
        }
    }

    // Public methods for external use
    isMenuVisible() {
        return this.isVisible;
    }

    forceHide() {
        this.hideContextMenu();
        this.cancelLongPress();
    }
}

// Global context menu instance
window.contextMenuManager = new ContextMenuManager();

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

