/**
 * Code Editor Module
 * Handles syntax highlighting, line numbers, context menu, and editor interactions
 */

class CodeEditor {
    constructor() {
        this.editor = document.getElementById('codeEditor');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.contextMenu = document.getElementById('contextMenu');
        this.currentFile = 'index.html';
        this.files = new Map();
        this.syntaxHighlighter = new SyntaxHighlighter();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateLineNumbers();
        this.loadDefaultContent();
        this.setupContextMenu();
    }
    
    setupEventListeners() {
        // Editor input events
        this.editor.addEventListener('input', (e) => {
            this.handleInput(e);
        });
        
        this.editor.addEventListener('scroll', () => {
            this.syncLineNumbers();
        });
        
        this.editor.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // Context menu events
        this.editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });
        
        // Click outside to hide context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
        
        // Prevent context menu on line numbers
        this.lineNumbers.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Tab management
        this.setupTabEvents();
    }
    
    handleInput(e) {
        const content = this.editor.value;
        
        // Save current file content
        this.files.set(this.currentFile, content);
        
        // Update line numbers
        this.updateLineNumbers();
        
        // Apply syntax highlighting (debounced)
        clearTimeout(this.highlightTimeout);
        this.highlightTimeout = setTimeout(() => {
            this.applySyntaxHighlighting();
        }, 300);
        
        // Auto-refresh preview
        if (window.previewManager) {
            window.previewManager.autoRefresh();
        }
        
        // Update storage
        if (window.storageManager) {
            window.storageManager.saveFile(this.currentFile, content);
        }
    }
    
    handleKeydown(e) {
        // Tab key handling
        if (e.key === 'Tab') {
            e.preventDefault();
            this.insertTab();
        }
        
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveFile();
        }
        
        // Ctrl+A to select all
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }
        
        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            // Browser handles undo
        }
        
        // Ctrl+Y or Ctrl+Shift+Z for redo
        if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            // Browser handles redo
        }
        
        // Auto-close brackets and quotes
        this.handleAutoClose(e);
    }
    
    insertTab() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const value = this.editor.value;
        
        // Insert 4 spaces instead of tab
        const spaces = '    ';
        this.editor.value = value.substring(0, start) + spaces + value.substring(end);
        this.editor.selectionStart = this.editor.selectionEnd = start + spaces.length;
        
        // Trigger input event
        this.editor.dispatchEvent(new Event('input'));
    }
    
    handleAutoClose(e) {
        const pairs = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'",
            '<': '>'
        };
        
        if (pairs[e.key]) {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            // Don't auto-close if there's selected text or if next char is the same
            if (start !== end || value[start] === pairs[e.key]) {
                return;
            }
            
            // Special handling for quotes
            if ((e.key === '"' || e.key === "'") && value[start - 1] === e.key) {
                return;
            }
            
            // Insert closing character
            setTimeout(() => {
                const newStart = this.editor.selectionStart;
                const newValue = this.editor.value;
                this.editor.value = newValue.substring(0, newStart) + pairs[e.key] + newValue.substring(newStart);
                this.editor.selectionStart = this.editor.selectionEnd = newStart;
            }, 0);
        }
    }
    
    updateLineNumbers() {
        const lines = this.editor.value.split('\n');
        const lineCount = lines.length;
        
        let lineNumbersHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHTML += `<div class="line-number">${i}</div>`;
        }
        
        this.lineNumbers.innerHTML = lineNumbersHTML;
        this.syncLineNumbers();
    }
    
    syncLineNumbers() {
        this.lineNumbers.scrollTop = this.editor.scrollTop;
    }
    
    applySyntaxHighlighting() {
        // This is a simplified syntax highlighting
        // In a real implementation, you might use a library like Prism.js or CodeMirror
        const content = this.editor.value;
        const fileExtension = this.getFileExtension(this.currentFile);
        
        // Add syntax highlighting classes to the editor
        this.editor.className = `code-editor syntax-${fileExtension}`;
        
        // Check for syntax errors
        this.checkSyntaxErrors(content, fileExtension);
    }
    
    checkSyntaxErrors(content, fileExtension) {
        const errors = [];
        
        if (fileExtension === 'html') {
            errors.push(...this.checkHTMLErrors(content));
        } else if (fileExtension === 'css') {
            errors.push(...this.checkCSSErrors(content));
        } else if (fileExtension === 'js') {
            errors.push(...this.checkJSErrors(content));
        }
        
        this.displayErrors(errors);
    }
    
    checkHTMLErrors(content) {
        const errors = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Check for unclosed tags (simplified)
            const openTags = line.match(/<[^\/][^>]*>/g) || [];
            const closeTags = line.match(/<\/[^>]*>/g) || [];
            
            openTags.forEach(tag => {
                const tagName = tag.match(/<([^\s>]+)/)?.[1];
                if (tagName && !['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName.toLowerCase())) {
                    const closeTag = `</${tagName}>`;
                    if (!line.includes(closeTag) && !closeTags.some(ct => ct.includes(tagName))) {
                        // This is a simplified check - in reality, tags can span multiple lines
                    }
                }
            });
        });
        
        return errors;
    }
    
    checkCSSErrors(content) {
        const errors = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Check for missing semicolons
            if (line.includes(':') && !line.includes(';') && !line.includes('{') && !line.includes('}') && line.trim() !== '') {
                errors.push({
                    line: index + 1,
                    message: 'Missing semicolon',
                    type: 'warning'
                });
            }
            
            // Check for unmatched braces
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            if (openBraces !== closeBraces && (openBraces > 0 || closeBraces > 0)) {
                // This is a simplified check
            }
        });
        
        return errors;
    }
    
    checkJSErrors(content) {
        const errors = [];
        
        try {
            // Use Function constructor to check for syntax errors
            new Function(content);
        } catch (error) {
            const match = error.message.match(/line (\d+)/);
            const lineNumber = match ? parseInt(match[1]) : 1;
            
            errors.push({
                line: lineNumber,
                message: error.message,
                type: 'error'
            });
        }
        
        return errors;
    }
    
    displayErrors(errors) {
        // Remove existing error highlights
        this.editor.classList.remove('has-errors');
        
        if (errors.length > 0) {
            this.editor.classList.add('has-errors');
            
            // Log errors to console
            if (window.consoleManager) {
                errors.forEach(error => {
                    window.consoleManager.addMessage(
                        `Line ${error.line}: ${error.message}`,
                        error.type
                    );
                });
            }
        }
    }
    
    setupContextMenu() {
        const contextItems = this.contextMenu.querySelectorAll('.context-item');
        
        contextItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextAction(action);
                this.hideContextMenu();
            });
        });
    }
    
    showContextMenu(e) {
        const x = e.clientX;
        const y = e.clientY;
        
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');
        
        // Adjust position if menu goes off screen
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.contextMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.contextMenu.style.top = `${y - rect.height}px`;
        }
    }
    
    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
    }
    
    handleContextAction(action) {
        switch (action) {
            case 'selectAll':
                this.selectAll();
                break;
            case 'copy':
                this.copySelection();
                break;
            case 'cut':
                this.cutSelection();
                break;
            case 'paste':
                this.pasteFromClipboard();
                break;
        }
    }
    
    selectAll() {
        this.editor.select();
    }
    
    copySelection() {
        const selectedText = this.editor.value.substring(
            this.editor.selectionStart,
            this.editor.selectionEnd
        );
        
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    }
    
    cutSelection() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);
        
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                const value = this.editor.value;
                this.editor.value = value.substring(0, start) + value.substring(end);
                this.editor.selectionStart = this.editor.selectionEnd = start;
                this.editor.dispatchEvent(new Event('input'));
            }).catch(err => {
                console.error('Failed to cut text: ', err);
            });
        }
    }
    
    pasteFromClipboard() {
        navigator.clipboard.readText().then(text => {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            this.editor.value = value.substring(0, start) + text + value.substring(end);
            this.editor.selectionStart = this.editor.selectionEnd = start + text.length;
            this.editor.dispatchEvent(new Event('input'));
        }).catch(err => {
            console.error('Failed to paste text: ', err);
        });
    }
    
    setupTabEvents() {
        const tabContainer = document.querySelector('.file-tabs');
        
        tabContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-tab')) {
                e.stopPropagation();
                const tab = e.target.closest('.file-tab');
                const fileName = tab.dataset.file;
                this.closeTab(fileName);
            } else if (e.target.closest('.file-tab')) {
                const tab = e.target.closest('.file-tab');
                const fileName = tab.dataset.file;
                this.switchToFile(fileName);
            }
        });
    }
    
    openFile(fileName, content = '') {
        // Add to files map
        this.files.set(fileName, content);
        
        // Create tab if it doesn't exist
        this.createTab(fileName);
        
        // Switch to the file
        this.switchToFile(fileName);
    }
    
    createTab(fileName) {
        const tabContainer = document.querySelector('.file-tabs');
        const existingTab = tabContainer.querySelector(`[data-file="${fileName}"]`);
        
        if (!existingTab) {
            const tab = document.createElement('div');
            tab.className = 'file-tab';
            tab.dataset.file = fileName;
            tab.innerHTML = `
                <span>${fileName}</span>
                <button class="close-tab">×</button>
            `;
            
            tabContainer.appendChild(tab);
        }
    }
    
    switchToFile(fileName) {
        // Save current file content
        if (this.currentFile) {
            this.files.set(this.currentFile, this.editor.value);
        }
        
        // Switch to new file
        this.currentFile = fileName;
        const content = this.files.get(fileName) || '';
        this.editor.value = content;
        
        // Update UI
        this.updateActiveTab(fileName);
        this.updateLineNumbers();
        this.applySyntaxHighlighting();
        
        // Update preview
        if (window.previewManager) {
            window.previewManager.refresh();
        }
    }
    
    updateActiveTab(fileName) {
        const tabs = document.querySelectorAll('.file-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.file === fileName);
        });
    }
    
    closeTab(fileName) {
        const tabs = document.querySelectorAll('.file-tab');
        const tab = document.querySelector(`[data-file="${fileName}"]`);
        
        if (tab) {
            tab.remove();
            this.files.delete(fileName);
            
            // If closing current file, switch to another
            if (this.currentFile === fileName) {
                const remainingTabs = document.querySelectorAll('.file-tab');
                if (remainingTabs.length > 0) {
                    const nextFile = remainingTabs[0].dataset.file;
                    this.switchToFile(nextFile);
                } else {
                    // No tabs left, create default
                    this.createDefaultFile();
                }
            }
        }
    }
    
    createDefaultFile() {
        const defaultContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Document</title>
</head>
<body>
    <h1>Hello World!</h1>
</body>
</html>`;
        
        this.openFile('index.html', defaultContent);
    }
    
    saveFile() {
        const content = this.editor.value;
        this.files.set(this.currentFile, content);
        
        if (window.storageManager) {
            window.storageManager.saveFile(this.currentFile, content);
        }
        
        // Show save indicator
        this.showSaveIndicator();
    }
    
    showSaveIndicator() {
        const tab = document.querySelector(`[data-file="${this.currentFile}"]`);
        if (tab) {
            tab.classList.add('saved');
            setTimeout(() => {
                tab.classList.remove('saved');
            }, 1000);
        }
    }
    
    loadDefaultContent() {
        const defaultContent = this.editor.value;
        this.files.set(this.currentFile, defaultContent);
        this.applySyntaxHighlighting();
    }
    
    getFileExtension(fileName) {
        return fileName.split('.').pop().toLowerCase();
    }
    
    getCurrentContent() {
        return this.editor.value;
    }
    
    getCurrentFile() {
        return this.currentFile;
    }
    
    getAllFiles() {
        // Update current file content
        this.files.set(this.currentFile, this.editor.value);
        return new Map(this.files);
    }
}

/**
 * Simple Syntax Highlighter
 */
class SyntaxHighlighter {
    constructor() {
        this.htmlKeywords = ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        this.cssKeywords = ['color', 'background', 'font', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position'];
        this.jsKeywords = ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'class', 'extends'];
    }
    
    highlight(content, language) {
        // This is a placeholder for syntax highlighting
        // In a real implementation, you would use a proper syntax highlighting library
        return content;
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.codeEditor = new CodeEditor();
});

