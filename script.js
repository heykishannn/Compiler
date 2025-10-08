document.addEventListener('DOMContentLoaded', async () => {
    let currentPath = '/', activeFilePath = null, editor, db;
    let objectURLs = {};

    // --- DATABASE SETUP ---
    const DB_NAME = 'CodeVerseDB-v3'; const STORE_NAME = 'files';
    async function initDb() { db = await idb.openDB(DB_NAME, 1, { upgrade(db) { db.createObjectStore(STORE_NAME, { keyPath: 'path' }); } }); }

    // --- DOM Elements ---
    const mainWrapper = document.querySelector('.main-wrapper');
    const mobileFileManager = document.getElementById('mobile-file-manager');
    const desktopFileManager = document.querySelector('.desktop-file-explorer');
    const overlay = document.getElementById('overlay');
    const previewContainer = document.getElementById('preview-container');
    const previewWrapper = document.getElementById('preview-wrapper');
    const previewFrame = document.getElementById('preview-frame');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const editorContextMenu = document.getElementById('editor-context-menu');
    const consoleOutput = document.getElementById('console-output');

    // --- File System & UI Logic (Simplified for brevity) ---
    const renderFileList = async () => { /* ... (no changes) ... */ };
    const createNode = async (type) => { /* ... (no changes) ... */ };
    const deleteNode = async (path) => { /* ... (no changes) ... */ };
    const setActiveFile = async (path) => { activeFilePath = path; if (path) { const node = await db.get(STORE_NAME, path); editor.setValue(node && !(node.content instanceof Blob) ? node.content || '' : 'Cannot edit binary files.'); editor.setOption('mode', node ? node.mode : 'text/plain'); } else { editor.setValue(''); } await renderFileList(); editor.refresh(); };
    const loadProject = async () => { /* ... (no changes, but using cleaner default code) ... */ };
    function setupEventListeners(container) { /* ... (no changes) ... */ }
    
    // --- Code Execution with Console ---
    let consoleTimeout;
    const runCode = async () => {
        clearTimeout(consoleTimeout);
        consoleOutput.textContent = "Running...";
        consoleOutput.className = 'console-output';

        Object.values(objectURLs).forEach(URL.revokeObjectURL); objectURLs = {};
        const indexNode = await db.get(STORE_NAME, '/index.html');
        if (!indexNode) { previewFrame.srcdoc = `<html><body><h1>index.html not found!</h1></body></html>`; return; }
        
        const allFiles = await db.getAll(STORE_NAME);
        for (const file of allFiles) { if (file.content instanceof Blob) { objectURLs[file.path] = URL.createObjectURL(file.content); } }
        
        let htmlContent = indexNode.content.replace(/(src|href)=["'](?!https?:\/\/|\/\/)(.*?)["']/g, (match, attr, value) => { let path = value.startsWith('/') ? value : new URL(value, 'http://a.com' + currentPath).pathname; return objectURLs[path] ? `${attr}="${objectURLs[path]}"` : match; });
        
        const cssNode = await db.get(STORE_NAME, '/style.css');
        const jsNode = await db.get(STORE_NAME, '/script.js');
        const styleTag = cssNode ? `<style>${cssNode.content}</style>` : '';
        
        // Error handling script
        const consoleHandler = `<script>
            window.onerror = function(message, source, lineno, colno, error) {
                window.parent.postMessage({ type: 'CONSOLE_ERROR', message: message }, '*');
                return true; 
            };
        <\/script>`;
        
        const scriptTag = jsNode ? `<script>${jsNode.content}<\/script>` : '';
        previewFrame.srcdoc = `<html><head>${consoleHandler}${styleTag}</head><body>${htmlContent}${scriptTag}</body></html>`;

        // If no error message is received after a short delay, assume success
        consoleTimeout = setTimeout(() => {
            consoleOutput.textContent = "Success";
            consoleOutput.classList.add('success');
        }, 500);
    };

    // --- UI Interaction Logic ---
    const updatePreviewLayout = () => {
        const containerWidth = previewContainer.clientWidth - 32;
        const containerHeight = previewContainer.clientHeight - 32;

        previewWrapper.style.transform = ''; // Reset transform before calculation

        if (previewWrapper.classList.contains('desktop-scaled-mode')) {
            const scaleX = containerWidth / 1280; const scaleY = containerHeight / 720;
            const scale = Math.min(scaleX, scaleY);
            previewFrame.style.transform = `scale(${scale})`;
            previewWrapper.style.width = `${1280 * scale}px`; previewWrapper.style.height = `${720 * scale}px`;
        } else if (previewWrapper.classList.contains('mobile-mode')) {
            const mobileWidth = 375; const mobileHeight = 812;
            const scaleX = containerWidth / mobileWidth; const scaleY = containerHeight / mobileHeight;
            const scale = Math.min(scaleX, scaleY);
            previewWrapper.style.transform = `scale(${scale})`;
            previewWrapper.style.width = `${mobileWidth}px`; previewWrapper.style.height = `${mobileHeight}px`;
        } else {
             previewWrapper.style.width = ''; previewWrapper.style.height = '';
        }
    };
    
    // --- Event Listeners ---
    document.getElementById('toggle-explorer-btn').addEventListener('click', () => { if (window.innerWidth > 800) { mainWrapper.classList.toggle('explorer-collapsed'); } else { const isOpen = mobileFileManager.classList.contains('open'); mobileFileManager.classList.toggle('open', !isOpen); overlay.classList.toggle('hidden', isOpen); } setTimeout(() => { editor.refresh(); updatePreviewLayout(); }, 310); });
    overlay.addEventListener('click', () => { mobileFileManager.classList.remove('open'); overlay.classList.add('hidden'); });
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.className = 'preview-wrapper desktop-scaled-mode'; updatePreviewLayout(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.className = 'preview-wrapper mobile-mode'; updatePreviewLayout(); });
    window.addEventListener('resize', updatePreviewLayout);
    document.getElementById('fs-preview-btn').addEventListener('click', () => previewContainer.requestFullscreen().catch(err => console.error(err)));
    document.getElementById('run-btn').addEventListener('click', runCode);
    document.getElementById('select-all-btn').addEventListener('click', () => { editor.execCommand('selectAll'); editor.focus(); });
    dropdownMenu.addEventListener('click', e => { const action = e.target.dataset.action; const path = dropdownMenu.dataset.path; if (action && path) { if (action === 'delete') deleteNode(path); } dropdownMenu.classList.add('hidden'); });

    // Listen for messages (errors) from the iframe
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CONSOLE_ERROR') {
            clearTimeout(consoleTimeout);
            consoleOutput.textContent = event.data.message;
            consoleOutput.className = 'console-output error';
        }
    });

    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'dracula', autoCloseTags: true, lineWrapping: false });
    
    // --- Editor Context Menu Logic ---
    editor.on('contextmenu', (cm, event) => { event.preventDefault(); editorContextMenu.style.top = `${event.clientY}px`; editorContextMenu.style.left = `${event.clientX}px`; editorContextMenu.classList.remove('hidden'); });
    editorContextMenu.addEventListener('click', e => {
        const action = e.target.dataset.action; if (!action) return;
        editor.focus(); // Focus editor first
        const selected = editor.getSelection();
        if (action === 'copy') { if (selected) navigator.clipboard.writeText(selected); } 
        else if (action === 'cut') { if (selected) { navigator.clipboard.writeText(selected).then(() => editor.replaceSelection('', 'around')); } } 
        else if (action === 'paste') { navigator.clipboard.readText().then(text => editor.replaceSelection(text)); }
        editorContextMenu.classList.add('hidden');
    });
    document.addEventListener('click', e => { if (!e.target.closest('.file-options-btn')) dropdownMenu.classList.add('hidden'); if (!e.target.closest('#editor-context-menu')) editorContextMenu.classList.add('hidden'); });

    let debounceTimer;
    editor.on('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(async () => { if (activeFilePath) { const node = await db.get(STORE_NAME, activeFilePath); if(node && !(node.content instanceof Blob)) { node.content = editor.getValue(); await db.put(STORE_NAME, node); runCode(); } } }, 500); });

    await initDb();
    // Simplified versions of unchanged functions for final display
    renderFileList = async () => {const allFiles = await db.getAll(STORE_NAME);const folders = new Set();const itemsInCurrentPath = [];allFiles.forEach(item => {if (item.path.startsWith(currentPath)) {const relativePath = item.path.substring(currentPath.length);const parts = relativePath.split('/');if (parts.length === 1 && parts[0] !== '') {itemsInCurrentPath.push({ ...item, name: parts[0] });} else if (parts.length > 1 && !folders.has(parts[0])) {folders.add(parts[0]);itemsInCurrentPath.push({ path: currentPath + parts[0] + '/', type: 'folder', name: parts[0] });}}});document.querySelectorAll('.file-list').forEach(listEl => {listEl.innerHTML = '';itemsInCurrentPath.sort((a, b) => a.name.localeCompare(b.name)).forEach(node => {const li = document.createElement('li');li.className = 'file-item';li.dataset.path = node.path;let icon = node.type === 'folder' ? icons.folder : (icons[node.name.split('.').pop()] || icons.file);li.innerHTML = `<span class="file-name">${node.name}</span><button class="file-options-btn">...</button>`.replace('...', '...');if (node.path === activeFilePath) li.classList.add('active');listEl.appendChild(li);});});document.querySelectorAll('#current-path-display').forEach(d => d.textContent = currentPath);document.querySelectorAll('#back-btn').forEach(b => b.classList.toggle('hidden', currentPath === '/'));};
    loadProject = async () => {const allFiles = await db.getAll(STORE_NAME);if (allFiles.length === 0) {const defaultFiles = [{ path: '/', type: 'folder' }, { path: '/index.html', type: 'file', mode: 'xml', content: `<h1>Hello, CodeVerse!</h1>\n<button onclick="alert('It works!')">Click Me</button>` }, { path: '/style.css', type: 'file', mode: 'css', content: `body { font-family: sans-serif; padding: 20px; } button { padding: 10px; cursor: pointer; }` }, { path: '/script.js', type: 'file', mode: 'javascript', content: `console.log("Welcome!");\n\n// Try writing: alert("Hello); to see an error.` }];for(const file of defaultFiles) await db.put(STORE_NAME, file);}await renderFileList();};
    setupEventListeners(desktopFileManager); setupEventListeners(mobileFileManager);
    
    await loadProject();
    await setActiveFile('/index.html');
    
    document.getElementById('pc-view-btn').click(); 
    setTimeout(updatePreviewLayout, 100); 
});