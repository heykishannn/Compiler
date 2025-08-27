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
const styleSheet = document.createElement('style');
styleSheet.textContent = fullscreenStyles;
document.head.appendChild(styleSheet);

// Initialize preview when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.preview = new Preview();
});

