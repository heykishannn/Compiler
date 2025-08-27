/**
 * Console Manager Module
 * Handles console display, logging, and error reporting
 */

class ConsoleManager {
    constructor() {
        this.consolePanel = document.getElementById('consolePanel');
        this.consoleContent = document.getElementById('consoleContent');
        this.isVisible = false;
        this.messages = [];
        this.maxMessages = 1000;
        this.autoScroll = true;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.addWelcomeMessage();
    }
    
    setupEventListeners() {
        // Console button to toggle console
        document.getElementById('consoleBtn').addEventListener('click', () => {
            this.toggleConsole();
        });
        
        // Close console button
        document.getElementById('closeConsole').addEventListener('click', () => {
            this.hideConsole();
        });
        
        // Clear console button
        document.getElementById('clearConsole').addEventListener('click', () => {
            this.clearConsole();
        });
        
        // Auto-scroll toggle (double-click on console content)
        this.consoleContent.addEventListener('dblclick', () => {
            this.toggleAutoScroll();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+` to toggle console
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                this.toggleConsole();
            }
            
            // Ctrl+L to clear console
            if (e.ctrlKey && e.key === 'l' && this.isVisible) {
                e.preventDefault();
                this.clearConsole();
            }
            
            // Escape to close console
            if (e.key === 'Escape' && this.isVisible) {
                this.hideConsole();
            }
        });
        
        // Handle console content scroll
        this.consoleContent.addEventListener('scroll', () => {
            this.handleScroll();
        });
    }
    
    toggleConsole() {
        if (this.isVisible) {
            this.hideConsole();
        } else {
            this.showConsole();
        }
    }
    
    showConsole() {
        this.consolePanel.classList.remove('hidden');
        this.isVisible = true;
        
        // Adjust main content margin
        document.querySelector('.main-content').style.marginBottom = 'var(--console-height)';
        
        // Auto-scroll to bottom
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Update button state
        document.getElementById('consoleBtn').classList.add('active');
    }
    
    hideConsole() {
        this.consolePanel.classList.add('hidden');
        this.isVisible = false;
        
        // Reset main content margin
        document.querySelector('.main-content').style.marginBottom = '0';
        
        // Update button state
        document.getElementById('consoleBtn').classList.remove('active');
    }
    
    addMessage(message, level = 'log', source = null, lineNumber = null) {
        const timestamp = new Date();
        const messageObj = {
            id: Date.now() + Math.random(),
            message: message,
            level: level,
            source: source,
            lineNumber: lineNumber,
            timestamp: timestamp,
            count: 1
        };
        
        // Check for duplicate messages
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage && 
            lastMessage.message === message && 
            lastMessage.level === level &&
            (timestamp - lastMessage.timestamp) < 1000) {
            // Update count for duplicate message
            lastMessage.count++;
            lastMessage.timestamp = timestamp;
            this.updateMessageElement(lastMessage);
            return;
        }
        
        // Add new message
        this.messages.push(messageObj);
        
        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        
        // Create and append message element
        this.createMessageElement(messageObj);
        
        // Auto-scroll if enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Show console if it's an error
        if (level === 'error' && !this.isVisible) {
            this.showConsole();
        }
    }
    
    createMessageElement(messageObj) {
        const messageElement = document.createElement('div');
        messageElement.className = `console-message ${messageObj.level}`;
        messageElement.dataset.messageId = messageObj.id;
        
        const timestamp = this.formatTimestamp(messageObj.timestamp);
        const countBadge = messageObj.count > 1 ? 
            `<span class="message-count">${messageObj.count}</span>` : '';
        
        let sourceInfo = '';
        if (messageObj.source && messageObj.lineNumber) {
            sourceInfo = `<span class="message-source">${messageObj.source}:${messageObj.lineNumber}</span>`;
        }
        
        messageElement.innerHTML = `
            <span class="console-timestamp">[${timestamp}]</span>
            <span class="console-text">${this.formatMessage(messageObj.message)}</span>
            ${countBadge}
            ${sourceInfo}
        `;
        
        this.consoleContent.appendChild(messageElement);
        
        // Add click handler for expandable messages
        if (this.isExpandableMessage(messageObj.message)) {
            messageElement.classList.add('expandable');
            messageElement.addEventListener('click', () => {
                messageElement.classList.toggle('expanded');
            });
        }
    }
    
    updateMessageElement(messageObj) {
        const messageElement = this.consoleContent.querySelector(
            `[data-message-id="${messageObj.id}"]`
        );
        
        if (messageElement) {
            const timestamp = this.formatTimestamp(messageObj.timestamp);
            const countBadge = messageObj.count > 1 ? 
                `<span class="message-count">${messageObj.count}</span>` : '';
            
            let sourceInfo = '';
            if (messageObj.source && messageObj.lineNumber) {
                sourceInfo = `<span class="message-source">${messageObj.source}:${messageObj.lineNumber}</span>`;
            }
            
            messageElement.innerHTML = `
                <span class="console-timestamp">[${timestamp}]</span>
                <span class="console-text">${this.formatMessage(messageObj.message)}</span>
                ${countBadge}
                ${sourceInfo}
            `;
        }
    }
    
    formatMessage(message) {
        if (typeof message === 'string') {
            // Escape HTML
            message = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            // Highlight URLs
            message = message.replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" class="console-link">$1</a>'
            );
            
            // Highlight file paths
            message = message.replace(
                /([a-zA-Z0-9_-]+\.(js|css|html|json))/g,
                '<span class="console-file">$1</span>'
            );
            
            return message;
        }
        
        // For objects, arrays, etc.
        try {
            return `<pre class="console-object">${JSON.stringify(message, null, 2)}</pre>`;
        } catch (e) {
            return String(message);
        }
    }
    
    isExpandableMessage(message) {
        return typeof message === 'object' || 
               (typeof message === 'string' && message.length > 200);
    }
    
    formatTimestamp(timestamp) {
        return timestamp.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    clearConsole() {
        this.messages = [];
        this.consoleContent.innerHTML = '';
        this.addWelcomeMessage();
    }
    
    addWelcomeMessage() {
        this.addMessage('Console ready. Run your code to see output.', 'info');
    }
    
    scrollToBottom() {
        this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
    }
    
    handleScroll() {
        const { scrollTop, scrollHeight, clientHeight } = this.consoleContent;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
        
        // Update auto-scroll based on user scroll position
        this.autoScroll = isAtBottom;
    }
    
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        
        // Show notification
        this.addMessage(
            `Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`,
            'info'
        );
        
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }
    
    // Logging methods for internal use
    log(...args) {
        this.addMessage(args.join(' '), 'log');
    }
    
    info(...args) {
        this.addMessage(args.join(' '), 'info');
    }
    
    warn(...args) {
        this.addMessage(args.join(' '), 'warn');
    }
    
    error(...args) {
        this.addMessage(args.join(' '), 'error');
    }
    
    success(...args) {
        this.addMessage(args.join(' '), 'success');
    }
    
    // Code execution logging
    logCodeExecution(fileName) {
        this.addMessage(`Executing ${fileName}...`, 'info');
    }
    
    logSyntaxError(error, fileName, lineNumber) {
        this.addMessage(
            `Syntax Error in ${fileName}: ${error}`,
            'error',
            fileName,
            lineNumber
        );
    }
    
    logRuntimeError(error, fileName, lineNumber) {
        this.addMessage(
            `Runtime Error: ${error}`,
            'error',
            fileName,
            lineNumber
        );
    }
    
    // File operation logging
    logFileOperation(operation, fileName, success = true) {
        const message = `${operation} ${fileName}`;
        this.addMessage(message, success ? 'success' : 'error');
    }
    
    // Preview logging
    logPreviewUpdate(mode) {
        this.addMessage(`Preview updated (${mode} mode)`, 'info');
    }
    
    // Export console content
    exportConsole() {
        const content = this.messages.map(msg => {
            const timestamp = this.formatTimestamp(msg.timestamp);
            const level = msg.level.toUpperCase();
            const count = msg.count > 1 ? ` (${msg.count}x)` : '';
            return `[${timestamp}] ${level}: ${msg.message}${count}`;
        }).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-log-${new Date().toISOString().slice(0, 19)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addMessage('Console log exported', 'success');
    }
    
    // Filter messages by level
    filterMessages(level) {
        const messageElements = this.consoleContent.querySelectorAll('.console-message');
        
        messageElements.forEach(element => {
            if (level === 'all' || element.classList.contains(level)) {
                element.style.display = 'flex';
            } else {
                element.style.display = 'none';
            }
        });
    }
    
    // Search messages
    searchMessages(query) {
        const messageElements = this.consoleContent.querySelectorAll('.console-message');
        const regex = new RegExp(query, 'i');
        
        messageElements.forEach(element => {
            const text = element.textContent;
            if (!query || regex.test(text)) {
                element.style.display = 'flex';
                
                // Highlight search terms
                if (query) {
                    const textElement = element.querySelector('.console-text');
                    const highlightedText = textElement.innerHTML.replace(
                        new RegExp(`(${query})`, 'gi'),
                        '<mark>$1</mark>'
                    );
                    textElement.innerHTML = highlightedText;
                }
            } else {
                element.style.display = 'none';
            }
        });
    }
    
    // Get console statistics
    getStats() {
        const stats = {
            total: this.messages.length,
            log: 0,
            info: 0,
            warn: 0,
            error: 0,
            success: 0
        };
        
        this.messages.forEach(msg => {
            if (stats.hasOwnProperty(msg.level)) {
                stats[msg.level]++;
            }
        });
        
        return stats;
    }
    
    // Console state management
    getState() {
        return {
            isVisible: this.isVisible,
            autoScroll: this.autoScroll,
            messageCount: this.messages.length
        };
    }
    
    setState(state) {
        if (state.isVisible !== undefined) {
            if (state.isVisible) {
                this.showConsole();
            } else {
                this.hideConsole();
            }
        }
        
        if (state.autoScroll !== undefined) {
            this.autoScroll = state.autoScroll;
        }
    }
}

// Initialize console manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.consoleManager = new ConsoleManager();
});

