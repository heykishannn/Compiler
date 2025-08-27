/**
 * Preview Manager Module
 * Handles live preview with PC/mobile modes and fullscreen functionality
 */

class PreviewManager {
    constructor() {
        this.previewFrame = document.getElementById('previewFrame');
        this.fullscreenFrame = document.getElementById('fullscreenFrame');
        this.fullscreenOverlay = document.getElementById('fullscreenOverlay');
        this.previewModeIndicator = document.getElementById('previewMode');
        this.currentMode = 'pc'; // 'pc' or 'mobile'
        this.autoRefreshEnabled = true;
        this.refreshTimeout = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.refresh();
    }
    
    setupEventListeners() {
        // Mode switching buttons
        document.getElementById('pcModeBtn').addEventListener('click', () => {
            this.switchMode('pc');
        });
        
        document.getElementById('mobileModeBtn').addEventListener('click', () => {
            this.switchMode('mobile');
        });
        
        // Fullscreen buttons
        document.getElementById('fullscreenPcBtn').addEventListener('click', () => {
            this.openFullscreen('pc');
        });
        
        document.getElementById('fullscreenMobileBtn').addEventListener('click', () => {
            this.openFullscreen('mobile');
        });
        
        // Run button
        document.getElementById('runBtn').addEventListener('click', () => {
            this.refresh();
        });
        
        // Refresh button
        document.getElementById('refreshPreview').addEventListener('click', () => {
            this.refresh();
        });
        
        // Exit fullscreen
        document.getElementById('exitFullscreen').addEventListener('click', () => {
            this.exitFullscreen();
        });
        
        // Escape key to exit fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.fullscreenOverlay.classList.contains('hidden')) {
                this.exitFullscreen();
            }
        });
        
        // Handle iframe load events
        this.previewFrame.addEventListener('load', () => {
            this.handlePreviewLoad();
        });
        
        this.fullscreenFrame.addEventListener('load', () => {
            this.handleFullscreenLoad();
        });
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update button states
        document.getElementById('pcModeBtn').classList.toggle('active', mode === 'pc');
        document.getElementById('mobileModeBtn').classList.toggle('active', mode === 'mobile');
        
        // Update preview frame classes
        this.previewFrame.className = `preview-frame ${mode}-mode`;
        
        // Update mode indicator
        this.previewModeIndicator.textContent = mode === 'pc' ? 'PC Mode' : 'Mobile Mode';
        
        // Refresh preview to apply new mode
        this.refresh();
    }
    
    openFullscreen(mode) {
        this.fullscreenOverlay.classList.remove('hidden');
        
        // Set fullscreen frame mode
        this.fullscreenFrame.className = mode === 'mobile' ? 'fullscreen-frame mobile-preview' : 'fullscreen-frame';
        
        // Update title
        document.getElementById('fullscreenTitle').textContent = 
            mode === 'mobile' ? 'Mobile Preview' : 'PC Preview';
        
        // Copy current preview content to fullscreen
        this.refreshFullscreen();
    }
    
    exitFullscreen() {
        this.fullscreenOverlay.classList.add('hidden');
    }
    
    refresh() {
        if (!window.codeEditor) {
            console.warn('Code editor not available');
            return;
        }
        
        const content = this.generatePreviewContent();
        this.updatePreview(content);
        
        // Also update fullscreen if open
        if (!this.fullscreenOverlay.classList.contains('hidden')) {
            this.refreshFullscreen();
        }
    }
    
    refreshFullscreen() {
        const content = this.generatePreviewContent();
        this.updateFullscreenPreview(content);
    }
    
    autoRefresh() {
        if (!this.autoRefreshEnabled) return;
        
        // Debounce auto-refresh
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
            this.refresh();
        }, 500);
    }
    
    generatePreviewContent() {
        if (!window.codeEditor) {
            return this.getDefaultPreviewContent();
        }
        
        const currentFile = window.codeEditor.getCurrentFile();
        const currentContent = window.codeEditor.getCurrentContent();
        const allFiles = window.codeEditor.getAllFiles();
        
        // If current file is HTML, use it as base
        if (currentFile.endsWith('.html')) {
            return this.processHTMLContent(currentContent, allFiles);
        }
        
        // If current file is CSS or JS, find HTML file or create wrapper
        const htmlFile = this.findHTMLFile(allFiles);
        if (htmlFile) {
            const htmlContent = allFiles.get(htmlFile);
            return this.processHTMLContent(htmlContent, allFiles);
        }
        
        // Create wrapper HTML for CSS/JS files
        return this.createWrapperHTML(currentFile, currentContent, allFiles);
    }
    
    processHTMLContent(htmlContent, allFiles) {
        let processedContent = htmlContent;
        
        // Inject CSS files
        const cssFiles = Array.from(allFiles.entries()).filter(([name]) => name.endsWith('.css'));
        cssFiles.forEach(([name, content]) => {
            const cssTag = `<style>/* ${name} */\n${content}\n</style>`;
            
            // Try to inject before closing head tag
            if (processedContent.includes('</head>')) {
                processedContent = processedContent.replace('</head>', `${cssTag}\n</head>`);
            } else {
                // If no head tag, add at the beginning
                processedContent = `${cssTag}\n${processedContent}`;
            }
        });
        
        // Inject JS files
        const jsFiles = Array.from(allFiles.entries()).filter(([name]) => name.endsWith('.js'));
        jsFiles.forEach(([name, content]) => {
            const jsTag = `<script>/* ${name} */\n${content}\n</script>`;
            
            // Try to inject before closing body tag
            if (processedContent.includes('</body>')) {
                processedContent = processedContent.replace('</body>', `${jsTag}\n</body>`);
            } else {
                // If no body tag, add at the end
                processedContent = `${processedContent}\n${jsTag}`;
            }
        });
        
        // Add console capture script
        processedContent = this.injectConsoleCapture(processedContent);
        
        return processedContent;
    }
    
    findHTMLFile(allFiles) {
        const htmlFiles = Array.from(allFiles.keys()).filter(name => name.endsWith('.html'));
        
        // Prefer index.html
        if (htmlFiles.includes('index.html')) {
            return 'index.html';
        }
        
        // Return first HTML file found
        return htmlFiles[0] || null;
    }
    
    createWrapperHTML(currentFile, currentContent, allFiles) {
        const extension = currentFile.split('.').pop().toLowerCase();
        
        let wrapperHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - ${currentFile}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
        }
        .preview-info {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
            color: #495057;
        }
    </style>`;
        
        // Add all CSS files
        const cssFiles = Array.from(allFiles.entries()).filter(([name]) => name.endsWith('.css'));
        cssFiles.forEach(([name, content]) => {
            wrapperHTML += `\n    <style>/* ${name} */\n${content}\n    </style>`;
        });
        
        wrapperHTML += `\n</head>\n<body>`;
        
        if (extension === 'css') {
            wrapperHTML += `
    <div class="preview-info">
        <h3>CSS Preview: ${currentFile}</h3>
        <p>This is a preview of your CSS file. The styles are applied to this demo content.</p>
    </div>
    <div class="demo-content">
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <p>This is a paragraph with some <strong>bold text</strong> and <em>italic text</em>.</p>
        <ul>
            <li>List item 1</li>
            <li>List item 2</li>
            <li>List item 3</li>
        </ul>
        <button class="btn">Button</button>
        <div class="card">
            <h4>Card Title</h4>
            <p>Card content goes here.</p>
        </div>
    </div>`;
        } else if (extension === 'js') {
            wrapperHTML += `
    <div class="preview-info">
        <h3>JavaScript Preview: ${currentFile}</h3>
        <p>Check the console for JavaScript output. Open Developer Tools to see console messages.</p>
    </div>
    <div id="output"></div>
    <button onclick="testFunction()">Test Function</button>`;
        }
        
        // Add all JS files
        const jsFiles = Array.from(allFiles.entries()).filter(([name]) => name.endsWith('.js'));
        jsFiles.forEach(([name, content]) => {
            wrapperHTML += `\n    <script>/* ${name} */\n${content}\n    </script>`;
        });
        
        wrapperHTML += `\n</body>\n</html>`;
        
        return this.injectConsoleCapture(wrapperHTML);
    }
    
    injectConsoleCapture(htmlContent) {
        const consoleScript = `
<script>
(function() {
    // Capture console messages and send to parent
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    
    function sendToParent(message, type) {
        try {
            window.parent.postMessage({
                type: 'console',
                level: type,
                message: message,
                timestamp: new Date().toISOString()
            }, '*');
        } catch (e) {
            // Ignore errors when posting to parent
        }
    }
    
    console.log = function(...args) {
        originalLog.apply(console, args);
        sendToParent(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '), 'log');
    };
    
    console.error = function(...args) {
        originalError.apply(console, args);
        sendToParent(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '), 'error');
    };
    
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        sendToParent(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '), 'warn');
    };
    
    console.info = function(...args) {
        originalInfo.apply(console, args);
        sendToParent(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '), 'info');
    };
    
    // Capture JavaScript errors
    window.addEventListener('error', function(e) {
        sendToParent(\`\${e.message} at line \${e.lineno}\`, 'error');
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function(e) {
        sendToParent(\`Unhandled promise rejection: \${e.reason}\`, 'error');
    });
})();
</script>`;
        
        // Inject before closing head tag or at the beginning
        if (htmlContent.includes('</head>')) {
            return htmlContent.replace('</head>', `${consoleScript}\n</head>`);
        } else {
            return `${consoleScript}\n${htmlContent}`;
        }
    }
    
    updatePreview(content) {
        // Create blob URL for the content
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Update iframe src
        this.previewFrame.src = url;
        
        // Clean up previous blob URL
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }
        this.currentBlobUrl = url;
    }
    
    updateFullscreenPreview(content) {
        // Create blob URL for the content
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Update iframe src
        this.fullscreenFrame.src = url;
        
        // Clean up previous blob URL
        if (this.currentFullscreenBlobUrl) {
            URL.revokeObjectURL(this.currentFullscreenBlobUrl);
        }
        this.currentFullscreenBlobUrl = url;
    }
    
    handlePreviewLoad() {
        // Setup message listener for console messages
        this.setupConsoleListener();
    }
    
    handleFullscreenLoad() {
        // Setup message listener for fullscreen console messages
        this.setupConsoleListener();
    }
    
    setupConsoleListener() {
        // Listen for console messages from iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'console') {
                if (window.consoleManager) {
                    window.consoleManager.addMessage(
                        event.data.message,
                        event.data.level
                    );
                }
            }
        });
    }
    
    getDefaultPreviewContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Compiler Preview</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container {
            max-width: 600px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
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
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover {
            background: white;
            color: #667eea;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Web Compiler!</h1>
        <p>Start coding to see your live preview here.</p>
        <button class="btn" onclick="alert('Hello from Web Compiler!')">Click Me</button>
    </div>
</body>
</html>`;
    }
    
    setAutoRefresh(enabled) {
        this.autoRefreshEnabled = enabled;
    }
    
    isAutoRefreshEnabled() {
        return this.autoRefreshEnabled;
    }
    
    getCurrentMode() {
        return this.currentMode;
    }
    
    // Cleanup method
    destroy() {
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }
        if (this.currentFullscreenBlobUrl) {
            URL.revokeObjectURL(this.currentFullscreenBlobUrl);
        }
        clearTimeout(this.refreshTimeout);
    }
}

// Initialize preview manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.previewManager = new PreviewManager();
});

