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

