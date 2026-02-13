// SPY BOT - Task-Based Multiplayer Game
// Architecture adapted from TRAITORS game with Among Us task-based gameplay

// Bot Names (Debug)
const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave', 'Bot Eve'];

// Game State
const gameState = {
    playerName: '',
    playerId: '',
    gameCode: '',
    isHost: false,
    role: null, // 'agent' or 'cyborg'
    players: [], // Array of {id, name, role, eliminated, voted, isHost, isBot, connectionId}
    numCyborgs: 1,
    phase: 'lobby', // lobby, playing, deliberation, gameOver
    votes: {}, // playerId: targetPlayerId
    tasks: { 1: 'incomplete', 2: 'incomplete', 3: 'incomplete', 4: 'incomplete', 5: 'incomplete' },
    timeRemaining: 600, // 10 minutes in seconds
    timerRunning: false
};

// Networking
let peer = null;
let connections = {};
let isConnecting = false;

// Debug mode
let debugMode = false;

// Host manual elimination selection
let hostManualSelection = null;

// Screen tracking (for help button return)
let currentScreen = 'welcomeScreen';
let previousScreen = 'welcomeScreen';

// Timer
let timerInterval = null;
let timerSyncInterval = null;

// Audio
let bgMusic;
let musicTimeout = null;
let soundMuted = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    bgMusic = document.getElementById('bgMusic');
    bgMusic.volume = 0.2;

    setupEventListeners();
    loadGameState();

    // Show welcome screen or ask about reconnecting
    if (gameState.gameCode && gameState.players.length > 0 && gameState.phase !== 'gameOver') {
        showReconnectPrompt();
    } else {
        if (gameState.phase === 'gameOver') {
            resetGame();
        }
        showScreen('welcomeScreen');
    }
});

function setupEventListeners() {
    // Sound toggle button
    document.getElementById('soundToggle').addEventListener('click', () => {
        soundMuted = !soundMuted;
        document.getElementById('soundOnIcon').classList.toggle('hidden', soundMuted);
        document.getElementById('soundOffIcon').classList.toggle('hidden', !soundMuted);
        if (soundMuted && bgMusic) {
            bgMusic.pause();
            bgMusic.currentTime = 0;
            if (musicTimeout) {
                clearTimeout(musicTimeout);
                musicTimeout = null;
            }
        }
    });

    // Help button
    document.getElementById('helpButton').addEventListener('click', () => {
        previousScreen = currentScreen || 'welcomeScreen';
        showScreen('helpScreen');
    });

    document.getElementById('btnCloseHelp').addEventListener('click', () => {
        showScreen(previousScreen || 'welcomeScreen');
    });

    document.getElementById('btnCloseHelpBottom').addEventListener('click', () => {
        showScreen(previousScreen || 'welcomeScreen');
    });

    // Reconnect dialog buttons
    document.getElementById('btnReconnectYes').addEventListener('click', () => {
        document.getElementById('reconnectDialog').classList.add('hidden');
        showNotification('Reconnecting to game...', 'success');
        reconnectToGame();
    });

    document.getElementById('btnReconnectNo').addEventListener('click', () => {
        document.getElementById('reconnectDialog').classList.add('hidden');
        resetGame();
        showScreen('welcomeScreen');
    });

    // Emergency reset button
    document.getElementById('emergencyReset').addEventListener('click', () => {
        if (confirm('Are you sure you want to quit the game? This cannot be undone.')) {
            if (gameState.isHost) {
                broadcastToAll({ type: 'gameCancelled' });
            }
            resetGame();
            showScreen('welcomeScreen');
            showNotification('Game reset', 'success');
        }
    });

    // Welcome screen
    document.getElementById('btnPlay').addEventListener('click', () => {
        playSound('sndClick');
        showScreen('nameScreen');
    });

    // Name entry
    document.getElementById('btnHostGame').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        if (name) {
            gameState.playerName = name;
            gameState.playerId = generateId();
            playSound('sndClick');
            hostGame();
        } else {
            showNotification('Please enter your name', 'error');
        }
    });

    document.getElementById('btnJoinGame').addEventListener('click', () => {
        const name = document.getElementById('playerName').value.trim();
        if (name) {
            gameState.playerName = name;
            gameState.playerId = generateId();
            playSound('sndClick');
            showScreen('joinGameScreen');
        } else {
            showNotification('Please enter your name', 'error');
        }
    });

    // Join game
    document.getElementById('btnConfirmJoin').addEventListener('click', () => {
        const code = document.getElementById('gameCodeInput').value.trim().toUpperCase();
        if (code.length === 4 && /^[A-Z]+$/.test(code)) {
            playSound('sndClick');
            joinGame(code);
        } else {
            showNotification('Please enter a 4-letter game code', 'error');
        }
    });

    document.getElementById('btnCancelJoin').addEventListener('click', () => {
        playSound('sndClick');
        showScreen('nameScreen');
    });

    // Auto-uppercase game code input
    document.getElementById('gameCodeInput').addEventListener('focus', (e) => {
        e.target.value = '';
    });
    document.getElementById('gameCodeInput').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Host setup
    document.getElementById('btnStartGame').addEventListener('click', startGameAsHost);
    document.getElementById('btnCancelHost').addEventListener('click', cancelHosting);
    document.getElementById('btnDebugToggle').addEventListener('click', toggleDebugMode);

    // Waiting room
    document.getElementById('btnLeaveGame').addEventListener('click', leaveGame);

    // Role reveal
    document.getElementById('btnAcknowledgeRole').addEventListener('click', () => {
        playSound('sndClick');
        showScreen('gameScreen');
        updateGameScreen();
        if (gameState.isHost) {
            startTimer();
        }
    });

    // Elimination reveal continue
    document.getElementById('btnContinueAfterElimination').addEventListener('click', continueAfterElimination);

    // Game actions
    document.getElementById('btnCallMeeting').addEventListener('click', callDeliberation);
    document.getElementById('btnRecordMurder').addEventListener('click', showMurderScreen);

    // Siren stop buttons
    document.getElementById('btnStopSiren').addEventListener('click', stopSiren);
    document.getElementById('btnStopSirenMeeting').addEventListener('click', stopSiren);

    // Deliberation
    document.getElementById('btnEliminatePlayer').addEventListener('click', eliminatePlayer);
    document.getElementById('btnManualEliminate').addEventListener('click', manualEliminatePlayer);
    document.getElementById('btnCancelDeliberation').addEventListener('click', cancelDeliberation);

    // Murder screen cancel
    document.getElementById('btnCancelMurder').addEventListener('click', () => {
        playSound('sndClick');
        showScreen('gameScreen');
    });

    // Game over
    document.getElementById('btnNewGame').addEventListener('click', () => {
        resetGame();
        showScreen('welcomeScreen');
    });

    // Cyborg count selector
    document.getElementById('numCyborgs').addEventListener('change', (e) => {
        gameState.numCyborgs = parseInt(e.target.value);
        updateCyborgOptions();
    });

    // Task buttons
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`btnTask${i}GRN`).addEventListener('click', () => handleTaskClick(i, 'GRN'));
        document.getElementById(`btnTask${i}RED`).addEventListener('click', () => handleTaskClick(i, 'RED'));
    }
}

// ========================
// GAME FLOW
// ========================

function hostGame() {
    gameState.isHost = true;
    gameState.phase = 'lobby';
    gameState.gameCode = generateGameCode();
    gameState.players = [{
        id: gameState.playerId,
        name: gameState.playerName,
        role: null,
        eliminated: false,
        voted: false,
        isHost: true,
        connectionId: null
    }];

    // Reset debug mode so it can be toggled fresh
    debugMode = false;
    const debugBtn = document.getElementById('btnDebugToggle');
    if (debugBtn) debugBtn.classList.remove('active');

    initializePeer(gameState.gameCode);

    document.getElementById('gameCodeDisplay').textContent = gameState.gameCode;
    updateLobbyPlayers();
    updateCyborgOptions();

    showScreen('hostSetupScreen');
    saveGameState();
}

function joinGame(code) {
    gameState.gameCode = code;
    gameState.isHost = false;

    showLoading(true);

    const myPeerId = generateId();

    initializePeer(myPeerId, () => {
        console.log('Attempting to connect to host:', code);

        const conn = peer.connect(code);

        conn.on('open', () => {
            console.log('Connected to host!');
            connections[code] = conn;

            conn.send({
                type: 'join',
                playerId: gameState.playerId,
                playerName: gameState.playerName
            });

            showLoading(false);
            document.getElementById('waitingGameCode').textContent = code;
            showScreen('waitingRoomScreen');
        });

        conn.on('data', (data) => handleMessage(data, conn));

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showLoading(false);
            showNotification('Failed to join game. Check the code and try again.', 'error');
            showScreen('joinGameScreen');
        });

        conn.on('close', () => {
            console.log('Connection to host closed');
            delete connections[code];
        });

        setTimeout(() => {
            if (!connections[code]) {
                showLoading(false);
                showNotification('Connection timeout. Host may not be available.', 'error');
                showScreen('joinGameScreen');
            }
        }, 20000);
    });
}

function initializePeer(id, callback, _retryCount) {
    const retryCount = _retryCount || 0;

    function createPeer() {
        console.log('Initializing peer with ID:', id);

        peer = new Peer(id, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            },
            debug: 2
        });

        peer.on('open', (peerId) => {
            console.log('Peer connection opened. My ID:', peerId);
            if (callback) callback();
        });

        peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            connections[conn.peer] = conn;

            conn.on('data', (data) => handleMessage(data, conn));

            conn.on('close', () => {
                console.log('Connection closed:', conn.peer);
                delete connections[conn.peer];
                handlePlayerDisconnect(conn.peer);
            });

            conn.on('error', (err) => {
                console.error('Connection error with peer:', conn.peer, err);
            });
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);

            if (err.type === 'unavailable-id' && retryCount < 3) {
                console.log('Peer ID unavailable, retrying... (attempt ' + (retryCount + 1) + ')');
                peer.destroy();
                peer = null;
                const newId = generateId();
                initializePeer(newId, callback, retryCount + 1);
                return;
            }

            if (err.type === 'peer-unavailable') {
                showNotification('Host not found. Check the game code.', 'error');
            } else if (err.type === 'unavailable-id') {
                showNotification('Connection conflict. Please try again.', 'error');
            } else if (err.type === 'network') {
                showNotification('Network error. Check your connection.', 'error');
            } else if (err.type === 'server-error') {
                showNotification('PeerJS server error. Please try again.', 'error');
            } else {
                showNotification('Connection error. Please try again.', 'error');
            }

            showLoading(false);
        });

        peer.on('disconnected', () => {
            console.log('Peer disconnected from signaling server');
            if (!peer.destroyed) {
                peer.reconnect();
            }
        });
    }

    if (peer) {
        peer.destroy();
        peer = null;
        setTimeout(createPeer, 500);
    } else {
        createPeer();
    }
}

// ========================
// MESSAGE HANDLING
// ========================

function handleMessage(data, conn) {
    console.log('Received message:', data);

    switch (data.type) {
        case 'join':
            if (gameState.isHost && gameState.phase === 'lobby') {
                const newPlayer = {
                    id: data.playerId,
                    name: data.playerName,
                    role: null,
                    eliminated: false,
                    voted: false,
                    isHost: false,
                    connectionId: conn.peer
                };

                gameState.players.push(newPlayer);
                updateLobbyPlayers();
                updateCyborgOptions();
                saveGameState();

                conn.send({
                    type: 'gameState',
                    state: gameState
                });

                broadcastToAll({
                    type: 'playerJoined',
                    player: newPlayer,
                    players: gameState.players
                });

                showNotification(`${data.playerName} joined the game`, 'success');
                playSound('sndBeep');
            }
            break;

        case 'gameState':
            gameState.players = data.state.players;
            gameState.numCyborgs = data.state.numCyborgs;
            gameState.phase = data.state.phase;
            if (gameState.phase === 'lobby') {
                updateWaitingPlayers();
            }
            saveGameState();
            break;

        case 'playerJoined':
            gameState.players = data.players;
            updateWaitingPlayers();
            saveGameState();
            showNotification(`${data.player.name} joined the game`, 'success');
            break;

        case 'playerLeft':
            gameState.players = gameState.players.filter(p => p.id !== data.playerId);
            if (gameState.isHost) {
                updateLobbyPlayers();
                broadcastToAll({
                    type: 'playerRemoved',
                    playerId: data.playerId,
                    players: gameState.players
                });
            } else {
                updateWaitingPlayers();
            }
            saveGameState();
            showNotification(`${data.playerName} left the game`, 'error');
            break;

        case 'playerRemoved':
            gameState.players = data.players;
            if (gameState.phase === 'lobby') {
                updateWaitingPlayers();
            }
            saveGameState();
            break;

        case 'gameStart':
            gameState.players = data.players;
            gameState.tasks = data.tasks;
            gameState.timeRemaining = data.timeRemaining;
            gameState.phase = 'playing';
            gameState.timerRunning = true;

            const me = gameState.players.find(p => p.id === gameState.playerId);
            if (me) {
                gameState.role = me.role;
            }

            playMusicOnEvent();
            saveGameState();
            showRoleReveal();
            break;

        case 'taskUpdate':
            if (gameState.isHost) {
                const { taskId, taskType, playerId } = data;
                const player = gameState.players.find(p => p.id === playerId);
                if (!player) return;

                if (taskType === 'GRN') {
                    // Both agents and cyborgs can complete green tasks
                    gameState.tasks[taskId] = 'complete';
                    playSound('sndBeep');
                } else if (taskType === 'RED' && player.role === 'cyborg') {
                    gameState.tasks[taskId] = 'broken';
                    playSound('sndExplosion');
                }

                broadcastToAll({
                    type: 'taskStateSync',
                    tasks: gameState.tasks
                });

                updateTaskDisplay();
                updateStatusDisplay();
                checkWinConditions();
            }
            break;

        case 'taskStateSync':
            gameState.tasks = data.tasks;
            updateTaskDisplay();
            updateStatusDisplay();
            break;

        case 'timerSync':
            gameState.timeRemaining = data.timeRemaining;
            gameState.timerRunning = data.timerRunning;
            updateTimerDisplay();
            break;

        case 'deliberationStart':
            gameState.phase = 'deliberation';
            gameState.votes = {};
            gameState.timerRunning = false;

            playSiren();
            saveGameState();
            showDeliberationScreen();
            showNotification('TEAM MEETING CALLED!', 'error');
            break;

        case 'vote':
            gameState.votes[data.voterId] = data.targetId;
            const voter = gameState.players.find(p => p.id === data.voterId);
            if (voter) voter.voted = true;
            saveGameState();
            if (gameState.phase === 'deliberation') {
                updateVoteStatus();
            }
            break;

        case 'playerEliminated':
            const eliminated = gameState.players.find(p => p.id === data.playerId);
            if (eliminated) {
                eliminated.eliminated = true;
                eliminated.role = data.role;
            }

            gameState.phase = 'playing';
            gameState.votes = {};
            gameState.players.forEach(p => p.voted = false);

            saveGameState();
            showEliminationReveal(data.playerName, data.role);
            break;

        case 'playerMurdered':
            const murdered = gameState.players.find(p => p.id === data.playerId);
            if (murdered) {
                murdered.eliminated = true;
                murdered.role = data.role;
            }
            saveGameState();
            showEliminationReveal(data.playerName, data.role, 'MURDERED');
            break;

        case 'voteTied':
            gameState.votes = {};
            gameState.players.forEach(p => p.voted = false);
            saveGameState();
            showNotification(`Vote tied between ${data.tiedPlayerNames.join(' and ')}! Voting again...`, 'error');
            showDeliberationScreen();
            break;

        case 'deliberationCancelled':
            gameState.phase = 'playing';
            gameState.votes = {};
            gameState.timerRunning = true;
            gameState.players.forEach(p => p.voted = false);
            saveGameState();
            stopSiren();
            showNotification('Team meeting cancelled by host', 'error');
            showScreen('gameScreen');
            updateGameScreen();
            break;

        case 'gameOver':
            gameState.phase = 'gameOver';
            gameState.timerRunning = false;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            data.players.forEach(serverPlayer => {
                const localPlayer = gameState.players.find(p => p.id === serverPlayer.id);
                if (localPlayer) {
                    localPlayer.role = serverPlayer.role;
                    localPlayer.eliminated = serverPlayer.eliminated;
                }
            });

            if (data.tasks) {
                gameState.tasks = data.tasks;
            }

            saveGameState();
            showGameOver(data.winner, data.reason);
            break;

        case 'gameCancelled':
            showNotification('Host cancelled the game', 'error');
            resetGame();
            showScreen('welcomeScreen');
            break;

        case 'requestStateSync':
            if (gameState.isHost) {
                conn.send({
                    type: 'stateSync',
                    state: {
                        players: gameState.players,
                        phase: gameState.phase,
                        numCyborgs: gameState.numCyborgs,
                        votes: gameState.votes,
                        tasks: gameState.tasks,
                        timeRemaining: gameState.timeRemaining,
                        timerRunning: gameState.timerRunning
                    }
                });
            }
            break;

        case 'stateSync':
            gameState.players = data.state.players;
            gameState.phase = data.state.phase;
            gameState.numCyborgs = data.state.numCyborgs;
            gameState.votes = data.state.votes || {};
            gameState.tasks = data.state.tasks || gameState.tasks;
            gameState.timeRemaining = data.state.timeRemaining || gameState.timeRemaining;
            gameState.timerRunning = data.state.timerRunning || false;

            const myPlayer = gameState.players.find(p => p.id === gameState.playerId);
            if (myPlayer && myPlayer.role) {
                gameState.role = myPlayer.role;
            }

            saveGameState();

            if (gameState.phase === 'lobby') {
                showScreen('waitingRoomScreen');
                updateWaitingPlayers();
            } else if (gameState.phase === 'deliberation') {
                showDeliberationScreen();
            } else if (gameState.phase === 'playing') {
                showScreen('gameScreen');
                updateGameScreen();
            }

            showNotification('Synced with game state', 'success');
            break;
    }
}

// ========================
// GAME START
// ========================

function startGameAsHost() {
    if (gameState.players.length < 3) {
        showNotification('Need at least 3 players to start', 'error');
        return;
    }

    if (gameState.numCyborgs >= gameState.players.length / 2) {
        showNotification('Too many cyborgs! Must be less than half the players.', 'error');
        return;
    }

    assignRoles();

    gameState.phase = 'playing';
    gameState.timerRunning = true;
    gameState.tasks = { 1: 'incomplete', 2: 'incomplete', 3: 'incomplete', 4: 'incomplete', 5: 'incomplete' };
    gameState.timeRemaining = 600;

    saveGameState();
    playMusicOnEvent();

    broadcastToAll({
        type: 'gameStart',
        players: gameState.players,
        tasks: gameState.tasks,
        timeRemaining: gameState.timeRemaining
    });

    showRoleReveal();
}

function assignRoles() {
    const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);

    for (let i = 0; i < gameState.numCyborgs; i++) {
        shuffled[i].role = 'cyborg';
    }

    for (let i = gameState.numCyborgs; i < shuffled.length; i++) {
        shuffled[i].role = 'agent';
    }

    gameState.players = shuffled;

    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (me) {
        gameState.role = me.role;
    }
}

function showRoleReveal() {
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.role) return;

    const roleCard = document.getElementById('roleCard');
    const roleImage = document.getElementById('roleImage');
    const roleTitle = document.getElementById('roleTitle');
    const roleDescription = document.getElementById('roleDescription');
    const cyborgListContainer = document.getElementById('cyborgListContainer');

    if (me.role === 'agent') {
        roleCard.className = 'role-card agent';
        roleImage.src = 'assets/Agent.png';
        roleTitle.textContent = 'YOU ARE AN AGENT';
        roleTitle.style.color = 'var(--color-agent)';
        roleDescription.textContent = 'Complete all GREEN tasks before time runs out! Watch out for Cyborgs sabotaging with RED tasks.';
        cyborgListContainer.classList.add('hidden');
    } else {
        roleCard.className = 'role-card cyborg';
        roleImage.src = 'assets/Cyborg.png';
        roleTitle.textContent = 'YOU ARE A CYBORG';
        roleTitle.style.color = 'var(--color-cyborg)';
        roleDescription.textContent = 'Sabotage by completing RED tasks or let the timer run out! You can also press GREEN buttons to blend in and trick nearby Agents.';

        const otherCyborgs = gameState.players.filter(p => p.role === 'cyborg' && p.id !== gameState.playerId);
        if (otherCyborgs.length > 0) {
            const cyborgListDiv = document.getElementById('cyborgList');
            cyborgListDiv.innerHTML = otherCyborgs.map(t => `<div class="player-chip">${t.name}</div>`).join('');
            cyborgListContainer.classList.remove('hidden');
        } else {
            cyborgListContainer.classList.add('hidden');
        }

        playSound('sndDestroy');
    }

    showScreen('roleRevealScreen');
}

// ========================
// TIMER
// ========================

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (gameState.timerRunning && gameState.timeRemaining > 0) {
            gameState.timeRemaining--;
            updateTimerDisplay();

            if (gameState.timeRemaining === 0) {
                handleTimerEnd();
            }
        }
    }, 1000);

    // Sync timer to other players every 5 seconds
    if (timerSyncInterval) clearInterval(timerSyncInterval);
    timerSyncInterval = setInterval(() => {
        if (gameState.isHost && gameState.phase === 'playing') {
            broadcastToAll({
                type: 'timerSync',
                timeRemaining: gameState.timeRemaining,
                timerRunning: gameState.timerRunning
            });
        }
    }, 5000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;
}

function handleTimerEnd() {
    if (gameState.isHost) {
        gameState.timerRunning = false;
        endGame('cyborgs', 'Time ran out!');
    }
}

// ========================
// TASK SYSTEM
// ========================

function handleTaskClick(taskId, taskType) {
    if (gameState.phase !== 'playing') return;

    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || me.eliminated) return;

    // Validate role can perform this action
    // Agents: GREEN only. Cyborgs: RED or GREEN (green to blend in/trick agents)
    const canDoAction = (taskType === 'GRN') ||
                        (taskType === 'RED' && me.role === 'cyborg');

    if (!canDoAction) {
        showNotification('You cannot perform this action!', 'error');
        return;
    }

    // Check if task already done
    if (gameState.tasks[taskId] !== 'incomplete') {
        showNotification('Task already completed!', 'error');
        return;
    }

    playSound('sndClick');

    if (gameState.isHost) {
        gameState.tasks[taskId] = taskType === 'GRN' ? 'complete' : 'broken';
        playSound(taskType === 'GRN' ? 'sndBeep' : 'sndExplosion');

        broadcastToAll({
            type: 'taskStateSync',
            tasks: gameState.tasks
        });

        updateTaskDisplay();
        updateStatusDisplay();
        saveGameState();
        checkWinConditions();
    } else {
        // Send to host for validation
        const hostConn = connections[gameState.gameCode];
        if (hostConn) {
            hostConn.send({
                type: 'taskUpdate',
                taskId: taskId,
                taskType: taskType,
                playerId: gameState.playerId
            });
        }
    }
}

function updateTaskDisplay() {
    for (let i = 1; i <= 5; i++) {
        const status = gameState.tasks[i];
        const grnBtn = document.getElementById(`btnTask${i}GRN`);
        const redBtn = document.getElementById(`btnTask${i}RED`);

        if (grnBtn && redBtn) {
            // Reset active states
            grnBtn.classList.remove('active');
            redBtn.classList.remove('active');
            grnBtn.disabled = false;
            redBtn.disabled = false;

            if (status === 'complete') {
                grnBtn.classList.add('active');
                grnBtn.disabled = true;
                redBtn.disabled = true;
            } else if (status === 'broken') {
                redBtn.classList.add('active');
                grnBtn.disabled = true;
                redBtn.disabled = true;
            }
        }
    }
}

function updateStatusDisplay() {
    const completed = Object.values(gameState.tasks).filter(t => t === 'complete').length;
    const broken = Object.values(gameState.tasks).filter(t => t === 'broken').length;

    document.getElementById('statusDisplay').textContent =
        `Complete: ${completed}/5 | Broken: ${broken}/5`;
}

function checkWinConditions() {
    if (!gameState.isHost) return;

    const completed = Object.values(gameState.tasks).filter(t => t === 'complete').length;
    const broken = Object.values(gameState.tasks).filter(t => t === 'broken').length;
    const cyborgsAlive = gameState.players.filter(p => !p.eliminated && p.role === 'cyborg').length;

    if (completed === 5) {
        endGame('agents', 'All tasks completed!');
    } else if (broken === 5) {
        endGame('cyborgs', 'All tasks sabotaged!');
    } else if (cyborgsAlive === 0) {
        endGame('agents', 'All Cyborgs have been exposed!');
    }
}

// ========================
// DELIBERATION (TEAM MEETING)
// ========================

function callDeliberation() {
    if (!gameState.isHost) return;

    gameState.phase = 'deliberation';
    gameState.votes = {};
    hostManualSelection = null;
    gameState.timerRunning = false;
    gameState.players.forEach(p => p.voted = false);

    saveGameState();
    playSiren();

    broadcastToAll({
        type: 'deliberationStart'
    });

    showDeliberationScreen();
    scheduleBotDeliberationVotes();
}

function showDeliberationScreen() {
    const votingPlayers = document.getElementById('votingPlayers');
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    const meEliminated = gameState.players.find(p => p.id === gameState.playerId)?.eliminated;
    const disableButtons = meEliminated && !gameState.isHost;

    votingPlayers.innerHTML = alivePlayers.map(p => `
        <button class="vote-button" data-player-id="${p.id}" ${disableButtons ? 'disabled' : ''}>
            ${p.name}${p.id === gameState.playerId ? ' (You)' : ''}
        </button>
    `).join('');

    if (meEliminated && !gameState.isHost) {
        votingPlayers.insertAdjacentHTML('beforeend',
            '<p style="color: #ff6b6b; margin-top: 10px;">You have been eliminated and cannot vote.</p>');
    }

    votingPlayers.querySelectorAll('.vote-button').forEach(btn => {
        btn.addEventListener('click', () => voteForPlayer(btn.dataset.playerId));
    });

    if (gameState.isHost) {
        document.getElementById('hostDeliberationActions').classList.remove('hidden');
    } else {
        document.getElementById('hostDeliberationActions').classList.add('hidden');
    }

    updateVoteStatus();
    showScreen('deliberationScreen');
}

function voteForPlayer(targetId) {
    const myPlayer = gameState.players.find(p => p.id === gameState.playerId);

    if (myPlayer && myPlayer.eliminated) {
        if (gameState.isHost) {
            hostManualSelection = targetId;
            document.querySelectorAll('.vote-button').forEach(btn => btn.classList.remove('voted'));
            document.querySelector(`[data-player-id="${targetId}"]`)?.classList.add('voted');
            // hostManualSelection is set - manual eliminate ready
            return;
        }
        showNotification('You have been eliminated and cannot vote!', 'error');
        return;
    }

    if (gameState.isHost) {
        hostManualSelection = targetId;
    }

    gameState.votes[gameState.playerId] = targetId;
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (me) me.voted = true;

    saveGameState();

    broadcastToAll({
        type: 'vote',
        voterId: gameState.playerId,
        targetId: targetId
    });

    document.querySelectorAll('.vote-button').forEach(btn => btn.classList.remove('voted'));
    document.querySelector(`[data-player-id="${targetId}"]`)?.classList.add('voted');

    if (gameState.isHost) {
        // hostManualSelection is set - manual eliminate ready
    }

    updateVoteStatus();
}

function updateVoteStatus() {
    const voteStatus = document.getElementById('voteStatus');
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    const votedCount = Object.keys(gameState.votes).length;

    voteStatus.innerHTML = `<p>Votes: ${votedCount} / ${alivePlayers.length}</p>`;

    if (gameState.isHost && votedCount === alivePlayers.length) {
        showNotification('All players have voted! You can now count votes.', 'success');
    }
}

function eliminatePlayer() {
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    const votedCount = Object.keys(gameState.votes).length;

    if (votedCount < alivePlayers.length) {
        showNotification('Not all players have voted yet!', 'error');
        return;
    }

    // Count votes
    const voteCounts = {};
    Object.values(gameState.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let eliminatedId = null;
    const tied = [];

    Object.entries(voteCounts).forEach(([playerId, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            eliminatedId = playerId;
            tied.length = 0;
            tied.push(playerId);
        } else if (count === maxVotes) {
            tied.push(playerId);
        }
    });

    if (tied.length > 1) {
        const tiedNames = tied.map(id => {
            const p = gameState.players.find(pl => pl.id === id);
            return p ? p.name : 'Unknown';
        });

        broadcastToAll({
            type: 'voteTied',
            tiedPlayerNames: tiedNames
        });

        showNotification(`Vote tied between ${tiedNames.join(' and ')}! Voting again...`, 'error');
        gameState.votes = {};
        gameState.players.forEach(p => p.voted = false);
        saveGameState();
        updateVoteStatus();
        showDeliberationScreen();
        scheduleBotDeliberationVotes();
        return;
    }

    const eliminatedPlayer = gameState.players.find(p => p.id === eliminatedId);
    if (!eliminatedPlayer) return;

    eliminatedPlayer.eliminated = true;

    broadcastToAll({
        type: 'playerEliminated',
        playerId: eliminatedId,
        playerName: eliminatedPlayer.name,
        role: eliminatedPlayer.role
    });

    gameState.phase = 'playing';
    gameState.votes = {};
    gameState.players.forEach(p => p.voted = false);
    saveGameState();

    showEliminationReveal(eliminatedPlayer.name, eliminatedPlayer.role);
}

function manualEliminatePlayer() {
    if (!gameState.isHost) return;

    if (!hostManualSelection) {
        showNotification('Please select a player first by clicking their button above', 'error');
        return;
    }

    const eliminatedPlayer = gameState.players.find(p => p.id === hostManualSelection);
    if (!eliminatedPlayer || eliminatedPlayer.eliminated) {
        showNotification('Invalid player selection', 'error');
        return;
    }

    if (!confirm(`Manually eliminate ${eliminatedPlayer.name}?`)) {
        return;
    }

    eliminatedPlayer.eliminated = true;

    broadcastToAll({
        type: 'playerEliminated',
        playerId: eliminatedPlayer.id,
        playerName: eliminatedPlayer.name,
        role: eliminatedPlayer.role
    });

    gameState.phase = 'playing';
    gameState.votes = {};
    gameState.players.forEach(p => p.voted = false);
    saveGameState();

    showEliminationReveal(eliminatedPlayer.name, eliminatedPlayer.role);
}

function cancelDeliberation() {
    gameState.phase = 'playing';
    gameState.votes = {};
    gameState.timerRunning = true;
    gameState.players.forEach(p => p.voted = false);

    saveGameState();
    stopSiren();

    if (gameState.isHost) {
        broadcastToAll({ type: 'deliberationCancelled' });
    }

    showScreen('gameScreen');
    updateGameScreen();
}

function showEliminationReveal(playerName, role, title) {
    const titleEl = document.getElementById('eliminationRevealTitle');
    const card = document.getElementById('eliminationRevealCard');
    const nameEl = document.getElementById('eliminationRevealName');
    const roleEl = document.getElementById('eliminationRevealRole');

    titleEl.textContent = title || 'ELIMINATED';
    nameEl.textContent = playerName;
    roleEl.textContent = role === 'agent' ? 'AGENT' : 'CYBORG';
    card.className = `elimination-reveal-card ${role}`;

    playSound('sndExplosion');

    showScreen('eliminationRevealScreen');
}

function continueAfterElimination() {
    playSound('sndClick');
    stopSiren();

    // Resume timer after deliberation
    if (gameState.isHost) {
        gameState.timerRunning = true;
        broadcastToAll({
            type: 'timerSync',
            timeRemaining: gameState.timeRemaining,
            timerRunning: true
        });
    }

    showScreen('gameScreen');
    updateGameScreen();

    // Check win conditions after elimination
    if (gameState.isHost) {
        checkWinConditions();
    }
}

// ========================
// MURDER MECHANIC (Host only - records physical world murders)
// ========================

function showMurderScreen() {
    if (!gameState.isHost) return;
    playSound('sndClick');

    const container = document.getElementById('murderPlayersList');
    const alivePlayers = gameState.players.filter(p => !p.eliminated);

    container.innerHTML = alivePlayers.map(p => `
        <button class="vote-button" data-player-id="${p.id}">
            ${p.name}${p.id === gameState.playerId ? ' (You)' : ''}
        </button>
    `).join('');

    container.querySelectorAll('.vote-button').forEach(btn => {
        btn.addEventListener('click', () => recordMurder(btn.dataset.playerId));
    });

    showScreen('murderScreen');
}

function recordMurder(playerId) {
    if (!gameState.isHost) return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.eliminated) return;

    if (!confirm(`Record ${player.name} as murdered?`)) return;

    player.eliminated = true;
    playSound('sndExplosion');

    broadcastToAll({
        type: 'playerMurdered',
        playerId: player.id,
        playerName: player.name,
        role: player.role
    });

    saveGameState();
    showEliminationReveal(player.name, player.role, 'MURDERED');
    checkWinConditions();
}

// ========================
// BOT SYSTEM
// ========================

function toggleDebugMode() {
    if (gameState.phase !== 'lobby') return;

    debugMode = !debugMode;
    const btn = document.getElementById('btnDebugToggle');

    if (debugMode) {
        btn.classList.add('active');
        addBotPlayers();
        showNotification('Debug mode ON - 5 bots added', 'success');
    } else {
        btn.classList.remove('active');
        removeBotPlayers();
        showNotification('Debug mode OFF - bots removed', 'error');
    }
}

function addBotPlayers() {
    if (!gameState.isHost || gameState.phase !== 'lobby') return;

    if (gameState.players.some(p => p.isBot)) {
        showNotification('Bots already added!', 'error');
        return;
    }

    BOT_NAMES.forEach(name => {
        gameState.players.push({
            id: 'bot-' + generateId(),
            name: name,
            role: null,
            eliminated: false,
            voted: false,
            isHost: false,
            isBot: true,
            connectionId: null
        });
    });

    updateLobbyPlayers();
    updateCyborgOptions();
    saveGameState();

    broadcastToAll({
        type: 'playerJoined',
        player: { name: 'Bots' },
        players: gameState.players
    });
}

function removeBotPlayers() {
    if (!gameState.isHost || gameState.phase !== 'lobby') return;

    const hadBots = gameState.players.some(p => p.isBot);
    gameState.players = gameState.players.filter(p => !p.isBot);

    if (hadBots) {
        updateLobbyPlayers();
        updateCyborgOptions();
        saveGameState();

        broadcastToAll({
            type: 'playerJoined',
            player: { name: 'Update' },
            players: gameState.players
        });
    }
}

function scheduleBotDeliberationVotes() {
    if (!gameState.isHost) return;

    const aliveBots = gameState.players.filter(p => !p.eliminated && p.isBot);
    const alivePlayers = gameState.players.filter(p => !p.eliminated);

    aliveBots.forEach((bot) => {
        const delay = 500 + Math.random() * 1500;
        setTimeout(() => {
            if (gameState.phase !== 'deliberation') return;
            if (bot.eliminated) return;
            if (gameState.votes[bot.id]) return;

            const targets = alivePlayers.filter(p => p.id !== bot.id && !p.eliminated);
            if (targets.length === 0) return;
            const target = targets[Math.floor(Math.random() * targets.length)];

            gameState.votes[bot.id] = target.id;
            bot.voted = true;
            saveGameState();

            broadcastToAll({
                type: 'vote',
                voterId: bot.id,
                targetId: target.id
            });

            updateVoteStatus();
        }, delay);
    });
}

// ========================
// GAME OVER
// ========================

function endGame(winner, reason) {
    if (!gameState.isHost) return;

    gameState.phase = 'gameOver';
    gameState.timerRunning = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (timerSyncInterval) {
        clearInterval(timerSyncInterval);
        timerSyncInterval = null;
    }

    saveGameState();
    playMusicOnEvent();

    broadcastToAll({
        type: 'gameOver',
        winner: winner,
        reason: reason,
        players: gameState.players,
        tasks: gameState.tasks
    });

    showGameOver(winner, reason);
}

function showGameOver(winner, reason) {
    const winnerTitle = document.getElementById('winnerTitle');
    const winnerMessage = document.getElementById('winnerMessage');
    const finalRolesList = document.getElementById('finalRolesList');

    if (winner === 'agents') {
        winnerTitle.textContent = 'AGENTS WIN!';
        winnerTitle.className = 'winner-title agents-win';
    } else {
        winnerTitle.textContent = 'CYBORGS WIN!';
        winnerTitle.className = 'winner-title cyborgs-win';
    }

    winnerMessage.textContent = reason || '';

    finalRolesList.innerHTML = gameState.players.map(p => {
        let statusIcon = '';
        if (p.eliminated) statusIcon = ' (Eliminated)';

        return `
            <div class="role-item ${p.role}">
                <span>${p.isBot ? 'BOT ' : ''}${p.name}${statusIcon}</span>
                <span class="role-badge ${p.role}">${(p.role || '?').toUpperCase()}</span>
            </div>
        `;
    }).join('');

    showScreen('gameOverScreen');
}

// ========================
// UI UPDATE FUNCTIONS
// ========================

function updateLobbyPlayers() {
    const lobbyPlayers = document.getElementById('lobbyPlayers');
    lobbyPlayers.innerHTML = gameState.players.map(p => `
        <div class="player-chip ${p.isHost ? 'host' : ''} ${p.isBot ? 'bot' : ''}">
            ${p.isBot ? 'BOT ' : ''}${p.name}${p.isHost ? ' (Host)' : ''}
        </div>
    `).join('');

    const startBtn = document.getElementById('btnStartGame');
    const helpText = document.getElementById('startButtonHelp');

    if (gameState.players.length < 3) {
        startBtn.disabled = true;
        helpText.textContent = `Need at least 3 players to start (currently ${gameState.players.length})`;
    } else {
        startBtn.disabled = false;
        helpText.textContent = '';
    }
}

function updateWaitingPlayers() {
    const waitingPlayers = document.getElementById('waitingPlayers');
    waitingPlayers.innerHTML = gameState.players.map(p => `
        <div class="player-chip ${p.isHost ? 'host' : ''} ${p.isBot ? 'bot' : ''}">
            ${p.isBot ? 'BOT ' : ''}${p.name}${p.isHost ? ' (Host)' : ''}
        </div>
    `).join('');
}

function updateGameScreen() {
    const aliveAgents = gameState.players.filter(p => !p.eliminated && p.role === 'agent').length;
    const aliveCyborgs = gameState.players.filter(p => !p.eliminated && p.role === 'cyborg').length;

    document.getElementById('agentCount').textContent = aliveAgents;
    document.getElementById('cyborgCount').textContent = aliveCyborgs;

    // Show host actions
    if (gameState.isHost) {
        document.getElementById('hostActions').classList.remove('hidden');
    } else {
        document.getElementById('hostActions').classList.add('hidden');
    }

    updateTaskDisplay();
    updateTimerDisplay();
    updateStatusDisplay();
}

function updateCyborgOptions() {
    const numCyborgs = document.getElementById('numCyborgs');
    const playerCount = gameState.players.length;
    const maxCyborgs = Math.floor(playerCount / 2);

    numCyborgs.innerHTML = '';
    for (let i = 1; i <= Math.max(1, maxCyborgs); i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} Cyborg${i > 1 ? 's' : ''}`;
        if (i === gameState.numCyborgs) option.selected = true;
        numCyborgs.appendChild(option);
    }
}

// ========================
// NETWORKING HELPERS
// ========================

function broadcastToAll(message) {
    Object.values(connections).forEach(conn => {
        try {
            conn.send(message);
        } catch (e) {
            console.error('Failed to send to peer:', e);
        }
    });
}

function handlePlayerDisconnect(peerId) {
    const player = gameState.players.find(p => p.connectionId === peerId);

    if (player) {
        console.log('Player disconnected:', player.name);

        if (gameState.isHost) {
            gameState.players = gameState.players.filter(p => p.connectionId !== peerId);

            if (gameState.phase === 'lobby') {
                updateLobbyPlayers();
            }

            broadcastToAll({
                type: 'playerRemoved',
                playerId: player.id,
                playerName: player.name,
                players: gameState.players
            });

            saveGameState();
            showNotification(`${player.name} disconnected`, 'error');
        }
    }

    // Host failover
    if (player && player.isHost && !gameState.isHost && gameState.players.length > 1) {
        gameState.isHost = true;
        const me = gameState.players.find(p => p.id === gameState.playerId);
        if (me) me.isHost = true;

        showNotification('You are now the host!', 'success');
        saveGameState();

        if (gameState.phase === 'playing') {
            updateGameScreen();
        }
    }
}

function reconnectToGame() {
    if (gameState.isHost) {
        initializePeer(gameState.gameCode);

        if (gameState.phase === 'lobby') {
            showScreen('hostSetupScreen');
            document.getElementById('gameCodeDisplay').textContent = gameState.gameCode;
            updateLobbyPlayers();
        } else if (gameState.phase === 'playing') {
            showScreen('gameScreen');
            updateGameScreen();
            startTimer();
        }
    } else {
        joinGame(gameState.gameCode);
    }
}

function showReconnectPrompt() {
    const roleText = gameState.role ? ` as ${gameState.role === 'agent' ? 'an Agent' : 'a Cyborg'}` : '';
    const phaseText = gameState.phase === 'lobby' ? 'in the lobby' : 'in progress';
    const message = `You were in a game ${phaseText}${roleText}. Do you want to reconnect?`;

    document.getElementById('reconnectMessage').textContent = message;
    document.getElementById('reconnectDialog').classList.remove('hidden');
}

function cancelHosting() {
    if (gameState.isHost && gameState.players.length > 1) {
        broadcastToAll({ type: 'gameCancelled' });
    }
    resetGame();
    showScreen('nameScreen');
}

function leaveGame() {
    if (!gameState.isHost && connections[gameState.gameCode]) {
        connections[gameState.gameCode].send({
            type: 'playerLeft',
            playerId: gameState.playerId,
            playerName: gameState.playerName
        });
    }

    if (gameState.isHost) {
        broadcastToAll({ type: 'gameCancelled' });
    }

    resetGame();
    showScreen('welcomeScreen');
}

function resetGame() {
    if (peer) peer.destroy();
    peer = null;
    connections = {};

    // Reset debug mode
    debugMode = false;
    const debugBtn = document.getElementById('btnDebugToggle');
    if (debugBtn) debugBtn.classList.remove('active');

    // Stop any playing siren
    stopSiren();

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (timerSyncInterval) {
        clearInterval(timerSyncInterval);
        timerSyncInterval = null;
    }

    gameState.gameCode = '';
    gameState.isHost = false;
    gameState.role = null;
    gameState.players = [];
    gameState.phase = 'lobby';
    gameState.votes = {};
    gameState.tasks = { 1: 'incomplete', 2: 'incomplete', 3: 'incomplete', 4: 'incomplete', 5: 'incomplete' };
    gameState.timeRemaining = 600;
    gameState.timerRunning = false;
    gameState.numCyborgs = 1;

    localStorage.removeItem('spybotGameState');
}

// ========================
// UTILITY FUNCTIONS
// ========================

function generateGameCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return code;
}

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function showScreen(screenId) {
    if (screenId !== 'helpScreen') {
        currentScreen = screenId;
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    // Show/hide emergency reset button
    const resetBtn = document.getElementById('emergencyReset');
    if (screenId === 'welcomeScreen' || screenId === 'helpScreen') {
        resetBtn.classList.add('hidden');
    } else {
        resetBtn.classList.remove('hidden');
    }

    // Show help button on all screens except help
    const helpBtn = document.getElementById('helpButton');
    if (screenId === 'helpScreen') {
        helpBtn.classList.add('hidden');
    } else {
        helpBtn.classList.remove('hidden');
    }

    // Show debug toggle only on host setup screen
    const debugBtn = document.getElementById('btnDebugToggle');
    if (screenId === 'hostSetupScreen') {
        debugBtn.classList.remove('hidden');
    } else {
        debugBtn.classList.add('hidden');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function playSound(soundId) {
    if (soundMuted) return;
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound play failed:', e));
    }
}

function playSiren() {
    if (soundMuted) return;
    const siren = document.getElementById('sndSiren');
    if (siren) {
        siren.currentTime = 0;
        siren.play().catch(e => console.log('Siren play failed:', e));
    }
    // Show stop siren buttons
    const stopBtn = document.getElementById('btnStopSiren');
    const stopBtnMeeting = document.getElementById('btnStopSirenMeeting');
    if (stopBtn) stopBtn.classList.remove('hidden');
    if (stopBtnMeeting) stopBtnMeeting.classList.remove('hidden');
}

function stopSiren() {
    const siren = document.getElementById('sndSiren');
    if (siren) {
        siren.pause();
        siren.currentTime = 0;
    }
    // Hide stop siren buttons
    const stopBtn = document.getElementById('btnStopSiren');
    const stopBtnMeeting = document.getElementById('btnStopSirenMeeting');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (stopBtnMeeting) stopBtnMeeting.classList.add('hidden');
}

function playMusicOnEvent() {
    if (bgMusic && !soundMuted) {
        if (musicTimeout) {
            clearTimeout(musicTimeout);
        }

        bgMusic.currentTime = 0;
        bgMusic.play().catch(e => console.log('Music play failed:', e));

        musicTimeout = setTimeout(() => {
            bgMusic.pause();
            bgMusic.currentTime = 0;
        }, 120000);
    }
}

// ========================
// LOCAL STORAGE
// ========================

function saveGameState() {
    const stateToSave = {
        playerName: gameState.playerName,
        playerId: gameState.playerId,
        gameCode: gameState.gameCode,
        isHost: gameState.isHost,
        role: gameState.role,
        players: gameState.players,
        numCyborgs: gameState.numCyborgs,
        phase: gameState.phase,
        tasks: gameState.tasks,
        timeRemaining: gameState.timeRemaining,
        timerRunning: gameState.timerRunning
    };

    localStorage.setItem('spybotGameState', JSON.stringify(stateToSave));
}

function loadGameState() {
    const saved = localStorage.getItem('spybotGameState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            Object.assign(gameState, state);
        } catch (e) {
            console.error('Failed to load game state:', e);
            localStorage.removeItem('spybotGameState');
        }
    }
}

// Prevent accidental page refresh
window.addEventListener('beforeunload', (e) => {
    if (gameState.players.length > 0 && gameState.phase !== 'gameOver') {
        e.preventDefault();
        e.returnValue = '';
    }
});
