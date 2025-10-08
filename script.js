document.addEventListener('DOMContentLoaded', async () => {
    let currentPath = '/', activeFilePath = null, editor, db;
    
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
    const consoleStatusBtn = document.getElementById('console-status');

    // --- File System & UI Logic (Simplified for brevity, no changes here) ---
    const fileManagerHTML = `<div class="file-manager-container"><div class="file-manager-header"><button id="back-btn" title="Go Back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button><div id="current-path-display">/</div><div class="file-actions"><input type="file" class="file-importer" style="display:none;" multiple><button class="import-file-btn" title="Import File"><svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg></button><button class="new-file-btn" title="New File"><svg viewBox="0 0 24 24"><path d="M13 9h5.5L13 3.5V9M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m5 10v-2h-2v2H9v2h2v2h2v-2h2v-2h-2z"/></svg></button><button class="new-folder-btn" title="New Folder"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg></button></div></div><ul class="file-list"></ul></div>`;
    desktopFileManager.innerHTML = fileManagerHTML; mobileFileManager.innerHTML = fileManagerHTML;
    const renderFileList = async () => {/* ... same as before ... */}; const createNode = async (type) => {/* ... */}; const deleteNode = async (path) => {/* ... */};
    const setActiveFile = async (path) => { activeFilePath = path; if (path) { const node = await db.get(STORE_NAME, path); editor.setValue(node && typeof node.content === 'string' ? node.content : ''); editor.setOption('mode', node ? node.mode : 'text/plain'); } else { editor.setValue(''); } await renderFileList(); editor.refresh(); };
    const runCode = async () => {/* ... same as before ... */};
    const loadProject = async () => { const allFiles = await db.getAll(STORE_NAME); if (allFiles.length === 0) { const defaultFiles = [{ path: '/', type: 'folder' }, { path: '/index.html', type: 'file', mode: 'xml', content: `<h1>Hello, CodeVerse!</h1>\n<button onclick="alert('It works!')">Click Me</button>` }, { path: '/style.css', type: 'file', mode: 'css', content: `body { font-family: sans-serif; padding: 20px; }` }, { path: '/script.js', type: 'file', mode: 'javascript', content: `console.log("Welcome!");` }]; for(const file of defaultFiles) await db.put(STORE_NAME, file); } await renderFileList(); };
    function setupEventListeners(container) {/* ... same as before ... */}
    setupEventListeners(desktopFileManager); setupEventListeners(mobileFileManager);

    // --- नया कंसोल/लिंटर फ़ंक्शन ---
    const checkCodeSyntax = async () => {
        const jsNode = await db.get(STORE_NAME, '/script.js');
        if (jsNode && jsNode.content) {
            JSHINT(jsNode.content);
            if (JSHINT.errors && JSHINT.errors.length > 0) {
                consoleStatusBtn.classList.add('error');
                consoleStatusBtn.title = `JS Error: ${JSHINT.errors[0].reason}`;
            } else {
                consoleStatusBtn.classList.remove('error');
                consoleStatusBtn.title = 'JavaScript code is OK';
            }
        }
    };
    
    // --- बेहतर लेआउट अपडेट फ़ंक्शन ---
    const updatePreviewLayout = () => {
        // अगर फ़ुल-स्क्रीन में हैं तो स्केलिंग न करें
        if (document.fullscreenElement === previewContainer) {
            previewWrapper.style.transform = 'none';
            return;
        }

        const containerWidth = previewContainer.clientWidth - 32;
        const containerHeight = previewContainer.clientHeight - 32;
        let scale = 1;

        if (previewWrapper.classList.contains('desktop-scaled-mode')) {
            const scaleX = containerWidth / 1280; const scaleY = containerHeight / 720;
            scale = Math.min(scaleX, scaleY);
        } else if (previewWrapper.classList.contains('mobile-mode')) {
            const scaleX = containerWidth / 375; const scaleY = containerHeight / 812;
            scale = Math.min(scaleX, scaleY);
        }
        previewWrapper.style.transform = `scale(${scale < 1 ? scale : 1})`;
    };

    // --- UI Interaction Logic ---
    document.getElementById('toggle-explorer-btn').addEventListener('click', () => { if (window.innerWidth > 800) { mainWrapper.classList.toggle('explorer-collapsed'); } else { const isOpen = mobileFileManager.classList.contains('open'); mobileFileManager.classList.toggle('open', !isOpen); overlay.classList.toggle('hidden', isOpen); } setTimeout(() => { editor.refresh(); updatePreviewLayout(); }, 310); });
    overlay.addEventListener('click', () => { mobileFileManager.classList.remove('open'); overlay.classList.add('hidden'); });
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.className = 'desktop-scaled-mode'; updatePreviewLayout(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.className = 'mobile-mode'; updatePreviewLayout(); });
    window.addEventListener('resize', updatePreviewLayout);
    document.addEventListener('fullscreenchange', updatePreviewLayout);
    document.getElementById('fs-preview-btn').addEventListener('click', () => previewContainer.requestFullscreen());
    document.getElementById('run-btn').addEventListener('click', runCode);
    document.getElementById('select-all-btn').addEventListener('click', () => { editor.execCommand('selectAll'); editor.focus(); });
    
    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'dracula', autoCloseTags: true, lineWrapping: false });
    
    // --- सही किया गया एडिटर मेनू लॉजिक ---
    editor.on('contextmenu', (cm, event) => { event.preventDefault(); if (editor.getSelection().length > 0) { editorContextMenu.style.top = `${event.clientY}px`; editorContextMenu.style.left = `${event.clientX}px`; editorContextMenu.classList.remove('hidden'); } });
    editorContextMenu.addEventListener('click', e => {
        const action = e.target.closest('.dropdown-item')?.dataset.action; if (!action) return;
        const selected = editor.getSelection();
        if (action === 'copy' && selected) { navigator.clipboard.writeText(selected); } 
        else if (action === 'cut' && selected) {
            navigator.clipboard.writeText(selected).then(() => {
                // 'Select All' के बाद कट करने के लिए यह बेहतर काम करता है
                if (selected === editor.getValue()) {
                    editor.setValue('');
                } else {
                    editor.replaceSelection('');
                }
            });
        } 
        else if (action === 'paste') { navigator.clipboard.readText().then(text => editor.replaceSelection(text)); }
        editorContextMenu.classList.add('hidden'); editor.focus();
    });
    document.addEventListener('click', e => { if (!e.target.closest('.file-options-btn')) dropdownMenu.classList.add('hidden'); if (!e.target.closest('#editor-context-menu')) editorContextMenu.classList.add('hidden'); });

    let debounceTimer;
    editor.on('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(async () => { if (activeFilePath) { const node = await db.get(STORE_NAME, activeFilePath); if(node && typeof node.content === 'string') { node.content = editor.getValue(); await db.put(STORE_NAME, node); runCode(); if (activeFilePath.endsWith('.js')) checkCodeSyntax(); } } }, 500); });

    await initDb();
    await loadProject();
    await setActiveFile('/index.html');
    document.getElementById('pc-view-btn').click();
    setTimeout(updatePreviewLayout, 100);
});