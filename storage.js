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

