/**
 * Instagram Survivor Game
 * Pure Vanilla JS with IndexedDB for storage
 */

// --- Configuration & State ---
const DB_NAME = 'SurvivorGameDB';
const DB_VERSION = 1;
const STORE_NAME = 'players';

let db;
let players = [];
let gameInterval = null;
let isPaused = false;
let eliminatedIds = new Set();

// --- DOM Elements ---
const elements = {
    addPlayerForm: document.getElementById('addPlayerForm'),
    usernameInput: document.getElementById('usernameInput'),
    imageInput: document.getElementById('imageInput'),
    arena: document.getElementById('arena'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    clearPlayersBtn: document.getElementById('clearPlayersBtn'),
    resetGameBtn: document.getElementById('resetGameBtn'),
    winnerModal: document.getElementById('winnerModal'),
    winnerDisplay: document.getElementById('winnerDisplay'),
    closeModalBtn: document.getElementById('closeModalBtn')
};

// --- Initialization ---
async function init() {
    try {
        db = await openDB();
        await loadPlayers();
        renderPlayers();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize database. Please refresh the page.');
    }
}

// --- IndexedDB Logic ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function loadPlayers() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            players = request.result;
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function savePlayer(player) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(player);
        request.onsuccess = (e) => {
            player.id = e.target.result;
            players.push(player);
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function clearAllPlayers() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => {
            players = [];
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

// --- UI Rendering ---
function renderPlayers() {
    elements.arena.innerHTML = '';
    players.forEach(player => {
        const card = createPlayerCard(player);
        if (eliminatedIds.has(player.id)) {
            card.classList.add('eliminated');
        }
        elements.arena.appendChild(card);
    });
}

function createPlayerCard(player) {
    const div = document.createElement('div');
    div.className = 'player-card';
    div.id = `player-${player.id}`;
    div.innerHTML = `
        <img src="${player.dp}" alt="${player.username}" class="player-dp">
        <span class="player-username">${player.username}</span>
    `;
    return div;
}

// --- Game Logic ---
function startGame() {
    if (players.length < 2) {
        alert('Add at least 2 players to start the game!');
        return;
    }

    resetGameState();
    updateControls('running');
    
    gameInterval = setInterval(() => {
        if (!isPaused) {
            eliminateRandomPlayer();
        }
    }, 2000);
}

function eliminateRandomPlayer() {
    const remainingPlayers = players.filter(p => !eliminatedIds.has(p.id));
    
    if (remainingPlayers.length <= 1) {
        stopGame();
        if (remainingPlayers.length === 1) {
            showWinner(remainingPlayers[0]);
        }
        return;
    }

    const randomIndex = Math.floor(Math.random() * remainingPlayers.length);
    const playerToEliminate = remainingPlayers[randomIndex];
    
    eliminatedIds.add(playerToEliminate.id);
    const card = document.getElementById(`player-${playerToEliminate.id}`);
    if (card) {
        card.classList.add('eliminated');
    }

    // Check again after elimination
    if (remainingPlayers.length - 1 === 1) {
        const winner = remainingPlayers.find(p => p.id !== playerToEliminate.id);
        setTimeout(() => {
            stopGame();
            showWinner(winner);
        }, 1000);
    }
}

function pauseGame() {
    isPaused = true;
    updateControls('paused');
}

function resumeGame() {
    isPaused = false;
    updateControls('running');
}

function stopGame() {
    clearInterval(gameInterval);
    gameInterval = null;
    updateControls('idle');
}

function cancelGame() {
    stopGame();
    resetGameState();
    renderPlayers();
}

function resetGameState() {
    eliminatedIds.clear();
    isPaused = false;
}

function updateControls(state) {
    const isIdle = state === 'idle';
    const isRunning = state === 'running';
    const isPausedState = state === 'paused';

    elements.startBtn.disabled = !isIdle;
    elements.pauseBtn.disabled = !isRunning;
    elements.resumeBtn.disabled = !isPausedState;
    elements.cancelBtn.disabled = isIdle;
    
    // Disable admin controls during game
    elements.addPlayerForm.querySelector('button').disabled = !isIdle;
    elements.clearPlayersBtn.disabled = !isIdle;
    elements.resetGameBtn.disabled = !isIdle;
}

function showWinner(winner) {
    elements.winnerDisplay.innerHTML = `
        <img src="${winner.dp}" class="winner-dp-large">
        <div class="winner-username-large">${winner.username}</div>
        <div class="winner-label">WINNER</div>
    `;
    elements.winnerModal.style.display = 'flex';
    createConfetti();
}

function createConfetti() {
    const container = elements.winnerModal.querySelector('.confetti-container');
    container.innerHTML = '';
    const colors = ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.width = (Math.random() * 10 + 5) + 'px';
        confetti.style.height = confetti.style.width;
        container.appendChild(confetti);
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    elements.addPlayerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.usernameInput.value.trim();
        const file = elements.imageInput.files[0];

        if (!username || !file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const player = {
                username: username,
                dp: event.target.result
            };
            await savePlayer(player);
            renderPlayers();
            elements.addPlayerForm.reset();
        };
        reader.readAsDataURL(file);
    });

    elements.startBtn.addEventListener('click', startGame);
    elements.pauseBtn.addEventListener('click', pauseGame);
    elements.resumeBtn.addEventListener('click', resumeGame);
    elements.cancelBtn.addEventListener('click', cancelGame);

    elements.clearPlayersBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all players?')) {
            await clearAllPlayers();
            renderPlayers();
        }
    });

    elements.resetGameBtn.addEventListener('click', () => {
        cancelGame();
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.winnerModal.style.display = 'none';
        cancelGame();
    });

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.winnerModal) {
            elements.winnerModal.style.display = 'none';
            cancelGame();
        }
    });
}

// Start the app
init();
