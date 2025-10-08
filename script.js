document.addEventListener('DOMContentLoaded', async () => {
    let currentPath = '/', activeFilePath = null, editor, db;
    let objectURLs = {};

    const DB_NAME = 'CodeVerseDB-v3'; const STORE_NAME = 'files';
    async function initDb() { db = await idb.openDB(DB_NAME, 1, { upgrade(db) { db.createObjectStore(STORE_NAME, { keyPath: 'path' }); } }); }

    const mainWrapper = document.querySelector('.main-wrapper');
    const mobileFileManager = document.getElementById('mobile-file-manager');
    const desktopFileManager = document.querySelector('.desktop-file-explorer');
    const overlay = document.getElementById('overlay');
    const previewContainer = document.getElementById('preview-container');
    const previewWrapper = document.getElementById('preview-wrapper');
    const previewFrame = document.getElementById('preview-frame');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const editorContextMenu = document.getElementById('editor-context-menu');
    const consoleContainer = document.getElementById('console-container');
    const consoleOutput = document.getElementById('console-output');
    const consoleBtn = document.getElementById('console-btn');
    const errorIndicator = document.querySelector('.error-indicator');
    
    // ... icons and fileManagerHTML unchanged ...

    // --- File System & UI Logic (Minor Changes) ---
    // ... renderFileList, createNode, deleteNode are unchanged ...
    const setActiveFile = async (path) => { activeFilePath = path; if (path) { const node = await db.get(STORE_NAME, path); editor.setValue(node && !(node.content instanceof Blob) ? node.content || '' : 'Cannot edit binary files.'); editor.setOption('mode', node ? node.mode : 'text/plain'); } else { editor.setValue(''); } await renderFileList(); editor.refresh(); };
    const loadProject = async () => { const allFiles = await db.getAll(STORE_NAME); if (allFiles.length === 0) { const defaultFiles = [{ path: '/', type: 'folder' }, { path: '/index.html', type: 'file', mode: 'xml', content: `<h1>Hello!</h1>\n<button onclick="test()">Click Me</button>` }, { path: '/style.css', type: 'file', mode: 'css', content: `body { font-family: sans-serif; }` }, { path: '/script.js', type: 'file', mode: 'javascript', content: `function test() {\n  console.log("Button was clicked!");\n  // Try creating an error:\n  // let x = y;\n}` }]; for(const file of defaultFiles) await db.put(STORE_NAME, file); } await renderFileList(); };

    // --- अपडेट किया गया Code Execution with Console ---
    const runCode = async () => {
        errorIndicator.classList.add('hidden'); // हर रन पर इंडिकेटर रीसेट करें
        Object.values(objectURLs).forEach(URL.revokeObjectURL); objectURLs = {};
        const indexNode = await db.get(STORE_NAME, '/index.html');
        if (!indexNode) { previewFrame.srcdoc = `...`; return; }
        let htmlContent = indexNode.content; const allFiles = await db.getAll(STORE_NAME);
        for (const file of allFiles) { if (file.content instanceof Blob) { objectURLs[file.path] = URL.createObjectURL(file.content); } }
        htmlContent = htmlContent.replace(/(src|href)=["'](?!https?:\/\/|\/\/)(.*?)["']/g, (match, attr, value) => { let path = value.startsWith('/') ? value : new URL(value, 'http://a.com' + currentPath).pathname; return objectURLs[path] ? `${attr}="${objectURLs[path]}"` : match; });
        const cssNode = await db.get(STORE_NAME, '/style.css'); const jsNode = await db.get(STORE_NAME, '/script.js');
        const styleTag = cssNode ? `<style>${cssNode.content}</style>` : '';
        
        const injectedScript = `
            <script>
                const sendLog = (type, message) => window.parent.postMessage({ type: 'console', level: type, message: message }, '*');
                
                // console.log, console.error, etc. को ओवरराइड करें
                const originalConsole = { ...window.console };
                window.console.log = (...args) => { sendLog('log', args.join(' ')); originalConsole.log(...args); };
                window.console.error = (...args) => { sendLog('error', args.join(' ')); originalConsole.error(...args); };
                window.console.warn = (...args) => { sendLog('warn', args.join(' ')); originalConsole.warn(...args); };
                
                // रनटाइम त्रुटियों को पकड़ें
                window.onerror = (message, source, lineno, colno, error) => {
                    sendLog('error', \`\${message} (line: \${lineno})\`);
                };
                
                // यूजर का कोड चलाएं
                try {
                    ${jsNode ? jsNode.content : ''}
                } catch (e) {
                    sendLog('error', e.message);
                }
            <\/script>
        `;
        previewFrame.srcdoc = `<html><head>${styleTag}</head><body>${htmlContent}${injectedScript}</body></html>`;
    };

    // --- Event Listeners ---
    // ... setupEventListeners for file manager unchanged ...
    
    // --- Console Logic ---
    window.addEventListener('message', event => {
        if (event.data.type === 'console') {
            const { level, message } = event.data;
            const logEntry = document.createElement('div');
            logEntry.className = `console-${level}`;
            logEntry.textContent = `> ${message}`;
            consoleOutput.appendChild(logEntry);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
            if (level === 'error') {
                errorIndicator.classList.remove('hidden');
            }
        }
    });
    consoleBtn.addEventListener('click', () => consoleContainer.classList.toggle('hidden'));
    document.getElementById('clear-console-btn').addEventListener('click', () => consoleOutput.innerHTML = '');

    // --- UI Interaction Logic ---
    const updatePreviewLayout = () => {
        const isFullscreen = !!document.fullscreenElement;
        const container = isFullscreen ? document.body : previewContainer;
        const containerWidth = container.clientWidth - (isFullscreen ? 0 : 32);
        const containerHeight = container.clientHeight - (isFullscreen ? 0 : 32);

        if (previewWrapper.classList.contains('desktop-scaled-mode') && !isFullscreen) {
            const scaleX = containerWidth / 1280; const scaleY = containerHeight / 720;
            const scale = Math.min(scaleX, scaleY);
            previewFrame.style.transform = `scale(${scale})`;
            previewWrapper.style.width = `${1280 * scale}px`; previewWrapper.style.height = `${720 * scale}px`;
        } else if (previewWrapper.classList.contains('mobile-mode')) {
            const mobileWidth = 375; const mobileHeight = 812;
            const scaleX = containerWidth / mobileWidth; const scaleY = containerHeight / mobileHeight;
            const scale = Math.min(scaleX, scaleY);
            if (!isFullscreen) { // केवल होम स्क्रीन पर रैपर को स्केल करें
                previewWrapper.style.transform = `scale(${scale})`;
            }
            previewWrapper.style.width = `${mobileWidth}px`; previewWrapper.style.height = `${mobileHeight}px`;
        } else {
            previewFrame.style.transform = '';
            previewWrapper.style.transform = '';
            previewWrapper.style.width = '100%';
            previewWrapper.style.height = '100%';
        }
    };
    document.getElementById('toggle-explorer-btn').addEventListener('click', () => { if (window.innerWidth > 800) { mainWrapper.classList.toggle('explorer-collapsed'); } else { const isOpen = mobileFileManager.classList.contains('open'); mobileFileManager.classList.toggle('open', !isOpen); overlay.classList.toggle('hidden', isOpen); } setTimeout(() => { editor.refresh(); updatePreviewLayout(); }, 310); });
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.classList.remove('mobile-mode'); previewWrapper.classList.add('desktop-scaled-mode'); updatePreviewLayout(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.classList.remove('desktop-scaled-mode'); previewWrapper.classList.add('mobile-mode'); updatePreviewLayout(); });
    window.addEventListener('resize', updatePreviewLayout);
    document.addEventListener('fullscreenchange', updatePreviewLayout);
    document.getElementById('fs-preview-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) { previewContainer.requestFullscreen(); } else { document.exitFullscreen(); }
    });
    
    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'dracula', autoCloseTags: true, lineWrapping: false });
    
    // --- एडिटर मेनू (कट/कॉपी/पेस्ट) ---
    editor.on('contextmenu', (cm, event) => { event.preventDefault(); if (editor.getSelection()) { editorContextMenu.style.top = `${event.clientY}px`; editorContextMenu.style.left = `${event.clientX}px`; editorContextMenu.classList.remove('hidden'); } });
    editorContextMenu.addEventListener('click', e => {
        const action = e.target.dataset.action; if (!action) return;
        if (action === 'cut') {
            const selection = editor.getSelection();
            if(selection) navigator.clipboard.writeText(selection).then(() => editor.replaceSelection(""));
        } else if (action === 'copy') {
             const selection = editor.getSelection();
             if(selection) navigator.clipboard.writeText(selection);
        } else if (action === 'paste') {
            navigator.clipboard.readText().then(text => editor.replaceSelection(text));
        }
        editorContextMenu.classList.add('hidden'); editor.focus();
    });
    document.getElementById('select-all-btn').addEventListener('click', () => { editor.execCommand('selectAll'); editor.focus(); });
    
    let debounceTimer;
    editor.on('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(async () => { if (activeFilePath) { const node = await db.get(STORE_NAME, activeFilePath); if(node && !(node.content instanceof Blob)) { node.content = editor.getValue(); await db.put(STORE_NAME, node); runCode(); } } }, 500); });

    await initDb();
    await loadProject();
    await setActiveFile('/index.html');
    document.getElementById('pc-view-btn').click();
    setTimeout(updatePreviewLayout, 100);
});