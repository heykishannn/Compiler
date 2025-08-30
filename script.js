document.addEventListener('DOMContentLoaded', async () => {
    function debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const dom = {
        outputFrame: document.getElementById('output'),
        iframeWrapper: document.getElementById('iframe-wrapper'),
        consolePanel: document.getElementById('console-panel'),
        editorPanes: document.querySelector('.editor-panes'),
        fileList: document.getElementById('file-list'),
        sidebar: document.getElementById('file-manager'),
        contextMenu: document.getElementById('context-menu'),
        fileImporter: document.getElementById('file-importer'),
        editorTabs: document.getElementById('editor-tabs'),
    };

    let activeEditor = null;
    let openFiles = new Map();
    let db;

    const dbName = 'ProDevEditorDB';
    const fileStore = 'files';

    async function initDB() {
        db = await idb.openDB(dbName, 1, {
            upgrade(db) { db.createObjectStore(fileStore, { keyPath: 'path' }); },
        });
    }

    const fs = {
        get: (path) => db.get(fileStore, path),
        set: (path, data) => db.put(fileStore, { path, ...data }),
        delete: (path) => db.delete(fileStore, path),
        getAll: () => db.getAll(fileStore),
        rename: async (oldPath, newPath) => {
            const item = await fs.get(oldPath);
            if (!item) return;
            await fs.delete(oldPath);
            item.path = newPath;
            return db.put(fileStore, item);
        }
    };

    const consoleInterceptor = `<script>
        const _c = {...window.console};
        const post = (type, args) => parent.postMessage({type, data: args.map(a => a instanceof Node ? 'DOMNode' : a)}, '*');
        window.console = { ..._c,
            log: (...a) => { post('log', a); _c.log(...a); },
            error: (...a) => { post('error', a); _c.error(...a); },
            warn: (...a) => { post('warn', a); _c.warn(...a); },
        };
        window.addEventListener('error', e => console.error(e.message));
    <\/script>`;

    const run = debounce(async () => {
        dom.consolePanel.innerHTML = '';
        const files = await fs.getAll();
        const htmlFile = files.find(f => f.path === '/index.html');
        if (!htmlFile) return;

        let src = htmlFile.content.replace('<head>', `<head>${consoleInterceptor}`);
        
        for (const file of files) {
            if (file.path.endsWith('.css')) src = src.replace('</head>', `<style>${file.content}</style></head>`);
            if (file.path.endsWith('.js')) src = src.replace('</body>', `<script>${file.content}<\/script></body>`);
            if (file.content?.startsWith('data:')) {
                src = src.replaceAll(file.path.substring(1), file.content);
            }
        }
        dom.outputFrame.srcdoc = src;
    }, 500);

    const debouncedSave = debounce((path, content) => {
        const file = fs.get(path).then(item => {
            if (item) fs.set(path, { ...item, content });
        });
    }, 500);

    function createEditor(parent, mode, value, path) {
        const editor = CodeMirror(parent, {
            value, mode, theme: 'dracula', lineNumbers: true, autoCloseBrackets: true,
        });
        editor.on('change', () => debouncedSave(path, editor.getValue()));
        return editor;
    }
    
    function setActivePanel(panel) {
        dom.editorTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        openFiles.forEach(editor => editor.getWrapperElement().parentElement.style.display = 'none');
        dom.consolePanel.classList.remove('active');

        if (panel === 'console') {
            dom.consolePanel.classList.add('active');
            dom.editorTabs.querySelector('.tab-btn[data-path="console"]').classList.add('active');
            activeEditor = null;
        } else {
            activeEditor = panel;
            const wrapper = activeEditor.getWrapperElement().parentElement;
            wrapper.style.display = 'block';
            activeEditor.refresh();
            dom.editorTabs.querySelector(`[data-path="${activeEditor.path}"]`).classList.add('active');
        }
    }
    
    function addTab(path, isConsole = false) {
        const id = isConsole ? 'console' : path;
        if (dom.editorTabs.querySelector(`[data-path="${id}"]`)) return;

        const tab = document.createElement('button');
        tab.className = 'tab-btn';
        tab.dataset.path = id;
        tab.textContent = isConsole ? 'Console' : path.split('/').pop();
        
        if (!isConsole) {
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = ' &times;';
            closeBtn.onclick = e => { e.stopPropagation(); closeFile(path); };
            tab.appendChild(closeBtn);
        }
        tab.onclick = () => setActivePanel(isConsole ? 'console' : openFiles.get(path));
        dom.editorTabs.appendChild(tab);
    }
    
    async function openFile(path) {
        if (openFiles.has(path)) {
            setActivePanel(openFiles.get(path));
            return;
        }
        const file = await fs.get(path);
        if (!file || file.type !== 'file') return;

        const editorWrapper = document.createElement('div');
        editorWrapper.style.display = 'none';
        dom.editorPanes.insertBefore(editorWrapper, dom.consolePanel);
        
        const mode = path.endsWith('.css') ? 'css' : path.endsWith('.js') ? 'javascript' : 'xml';
        const editor = createEditor(editorWrapper, mode, file.content, path);
        editor.path = path;
        openFiles.set(path, editor);
        
        addTab(path);
        setActivePanel(editor);
    }

    function closeFile(path) {
        const editor = openFiles.get(path);
        if (!editor) return;

        editor.getWrapperElement().parentElement.remove();
        openFiles.delete(path);
        dom.editorTabs.querySelector(`[data-path="${path}"]`).remove();
        
        if (activeEditor && activeEditor.path === path) {
            const nextFile = openFiles.keys().next().value;
            setActivePanel(nextFile ? openFiles.get(nextFile) : 'console');
        }
    }
    
    function buildFileTree(files) {
        const tree = {};
        files.sort((a, b) => a.path.localeCompare(b.path)).forEach(file => {
            let level = tree;
            file.path.substring(1).split('/').forEach((part, i, arr) => {
                if (!level[part]) {
                    level[part] = i === arr.length - 1 ? file : { type: 'folder', children: {} };
                }
                level = level[part].children;
            });
        });
        return tree;
    }
    
    function renderFileTree(tree, container) {
        container.innerHTML = '';
        Object.entries(tree).forEach(([name, item]) => {
            const li = document.createElement('div');
            li.className = 'file-list-item';
            const icon = item.type === 'folder' ? 'fa-folder' : 'fa-file-code';
            li.innerHTML = `<i class="fas ${icon}"></i><span>${name}</span>`;
            li.onclick = () => { if (item.type === 'file') openFile(item.path); };
            li.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, item.path); };
            container.appendChild(li);

            if (item.type === 'folder') {
                const subContainer = document.createElement('div');
                subContainer.style.paddingLeft = '15px';
                li.appendChild(subContainer);
                renderFileTree(item.children, subContainer);
            }
        });
    }

    async function refreshFileExplorer() {
        const files = await fs.getAll();
        renderFileTree(buildFileTree(files), dom.fileList);
    }
    
    function showContextMenu(event, path) {
        dom.contextMenu.style.top = `${event.clientY}px`;
        dom.contextMenu.style.left = `${event.clientX}px`;
        dom.contextMenu.style.display = 'block';
        dom.contextMenu.dataset.path = path;
    }

    document.addEventListener('click', () => dom.contextMenu.style.display = 'none');
    
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.id;
        if (id === 'btn-run') run();
        if (id === 'btn-fullscreen') dom.outputFrame.requestFullscreen();
        if (id === 'btn-console') setActivePanel('console');
        if (id === 'btn-pc' || id === 'btn-mobile') {
            document.querySelector('.preview-controls .active').classList.remove('active');
            target.classList.add('active');
            dom.iframeWrapper.className = id === 'btn-pc' ? 'pc-mode' : 'mobile-mode';
        }
        if (id === 'menu-btn') dom.sidebar.classList.toggle('show');
        if (id === 'close-sidebar-btn') dom.sidebar.classList.remove('show');
        if (id === 'new-file-btn' || id === 'new-folder-btn') {
            const type = id === 'new-file-btn' ? 'file' : 'folder';
            const name = prompt(`Enter new ${type} name:`);
            if (name) {
                await fs.set(`/${name}`, { type, content: '', children: {} });
                await refreshFileExplorer();
            }
        }
        if (id === 'import-file-btn') dom.fileImporter.click();
    });

    dom.contextMenu.addEventListener('click', async (e) => {
        const action = e.target.closest('li').id;
        const path = dom.contextMenu.dataset.path;
        if (action === 'ctx-delete') {
            if (confirm(`Delete ${path}?`)) {
                await fs.delete(path);
                if (openFiles.has(path)) closeFile(path);
            }
        }
        if (action === 'ctx-rename') {
            const newName = prompt('Enter new name:', path.split('/').pop());
            if (newName) await fs.rename(path, path.substring(0, path.lastIndexOf('/') + 1) + newName);
        }
        await refreshFileExplorer();
    });

    dom.fileImporter.addEventListener('change', (e) => {
        for (const file of e.target.files) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                await fs.set(`/${file.name}`, { type: 'file', content: event.target.result });
                await refreshFileExplorer();
            };
            if (file.type.match(/image|video|audio|font/)) reader.readAsDataURL(file);
            else reader.readAsText(file);
        }
    });

    window.addEventListener('message', e => {
        if (e.data.type) logToConsolePanel(e.data);
    });

    function logToConsolePanel(msg) {
        const log = document.createElement('div');
        log.className = `console-log ${msg.type}`;
        const text = msg.data.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        log.textContent = `[${msg.type}] ${text}`;
        dom.consolePanel.appendChild(log);
    }
    
    async function main() {
        await initDB();
        let files = await fs.getAll();
        if (files.length === 0) {
            const demo = {
                '/index.html': { type: 'file', content: `<h1>Hello, World!</h1>\n<p>Edit this code to start.</p>\n<script src="script.js"></script>` },
                '/script.js': { type: 'file', content: `console.log("Welcome to your editor!");` },
            };
            await Promise.all(Object.entries(demo).map(([path, data]) => fs.set(path, data)));
        }
        
        addTab(null, true);
        await refreshFileExplorer();
        await openFile('/index.html');
        run();
        
        document.body.classList.remove('is-loading');
    }

    main();
});
