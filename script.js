document.addEventListener('DOMContentLoaded', () => {
    // DOM एलिमेंट्स
    const editor = document.getElementById('editor');
    const previewWindow = document.getElementById('preview-window');
    const lineNumbers = document.getElementById('line-numbers');
    const runBtn = document.getElementById('run-btn');
    const menuBtn = document.getElementById('menu-btn');
    const fileExplorer = document.getElementById('file-explorer');
    const consoleBtn = document.getElementById('console-btn');
    const consoleOutput = document.getElementById('console-output');
    const closeConsoleBtn = document.getElementById('close-console-btn');
    const consoleMessages = document.getElementById('console-messages');
    
    const newFileBtn = document.getElementById('new-file-btn');
    const fileList = document.getElementById('file-list');
    const currentFileTitle = document.getElementById('current-file-title');
    
    // IndexedDB सेटअप
    let db;
    let currentFile = 'Untitled.html';
    const request = indexedDB.open('proCodeEditorDB', 1);

    request.onupgradeneeded = e => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files', { keyPath: 'name' });
        }
    };
    request.onsuccess = e => {
        db = e.target.result;
        loadFiles();
        loadFileContent(currentFile);
    };
    request.onerror = e => console.error('IndexedDB error:', e.target.errorCode);

    // फ़ाइल फंक्शन्स
    const saveFile = (name, content) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        store.put({ name, content });
    };

    const loadFileContent = (name) => {
        const transaction = db.transaction(['files']);
        const store = transaction.objectStore('files');
        const request = store.get(name);
        request.onsuccess = e => {
            if (e.target.result) {
                editor.value = e.target.result.content;
            } else {
                editor.value = '<!-- Welcome to your new file -->';
            }
            currentFile = name;
            currentFileTitle.textContent = name;
            updateEditor();
            highlightActiveFile();
        };
    };

    const loadFiles = () => {
        const transaction = db.transaction(['files']);
        const store = transaction.objectStore('files');
        const request = store.getAll();
        request.onsuccess = e => {
            fileList.innerHTML = '';
            const files = e.target.result;
            if (files.length === 0) {
                 saveFile(currentFile, '<h1>Hello, World!</h1>');
                 loadFiles(); // Reload to show the new file
            }
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.name;
                li.onclick = () => loadFileContent(file.name);
                fileList.appendChild(li);
            });
            highlightActiveFile();
        };
    };

    newFileBtn.addEventListener('click', () => {
        const fileName = prompt('नई फ़ाइल का नाम:', 'new.html');
        if (fileName) {
            saveFile(fileName, '');
            loadFileContent(fileName);
            loadFiles();
        }
    });
    
    function highlightActiveFile() {
        document.querySelectorAll('#file-list li').forEach(li => {
            li.classList.toggle('active', li.textContent === currentFile);
        });
    }

    // एडिटर और प्रीव्यू
    const runCode = () => {
        const code = editor.value;
        saveFile(currentFile, code); // ऑटो-सेव
        const iframeDoc = previewWindow.contentWindow.document;
        iframeDoc.open();
        // कंसोल में त्रुटियों को पकड़ने के लिए
        iframeDoc.write(`<script>
            window.onerror = function(message, source, lineno, colno, error) {
                window.parent.postMessage({
                    type: 'error',
                    message: message,
                    lineno: lineno
                }, '*');
                return true;
            };
        <\/script>${code}`);
        iframeDoc.close();
        logToConsole('Code Executed.', 'log');
    };

    const updateLineNumbers = () => {
        const lines = editor.value.split('\n').length;
        lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    };
    
    const updateEditor = () => {
        runCode();
        updateLineNumbers();
    }

    editor.addEventListener('input', updateEditor);
    editor.addEventListener('scroll', () => {
        lineNumbers.scrollTop = editor.scrollTop;
    });
    runBtn.addEventListener('click', runCode);
    // Ctrl+S से भी रन करें
    editor.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            runCode();
        }
    });


    // UI टॉगल
    menuBtn.addEventListener('click', () => fileExplorer.classList.toggle('closed'));
    consoleBtn.addEventListener('click', () => consoleOutput.classList.toggle('open'));
    closeConsoleBtn.addEventListener('click', () => consoleOutput.classList.remove('open'));

    // कंसोल लॉगिंग
    function logToConsole(message, type = 'log') {
        const msgElement = document.createElement('div');
        msgElement.className = type; // log, error, warn
        msgElement.textContent = `> ${message}`;
        consoleMessages.appendChild(msgElement);
        consoleMessages.scrollTop = consoleMessages.scrollHeight;
    }

    // iframe से त्रुटि संदेश प्राप्त करना
    window.addEventListener('message', e => {
        if (e.data && e.data.type === 'error') {
            logToConsole(`Error on line ${e.data.lineno}: ${e.data.message}`, 'error');
            if(!consoleOutput.classList.contains('open')) {
                consoleOutput.classList.add('open');
            }
        }
    });

    // कस्टम कॉन्टेक्स्ट मेनू
    const contextMenu = document.getElementById('custom-context-menu');
    editor.addEventListener('contextmenu', e => {
        e.preventDefault();
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.display = 'block';
    });

    document.addEventListener('click', () => contextMenu.style.display = 'none');
    
    document.getElementById('ctx-cut').addEventListener('click', () => document.execCommand('cut'));
    document.getElementById('ctx-copy').addEventListener('click', () => document.execCommand('copy'));
    document.getElementById('ctx-paste').addEventListener('click', () => document.execCommand('paste'));
    document.getElementById('ctx-select-all').addEventListener('click', () => editor.select());

    // आरंभिक लोड
    updateEditor();
});
