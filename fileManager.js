/**
 * File Manager Module
 * Handles file management UI and operations
 */

class FileManager {
    constructor() {
        this.fileManager = document.getElementById('fileManager');
        this.fileTree = document.getElementById('fileTree');
        this.fileInput = document.getElementById('fileInput');
        this.currentPath = '/';
        this.selectedFile = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadFileTree();
    }
    
    setupEventListeners() {
        // Menu button to toggle file manager
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.toggleFileManager();
        });
        
        // Close file manager
        document.getElementById('closeFileManager').addEventListener('click', () => {
            this.hideFileManager();
        });
        
        // File manager actions
        document.getElementById('createFileBtn').addEventListener('click', () => {
            this.createNewFile();
        });
        
        document.getElementById('createFolderBtn').addEventListener('click', () => {
            this.createNewFolder();
        });
        
        document.getElementById('importFileBtn').addEventListener('click', () => {
            this.importFiles();
        });
        
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e);
        });
        
        // File tree interactions
        this.fileTree.addEventListener('click', (e) => {
            this.handleFileTreeClick(e);
        });
        
        this.fileTree.addEventListener('contextmenu', (e) => {
            this.handleFileTreeContextMenu(e);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.createNewFile();
            }
            
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.createNewFolder();
            }
            
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.importFiles();
            }
        });
        
        // Click outside to close file manager on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !this.fileManager.contains(e.target) && 
                !document.getElementById('menuBtn').contains(e.target)) {
                this.hideFileManager();
            }
        });
    }
    
    toggleFileManager() {
        this.fileManager.classList.toggle('hidden');
        document.querySelector('.main-content').classList.toggle('sidebar-open');
        
        if (!this.fileManager.classList.contains('hidden')) {
            this.loadFileTree();
        }
    }
    
    showFileManager() {
        this.fileManager.classList.remove('hidden');
        document.querySelector('.main-content').classList.add('sidebar-open');
        this.loadFileTree();
    }
    
    hideFileManager() {
        this.fileManager.classList.add('hidden');
        document.querySelector('.main-content').classList.remove('sidebar-open');
    }
    
    async loadFileTree() {
        if (!window.storageManager || !window.storageManager.isReady) {
            setTimeout(() => this.loadFileTree(), 100);
            return;
        }
        
        try {
            const files = await window.storageManager.getAllFiles();
            this.renderFileTree(files);
        } catch (error) {
            console.error('Failed to load file tree:', error);
            this.showError('Failed to load files');
        }
    }
    
    renderFileTree(files) {
        // Sort files: folders first, then files, alphabetically
        const sortedFiles = files.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        // Group by parent path
        const filesByParent = {};
        sortedFiles.forEach(file => {
            const parent = file.parentPath || '/';
            if (!filesByParent[parent]) {
                filesByParent[parent] = [];
            }
            filesByParent[parent].push(file);
        });
        
        // Render tree
        this.fileTree.innerHTML = '';
        this.renderFileTreeLevel(filesByParent, '/', 0);
    }
    
    renderFileTreeLevel(filesByParent, parentPath, level) {
        const files = filesByParent[parentPath] || [];
        
        files.forEach(file => {
            const fileItem = this.createFileItem(file, level);
            this.fileTree.appendChild(fileItem);
            
            // If it's a folder, render its children
            if (file.type === 'folder') {
                this.renderFileTreeLevel(filesByParent, file.path, level + 1);
            }
        });
    }
    
    createFileItem(file, level) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.path = file.path;
        item.dataset.type = file.type;
        item.style.paddingLeft = `${(level * 20) + 16}px`;
        
        const icon = this.getFileIcon(file);
        const name = file.name;
        
        item.innerHTML = `
            ${icon}
            <span class="file-name">${name}</span>
            <div class="file-actions">
                <button class="file-action-btn" data-action="rename" title="Rename">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="file-action-btn" data-action="delete" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add active class if this is the current file
        if (window.codeEditor && file.path === `/${window.codeEditor.getCurrentFile()}`) {
            item.classList.add('active');
        }
        
        return item;
    }
    
    getFileIcon(file) {
        if (file.type === 'folder') {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>`;
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'html':
            case 'htm':
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e34c26" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10,9 9,9 8,9"></polyline>
                </svg>`;
            case 'css':
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1572b6" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>`;
            case 'js':
            case 'jsx':
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>`;
            case 'json':
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                </svg>`;
            case 'md':
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#083fa1" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>`;
            default:
                return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                </svg>`;
        }
    }
    
    handleFileTreeClick(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        const actionBtn = e.target.closest('.file-action-btn');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            const path = fileItem.dataset.path;
            this.handleFileAction(action, path);
            return;
        }
        
        const path = fileItem.dataset.path;
        const type = fileItem.dataset.type;
        
        if (type === 'file') {
            this.openFile(path);
        } else if (type === 'folder') {
            this.toggleFolder(fileItem);
        }
    }
    
    handleFileTreeContextMenu(e) {
        e.preventDefault();
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        const path = fileItem.dataset.path;
        this.showFileContextMenu(e, path);
    }
    
    showFileContextMenu(e, path) {
        // Create context menu for file operations
        const contextMenu = document.createElement('div');
        contextMenu.className = 'file-context-menu';
        contextMenu.innerHTML = `
            <div class="context-item" data-action="open">Open</div>
            <div class="context-item" data-action="rename">Rename</div>
            <div class="context-item" data-action="delete">Delete</div>
            <div class="context-item" data-action="export">Export</div>
        `;
        
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.zIndex = '1000';
        
        document.body.appendChild(contextMenu);
        
        // Handle context menu clicks
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleFileAction(action, path);
            }
            document.body.removeChild(contextMenu);
        });
        
        // Remove context menu on outside click
        setTimeout(() => {
            document.addEventListener('click', function removeContextMenu() {
                if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                }
                document.removeEventListener('click', removeContextMenu);
            });
        }, 0);
    }
    
    async handleFileAction(action, path) {
        try {
            switch (action) {
                case 'open':
                    await this.openFile(path);
                    break;
                case 'rename':
                    await this.renameFile(path);
                    break;
                case 'delete':
                    await this.deleteFile(path);
                    break;
                case 'export':
                    await this.exportFile(path);
                    break;
            }
        } catch (error) {
            console.error(`Failed to ${action} file:`, error);
            this.showError(`Failed to ${action} file: ${error.message}`);
        }
    }
    
    async openFile(path) {
        try {
            const file = await window.storageManager.loadFile(path);
            if (file && file.type === 'file') {
                const fileName = file.name;
                const content = file.content || '';
                
                if (window.codeEditor) {
                    window.codeEditor.openFile(fileName, content);
                }
                
                // Update active state
                this.updateActiveFile(path);
                
                // Hide file manager on mobile
                if (window.innerWidth <= 768) {
                    this.hideFileManager();
                }
            }
        } catch (error) {
            console.error('Failed to open file:', error);
            this.showError('Failed to open file');
        }
    }
    
    updateActiveFile(path) {
        const fileItems = this.fileTree.querySelectorAll('.file-item');
        fileItems.forEach(item => {
            item.classList.toggle('active', item.dataset.path === path);
        });
    }
    
    async createNewFile() {
        const fileName = prompt('Enter file name:', 'newfile.html');
        if (!fileName) return;
        
        try {
            const path = `/${fileName}`;
            const content = this.getDefaultContent(fileName);
            
            await window.storageManager.saveFile(path, content);
            await this.loadFileTree();
            
            // Open the new file
            if (window.codeEditor) {
                window.codeEditor.openFile(fileName, content);
            }
            
            this.showSuccess(`File "${fileName}" created successfully`);
        } catch (error) {
            console.error('Failed to create file:', error);
            this.showError('Failed to create file');
        }
    }
    
    async createNewFolder() {
        const folderName = prompt('Enter folder name:', 'new-folder');
        if (!folderName) return;
        
        try {
            await window.storageManager.createFolder(this.currentPath, folderName);
            await this.loadFileTree();
            this.showSuccess(`Folder "${folderName}" created successfully`);
        } catch (error) {
            console.error('Failed to create folder:', error);
            this.showError('Failed to create folder');
        }
    }
    
    async renameFile(path) {
        const file = await window.storageManager.loadFile(path);
        if (!file) return;
        
        const newName = prompt('Enter new name:', file.name);
        if (!newName || newName === file.name) return;
        
        try {
            await window.storageManager.renameFile(path, newName);
            await this.loadFileTree();
            this.showSuccess(`File renamed to "${newName}"`);
        } catch (error) {
            console.error('Failed to rename file:', error);
            this.showError('Failed to rename file');
        }
    }
    
    async deleteFile(path) {
        const file = await window.storageManager.loadFile(path);
        if (!file) return;
        
        const confirmed = confirm(`Are you sure you want to delete "${file.name}"?`);
        if (!confirmed) return;
        
        try {
            await window.storageManager.deleteFile(path);
            await this.loadFileTree();
            
            // If the deleted file was open, close its tab
            if (window.codeEditor && window.codeEditor.getCurrentFile() === file.name) {
                window.codeEditor.closeTab(file.name);
            }
            
            this.showSuccess(`File "${file.name}" deleted successfully`);
        } catch (error) {
            console.error('Failed to delete file:', error);
            this.showError('Failed to delete file');
        }
    }
    
    async exportFile(path) {
        try {
            await window.storageManager.exportFile(path);
        } catch (error) {
            console.error('Failed to export file:', error);
            this.showError('Failed to export file');
        }
    }
    
    importFiles() {
        this.fileInput.click();
    }
    
    async handleFileImport(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        this.showLoading('Importing files...');
        
        try {
            for (const file of files) {
                await window.storageManager.importFile(file);
            }
            
            await this.loadFileTree();
            this.showSuccess(`${files.length} file(s) imported successfully`);
        } catch (error) {
            console.error('Failed to import files:', error);
            this.showError('Failed to import files');
        } finally {
            this.hideLoading();
            // Clear the input
            e.target.value = '';
        }
    }
    
    getDefaultContent(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'html':
            case 'htm':
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
}

h1 {
    color: #333;
}`;
            case 'js':
                return `// JavaScript Code
console.log('Hello World!');

function greet(name) {
    return \`Hello, \${name}!\`;
}`;
            case 'json':
                return `{
    "name": "example",
    "version": "1.0.0",
    "description": "Example JSON file"
}`;
            default:
                return '';
        }
    }
    
    toggleFolder(folderItem) {
        // This would expand/collapse folder in a tree view
        // For now, we'll just reload the tree
        folderItem.classList.toggle('expanded');
    }
    
    showLoading(message = 'Loading...') {
        const indicator = document.getElementById('loadingIndicator');
        indicator.querySelector('span').textContent = message;
        indicator.classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px',
            zIndex: '1000',
            maxWidth: '300px',
            wordWrap: 'break-word'
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
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}

// Initialize file manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManager();
});

