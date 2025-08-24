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
    const consoleContainer = document.getElementById('console-container');
    const consoleOutput = document.getElementById('console-output');
    
    const icons = { folder: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>`, html: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M13.42 15.58L15.8 13l-2.38-2.58L14.17 9.5l3.25 3.5-3.25 3.5-1.42-1.08zM10.58 15.58L9.17 16.5l-3.25-3.5 3.25-3.5 1.42 1.08L8.2 13l2.38 2.58z"/></svg>`, css: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`, js: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4v-6h2v6h-2z"/></svg>`, file: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>`, options: `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>` };
    const fileManagerHTML = `<div class="file-manager-container"><div class="file-manager-header"><button id="back-btn" title="Go Back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button><div id="current-path-display">/</div><div class="file-actions"><input type="file" class="file-importer" style="display:none;" multiple><button class="import-file-btn" title="Import File"><svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg></button><button class="new-file-btn" title="New File"><svg viewBox="0 0 24 24"><path d="M13 9h5.5L13 3.5V9M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m5 10v-2h-2v2H9v2h2v2h2v-2h2v-2h-2z"/></svg></button><button class="new-folder-btn" title="New Folder"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg></button></div></div><ul class="file-list"></ul></div>`;
    desktopFileManager.innerHTML = fileManagerHTML; mobileFileManager.innerHTML = fileManagerHTML;

    // --- File System Logic (No Changes) ---
    const renderFileList = async () => { const allFiles = await db.getAll(STORE_NAME); const folders = new Set(); const itemsInCurrentPath = []; allFiles.forEach(item => { if (item.path.startsWith(currentPath)) { const relativePath = item.path.substring(currentPath.length); const parts = relativePath.split('/'); if (parts.length === 1 && parts[0] !== '') { itemsInCurrentPath.push({ ...item, name: parts[0] }); } else if (parts.length > 1 && !folders.has(parts[0])) { folders.add(parts[0]); itemsInCurrentPath.push({ path: currentPath + parts[0] + '/', type: 'folder', name: parts[0] }); } } }); document.querySelectorAll('.file-list').forEach(listEl => { listEl.innerHTML = ''; itemsInCurrentPath.sort((a, b) => a.name.localeCompare(b.name)).forEach(node => { const li = document.createElement('li'); li.className = 'file-item'; li.dataset.path = node.path; let icon = node.type === 'folder' ? icons.folder : (icons[node.name.split('.').pop()] || icons.file); li.innerHTML = `${icon}<span class="file-name">${node.name}</span><button class="file-options-btn">${icons.options}</button>`; if (node.path === activeFilePath) li.classList.add('active'); listEl.appendChild(li); }); }); document.querySelectorAll('#current-path-display').forEach(d => d.textContent = currentPath); document.querySelectorAll('#back-btn').forEach(b => b.classList.toggle('hidden', currentPath === '/')); };
    const createNode = async (type) => { const name = prompt(`Enter new ${type} name:`); if (!name || name.includes('/')) return alert("Invalid name."); const path = currentPath + name + (type === 'folder' ? '/' : ''); if (await db.get(STORE_NAME, path)) return alert('Name already exists!'); const node = { path, type: type === 'folder' ? 'folder' : 'file', content: '' }; if (type === 'file') { const ext = name.split('.').pop(); if (ext === 'html') node.mode = 'xml'; else if (ext === 'css') node.mode = 'css'; else if (ext === 'js') node.mode = 'javascript'; } else { delete node.content; } await db.put(STORE_NAME, node); await renderFileList(); };
    const deleteNode = async (path) => { if (!confirm(`Delete "${path}"?`)) return; const keysToDelete = (await db.getAllKeys(STORE_NAME)).filter(key => key.startsWith(path)); for (const key of keysToDelete) await db.delete(STORE_NAME, key); if (activeFilePath && activeFilePath.startsWith(path)) setActiveFile(null); await renderFileList(); };
    const setActiveFile = async (path) => { activeFilePath = path; if (path) { const node = await db.get(STORE_NAME, path); editor.setValue(node && !(node.content instanceof Blob) ? node.content || '' : 'Cannot edit binary files.'); editor.setOption('mode', node ? node.mode : 'text/plain'); } else { editor.setValue(''); } await renderFileList(); editor.refresh(); };
    
    // --- Code Execution & Console (No Changes) ---
    const consoleInterceptor = `<script>
        const post = (type, args) => window.parent.postMessage({ source: 'iframe-console', type, message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ') }, '*');
        const originalConsole = { log: console.log, error: console.error, warn: console.warn };
        console.log = (...args) => { post('log', args); originalConsole.log.apply(console, args); };
        console.error = (...args) => { post('error', args); originalConsole.error.apply(console, args); };
        console.warn = (...args) => { post('warn', args); originalConsole.warn.apply(console, args); };
        window.addEventListener('error', e => { post('error', [e.message, 'at', e.filename.split('/').pop(), \`:\${e.lineno}:\${e.colno}\`]); });
    <\/script>`;
    const runCode = async () => { consoleOutput.innerHTML = ''; Object.values(objectURLs).forEach(URL.revokeObjectURL); objectURLs = {}; const indexNode = await db.get(STORE_NAME, '/index.html'); if (!indexNode) { previewFrame.srcdoc = `<html><body><h1>index.html not found!</h1></body></html>`; return; } let htmlContent = indexNode.content; const allFiles = await db.getAll(STORE_NAME); for (const file of allFiles) { if (file.content instanceof Blob) { objectURLs[file.path] = URL.createObjectURL(file.content); } } htmlContent = htmlContent.replace(/(src|href)=["'](?!https?:\/\/|\/\/)(.*?)["']/g, (match, attr, value) => { let path = value.startsWith('/') ? value : new URL(value, 'http://a.com' + currentPath).pathname; return objectURLs[path] ? `${attr}="${objectURLs[path]}"` : match; }); const cssNode = await db.get(STORE_NAME, '/style.css'); const jsNode = await db.get(STORE_NAME, '/script.js'); const styleTag = cssNode ? `<style>${cssNode.content}</style>` : ''; const safeJsContent = jsNode ? jsNode.content.replace(/<\/script>/gi, '<\\/script>') : ''; const scriptTag = jsNode ? `<script>${safeJsContent}<\/script>` : ''; previewFrame.srcdoc = `<html><head>${consoleInterceptor}${styleTag}</head><body>${htmlContent}${scriptTag}</body></html>`; };
    
    // --- बदला हुआ: नया उदाहरण प्रोजेक्ट ---
    const loadProject = async () => {
        const allFiles = await db.getAll(STORE_NAME);
        if (allFiles.length === 0) {
            const defaultFiles = [
                { path: '/', type: 'folder' },
                { 
                    path: '/index.html', type: 'file', mode: 'xml', 
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neon Button</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <a href="#" class="neon-button" id="myButton">Click Me</a>
    <script src="script.js"><\/script>
</body>
</html>`
                },
                { 
                    path: '/style.css', type: 'file', mode: 'css', 
                    content: `body {
    display: grid;
    place-items: center;
    height: 100vh;
    background: #111;
    font-family: 'Poppins', sans-serif;
}

.neon-button {
    position: relative;
    display: inline-block;
    padding: 15px 30px;
    color: #03e9f4;
    background: none;
    border: 2px solid #03e9f4;
    text-transform: uppercase;
    text-decoration: none;
    font-size: 20px;
    overflow: hidden;
    transition: 0.5s;
    -webkit-box-reflect: below 1px linear-gradient(transparent, #0005);
}

.neon-button:hover {
    background: #03e9f4;
    color: #050801;
    box-shadow: 0 0 5px #03e9f4,
                0 0 25px #03e9f4,
                0 0 50px #03e9f4,
                0 0 200px #03e9f4;
}`
                },
                { 
                    path: '/script.js', type: 'file', mode: 'javascript', 
                    content: `console.log("Neon Button Project Loaded!");

const button = document.getElementById('myButton');

button.addEventListener('click', (e) => {
    e.preventDefault(); // Prevents the link from navigating
    alert('You clicked the Neon Button!');
});`
                }
            ];
            for(const file of defaultFiles) await db.put(STORE_NAME, file);
        }
        await renderFileList();
    };

    // --- UI Interaction Logic ---
    function setupEventListeners(container) { container.querySelector('.file-importer').addEventListener('change', async (e) => { for(const file of e.target.files) { const path = currentPath + file.name; const content = file.type.startsWith('text/') ? await file.text() : new Blob([await file.arrayBuffer()], {type: file.type}); const ext = file.name.split('.').pop(); let mode = 'text/plain'; if (ext === 'html') mode = 'xml'; else if (ext === 'css') mode = 'css'; else if (ext === 'js') mode = 'javascript'; await db.put(STORE_NAME, { path, type: 'file', content, mode }); } await renderFileList(); e.target.value = ''; }); container.querySelector('.import-file-btn').addEventListener('click', () => container.querySelector('.file-importer').click()); container.querySelector('.file-list').addEventListener('click', async (e) => { const itemLi = e.target.closest('.file-item'); if (!itemLi) return; const path = itemLi.dataset.path; if (e.target.closest('.file-options-btn')) { const rect = e.target.getBoundingClientRect(); dropdownMenu.style.top = `${rect.bottom}px`; dropdownMenu.style.left = `${rect.right - 120}px`; dropdownMenu.classList.remove('hidden'); dropdownMenu.dataset.path = path; } else if (e.target.closest('.file-name')) { if (path.endsWith('/')) { currentPath = path; await renderFileList(); } else { await setActiveFile(path); } if (window.innerWidth <= 800) { mobileFileManager.classList.remove('open'); overlay.classList.add('hidden'); } } }); container.querySelector('#back-btn').addEventListener('click', async () => { if (currentPath === '/') return; const parts = currentPath.split('/').filter(p => p); parts.pop(); currentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : ''); await renderFileList(); }); container.querySelector('.new-file-btn').addEventListener('click', () => createNode('file')); container.querySelector('.new-folder-btn').addEventListener('click', () => createNode('folder')); }
    setupEventListeners(desktopFileManager); setupEventListeners(mobileFileManager);
    
    const updatePreviewLayout = () => { const isFullscreen = !!document.fullscreenElement; const container = previewContainer; const padding = isFullscreen ? 0 : 32; const availableWidth = container.clientWidth - padding; const availableHeight = container.clientHeight - padding; if (previewWrapper.classList.contains('desktop-scaled-mode')) { const scale = Math.min(availableWidth / 1280, availableHeight / 720); previewFrame.style.transform = `scale(${scale})`; previewWrapper.style.width = `${1280 * scale}px`; previewWrapper.style.height = `${720 * scale}px`; previewWrapper.style.transform = ''; } else if (previewWrapper.classList.contains('mobile-mode')) { const scale = Math.min(availableWidth / 375, availableHeight / 812); previewWrapper.style.transform = `scale(${scale})`; previewWrapper.style.width = '375px'; previewWrapper.style.height = '812px'; previewFrame.style.transform = ''; } };
    
    document.getElementById('toggle-explorer-btn').addEventListener('click', () => { if (window.innerWidth > 800) { mainWrapper.classList.toggle('explorer-collapsed'); } else { const isOpen = mobileFileManager.classList.contains('open'); mobileFileManager.classList.toggle('open', !isOpen); overlay.classList.toggle('hidden', isOpen); } setTimeout(() => { editor.refresh(); updatePreviewLayout(); }, 310); });
    overlay.addEventListener('click', () => { mobileFileManager.classList.remove('open'); overlay.classList.add('hidden'); });
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.classList.remove('mobile-mode'); previewWrapper.classList.add('desktop-scaled-mode'); updatePreviewLayout(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.classList.remove('desktop-scaled-mode'); previewWrapper.classList.add('mobile-mode'); updatePreviewLayout(); });
    window.addEventListener('resize', updatePreviewLayout);
    document.getElementById('fs-preview-btn').addEventListener('click', () => { if (!document.fullscreenElement) { previewContainer.requestFullscreen().catch(err => alert(`Error: ${err.message}`)); } else { document.exitFullscreen(); }});
    document.addEventListener('fullscreenchange', () => setTimeout(updatePreviewLayout, 50));
    document.getElementById('run-btn').addEventListener('click', runCode);
    dropdownMenu.addEventListener('click', e => { const action = e.target.dataset.action; const path = dropdownMenu.dataset.path; if (action === 'delete' && path) deleteNode(path); dropdownMenu.classList.add('hidden'); });
    
    document.getElementById('console-btn').addEventListener('click', () => consoleContainer.classList.toggle('hidden'));
    document.getElementById('close-console-btn').addEventListener('click', () => consoleContainer.classList.add('hidden'));
    document.getElementById('clear-console-btn').addEventListener('click', () => consoleOutput.innerHTML = '');
    window.addEventListener('message', e => { if (e.data && e.data.source === 'iframe-console') { const { type, message } = e.data; const logEl = document.createElement('div'); logEl.className = type; logEl.textContent = `> ${message}`; consoleOutput.appendChild(logEl); consoleOutput.scrollTop = consoleOutput.scrollHeight; } });

    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'dracula', autoCloseTags: true, lineWrapping: false });
    
    // कस्टम मेन्यू से संबंधित सभी इवेंट लिसनर हटा दिए गए हैं
    
    document.addEventListener('click', e => { if (!e.target.closest('.file-options-btn')) dropdownMenu.classList.add('hidden'); });

    let debounceTimer;
    editor.on('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(async () => { if (activeFilePath) { const node = await db.get(STORE_NAME, activeFilePath); if(node && !(node.content instanceof Blob)) { node.content = editor.getValue(); await db.put(STORE_NAME, node); runCode(); } } }, 500); });

    await initDb();
    await loadProject();
    await setActiveFile('/index.html');
    
    document.getElementById('pc-view-btn').click(); 
    setTimeout(updatePreviewLayout, 100); 
});
