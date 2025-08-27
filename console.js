class ConsoleManager {
    constructor() {
        this.console = document.getElementById('console');
        this.consoleOutput = document.getElementById('consoleOutput');
        this.toggleBtn = document.getElementById('toggleConsole');
        this.clearBtn = document.getElementById('clearConsole');
        this.closeBtn = document.getElementById('closeConsole');
        
        this.isVisible = false;
        this.messages = [];
        this.maxMessages = 1000; // Limit messages to prevent memory issues
        
        this.setupEventListeners();
        this.interceptConsole();
    }

    setupEventListeners() {
        // Toggle console visibility
        this.toggleBtn.addEventListener('click', () => {
            this.toggle();
        });

        // Clear console
        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Close console
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Auto-scroll to bottom when new messages arrive
        this.consoleOutput.addEventListener('DOMNodeInserted', () => {
            this.scrollToBottom();
        });
    }

    interceptConsole() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };

        // Override console methods to capture messages
        console.log = (...args) => {
            this.originalConsole.log.apply(console, args);
            this.addMessage('log', this.formatArgs(args));
        };

        console.error = (...args) => {
            this.originalConsole.error.apply(console, args);
            this.addMessage('error', this.formatArgs(args));
        };

        console.warn = (...args) => {
            this.originalConsole.warn.apply(console, args);
            this.addMessage('warn', this.formatArgs(args));
        };

        console.info = (...args) => {
            this.originalConsole.info.apply(console, args);
            this.addMessage('info', this.formatArgs(args));
        };

        // Capture unhandled errors
        window.addEventListener('error', (e) => {
            this.addMessage('error', `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.addMessage('error', `Unhandled promise rejection: ${e.reason}`);
        });
    }

    formatArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    addMessage(level, message, timestamp = null) {
        const time = timestamp || new Date();
        const messageObj = {
            level,
            message,
            timestamp: time,
            id: Date.now() + Math.random()
        };

        this.messages.push(messageObj);

        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }

        // Create message element
        const messageElement = this.createMessageElement(messageObj);
        this.consoleOutput.appendChild(messageElement);

        // Auto-show console for errors
        if (level === 'error' && !this.isVisible) {
            this.show();
        }

        // Update toggle button to show activity
        this.updateToggleButton();
    }

    createMessageElement(messageObj) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `console-message ${messageObj.level}`;
        messageDiv.dataset.id = messageObj.id;

        const timestamp = this.formatTimestamp(messageObj.timestamp);
        const levelIcon = this.getLevelIcon(messageObj.level);
        
        messageDiv.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="level-icon">${levelIcon}</span>
            <span class="message-content">${this.escapeHtml(messageObj.message)}</span>
        `;

        // Add click to expand/collapse for long messages
        if (messageObj.message.length > 200) {
            messageDiv.classList.add('expandable');
            messageDiv.addEventListener('click', () => {
                messageDiv.classList.toggle('expanded');
            });
        }

        return messageDiv;
    }

    getLevelIcon(level) {
        const icons = {
            log: '📝',
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️'
        };
        return icons[level] || '📝';
    }

    formatTimestamp(date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    show() {
        this.console.classList.add('visible');
        this.isVisible = true;
        this.toggleBtn.classList.add('active');
        this.scrollToBottom();
        
        // Adjust main container height
        this.adjustMainContainerHeight();
    }

    hide() {
        this.console.classList.remove('visible');
        this.isVisible = false;
        this.toggleBtn.classList.remove('active');
        
        // Restore main container height
        this.adjustMainContainerHeight();
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    clear() {
        this.messages = [];
        this.consoleOutput.innerHTML = '';
        this.addMessage('info', 'Console cleared');
    }

    scrollToBottom() {
        setTimeout(() => {
            this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
        }, 10);
    }

    adjustMainContainerHeight() {
        const mainContainer = document.querySelector('.main-container');
        if (this.isVisible) {
            mainContainer.style.height = 'calc(100vh - 50px - 200px)';
        } else {
            mainContainer.style.height = 'calc(100vh - 50px)';
        }
    }

    updateToggleButton() {
        // Add visual indicator for new messages
        if (!this.isVisible) {
            this.toggleBtn.classList.add('has-new-messages');
            setTimeout(() => {
                this.toggleBtn.classList.remove('has-new-messages');
            }, 2000);
        }
    }

    // Public methods for external use
    logMessage(message) {
        this.addMessage('log', message);
    }

    errorMessage(message) {
        this.addMessage('error', message);
    }

    warnMessage(message) {
        this.addMessage('warn', message);
    }

    infoMessage(message) {
        this.addMessage('info', message);
    }

    getMessages() {
        return [...this.messages];
    }

    exportMessages() {
        const exportData = this.messages.map(msg => ({
            timestamp: msg.timestamp.toISOString(),
            level: msg.level,
            message: msg.message
        }));

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-log-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Filter messages by level
    filterByLevel(level) {
        const messages = this.consoleOutput.querySelectorAll('.console-message');
        messages.forEach(msg => {
            if (level === 'all' || msg.classList.contains(level)) {
                msg.style.display = 'block';
            } else {
                msg.style.display = 'none';
            }
        });
    }

    // Search messages
    searchMessages(query) {
        const messages = this.consoleOutput.querySelectorAll('.console-message');
        const searchTerm = query.toLowerCase();
        
        messages.forEach(msg => {
            const content = msg.textContent.toLowerCase();
            if (!query || content.includes(searchTerm)) {
                msg.style.display = 'block';
                // Highlight search term
                if (query) {
                    this.highlightSearchTerm(msg, query);
                }
            } else {
                msg.style.display = 'none';
            }
        });
    }

    highlightSearchTerm(element, term) {
        const content = element.querySelector('.message-content');
        if (content) {
            const text = content.textContent;
            const regex = new RegExp(`(${term})`, 'gi');
            const highlightedText = text.replace(regex, '<mark>$1</mark>');
            content.innerHTML = highlightedText;
        }
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        // Monitor performance and log metrics
        if (window.performance && window.performance.mark) {
            setInterval(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                if (navigation) {
                    this.addMessage('info', `Page load time: ${Math.round(navigation.loadEventEnd - navigation.loadEventStart)}ms`);
                }
            }, 30000); // Every 30 seconds
        }
    }
}

// Add console-specific CSS
const consoleStyle = document.createElement('style');
consoleStyle.textContent = `
    .console-message.expandable {
        cursor: pointer;
    }
    
    .console-message.expandable .message-content {
        max-height: 60px;
        overflow: hidden;
        position: relative;
    }
    
    .console-message.expandable.expanded .message-content {
        max-height: none;
    }
    
    .console-message.expandable:not(.expanded) .message-content::after {
        content: '...';
        position: absolute;
        bottom: 0;
        right: 0;
        background: #1e1e1e;
        padding-left: 10px;
    }
    
    .btn-icon.has-new-messages {
        animation: pulse 1s ease-in-out;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
    
    .console-message mark {
        background: #ffd700;
        color: #000;
        padding: 1px 2px;
        border-radius: 2px;
    }
    
    .level-icon {
        margin-right: 8px;
        font-size: 12px;
    }
`;
document.head.appendChild(consoleStyle);

// Global console instance
window.consoleManager = new ConsoleManager();

