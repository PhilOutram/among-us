// SPY BOT - Task-Based Multiplayer Game
// Using PeerJS for P2P networking

class SpyBotGame {
    constructor() {
        this.peer = null;
        this.connections = [];
        this.gameCode = '';
        this.playerName = '';
        this.isHost = false;
        
        this.gameState = {
            players: [],  // {name, id, role: 'agent'|'cyborg'}
            tasks: {
                1: 'incomplete',  // incomplete, complete, broken
                2: 'incomplete',
                3: 'incomplete',
                4: 'incomplete',
                5: 'incomplete'
            },
            timeRemaining: 600,  // 10 minutes in seconds
            timerRunning: false,
            gamePhase: 'lobby',  // lobby, playing, meeting, gameover
            numCyborgs: 1
        };
        
        this.timerInterval = null;
        this.initializeEventListeners();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Splash screen
        document.getElementById('btnPlay').addEventListener('click', () => this.goToStartScreen());
        
        // Start screen
        document.getElementById('btnJoin').addEventListener('click', () => this.showJoinScreen());
        document.getElementById('btnCreate').addEventListener('click', () => this.createGame());
        
        // Join screen
        document.getElementById('btnJoinConfirm').addEventListener('click', () => this.joinGame());
        
        // Create screen
        document.getElementById('btnStartGame').addEventListener('click', () => this.startGame());
        
        // Role reveal
        document.getElementById('btnAgentContinue').addEventListener('click', () => this.enterGame());
        document.getElementById('btnCyborgContinue').addEventListener('click', () => this.enterGame());
        
        // Task buttons
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`btnTask${i}GRN`).addEventListener('click', () => this.handleTaskClick(i, 'GRN'));
            document.getElementById(`btnTask${i}RED`).addEventListener('click', () => this.handleTaskClick(i, 'RED'));
        }
        
        // Game actions
        document.getElementById('btnCallMeeting').addEventListener('click', () => this.callMeeting());
        document.getElementById('btnExposed').addEventListener('click', () => this.showExposeScreen());
        document.getElementById('btnReset').addEventListener('click', () => this.resetGame());
        
        // Meeting
        document.getElementById('btnEndMeeting').addEventListener('click', () => this.endMeeting());
        
        // Expose
        document.getElementById('btnCancelExpose').addEventListener('click', () => this.cancelExpose());
        
        // Game over
        document.getElementById('btnNewGame').addEventListener('click', () => this.newGame());
        
        // Help button
        document.getElementById('helpButton').addEventListener('click', () => this.showHelp());
        document.getElementById('closeHelp').addEventListener('click', () => this.closeHelp());
        
        // Emergency reset
        document.getElementById('emergencyReset').addEventListener('click', () => this.confirmReset());
        
        // Reconnect dialog
        document.getElementById('btnReconnectYes').addEventListener('click', () => this.reconnectToGame());
        document.getElementById('btnReconnectNo').addEventListener('click', () => this.startNewGame());
    }

    // Show screen
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        
        // Show/hide help and reset buttons based on screen
        const helpButton = document.getElementById('helpButton');
        const resetButton = document.getElementById('emergencyReset');
        
        if (screenId === 'splashScreen' || screenId === 'startScreen') {
            helpButton.classList.add('hidden');
            resetButton.classList.add('hidden');
        } else {
            helpButton.classList.remove('hidden');
            resetButton.classList.remove('hidden');
        }
        
        // Save game state
        this.saveGameState();
    }

    // Play sounds
    playSound(soundId) {
        const sound = document.getElementById(soundId);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Sound play failed:', e));
        }
    }

    // Show notification
    showNotification(message, isError = false) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = isError ? 'notification error' : 'notification';
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 4000);
    }

    // Generate random 4-letter code
    generateGameCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Go to start screen
    goToStartScreen() {
        this.playSound('sndClick');
        this.showScreen('startScreen');
        
        // Start background music
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic.paused) {
            bgMusic.volume = 0.3;
            bgMusic.play().catch(e => console.log('Music failed:', e));
        }
    }

    // Show join screen
    showJoinScreen() {
        this.playSound('sndClick');
        this.showScreen('joinScreen');
    }

    // Create game (host)
    async createGame() {
        this.playSound('sndClick');
        this.isHost = true;
        this.gameCode = this.generateGameCode();
        this.playerName = 'Host';  // Default, can be changed later
        
        this.showLoading(true);
        
        try {
            // Initialize PeerJS
            this.peer = new Peer(this.gameCode, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Host peer opened:', id);
                this.gameState.players = [{ name: this.playerName, id: 'host', role: null }];
                this.showLoading(false);
                this.showCreateScreen();
                this.saveGameState();
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.showLoading(false);
                
                let errorMsg = 'Connection error';
                if (err.type === 'unavailable-id') {
                    errorMsg = 'Game code already in use. Please try again.';
                    this.gameCode = this.generateGameCode();
                    setTimeout(() => this.createGame(), 1000);
                    return;
                } else if (err.type === 'network') {
                    errorMsg = 'Network error. Check your internet connection.';
                } else if (err.type === 'peer-unavailable') {
                    errorMsg = 'Could not connect to peer network.';
                }
                
                this.showNotification(errorMsg, true);
            });
            
            this.peer.on('disconnected', () => {
                console.log('Peer disconnected, attempting reconnect...');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });

        } catch (error) {
            console.error('Failed to create game:', error);
            this.showLoading(false);
            this.showNotification('Failed to create game. Please try again.', true);
        }
    }

    // Show create screen
    showCreateScreen() {
        this.showScreen('createScreen');
        document.getElementById('gameCode').textContent = this.gameCode;
        this.updatePlayersList();
        this.checkCanStart();
    }

    // Handle new player connection
    handleNewConnection(conn) {
        conn.on('open', () => {
            console.log('New connection from:', conn.peer);
            this.connections.push(conn);
            
            conn.on('data', (data) => {
                this.handleMessage(data, conn);
            });

            conn.on('close', () => {
                this.handleDisconnection(conn);
            });
        });
    }

    // Handle incoming messages
    handleMessage(data, conn) {
        console.log('Received message:', data);
        
        switch (data.type) {
            case 'join':
                this.handlePlayerJoin(data, conn);
                break;
            case 'taskUpdate':
                this.handleTaskUpdate(data);
                break;
            case 'stateUpdate':
                this.handleStateUpdate(data);
                break;
        }
    }

    // Handle player joining
    handlePlayerJoin(data, conn) {
        if (this.isHost) {
            const newPlayer = {
                name: data.playerName,
                id: conn.peer,
                role: null
            };
            
            this.gameState.players.push(newPlayer);
            this.playSound('sndBeep');
            this.showNotification(`${data.playerName} joined!`);
            this.updatePlayersList();
            this.checkCanStart();
            
            // Send current state to new player
            conn.send({
                type: 'stateUpdate',
                gameState: this.gameState,
                gameCode: this.gameCode
            });
            
            // Broadcast to all
            this.broadcastGameState();
        }
    }

    // Handle task update from other players
    handleTaskUpdate(data) {
        if (this.isHost) {
            const { taskId, taskType, playerId } = data;
            const player = this.gameState.players.find(p => p.id === playerId);
            
            if (!player) return;
            
            // Check if player can do this action
            if (taskType === 'GRN' && player.role === 'agent') {
                this.gameState.tasks[taskId] = 'complete';
                this.playSound('sndBeep');
            } else if (taskType === 'RED' && player.role === 'cyborg') {
                this.gameState.tasks[taskId] = 'broken';
                this.playSound('sndExplosion');
            }
            
            this.broadcastGameState();
            this.checkWinConditions();
        }
    }

    // Handle state update (for non-host players)
    handleStateUpdate(data) {
        if (!this.isHost) {
            this.gameState = data.gameState;
            this.gameCode = data.gameCode || this.gameCode;
            this.updateUI();
        }
    }

    // Update players list
    updatePlayersList() {
        const lists = ['playersList', 'waitingPlayersList', 'meetingPlayersList'];
        lists.forEach(listId => {
            const elem = document.getElementById(listId);
            if (elem) {
                elem.innerHTML = this.gameState.players.map(p => 
                    `${p.name}${p.id === 'host' ? ' (Host)' : ''}`
                ).join('<br>');
            }
        });
    }

    // Check if can start game
    checkCanStart() {
        const btn = document.getElementById('btnStartGame');
        if (this.gameState.players.length >= 3) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    }

    // Join game
    async joinGame() {
        const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
        
        if (!code || code.length !== 4) {
            this.showNotification('Please enter a 4-letter code', true);
            return;
        }
        
        this.gameCode = code;
        this.playerName = 'Player' + Math.floor(Math.random() * 1000);
        this.playSound('sndClick');
        
        try {
            this.peer = new Peer({
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Player peer opened:', id);
                
                // Connect to host
                const conn = this.peer.connect(this.gameCode);
                
                conn.on('open', () => {
                    console.log('Connected to host');
                    this.connections.push(conn);
                    
                    // Send join request
                    conn.send({
                        type: 'join',
                        playerName: this.playerName
                    });
                    
                    conn.on('data', (data) => {
                        this.handleMessage(data, conn);
                    });
                    
                    conn.on('close', () => {
                        this.showNotification('Connection lost', true);
                    });
                    
                    this.showWaitingScreen();
                });
                
                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    this.showNotification('Failed to join game', true);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.showNotification('Connection error: ' + err.message, true);
            });

        } catch (error) {
            console.error('Failed to join:', error);
            this.showNotification('Failed to join game', true);
        }
    }

    // Show waiting screen
    showWaitingScreen() {
        this.showScreen('waitingScreen');
        document.getElementById('waitingCode').textContent = this.gameCode;
    }

    // Start game (assign roles and begin)
    startGame() {
        if (!this.isHost) return;
        
        this.playSound('sndSiren');
        
        // Assign roles
        this.assignRoles();
        
        // Set game phase
        this.gameState.gamePhase = 'playing';
        this.gameState.timerRunning = true;
        
        // Broadcast state
        this.broadcastGameState();
        
        // Show role to host
        this.showRoleReveal();
        
        // Start timer
        this.startTimer();
    }

    // Assign roles to players
    assignRoles() {
        const players = [...this.gameState.players];
        const numCyborgs = Math.max(1, Math.floor(players.length / 4));  // 1 cyborg per 4 players
        this.gameState.numCyborgs = numCyborgs;
        
        // Shuffle players
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        
        // Assign roles
        players.forEach((player, index) => {
            const role = index < numCyborgs ? 'cyborg' : 'agent';
            const gamePlayer = this.gameState.players.find(p => p.id === player.id);
            if (gamePlayer) {
                gamePlayer.role = role;
            }
        });
        
        console.log('Roles assigned:', this.gameState.players);
    }

    // Show role reveal screen
    showRoleReveal() {
        const myId = this.isHost ? 'host' : this.peer.id;
        const me = this.gameState.players.find(p => p.id === myId);
        
        if (!me) return;
        
        if (me.role === 'agent') {
            this.showScreen('agentScreen');
        } else {
            // Show other cyborgs
            const cyborgs = this.gameState.players
                .filter(p => p.role === 'cyborg' && p.id !== myId)
                .map(p => p.name);
            
            document.getElementById('cyborgTeamList').innerHTML = 
                cyborgs.length > 0 ? cyborgs.join('<br>') : 'You are the only Cyborg!';
            
            this.showScreen('cyborgScreen');
            this.playSound('sndDestroy');
        }
    }

    // Enter game after role reveal
    enterGame() {
        this.playSound('sndClick');
        this.showScreen('gameScreen');
        this.updateUI();
    }

    // Start countdown timer
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (this.gameState.timerRunning && this.gameState.timeRemaining > 0) {
                this.gameState.timeRemaining--;
                this.updateTimerDisplay();
                
                if (this.gameState.timeRemaining === 0) {
                    this.handleTimerEnd();
                }
                
                if (this.isHost) {
                    this.broadcastGameState();
                }
            }
        }, 1000);
    }

    // Update timer display
    updateTimerDisplay() {
        const minutes = Math.floor(this.gameState.timeRemaining / 60);
        const seconds = this.gameState.timeRemaining % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timerDisplay').textContent = display;
    }

    // Handle timer reaching zero
    handleTimerEnd() {
        if (this.isHost) {
            this.gameState.timerRunning = false;
            this.endGame('cyborgs', 'Time ran out!');
        }
    }

    // Handle task click
    handleTaskClick(taskId, taskType) {
        const myId = this.isHost ? 'host' : this.peer.id;
        const me = this.gameState.players.find(p => p.id === myId);
        
        if (!me) return;
        
        // Check if player can do this action
        const canDoAction = (taskType === 'GRN' && me.role === 'agent') ||
                           (taskType === 'RED' && me.role === 'cyborg');
        
        if (!canDoAction) {
            this.showNotification('You cannot perform this action!', true);
            return;
        }
        
        // Check if task already done
        if (this.gameState.tasks[taskId] !== 'incomplete') {
            this.showNotification('Task already completed!', true);
            return;
        }
        
        this.playSound('sndClick');
        
        if (this.isHost) {
            // Update directly
            this.gameState.tasks[taskId] = taskType === 'GRN' ? 'complete' : 'broken';
            this.playSound(taskType === 'GRN' ? 'sndBeep' : 'sndExplosion');
            this.broadcastGameState();
            this.updateTaskDisplay();
            this.checkWinConditions();
        } else {
            // Send to host
            this.connections[0].send({
                type: 'taskUpdate',
                taskId: taskId,
                taskType: taskType,
                playerId: myId
            });
        }
    }

    // Update task display
    updateTaskDisplay() {
        for (let i = 1; i <= 5; i++) {
            const status = this.gameState.tasks[i];
            const grnBtn = document.getElementById(`btnTask${i}GRN`);
            const redBtn = document.getElementById(`btnTask${i}RED`);
            
            if (grnBtn && redBtn) {
                const grnImg = grnBtn.querySelector('img');
                const redImg = redBtn.querySelector('img');
                
                if (status === 'complete') {
                    grnImg.src = `assets/${i}_GRN_ON.png`;
                    redImg.src = `assets/${i}_RED_OFF.png`;
                } else if (status === 'broken') {
                    grnImg.src = `assets/${i}_GRN_OFF.png`;
                    redImg.src = `assets/${i}_RED_ON.png`;
                } else {
                    grnImg.src = `assets/${i}_GRN_OFF.png`;
                    redImg.src = `assets/${i}_RED_OFF.png`;
                }
            }
        }
    }

    // Update UI
    updateUI() {
        if (this.gameState.gamePhase === 'playing') {
            this.updateTaskDisplay();
            this.updateTimerDisplay();
            this.updateStatusDisplay();
        }
    }

    // Update status display
    updateStatusDisplay() {
        const completed = Object.values(this.gameState.tasks).filter(t => t === 'complete').length;
        const broken = Object.values(this.gameState.tasks).filter(t => t === 'broken').length;
        
        document.getElementById('statusDisplay').textContent = 
            `Complete: ${completed} | Broken: ${broken}`;
    }

    // Check win conditions
    checkWinConditions() {
        const completed = Object.values(this.gameState.tasks).filter(t => t === 'complete').length;
        const broken = Object.values(this.gameState.tasks).filter(t => t === 'broken').length;
        
        if (completed === 5) {
            this.endGame('agents', 'All tasks completed!');
        } else if (broken === 5) {
            this.endGame('cyborgs', 'All tasks sabotaged!');
        }
    }

    // Call team meeting
    callMeeting() {
        if (!this.isHost) return;
        
        this.playSound('sndSiren');
        this.gameState.timerRunning = false;
        this.gameState.gamePhase = 'meeting';
        this.broadcastGameState();
        this.showMeetingScreen();
    }

    // Show meeting screen
    showMeetingScreen() {
        this.showScreen('meetingScreen');
        this.updatePlayersList();
    }

    // End meeting
    endMeeting() {
        if (!this.isHost) return;
        
        this.playSound('sndClick');
        this.gameState.timerRunning = true;
        this.gameState.gamePhase = 'playing';
        this.broadcastGameState();
        this.showScreen('gameScreen');
    }

    // Show expose screen
    showExposeScreen() {
        this.playSound('sndClick');
        this.showScreen('exposedScreen');
        this.updateExposePlayersList();
    }

    // Update expose players list
    updateExposePlayersList() {
        const container = document.getElementById('exposedPlayersList');
        container.innerHTML = '';
        
        this.gameState.players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                <div class="name">${player.name}</div>
                <div class="role">${player.role === 'cyborg' ? 'CYBORG' : 'AGENT'}</div>
            `;
            card.addEventListener('click', () => this.exposePlayer(player));
            container.appendChild(card);
        });
    }

    // Expose a player
    exposePlayer(player) {
        this.playSound('sndExplosion');
        this.showNotification(`${player.name} is a ${player.role.toUpperCase()}!`);
        
        if (player.role === 'cyborg') {
            // Remove cyborg
            this.gameState.players = this.gameState.players.filter(p => p.id !== player.id);
            
            if (this.isHost) {
                this.broadcastGameState();
                this.checkCyborgWin();
            }
        }
        
        setTimeout(() => this.showScreen('gameScreen'), 3000);
    }

    // Check if cyborgs eliminated
    checkCyborgWin() {
        const cyborgsLeft = this.gameState.players.filter(p => p.role === 'cyborg').length;
        if (cyborgsLeft === 0) {
            this.endGame('agents', 'All Cyborgs exposed!');
        }
    }

    // Cancel expose
    cancelExpose() {
        this.playSound('sndClick');
        this.showScreen('gameScreen');
    }

    // End game
    endGame(winner, reason) {
        if (!this.isHost) return;
        
        this.gameState.gamePhase = 'gameover';
        this.gameState.timerRunning = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.broadcastGameState();
        this.showGameOver(winner, reason);
    }

    // Show game over screen
    showGameOver(winner, reason) {
        this.playSound('sndSiren');
        this.showScreen('gameOverScreen');
        
        const title = document.getElementById('winnerTitle');
        const details = document.getElementById('winnerDetails');
        
        if (winner === 'agents') {
            title.textContent = 'AGENTS WIN!!';
            title.className = 'game-over-title agents';
        } else {
            title.textContent = 'CYBORG WIN!!';
            title.className = 'game-over-title cyborgs';
        }
        
        details.textContent = reason;
        
        // Show final players
        const finalContainer = document.getElementById('finalPlayers');
        finalContainer.innerHTML = this.gameState.players.map(p => `
            <div class="player-item ${p.role}">
                <strong>${p.name}</strong> - ${p.role.toUpperCase()}
            </div>
        `).join('');
    }

    // Reset game
    resetGame() {
        if (confirm('Reset game? This will end the current game.')) {
            location.reload();
        }
    }

    // New game
    newGame() {
        location.reload();
    }

    // Broadcast game state to all players
    broadcastGameState() {
        if (!this.isHost) return;
        
        const message = {
            type: 'stateUpdate',
            gameState: this.gameState
        };
        
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });
    }

    // Handle disconnection
    handleDisconnection(conn) {
        const index = this.connections.indexOf(conn);
        if (index > -1) {
            this.connections.splice(index, 1);
        }
        
        if (this.isHost) {
            const player = this.gameState.players.find(p => p.id === conn.peer);
            if (player) {
                this.gameState.players = this.gameState.players.filter(p => p.id !== conn.peer);
                this.showNotification(`${player.name} disconnected`, true);
                this.updatePlayersList();
                this.checkCanStart();
                this.broadcastGameState();
            }
        }
    }
    
    // Show help dialog
    showHelp() {
        this.playSound('sndClick');
        document.getElementById('helpDialog').classList.remove('hidden');
    }
    
    // Close help dialog
    closeHelp() {
        this.playSound('sndClick');
        document.getElementById('helpDialog').classList.add('hidden');
    }
    
    // Confirm reset
    confirmReset() {
        if (confirm('Are you sure you want to reset? This will end the current game and return to the start.')) {
            this.playSound('sndClick');
            this.emergencyReset();
        }
    }
    
    // Emergency reset - clear everything and reload
    emergencyReset() {
        this.cleanup();
        localStorage.removeItem('amongUsGameState');
        location.reload();
    }
    
    // Cleanup connections
    cleanup() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.connections.forEach(conn => {
            if (conn) conn.close();
        });
        this.connections = [];
    }
    
    // Save game state to localStorage
    saveGameState() {
        const state = {
            gameState: this.gameState,
            playerName: this.playerName,
            isHost: this.isHost,
            gameCode: this.gameCode,
            timestamp: Date.now()
        };
        localStorage.setItem('amongUsGameState', JSON.stringify(state));
    }
    
    // Load saved game state
    loadSavedGameState() {
        const saved = localStorage.getItem('amongUsGameState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                const timeSince = Date.now() - state.timestamp;
                
                // If saved state is less than 10 minutes old and game was in progress
                if (timeSince < 600000 && state.gameState.gamePhase !== 'lobby') {
                    this.showReconnectDialog(state);
                    return true;
                }
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
        return false;
    }
    
    // Show reconnect dialog
    showReconnectDialog(state) {
        const message = `You have a game in progress (${state.gameCode}). Do you want to reconnect?`;
        document.getElementById('reconnectMessage').textContent = message;
        document.getElementById('reconnectDialog').classList.remove('hidden');
        
        this.savedState = state;
    }
    
    // Reconnect to existing game
    reconnectToGame() {
        document.getElementById('reconnectDialog').classList.add('hidden');
        
        if (this.savedState) {
            this.gameState = this.savedState.gameState;
            this.playerName = this.savedState.playerName;
            this.isHost = this.savedState.isHost;
            this.gameCode = this.savedState.gameCode;
            
            // Try to reconnect via PeerJS
            if (this.isHost) {
                this.createGame();
            } else {
                this.joinGame();
            }
            
            this.showNotification('Reconnecting to game...', false);
        }
    }
    
    // Start new game (from reconnect dialog)
    startNewGame() {
        document.getElementById('reconnectDialog').classList.add('hidden');
        localStorage.removeItem('amongUsGameState');
        this.showScreen('startScreen');
    }
    
    // Show loading overlay
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}

// Initialize game when page loads
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new SpyBotGame();
    
    // Check for saved game state
    const hasSavedState = game.loadSavedGameState();
    
    // Start background music on first interaction
    document.addEventListener('click', () => {
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic && bgMusic.paused) {
            bgMusic.volume = 0.3;
            bgMusic.play().catch(e => console.log('Music failed:', e));
        }
    }, { once: true });
    
    // Prevent accidental navigation away
    window.addEventListener('beforeunload', (e) => {
        if (game.gameState.gamePhase === 'playing' || game.gameState.gamePhase === 'meeting') {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

