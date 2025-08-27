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
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

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

