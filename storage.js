/**
 * Storage Manager - IndexedDB Implementation
 * Handles persistent storage of files and folders
 */

class StorageManager {
    constructor() {
        this.dbName = 'WebCompilerDB';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        
        this.init();
    }
    
    async init() {
        try {
            await this.openDatabase();
            await this.loadDefaultFiles();
            this.isReady = true;
            console.log('Storage Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize storage:', error);
        }
    }
    
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create files store
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', { keyPath: 'path' });
                    filesStore.createIndex('name', 'name', { unique: false });
                    filesStore.createIndex('type', 'type', { unique: false });
                    filesStore.createIndex('parentPath', 'parentPath', { unique: false });
                }
                
                // Create projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
                    projectsStore.createIndex('name', 'name', { unique: false });
                }
                
                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }
    
    async loadDefaultFiles() {
        const existingFiles = await this.getAllFiles();
        
        if (existingFiles.length === 0) {
            // Create default files
            const defaultFiles = [
                {
                    path: '/index.html',
                    name: 'index.html',
                    type: 'file',
                    parentPath: '/',
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
        }
        .btn {
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            color: white;
            padding: 12px 24px;
            font-size: 1rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .btn:hover {
            background: white;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Web Compiler!</h1>
        <p>Edit this code and see the live preview below.</p>
        <button class="btn" onclick="alert('Hello World!')">Click Me</button>
    </div>
</body>
</html>`,
                    createdAt: new Date(),
                    modifiedAt: new Date(),
                    size: 0
                },
                {
                    path: '/style.css',
                    name: 'style.css',
                    type: 'file',
                    parentPath: '/',
                    content: `/* Custom Styles */
body {
    font-family: 'Arial', sans-serif;
    margin: 0;
    padding: 0;
    background: #f0f0f0;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

h1 {
    color: #333;
    text-align: center;
    margin-bottom: 30px;
}

.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
    margin-bottom: 20px;
}

.btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s ease;
}

.btn:hover {
    background: #0056b3;
}`,
                    createdAt: new Date(),
                    modifiedAt: new Date(),
                    size: 0
                },
                {
                    path: '/script.js',
                    name: 'script.js',
                    type: 'file',
                    parentPath: '/',
                    content: `// JavaScript Code
console.log('Web Compiler loaded successfully!');

// Example function
function greetUser(name) {
    return \`Hello, \${name}! Welcome to Web Compiler.\`;
}

// DOM manipulation example
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // Add click event to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            console.log('Button clicked:', this.textContent);
        });
    });
});

// Example class
class WebCompiler {
    constructor(name) {
        this.name = name;
        this.version = '1.0.0';
    }
    
    getInfo() {
        return \`\${this.name} v\${this.version}\`;
    }
    
    compile() {
        console.log('Compiling code...');
        return 'Compilation successful!';
    }
}

// Create instance
const compiler = new WebCompiler('Web Compiler');
console.log(compiler.getInfo());`,
                    createdAt: new Date(),
                    modifiedAt: new Date(),
                    size: 0
                }
            ];
            
            for (const file of defaultFiles) {
                file.size = new Blob([file.content]).size;
                await this.saveFile(file.path, file.content, file);
            }
        }
    }
    
    async saveFile(path, content, metadata = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        const fileData = {
            path: path,
            name: path.split('/').pop(),
            type: 'file',
            parentPath: path.substring(0, path.lastIndexOf('/')) || '/',
            content: content,
            size: new Blob([content]).size,
            modifiedAt: new Date(),
            ...metadata
        };
        
        // If it's a new file, set createdAt
        if (!metadata.createdAt) {
            fileData.createdAt = new Date();
        }
        
        return new Promise((resolve, reject) => {
            const request = store.put(fileData);
            
            request.onsuccess = () => {
                resolve(fileData);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to save file'));
            };
        });
    }
    
    async loadFile(path) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.get(path);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to load file'));
            };
        });
    }
    
    async deleteFile(path) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(path);
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = () => {
                reject(new Error('Failed to delete file'));
            };
        });
    }
    
    async getAllFiles() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get files'));
            };
        });
    }
    
    async getFilesByParent(parentPath) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const index = store.index('parentPath');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(parentPath);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to get files by parent'));
            };
        });
    }
    
    async createFolder(path, name) {
        const folderPath = `${path}/${name}`;
        const folderData = {
            path: folderPath,
            name: name,
            type: 'folder',
            parentPath: path,
            content: '',
            size: 0,
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        return new Promise((resolve, reject) => {
            const request = store.put(folderData);
            
            request.onsuccess = () => {
                resolve(folderData);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to create folder'));
            };
        });
    }
    
    async renameFile(oldPath, newName) {
        const file = await this.loadFile(oldPath);
        if (!file) {
            throw new Error('File not found');
        }
        
        const newPath = `${file.parentPath}/${newName}`;
        
        // Create new file with new path
        const newFile = {
            ...file,
            path: newPath,
            name: newName,
            modifiedAt: new Date()
        };
        
        await this.saveFile(newPath, file.content, newFile);
        await this.deleteFile(oldPath);
        
        return newFile;
    }
    
    async moveFile(filePath, newParentPath) {
        const file = await this.loadFile(filePath);
        if (!file) {
            throw new Error('File not found');
        }
        
        const newPath = `${newParentPath}/${file.name}`;
        
        // Create new file with new parent path
        const newFile = {
            ...file,
            path: newPath,
            parentPath: newParentPath,
            modifiedAt: new Date()
        };
        
        await this.saveFile(newPath, file.content, newFile);
        await this.deleteFile(filePath);
        
        return newFile;
    }
    
    async importFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const path = `/${file.name}`;
                    
                    const fileData = await this.saveFile(path, content, {
                        originalFile: file,
                        mimeType: file.type
                    });
                    
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            // Read as text for code files, as data URL for binary files
            if (this.isTextFile(file)) {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        });
    }
    
    isTextFile(file) {
        const textTypes = [
            'text/',
            'application/javascript',
            'application/json',
            'application/xml',
            'application/xhtml+xml'
        ];
        
        const textExtensions = [
            '.html', '.htm', '.css', '.js', '.json', '.xml', '.txt',
            '.md', '.py', '.java', '.cpp', '.c', '.php', '.rb',
            '.go', '.rs', '.ts', '.jsx', '.tsx', '.vue', '.svelte'
        ];
        
        return textTypes.some(type => file.type.startsWith(type)) ||
               textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }
    
    async exportFile(path) {
        const file = await this.loadFile(path);
        if (!file) {
            throw new Error('File not found');
        }
        
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    async getStorageInfo() {
        const files = await this.getAllFiles();
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        
        return {
            fileCount: files.length,
            totalSize: totalSize,
            formattedSize: this.formatFileSize(totalSize)
        };
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async clearAllData() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction(['files', 'projects', 'settings'], 'readwrite');
        
        await Promise.all([
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('files').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear files'));
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('projects').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear projects'));
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore('settings').clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear settings'));
            })
        ]);
        
        // Reload default files
        await this.loadDefaultFiles();
    }
}

// Initialize storage manager
document.addEventListener('DOMContentLoaded', () => {
    window.storageManager = new StorageManager();
});

