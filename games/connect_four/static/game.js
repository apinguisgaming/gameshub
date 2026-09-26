/**
 * 4-Gewinnt (Connect Four) Client Logic
 * Powered by GameHub Multiplayer SDK
 */

(function () {
    'use strict';

    let c4Mp = null;
    let roomCode = null;
    let currentUser = null;
    let myColor = null;
    let lastRenderedBoard = null;
    let pollInterval = null;

    // Web Audio Sound Synthesizer (Zero asset dependencies)
    const AudioFX = {
        ctx: null,
        init: function () {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        playDrop: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Soft, warm, acoustic wooden/acrylic chip drop
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, this.ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

                gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.10);
            } catch (e) { }
        },
        playWin: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Gentle, soft, pleasant acoustic chime
                const notes = [330, 440, 554, 660];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const startTime = this.ctx.currentTime + (idx * 0.11);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime);
                    gain.gain.setValueAtTime(0.05, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(startTime);
                    osc.stop(startTime + 0.29);
                });
            } catch (e) { }
        }
    };

    // Parse room code from URL pathname (e.g. /connect-four/ABCD)
    function extractRoomCode() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[0] === 'connect-four') {
            return parts[1].toUpperCase();
        }
        const urlParams = new URLSearchParams(window.location.search);
        return (urlParams.get('room') || '').toUpperCase();
    }

    // Screen Management
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    }

    let roomListTimer = null;

    window.loadRoomList = function (silent) {
        const container = document.getElementById('room-list-container');
        if (!container) return;
        if (!silent) {
            container.innerHTML = '<div class="room-list-empty">Lade offene Räume...</div>';
        }
        fetch('/connect-four/rooms', {
            headers: { 'X-Auth-Token': window.GameHub.auth.getToken() }
        })
            .then(res => res.json())
            .then(data => {
                const rooms = data.rooms || [];
                if (rooms.length === 0) {
                    container.innerHTML = '<div class="room-list-empty">Keine offenen Räume.<br>Erstelle oben den ersten Raum!</div>';
                    return;
                }
                let html = '';
                rooms.forEach(r => {
                    const isLobby = r.status === 'lobby';
                    const statusClass = isLobby ? 'status-lobby' : 'status-playing';
                    const statusText = isLobby ? 'LOBBY' : 'IN SPIEL';
                    const btnText = (isLobby && (r.player_count || 1) < 2) ? 'BEITRETEN' : 'ZUSCHAUEN';
                    html += `
                        <div class="lobby-room-row">
                            <div class="lobby-room-info">
                                <div class="lobby-room-header">
                                    <span class="lobby-room-code">${r.room_code}</span>
                                    <span class="lobby-room-badge ${statusClass}">${statusText}</span>
                                </div>
                                <div class="lobby-room-meta">Host: <strong>${r.host_username || 'Host'}</strong> • ${r.player_count || 1}/2 Spieler</div>
                            </div>
                            <button type="button" class="btn-lobby-join" onclick="window.location.href='/connect-four/${r.room_code}'">${btnText} ➜</button>
                        </div>
                    `;
                });
                container.innerHTML = html;
            })
            .catch(() => {
                if (!silent) container.innerHTML = '<div class="room-list-empty" style="color:#e63946;">Fehler beim Laden der Räume.</div>';
            });
    };

    // Initialize application
    function init() {
        currentUser = (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) ||
            (window.getCurrentUser && window.getCurrentUser()) || null;

        c4Mp = window.GameHub ? window.GameHub.multiplayer('connect_four', { routePrefix: '/connect-four' }) : null;
        roomCode = extractRoomCode();

        if (roomCode) {
            joinExistingRoom(roomCode);
        } else {
            showScreen('screen-entry');
            window.loadRoomList();
            if (!roomListTimer) {
                roomListTimer = setInterval(() => {
                    const entryScreen = document.getElementById('screen-entry');
                    if (entryScreen && entryScreen.classList.contains('active')) {
                        window.loadRoomList(true);
                    }
                }, 3000);
            }
        }
    }

    window.createRoom = function () {
        if (!c4Mp) return alert('SDK nicht bereit');
        c4Mp.createRoom().then(res => {
            if (res.success && res.room_code) {
                window.location.href = `/connect-four/${res.room_code}`;
            } else {
                alert(res.error || 'Fehler beim Erstellen des Raumes');
            }
        }).catch(err => {
            console.error(err);
            alert('Netzwerkfehler');
        });
    };

    window.joinRoomSubmit = function (e) {
        e.preventDefault();
        const input = document.getElementById('input-room-code');
        const code = (input.value || '').trim().toUpperCase();
        if (code) {
            window.location.href = `/connect-four/${code}`;
        }
    };

    function joinExistingRoom(code) {
        roomCode = code;
        document.querySelectorAll('.active-room-display').forEach(el => el.textContent = code);

        if (!c4Mp) return;
        c4Mp.joinRoom(code).then(res => {
            if (res.error) {
                alert(res.error);
                window.location.href = '/connect-four';
                return;
            }

            // Start heartbeat
            c4Mp.startHeartbeat(code, 15000);

            // Subscribe via Pusher
            c4Mp.subscribe(code, (state) => {
                renderState(state);
            });

            // Polling fallback every 3s in case WebSockets are disabled
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(() => {
                c4Mp.getState(code).then(renderState).catch(() => { });
            }, 3000);

            if (res.state) {
                renderState(res.state);
            } else {
                c4Mp.getState(code).then(renderState);
            }
        }).catch(err => {
            console.error('Join error', err);
            window.location.href = '/connect-four';
        });
    }

    window.copyRoomLink = function () {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('Raum-Link in die Zwischenablage kopiert!');
        }).catch(() => {
            prompt('Kopiere diesen Link:', url);
        });
    };

    window.leaveRoom = function () {
        if (pollInterval) clearInterval(pollInterval);
        if (c4Mp && roomCode) {
            c4Mp.leaveRoom(roomCode).finally(() => {
                window.location.href = '/connect-four';
            });
        } else {
            window.location.href = '/connect-four';
        }
    };

    window.leaveRoomToHub = function (e) {
        if (e) e.preventDefault();
        if (pollInterval) clearInterval(pollInterval);
        if (c4Mp && roomCode) {
            c4Mp.leaveRoom(roomCode).finally(() => {
                window.location.href = '/';
            });
        } else {
            window.location.href = '/';
        }
    };

    window.startGame = function () {
        if (!c4Mp || !roomCode) return;
        c4Mp.action(roomCode, 'start_game').then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    window.restartGame = function () {
        document.getElementById('game-over-modal').classList.remove('active');
        if (!c4Mp || !roomCode) return;
        c4Mp.action(roomCode, 'restart_game').then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    window.handleColClick = function (col) {
        if (!c4Mp || !roomCode) return;
        AudioFX.init();
        c4Mp.action(roomCode, 'drop_disc', { col: col }).then(res => {
            if (res.error) {
                console.warn(res.error);
            } else if (res.state) {
                renderState(res.state);
            }
        });
    };

    let currentState = null;

    function renderState(state) {
        if (!state) return;

        // Merge delta into currentState if received directly
        if (state._delta) {
            if (window.GameDelta && typeof window.GameDelta.apply === 'function') {
                currentState = window.GameDelta.apply(currentState || {}, state);
                state = currentState;
            } else if (state.changes && typeof state.changes === 'object') {
                currentState = currentState || {};
                Object.assign(currentState, state.changes);
                state = currentState;
            }
        } else {
            currentState = state;
        }

        if (!state || !state.status) {
            console.warn('[ConnectFour] State received without status property:', state);
            return;
        }

        const myUsername = currentUser ? currentUser.username : null;
        const players = state.players || [];
        const isHost = (myUsername === state.host);
        myColor = state.player_colors ? state.player_colors[myUsername] : null;

        // 1. Status: LOBBY
        if (state.status === 'lobby') {
            document.getElementById('game-over-modal').classList.remove('active');
            showScreen('screen-lobby');

            const p1 = players[0] || null;
            const p2 = players[1] || null;

            const nameEl1 = document.getElementById('name-player-1');
            const nameEl2 = document.getElementById('name-player-2');
            if (nameEl1) nameEl1.textContent = p1 ? (p1 + (p1 === state.host ? ' 👑' : '')) : 'Wartet...';
            if (nameEl2) nameEl2.textContent = p2 ? (p2 + (p2 === state.host ? ' 👑' : '')) : 'Wartet auf Beitritt...';

            const isSpectator = myUsername && !players.includes(myUsername);
            const specNotice = document.getElementById('spectator-notice');
            if (specNotice) specNotice.style.display = isSpectator ? 'block' : 'none';

            const startBtn = document.getElementById('btn-start-game');
            if (startBtn) {
                if (isHost) {
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = (players.length < 2);
                    startBtn.textContent = players.length >= 2 ? 'SPIEL STARTEN (2/2)' : `WARTE AUF GEGNER (${players.length}/2)`;
                } else {
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = true;
                    startBtn.textContent = 'WARTE AUF HOST...';
                }
            }
            return;
        }

        // 2. Status: PLAYING or FINISHED only
        if (state.status !== 'playing' && state.status !== 'finished') {
            return;
        }
        showScreen('screen-game');

        // Scoreboard
        const p1 = players[0] || 'Spieler 1';
        const p2 = players[1] || 'Spieler 2';
        const scores = state.scores || {};
        const score1El = document.getElementById('score-p1');
        const score2El = document.getElementById('score-p2');
        if (score1El) score1El.textContent = `${p1}: ${scores[p1] || 0}`;
        if (score2El) score2El.textContent = `${p2}: ${scores[p2] || 0}`;

        // Turn indicator
        const isMyTurn = (state.turn === myUsername && state.status === 'playing');
        const turnColor = state.player_colors ? state.player_colors[state.turn] : 'red';
        const turnDisc = document.getElementById('turn-indicator-disc');
        const turnText = document.getElementById('turn-text');

        if (turnDisc) {
            turnDisc.className = 'turn-indicator-disc ' + (turnColor || 'red');
        }

        if (turnText) {
            if (state.status === 'playing') {
                if (isMyTurn) {
                    turnText.innerHTML = `<span style="color:var(--c4-red);">DU BIST AM ZUG!</span>`;
                } else {
                    turnText.textContent = `${state.turn} ist am Zug...`;
                }
            } else if (state.status === 'finished') {
                if (state.is_draw) {
                    turnText.textContent = 'UNENTSCHIEDEN!';
                } else {
                    turnText.textContent = `${state.winner} HAT GEWONNEN!`;
                }
            }
        }

        // Render drop triggers
        const triggers = document.querySelectorAll('.col-trigger');
        triggers.forEach(btn => {
            const col = parseInt(btn.getAttribute('data-col'), 10);
            const isFull = state.board && state.board[0] && (state.board[0][col] !== null);
            btn.disabled = (!isMyTurn || isFull);

            btn.classList.remove('preview-red', 'preview-yellow');
            if (myColor) {
                btn.classList.add('preview-' + myColor);
            }
        });

        // Detect new disc placement for audio
        if (lastRenderedBoard && state.last_move) {
            const lm = state.last_move;
            if (lastRenderedBoard[lm.row][lm.col] !== lm.color) {
                AudioFX.playDrop();
            }
        }
        lastRenderedBoard = JSON.parse(JSON.stringify(state.board));

        // Render Grid
        const winningCoords = new Set(
            (state.winning_cells || []).map(coord => `${coord[0]},${coord[1]}`)
        );

        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                const discEl = document.getElementById(`disc-${r}-${c}`);
                if (!discEl) continue;

                const cellVal = state.board[r][c];
                let classes = 'c4-disc ';
                if (!cellVal) {
                    classes += 'empty';
                } else {
                    classes += cellVal;
                    if (winningCoords.has(`${r},${c}`)) {
                        classes += ' winning';
                    }
                }
                discEl.className = classes;
            }
        }

        // Handle Finished Modal
        const modal = document.getElementById('game-over-modal');
        if (state.status === 'finished') {
            const headline = document.getElementById('modal-headline');
            const subtext = document.getElementById('modal-subtext');
            const icon = document.getElementById('modal-icon');

            if (state.is_draw) {
                headline.textContent = 'UNENTSCHIEDEN!';
                subtext.textContent = 'Das gesamte Spielfeld ist voll!';
                icon.textContent = '🤝';
            } else if (state.winner === myUsername) {
                headline.textContent = 'DU HAST GEWONNEN!';
                subtext.textContent = 'Hervorragende Taktik! 4 in einer Reihe!';
                icon.textContent = '🏆';
                AudioFX.playWin();
            } else {
                headline.textContent = `${state.winner} GEWINNT!`;
                subtext.textContent = 'Bessere Vorbereitung beim nächsten Mal!';
                icon.textContent = '👏';
            }

            document.getElementById('m-score-p1-name').textContent = p1;
            document.getElementById('m-score-p1-val').textContent = scores[p1] || 0;
            document.getElementById('m-score-p2-name').textContent = p2;
            document.getElementById('m-score-p2-val').textContent = scores[p2] || 0;

            modal.classList.add('active');
        } else {
            modal.classList.remove('active');
        }
    }

    // Startup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
