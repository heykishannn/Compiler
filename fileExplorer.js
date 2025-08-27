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

