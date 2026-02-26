/* =========================================
   1. IndexedDB Wrapper (Data Persistence)
   ========================================= */
const DB_NAME = 'SurvivorGameDB';
const DB_VERSION = 1;
const STORE_NAME = 'players';

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
});

const DB = {
    async addPlayer(player) {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(player);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async getAllPlayers() {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async clearAll() {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};

/* =========================================
   2. Global State
   ========================================= */
const state = {
    players: [],
    aliveIds: [],
    gameInterval: null,
    isRunning: false,
    isPaused: false
};

/* =========================================
   3. DOM Elements
   ========================================= */
const els = {
    grid: document.getElementById('playerGrid'),
    username: document.getElementById('usernameInput'),
    image: document.getElementById('imageInput'),
    addBtn: document.getElementById('addPlayerBtn'),
    clearBtn: document.getElementById('clearAllBtn'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    playerCount: document.getElementById('playerCount'),
    gameStatus: document.getElementById('gameStatus'),
    modal: document.getElementById('winnerModal'),
    modalClose: document.getElementById('closeModalBtn'),
    winnerText: document.getElementById('winnerText'),
    winnerImg: document.getElementById('winnerImage'),
    confettiCanvas: document.getElementById('confettiCanvas')
};

/* =========================================
   4. Logic: Player Management
   ========================================= */

// Initialize
async function init() {
    state.players = await DB.getAllPlayers();
    renderGrid();
    updateStatus();
}

// Add Player
els.addBtn.addEventListener('click', async () => {
    const name = els.username.value.trim();
    const file = els.image.files[0];

    if (!name || !file) {
        alert("Please provide both a username and a profile picture.");
        return;
    }

    // Convert image to Base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        const newPlayer = {
            id: Date.now().toString(),
            name: name,
            image: imageData
        };

        try {
            await DB.addPlayer(newPlayer);
            state.players.push(newPlayer);
            renderGrid();
            
            // Reset form
            els.username.value = '';
            els.image.value = '';
        } catch (err) {
            console.error(err);
            alert("Failed to save player. Image might be too large.");
        }
    };
    reader.readAsDataURL(file);
});

// Clear All
els.clearBtn.addEventListener('click', async () => {
    if(confirm("Are you sure? This deletes all players.")) {
        if (state.isRunning) stopGame();
        await DB.clearAll();
        state.players = [];
        renderGrid();
    }
});

// Render Grid
function renderGrid() {
    els.playerCount.textContent = `Players: ${state.players.length}`;
    
    // Performance optimization: 
    // If not running, re-render all to ensure clean state.
    // If running, we usually don't call this fully, but for reset we do.
    els.grid.innerHTML = '';

    const fragment = document.createDocumentFragment();

    state.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-card';
        div.id = `p-${p.id}`;
        div.innerHTML = `
            <div class="player-img-wrapper">
                <img src="${p.image}" alt="${p.name}" class="player-img">
            </div>
            <div class="player-name">${p.name}</div>
        `;
        fragment.appendChild(div);
    });

    els.grid.appendChild(fragment);
}

/* =========================================
   5. Logic: Game Mechanics
   ========================================= */

els.startBtn.addEventListener('click', startGame);
els.pauseBtn.addEventListener('click', pauseGame);
els.resumeBtn.addEventListener('click', resumeGame);
els.cancelBtn.addEventListener('click', stopGame);
els.modalClose.addEventListener('click', () => {
    els.modal.classList.add('hidden');
    stopGame(); // Reset after viewing winner
});

function updateStatus(msg = "Idle") {
    els.gameStatus.textContent = `Status: ${msg}`;
}

function toggleControls(mode) {
    if (mode === 'running') {
        els.startBtn.classList.add('hidden');
        els.pauseBtn.classList.remove('hidden');
        els.resumeBtn.classList.add('hidden');
        els.cancelBtn.classList.remove('hidden');
        // Disable admin during game
        els.addBtn.disabled = true;
        els.clearBtn.disabled = true;
    } else if (mode === 'paused') {
        els.pauseBtn.classList.add('hidden');
        els.resumeBtn.classList.remove('hidden');
    } else {
        // Idle
        els.startBtn.classList.remove('hidden');
        els.pauseBtn.classList.add('hidden');
        els.resumeBtn.classList.add('hidden');
        els.cancelBtn.classList.add('hidden');
        els.addBtn.disabled = false;
        els.clearBtn.disabled = false;
    }
}

function startGame() {
    if (state.players.length < 2) {
        alert("Need at least 2 players to start!");
        return;
    }

    // Reset visuals
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('eliminated'));
    
    state.aliveIds = state.players.map(p => p.id);
    state.isRunning = true;
    state.isPaused = false;
    
    toggleControls('running');
    updateStatus("Running");
    
    runGameLoop();
}

function runGameLoop() {
    if (state.gameInterval) clearInterval(state.gameInterval);

    state.gameInterval = setInterval(() => {
        if (state.aliveIds.length <= 1) {
            declareWinner();
            return;
        }

        eliminatePlayer();

    }, 2000); // 2 seconds per elimination
}

function eliminatePlayer() {
    const totalAlive = state.aliveIds.length;
    if (totalAlive <= 1) return;

    // Random Index
    const randomIndex = Math.floor(Math.random() * totalAlive);
    const eliminatedId = state.aliveIds[randomIndex];

    // Remove from array
    state.aliveIds.splice(randomIndex, 1);

    // Update UI
    const card = document.getElementById(`p-${eliminatedId}`);
    if (card) {
        card.classList.add('eliminated');
    }

    updateStatus(`${state.aliveIds.length} Remaining`);
}

function pauseGame() {
    clearInterval(state.gameInterval);
    state.isPaused = true;
    toggleControls('paused');
    updateStatus("Paused");
}

function resumeGame() {
    state.isPaused = false;
    toggleControls('running');
    updateStatus("Running");
    runGameLoop();
}

function stopGame() {
    clearInterval(state.gameInterval);
    state.isRunning = false;
    state.isPaused = false;
    toggleControls('idle');
    updateStatus("Idle");
    renderGrid(); // Reset styles
}

function declareWinner() {
    clearInterval(state.gameInterval);
    const winnerId = state.aliveIds[0];
    const winner = state.players.find(p => p.id === winnerId);

    if (winner) {
        els.winnerText.textContent = winner.name;
        els.winnerImg.src = winner.image;
        els.modal.classList.remove('hidden');
        startConfetti();
    }
    
    toggleControls('idle');
    updateStatus("Game Over");
}

/* =========================================
   6. Effects: Confetti
   ========================================= */
function startConfetti() {
    const canvas = els.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888', '#BB86FC', '#03DAC6'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            spin: Math.random() * 0.2 - 0.1
        });
    }

    function draw() {
        if (els.modal.classList.contains('hidden')) return; // Stop if closed

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speed;
            p.angle += p.spin;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
            ctx.restore();

            if (p.y > canvas.height) p.y = -20;
        });
        requestAnimationFrame(draw);
    }
    draw();
}

// Initial Load
window.addEventListener('load', init);
