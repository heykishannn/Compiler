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
    const consoleText = consoleOutput.querySelector('span');

    // --- File System & UI Logic (Minimal Changes) ---
    const renderFileList = async () => { /* ... (no changes) ... */ };
    const createNode = async (type) => { /* ... (no changes) ... */ };
    const deleteNode = async (path) => { /* ... (no changes) ... */ };
    const setActiveFile = async (path) => { if (path) { const node = await db.get(STORE_NAME, path); editor.setValue(node ? node.content || '' : ''); } else { editor.setValue(''); } activeFilePath = path; await renderFileList(); editor.refresh(); };
    const loadProject = async () => { const allFiles = await db.getAll(STORE_NAME); if (allFiles.length === 0) { const defaultFiles = [{ path: '/', type: 'folder' }, { path: '/index.html', type: 'file', content: `<h1>Hello!</h1>\n<button onclick="myFunction()">Click</button>` }, { path: '/style.css', type: 'file', content: `body { font-family: sans-serif; }` }, { path: '/script.js', type: 'file', content: `function myFunction() {\n  alert("It works!");\n}` }]; for(const file of defaultFiles) await db.put(STORE_NAME, file); } await renderFileList(); };

    // --- अपडेट किया गया Code Execution with Console ---
    const runCode = async () => {
        Object.values(objectURLs).forEach(URL.revokeObjectURL); objectURLs = {};
        const indexNode = await db.get(STORE_NAME, '/index.html');
        if (!indexNode) { previewFrame.srcdoc = `<h1>index.html not found!</h1>`; return; }

        let htmlContent = indexNode.content;
        const cssNode = await db.get(STORE_NAME, '/style.css');
        const jsNode = await db.get(STORE_NAME, '/script.js');
        const styleTag = cssNode ? `<style>${cssNode.content}</style>` : '';
        
        // JS कोड को try-catch में रैप करें ताकि त्रुटियाँ पकड़ी जा सकें
        const jsContent = jsNode ? jsNode.content : '';
        const wrappedJs = `
            <script>
                try {
                    ${jsContent}
                    window.parent.postMessage({ type: 'CODE_OK' }, '*');
                } catch (e) {
                    window.parent.postMessage({ type: 'CODE_ERROR', message: e.toString() }, '*');
                }
            <\/script>
        `;
        
        previewFrame.srcdoc = `<html><head>${styleTag}</head><body>${htmlContent}${wrappedJs}</body></html>`;
    };
    
    // --- कंसोल संदेशों को सुनने के लिए Listener ---
    window.addEventListener('message', (event) => {
        if (event.source !== previewFrame.contentWindow) return;

        if (event.data.type === 'CODE_OK') {
            consoleOutput.className = 'console-output ok';
            consoleText.textContent = 'OK';
        } else if (event.data.type === 'CODE_ERROR') {
            consoleOutput.className = 'console-output error';
            consoleText.textContent = event.data.message;
        }
    });

    const updatePreviewLayout = () => {
        const containerWidth = previewContainer.clientWidth - 32;
        const containerHeight = previewContainer.clientHeight - 32;

        if (previewWrapper.classList.contains('desktop-scaled-mode')) {
            const scale = Math.min(containerWidth / 1280, containerHeight / 720);
            previewFrame.style.transform = `scale(${scale})`;
            previewWrapper.style.width = `${1280 * scale}px`; previewWrapper.style.height = `${720 * scale}px`;
            previewWrapper.style.transform = 'none';
        } else if (previewWrapper.classList.contains('mobile-mode')) {
            const scale = Math.min(containerWidth / 375, containerHeight / 812);
            previewWrapper.style.transform = `scale(${scale})`;
            previewWrapper.style.width = '375px'; previewWrapper.style.height = '812px';
        }
    };

    // --- Event Listeners ---
    document.getElementById('toggle-explorer-btn').addEventListener('click', () => { if (window.innerWidth > 800) { mainWrapper.classList.toggle('explorer-collapsed'); } else { const isOpen = mobileFileManager.classList.contains('open'); mobileFileManager.classList.toggle('open', !isOpen); overlay.classList.toggle('hidden', isOpen); } setTimeout(() => { editor.refresh(); updatePreviewLayout(); }, 310); });
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.className = 'preview-wrapper desktop-scaled-mode'; updatePreviewLayout(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.className = 'preview-wrapper mobile-mode'; updatePreviewLayout(); });
    window.addEventListener('resize', updatePreviewLayout);
    document.getElementById('fs-preview-btn').addEventListener('click', () => previewContainer.requestFullscreen());
    document.getElementById('run-btn').addEventListener('click', runCode);
    document.getElementById('select-all-btn').addEventListener('click', () => { editor.execCommand('selectAll'); editor.focus(); });
    
    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'dracula', autoCloseTags: true, lineWrapping: false });
    
    editor.on('contextmenu', (cm, event) => { event.preventDefault(); if (editor.getSelection().length > 0) { editorContextMenu.style.top = `${event.clientY}px`; editorContextMenu.style.left = `${event.clientX}px`; editorContextMenu.classList.remove('hidden'); } });
    editorContextMenu.addEventListener('click', e => {
        const action = e.target.closest('.dropdown-item')?.dataset.action; if (!action) return;
        const selection = editor.getSelection();
        if (action === 'copy' && selection) { navigator.clipboard.writeText(selection); } 
        else if (action === 'cut' && selection) { navigator.clipboard.writeText(selection).then(() => editor.replaceSelection('')); } 
        else if (action === 'paste') { navigator.clipboard.readText().then(text => editor.replaceSelection(text)); }
        editorContextMenu.classList.add('hidden'); editor.focus();
    });
    document.addEventListener('click', e => { if (!e.target.closest('#editor-context-menu')) editorContextMenu.classList.add('hidden'); });

    let debounceTimer;
    editor.on('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(async () => { if (activeFilePath) { const node = await db.get(STORE_NAME, activeFilePath); if(node) { node.content = editor.getValue(); await db.put(STORE_NAME, node); runCode(); } } }, 500); });

    await initDb(); await loadProject(); await setActiveFile('/index.html');
    document.getElementById('pc-view-btn').click(); 
    setTimeout(updatePreviewLayout, 100); 
});```
