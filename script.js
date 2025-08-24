document.addEventListener('DOMContentLoaded', async () => {
    let currentPath = '/', activeFilePath = null, editor, db;
    let objectURLs = {};

    // --- DATABASE (INDEXEDDB) SETUP ---
    const DB_NAME = 'CodeVerseDB-v3'; // Incremented version to avoid old data issues
    const STORE_NAME = 'files';

    async function initDb() {
        db = await idb.openDB(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME, { keyPath: 'path' });
            },
        });
    }

    // --- DOM Elements ---
    const mobileFileManager = document.getElementById('mobile-file-manager');
    const desktopFileManager = document.querySelector('.desktop-file-explorer');
    const overlay = document.getElementById('overlay');
    const previewContainer = document.getElementById('preview-container');
    const previewWrapper = document.getElementById('preview-wrapper');
    const previewFrame = document.getElementById('preview-frame');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const editorContextMenu = document.getElementById('editor-context-menu');
    
    const icons = { folder: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>`, html: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M13.42 15.58L15.8 13l-2.38-2.58L14.17 9.5l3.25 3.5-3.25 3.5-1.42-1.08zM10.58 15.58L9.17 16.5l-3.25-3.5 3.25-3.5 1.42 1.08L8.2 13l2.38 2.58z"/></svg>`, css: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`, js: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4v-6h2v6h-2z"/></svg>`, file: `<svg class="file-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>`, options: `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>` };
    const fileManagerHTML = `<div class="file-manager-container"><div class="file-manager-header"><button id="back-btn" title="Go Back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button><div id="current-path-display">/</div><div class="file-actions"><input type="file" class="file-importer" style="display:none;" multiple><button class="import-file-btn" title="Import File"><svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg></button><button class="new-file-btn" title="New File"><svg viewBox="0 0 24 24"><path d="M13 9h5.5L13 3.5V9M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m5 10v-2h-2v2H9v2h2v2h2v-2h2v-2h-2z"/></svg></button><button class="new-folder-btn" title="New Folder"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg></button></div></div><ul class="file-list"></ul></div>`;
    desktopFileManager.innerHTML = fileManagerHTML;
    mobileFileManager.innerHTML = fileManagerHTML;

    // --- File System & UI Logic (FIXED & STABLE) ---
    const renderFileList = async () => {
        const allFiles = await db.getAll(STORE_NAME);
        const folders = new Set();
        const itemsInCurrentPath = [];

        allFiles.forEach(item => {
            if (item.path.startsWith(currentPath)) {
                const relativePath = item.path.substring(currentPath.length);
                const parts = relativePath.split('/');
                if (parts.length === 1 && parts[0] !== '') {
                    itemsInCurrentPath.push({ ...item, name: parts[0] });
                } else if (parts.length > 1 && !folders.has(parts[0])) {
                    folders.add(parts[0]);
                    itemsInCurrentPath.push({ path: currentPath + parts[0] + '/', type: 'folder', name: parts[0] });
                }
            }
        });

        document.querySelectorAll('.file-list').forEach(listEl => {
            listEl.innerHTML = '';
            itemsInCurrentPath.sort((a, b) => a.name.localeCompare(b.name)).forEach(node => {
                const li = document.createElement('li'); li.className = 'file-item'; li.dataset.path = node.path;
                let icon = node.type === 'folder' ? icons.folder : (icons[node.name.split('.').pop()] || icons.file);
                li.innerHTML = `${icon}<span class="file-name">${node.name}</span><button class="file-options-btn">${icons.options}</button>`;
                if (node.path === activeFilePath) li.classList.add('active');
                listEl.appendChild(li);
            });
        });
        
        document.querySelectorAll('#current-path-display').forEach(d => d.textContent = currentPath);
        document.querySelectorAll('#back-btn').forEach(b => b.classList.toggle('hidden', currentPath === '/'));
    };

    const createNode = async (type) => {
        const name = prompt(`Enter new ${type} name:`);
        if (!name || name.includes('/')) return alert("Invalid name.");
        const path = currentPath + name + (type === 'folder' ? '/' : '');
        if (await db.get(STORE_NAME, path)) return alert('Name already exists!');
        
        const node = { path, type: type === 'folder' ? 'folder' : 'file', content: '' };
        if (type === 'file') {
            const ext = name.split('.').pop();
            if (ext === 'html') node.mode = 'xml';
            else if (ext === 'css') node.mode = 'css';
            else if (ext === 'js') node.mode = 'javascript';
        } else {
            // In DB, folders are just empty paths ending in /, no content needed
            delete node.content;
        }
        await db.put(STORE_NAME, node);
        await renderFileList();
    };
    
    const deleteNode = async (path) => {
        if (!confirm(`Delete "${path}"?`)) return;
        const keysToDelete = (await db.getAllKeys(STORE_NAME)).filter(key => key.startsWith(path));
        for (const key of keysToDelete) await db.delete(STORE_NAME, key);
        if (activeFilePath && activeFilePath.startsWith(path)) setActiveFile(null);
        await renderFileList();
    };

    const setActiveFile = async (path) => {
        activeFilePath = path;
        if (path) {
            const node = await db.get(STORE_NAME, path);
            editor.setValue(node && !(node.content instanceof Blob) ? node.content || '' : 'Cannot edit binary files.');
            editor.setOption('mode', node ? node.mode : 'text/plain');
            editor.refresh();
        } else { editor.setValue(''); }
        await renderFileList();
    };
    
    // --- POWERFUL runCode with Media Support ---
    const runCode = async () => {
        Object.values(objectURLs).forEach(URL.revokeObjectURL); objectURLs = {};
        const indexNode = await db.get(STORE_NAME, '/index.html');
        if (!indexNode) { previewFrame.srcdoc = `<html><body><h1>index.html not found!</h1></body></html>`; return; }
        
        let htmlContent = indexNode.content;
        const allFiles = await db.getAll(STORE_NAME);
        for (const file of allFiles) { if (file.content instanceof Blob) { objectURLs[file.path] = URL.createObjectURL(file.content); } }
        
        htmlContent = htmlContent.replace(/(src|href)=["'](?!https?:\/\/|\/\/)(.*?)["']/g, (match, attr, value) => {
            let path = value.startsWith('/') ? value : new URL(value, 'http://a.com' + currentPath).pathname;
            return objectURLs[path] ? `${attr}="${objectURLs[path]}"` : match;
        });
        
        const cssNode = await db.get(STORE_NAME, '/style.css'); const jsNode = await db.get(STORE_NAME, '/script.js');
        const styleTag = cssNode ? `<style>${cssNode.content}</style>` : '';
        const scriptTag = jsNode ? `<script>${jsNode.content}<\/script>` : '';

        previewFrame.srcdoc = `<html><head><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">${styleTag}</head><body>${htmlContent}${scriptTag}</body></html>`;
    };

    const loadProject = async () => {
        const allFiles = await db.getAll(STORE_NAME);
        if (allFiles.length === 0) {
            const defaultFiles = [
                { path: '/', type: 'folder' },
                { path: '/index.html', type: 'file', mode: 'xml', content: `<div class="content"><h1 class="title">Welcome to CodeVerse</h1><p class="subtitle">Your creative space in the cloud.</p></div>`},
                { path: '/style.css', type: 'file', mode: 'css', content: `body { margin: 0; font-family: 'Poppins', sans-serif; color: white; background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab); background-size: 400% 400%; animation: gradient 15s ease infinite; height: 100vh; display: flex; justify-content: center; align-items: center; text-align: center; overflow: hidden;} @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } .content { animation: fadeIn 2s ease-in-out; } .title { font-size: 3rem; font-weight: 600; text-shadow: 0 0 15px rgba(0,0,0,0.5); } .subtitle { font-size: 1.2rem; text-shadow: 0 0 10px rgba(0,0,0,0.5); } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`},
                { path: '/script.js', type: 'file', mode: 'javascript', content: 'console.log("Welcome to the new CodeVerse IDE!");'}
            ];
            for(const file of defaultFiles) await db.put(STORE_NAME, file);
        }
        await renderFileList();
    };

    // --- EVENT LISTENERS ---
    function setupEventListeners(container) {
        container.querySelector('.import-file-btn').addEventListener('click', () => container.querySelector('.file-importer').click());
        container.querySelector('.file-importer').addEventListener('change', async (e) => {
            for(const file of e.target.files) {
                const path = currentPath + file.name;
                const content = file.type.startsWith('text/') ? await file.text() : new Blob([await file.arrayBuffer()], {type: file.type});
                const ext = file.name.split('.').pop(); let mode = 'text/plain'; if (ext === 'html') mode = 'xml'; else if (ext === 'css') mode = 'css'; else if (ext === 'js') mode = 'javascript';
                await db.put(STORE_NAME, { path, type: 'file', content, mode });
            }
            await renderFileList(); e.target.value = '';
        });
        container.querySelector('.file-list').addEventListener('click', async (e) => {
            const itemLi = e.target.closest('.file-item'); if (!itemLi) return;
            const path = itemLi.dataset.path;
            if (e.target.closest('.file-options-btn')) {
                const rect = e.target.getBoundingClientRect(); dropdownMenu.style.top = `${rect.bottom}px`; dropdownMenu.style.left = `${rect.right - 120}px`;
                dropdownMenu.classList.remove('hidden'); dropdownMenu.dataset.path = path;
            } else if (e.target.closest('.file-name')) {
                if (path.endsWith('/')) { currentPath = path; await renderFileList(); } else { await setActiveFile(path); }
                if (window.innerWidth <= 800) toggleFileManager(false);
            }
        });
        container.querySelector('#back-btn').addEventListener('click', async () => { if (currentPath === '/') return; const parts = currentPath.split('/').filter(p => p); parts.pop(); currentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : ''); await renderFileList(); });
        container.querySelector('.new-file-btn').addEventListener('click', () => createNode('file'));
        container.querySelector('.new-folder-btn').addEventListener('click', () => createNode('folder'));
    }
    setupEventListeners(desktopFileManager); setupEventListeners(mobileFileManager);

    const toggleFileManager = (force) => { const isOpen = mobileFileManager.classList.contains('open'); const show = force !== undefined ? force : !isOpen; mobileFileManager.classList.toggle('open', show); overlay.classList.toggle('hidden', !show); };
    const setDesktopScale = () => { const scale = previewWrapper.clientWidth / 1280; previewFrame.style.transform = `scale(${scale})`; };
    
    document.getElementById('toggle-files-btn-mobile').addEventListener('click', () => toggleFileManager());
    document.getElementById('toggle-files-btn-fs').addEventListener('click', () => { document.querySelector('.main-wrapper').classList.toggle('fs-files-open'); document.querySelector('.desktop-file-explorer').classList.toggle('fs-open'); setTimeout(() => editor.refresh(), 300); });
    overlay.addEventListener('click', () => toggleFileManager(false));
    document.getElementById('pc-view-btn').addEventListener('click', () => { previewWrapper.classList.remove('mobile-mode'); previewWrapper.classList.add('desktop-scaled-mode'); setDesktopScale(); });
    document.getElementById('mobile-view-btn').addEventListener('click', () => { previewWrapper.classList.add('mobile-mode'); previewWrapper.classList.remove('desktop-scaled-mode'); previewFrame.style.transform = 'scale(1)'; });
    document.getElementById('fs-preview-btn').addEventListener('click', () => previewContainer.requestFullscreen());
    document.getElementById('fs-editor-btn').addEventListener('click', () => { document.querySelector('.main-wrapper').classList.toggle('editor-fullscreen'); document.getElementById('toggle-files-btn-fs').classList.toggle('hidden'); setTimeout(() => editor.refresh(), 300); });
    window.addEventListener('resize', () => { if(previewWrapper.classList.contains('desktop-scaled-mode')) setDesktopScale(); });
    
    document.getElementById('run-btn').addEventListener('click', runCode);
    document.getElementById('select-all-btn').addEventListener('click', () => { editor.execCommand('selectAll'); editor.focus(); });
    dropdownMenu.addEventListener('click', e => { const action = e.target.dataset.action; const path = dropdownMenu.dataset.path; if (action && path) { if (action === 'delete') deleteNode(path); } dropdownMenu.classList.add('hidden'); });
    document.addEventListener('click', e => { if (!e.target.closest('.file-options-btn')) dropdownMenu.classList.add('hidden'); if (!e.target.closest('#editor-context-menu')) editorContextMenu.classList.add('hidden'); });
    editorContextMenu.addEventListener('click', e => { const action = e.target.dataset.action; if (!action) return; if (action === 'copy') { const selected = editor.getSelection(); if (selected) navigator.clipboard.writeText(selected); } else if (action === 'cut') { const selected = editor.getSelection(); if (selected) { navigator.clipboard.writeText(selected).then(() => editor.replaceSelection('')); } } else if (action === 'paste') { navigator.clipboard.readText().then(text => editor.replaceSelection(text)); } editorContextMenu.classList.add('hidden'); editor.focus(); });

    // --- INITIALIZATION ---
    editor = CodeMirror.fromTextArea(document.getElementById('main-editor'), { lineNumbers: true, theme: 'ayu-dark', autoCloseTags: true, lineWrapping: true });
    editor.on('contextmenu', (cm, event) => { event.preventDefault(); if (editor.getSelection().length > 0) { editorContextMenu.style.top = `${event.clientY}px`; editorContextMenu.style.left = `${event.clientX}px`; editorContextMenu.classList.remove('hidden'); } });
    
    let debounceTimer;
    editor.on('change', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (activeFilePath) {
                const node = await db.get(STORE_NAME, activeFilePath);
                if(node && !(node.content instanceof Blob)) { node.content = editor.getValue(); await db.put(STORE_NAME, node); }
            }
        }, 300);
    });

    await initDb();
    await loadProject();
    await setActiveFile('/index.html');
    runCode();
});
