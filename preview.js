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

