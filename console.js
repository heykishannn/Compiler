class ConsoleManager {
    constructor() {
        this.console = document.getElementById('console');
        this.consoleOutput = document.getElementById('consoleOutput');
        this.isOpen = false;
        this.logs = [];
        this.maxLogs = 1000; // Maximum number of logs to keep
        this.autoScroll = true;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.addWelcomeMessage();
    }

    setupEventListeners() {
        // Console toggle button
        document.getElementById('toggleConsole').addEventListener('click', () => {
            this.toggle();
        });

        // Clear console button
        document.getElementById('clearConsole').addEventListener('click', () => {
            this.clear();
        });

        // Auto-scroll toggle on scroll
        this.consoleOutput.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this.consoleOutput;
            this.autoScroll = scrollTop + clientHeight >= scrollHeight - 10;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + ` to toggle console
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                this.toggle();
            }
            
            // Ctrl/Cmd + K to clear console (when console is focused)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && this.isOpen) {
                e.preventDefault();
                this.clear();
            }
        });

        // Handle window resize to adjust console height
        window.addEventListener('resize', () => {
            this.adjustHeight();
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.console.classList.add('open');
        this.isOpen = true;
        
        // Update toggle button
        const toggleBtn = document.getElementById('toggleConsole');
        toggleBtn.classList.add('active');
        
        // Scroll to bottom if auto-scroll is enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Adjust main container height
        this.adjustMainContainer();
    }

    close() {
        this.console.classList.remove('open');
        this.isOpen = false;
        
        // Update toggle button
        const toggleBtn = document.getElementById('toggleConsole');
        toggleBtn.classList.remove('active');
        
        // Restore main container height
        this.adjustMainContainer();
    }

    adjustMainContainer() {
        const mainContainer = document.querySelector('.main-container');
        if (this.isOpen) {
            mainContainer.style.height = 'calc(100vh - 48px - 200px)';
        } else {
            mainContainer.style.height = 'calc(100vh - 48px)';
        }
        
        // Refresh editor and preview
        if (window.editor) {
            setTimeout(() => window.editor.refresh(), 100);
        }
        if (window.preview) {
            setTimeout(() => window.preview.updateScaling(), 100);
        }
    }

    adjustHeight() {
        if (this.isOpen) {
            this.adjustMainContainer();
        }
    }

    addLog(level, message, timestamp = new Date()) {
        const logEntry = {
            level: level,
            message: message,
            timestamp: timestamp,
            id: Date.now() + Math.random()
        };
        
        this.logs.push(logEntry);
        
        // Remove old logs if we exceed the maximum
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        
        // Add to DOM
        this.renderLog(logEntry);
        
        // Auto-scroll if enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Auto-open console on errors
        if (level === 'error' && !this.isOpen) {
            this.open();
        }
    }

    renderLog(logEntry) {
        const logElement = document.createElement('div');
        logElement.className = `console-log ${logEntry.level}`;
        logElement.dataset.id = logEntry.id;
        
        const timestamp = this.formatTimestamp(logEntry.timestamp);
        const levelIcon = this.getLevelIcon(logEntry.level);
        
        logElement.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-level">${levelIcon}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;
        
        this.consoleOutput.appendChild(logElement);
        
        // Limit DOM elements to prevent performance issues
        const logElements = this.consoleOutput.children;
        if (logElements.length > this.maxLogs) {
            logElements[0].remove();
        }
    }

    getLevelIcon(level) {
        const icons = {
            'log': '📝',
            'info': 'ℹ️',
            'warn': '⚠️',
            'error': '❌'
        };
        return icons[level] || '📝';
    }

    formatTimestamp(timestamp) {
        return timestamp.toLocaleTimeString('en-US', {
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

    clear() {
        this.logs = [];
        this.consoleOutput.innerHTML = '';
        this.addWelcomeMessage();
        
        // Visual feedback
        const clearBtn = document.getElementById('clearConsole');
        const originalIcon = clearBtn.innerHTML;
        clearBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            clearBtn.innerHTML = originalIcon;
        }, 1000);
    }

    scrollToBottom() {
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    addWelcomeMessage() {
        this.addLog('info', 'Console ready. Logs from the preview will appear here.');
    }

    // Public methods for external logging
    log(message) {
        this.addLog('log', message);
    }

    info(message) {
        this.addLog('info', message);
    }

    warn(message) {
        this.addLog('warn', message);
    }

    error(message) {
        this.addLog('error', message);
    }

    // Export logs functionality
    exportLogs() {
        const logsText = this.logs.map(log => {
            return `[${this.formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`;
        }).join('\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Filter logs by level
    filterLogs(level) {
        const logElements = this.consoleOutput.querySelectorAll('.console-log');
        
        logElements.forEach(element => {
            if (level === 'all' || element.classList.contains(level)) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Search logs
    searchLogs(query) {
        const logElements = this.consoleOutput.querySelectorAll('.console-log');
        const searchTerm = query.toLowerCase();
        
        logElements.forEach(element => {
            const message = element.querySelector('.log-message').textContent.toLowerCase();
            if (!query || message.includes(searchTerm)) {
                element.style.display = 'block';
                
                // Highlight search term
                if (query) {
                    this.highlightText(element.querySelector('.log-message'), query);
                }
            } else {
                element.style.display = 'none';
            }
        });
    }

    highlightText(element, searchTerm) {
        const text = element.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlightedText = text.replace(regex, '<mark>$1</mark>');
        element.innerHTML = highlightedText;
    }

    // Get console statistics
    getStats() {
        const stats = {
            total: this.logs.length,
            log: 0,
            info: 0,
            warn: 0,
            error: 0
        };
        
        this.logs.forEach(log => {
            stats[log.level]++;
        });
        
        return stats;
    }

    // Check if console is open
    isConsoleOpen() {
        return this.isOpen;
    }

    // Set auto-scroll behavior
    setAutoScroll(enabled) {
        this.autoScroll = enabled;
    }
}

// Add console-specific styles
const consoleStyles = `
.console-log {
    display: flex;
    align-items: flex-start;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
}

.log-timestamp {
    color: #666;
    margin-right: 8px;
    min-width: 70px;
    font-size: 11px;
}

.log-level {
    margin-right: 8px;
    min-width: 20px;
}

.log-message {
    flex: 1;
    word-break: break-word;
    white-space: pre-wrap;
}

.console-log.error .log-message {
    color: #f48771;
}

.console-log.warn .log-message {
    color: #dcdcaa;
}

.console-log.info .log-message {
    color: #9cdcfe;
}

.console-log.log .log-message {
    color: #d4d4d4;
}

/* Highlight for search results */
.log-message mark {
    background: #ffd700;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
}

/* Console animation improvements */
.console {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.console.open {
    transform: translateY(0);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
    .console {
        height: 150px;
    }
    
    .console.open ~ .main-container {
        height: calc(100vh - 48px - 150px) !important;
    }
    
    .log-timestamp {
        display: none;
    }
    
    .console-log {
        font-size: 11px;
    }
}
`;

// Inject console styles
const consoleStyleSheet = document.createElement('style');
consoleStyleSheet.textContent = consoleStyles;
document.head.appendChild(consoleStyleSheet);

// Initialize console manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.consoleManager = new ConsoleManager();
});

