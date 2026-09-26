/**
 * Battleship (Schiffe Versenken) Client Logic
 * Powered by GameHub Multiplayer SDK
 */

(function () {
    'use strict';

    const GRID_SIZE = 10;
    const FLEET_SPEC = [
        { id: 'battleship_1', name: 'Schlachtschiff', size: 4 },
        { id: 'cruiser_1', name: 'Kreuzer Alpha', size: 3 },
        { id: 'cruiser_2', name: 'Kreuzer Beta', size: 3 },
        { id: 'destroyer_1', name: 'Zerstörer 1', size: 2 },
        { id: 'destroyer_2', name: 'Zerstörer 2', size: 2 },
        { id: 'submarine_1', name: 'U-Boot 1', size: 1 },
        { id: 'submarine_2', name: 'U-Boot 2', size: 1 }
    ];

    let bsMp = null;
    let roomCode = null;
    let currentUser = null;
    let pollInterval = null;

    // Placement State
    let placedFleet = []; // list of ships
    let selectedShipIndex = 0;
    let orientation = 'H'; // 'H' or 'V'
    let myConfirmedReady = false;
    let myPrivateFleet = null;

    let currentState = null;
    let abilityArmed = false;
    let abilityDir = 'H';

    let selectedAbility = null;
    let activeAbilityId = null;

    const COMMANDERS_DATA = {
        'schmidt': {
            id: 'schmidt',
            name: 'Johannes Schmidt',
            nation: 'Kriegsmarine',
            icon: '⚓',
            title: 'U-Boot-Ass',
            ability: 'torpedo',
            abilityName: 'Torpedo-Salve',
            cost: 4,
            desc: 'Feuere ihn durch eine Zeile oder Spalte. Hält an, wenn er ein Schiff trifft.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'U-Boot-Sonar', icon: '📡', cost: 3, desc: 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.', type: 'sonar' },
                { id: 'mine', pos: 'left', name: 'Schnell-Torpedo', icon: '⚙️', cost: 2, desc: 'Präzisions-Schuss auf 1 Zielfeld mit +2 Energie bei Treffer.', type: 'precision' },
                { id: 'torpedo', pos: 'right', name: 'Torpedo', icon: '🚀', cost: 4, desc: 'Feuere ihn durch eine Zeile oder Spalte. Hält an, wenn er ein Schiff trifft.', type: 'torpedo' },
                { id: 'wolfpack', pos: 'bottom', name: 'Rudeltaktik (Ultimate)', icon: '💥', cost: 10, desc: 'Massives Torpedobombardement auf ein 3x3 Zielgebiet.', type: 'bombardment_3x3' }
            ],
            fleet: [
                { id: 'schnellboot', name: 'Schnellboot S-38', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'sub', name: 'U-Boot U-96', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'destroyer', name: 'Zerstörer Z-23 (L-Form)', size: 3, shape: [[0, 0], [1, 0], [1, 1]] },
                { id: 'cruiser', name: 'Kreuzer Prinz Eugen (L-Form)', size: 4, shape: [[0, 0], [1, 0], [2, 0], [2, 1]] },
                { id: 'battleship', name: 'Schlachtschiff Bismarck (Eck-Form)', size: 5, shape: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] }
            ]
        },
        'karslake': {
            id: 'karslake',
            name: 'Sir William Karslake',
            nation: 'Royal Navy',
            icon: '🎖️',
            title: 'Luftüberlegenheit',
            ability: 'airstrike',
            abilityName: 'Luftschlag',
            cost: 5,
            desc: 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.',
            abilities: [
                { id: 'radar', pos: 'top', name: 'Radar-Scan', icon: '📡', cost: 3, desc: 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.', type: 'sonar' },
                { id: 'recon', pos: 'left', name: 'Spähflug', icon: '🛩️', cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.', type: 'recon_2' },
                { id: 'airstrike', pos: 'right', name: 'Luftschlag', icon: '⚡', cost: 5, desc: 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.', type: 'airstrike_3' },
                { id: 'carpet_bomb', pos: 'bottom', name: 'Teppichbombardement (Ultimate)', icon: '💥', cost: 10, desc: 'Vernichtendes 3x3 Bombardement auf das Zielareal.', type: 'bombardment_3x3' }
            ],
            fleet: [
                { id: 'patrol', name: 'Patrouillenboot', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'frigate', name: 'Fregatte HMS Blackwood', size: 3, shape: [[0, 0], [1, 0], [2, 0]] },
                { id: 'destroyer', name: 'Zerstörer HMS Kelly (L-Form)', size: 3, shape: [[0, 0], [1, 0], [1, 1]] },
                { id: 'cruiser', name: 'Kreuzer HMS Belfast (T-Form)', size: 4, shape: [[0, 1], [1, 0], [1, 1], [1, 2]] },
                { id: 'carrier', name: 'Träger HMS Ark Royal (L-Form)', size: 5, shape: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]] }
            ]
        },
        'ferrara': {
            id: 'ferrara',
            name: 'Giuseppe Ferrara',
            nation: 'Regia Marina',
            icon: '💥',
            title: 'Artillerie-General',
            ability: 'bombardment',
            abilityName: 'Schweres Bombardement',
            cost: 6,
            desc: 'Feuert eine 2x2 Salve auf den gewählten Bereich.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'Horchposten', icon: '📡', cost: 3, desc: 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.', type: 'sonar' },
                { id: 'flare', pos: 'left', name: 'Leuchtgranate', icon: '✨', cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder auf feindliche Einheiten.', type: 'recon_2' },
                { id: 'crossfire', pos: 'right', name: 'Kreuzfeuer', icon: '⚔️', cost: 5, desc: 'Artilleriefeuer im Kreuzmuster (5 Felder: Zentrum + 4 Nachbarn).', type: 'crossfire_5' },
                { id: 'bombardment', pos: 'bottom', name: 'Schweres Bombardement (Ultimate)', icon: '💥', cost: 10, desc: 'Feuert eine verheerende 3x3 Salve auf den gewählten Bereich.', type: 'bombardment_3x3' }
            ],
            fleet: [
                { id: 'torpedoboot', name: 'MAS Torpedoboot', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'destroyer', name: 'Zerstörer Leone', size: 3, shape: [[0, 0], [1, 0], [2, 0]] },
                { id: 'corvette', name: 'Korvette Gabbiano (Winkel)', size: 3, shape: [[0, 0], [1, 0], [0, 1]] },
                { id: 'heavy_cruiser', name: 'Panzerkreuzer Zara (2x2 Block)', size: 4, shape: [[0, 0], [0, 1], [1, 0], [1, 1]] },
                { id: 'battleship', name: 'Schlachtschiff Roma (Eck-Form)', size: 5, shape: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] }
            ]
        },
        'kelly': {
            id: 'kelly',
            name: 'Astrid Kelly',
            nation: 'Marine-Aufklärung',
            icon: '📡',
            title: 'Sonar-Kommandeurin',
            ability: 'sonar',
            abilityName: 'Aufklärungs-Sonar',
            cost: 3,
            desc: 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'Aufklärungs-Sonar', icon: '📡', cost: 3, desc: 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.', type: 'sonar' },
                { id: 'ping', pos: 'left', name: 'Peilungs-Ping', icon: '🎯', cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.', type: 'recon_2' },
                { id: 'depth_charge', pos: 'right', name: 'Wasserbomben', icon: '💣', cost: 5, desc: 'Schachbrett-Salve (4 Felder im 2x2 Sektor).', type: 'bombardment_2x2' },
                { id: 'orbital_strike', pos: 'bottom', name: 'Präzisions-Bombardement (Ultimate)', icon: '💥', cost: 10, desc: 'Volle 3x3 Salve auf den gewählten Zielbereich.', type: 'bombardment_3x3' }
            ],
            fleet: [
                { id: 'patrol', name: 'Spähboot Valkyrie', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'sub', name: 'U-Jagdboot Archer', size: 2, shape: [[0, 0], [1, 0]] },
                { id: 'frigate', name: 'Fregatte Odin (L-Form)', size: 3, shape: [[0, 0], [1, 0], [1, 1]] },
                { id: 'stealth_cruiser', name: 'Tarnkreuzer Shadow (Z-Form)', size: 4, shape: [[0, 0], [1, 0], [1, 1], [2, 1]] },
                { id: 'flagship', name: 'Flaggschiff Fenrir (Winkel)', size: 4, shape: [[0, 0], [1, 0], [2, 0], [2, 1]] }
            ]
        }
    };

    // Web Audio Naval Warfare Synthesizer (Acoustic, warm, quiet, non-penetrant)
    const AudioFX = {
        ctx: null,
        init: function () {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        playFire: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Deep muffled acoustic cannon thump
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(220, this.ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.18);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(80, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.18);

                gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.19);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.20);
            } catch (e) { }
        },
        playSplash: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Soft ocean water plop
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(170, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.14);

                gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.16);
            } catch (e) { }
        },
        playExplosion: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Deep muffled underwater detonation rumble
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(160, this.ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(60, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);

                gain.gain.setValueAtTime(0.10, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.33);
            } catch (e) { }
        },
        playSonar: function () {
            try {
                this.init();
                if (!this.ctx) return;
                // Subtle gentle sonar ping
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(640, this.ctx.currentTime);

                gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.41);
            } catch (e) { }
        },
        playVictory: function () {
            try {
                this.init();
                if (!this.ctx) return;
                const fanfare = [261.63, 329.63, 392.00, 523.25];
                fanfare.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const st = this.ctx.currentTime + (idx * 0.13);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, st);
                    gain.gain.setValueAtTime(0.05, st);
                    gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(st);
                    osc.stop(st + 0.36);
                });
            } catch (e) { }
        }
    };

    function extractRoomCode() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[0] === 'battleship') {
            return parts[1].toUpperCase();
        }
        const urlParams = new URLSearchParams(window.location.search);
        return (urlParams.get('room') || '').toUpperCase();
    }

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    }

    function init() {
        currentUser = (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) ||
            (window.getCurrentUser && window.getCurrentUser()) || null;

        bsMp = window.GameHub ? window.GameHub.multiplayer('battleship', { routePrefix: '/battleship' }) : null;
        roomCode = extractRoomCode();

        initGridsDOM();

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

    let roomListTimer = null;

    window.loadRoomList = function (silent) {
        const container = document.getElementById('room-list-container');
        if (!container) return;
        if (!silent) {
            container.innerHTML = '<div class="room-list-empty">Lade offene Räume...</div>';
        }
        fetch('/battleship/rooms', {
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
                            <button type="button" class="btn-lobby-join" onclick="window.location.href='/battleship/${r.room_code}'">${btnText} ➜</button>
                        </div>
                    `;
                });
                container.innerHTML = html;
            })
            .catch(() => {
                if (!silent) container.innerHTML = '<div class="room-list-empty" style="color:#e63946;">Fehler beim Laden der Räume.</div>';
            });
    };

    function initGridsDOM() {
        // Build 100 cells for placement-grid, enemy-battle-grid, and own-battle-grid
        ['placement-grid', 'enemy-battle-grid', 'own-battle-grid'].forEach(gridId => {
            const container = document.getElementById(gridId);
            if (!container) return;
            container.innerHTML = '';
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'radar-cell';
                    cell.setAttribute('data-row', r);
                    cell.setAttribute('data-col', c);

                    if (gridId === 'placement-grid') {
                        cell.addEventListener('mouseenter', () => onPlacementHover(r, c));
                        cell.addEventListener('mouseleave', () => clearPlacementHover());
                        cell.addEventListener('click', () => onPlacementClick(r, c));
                    } else if (gridId === 'enemy-battle-grid') {
                        cell.addEventListener('mouseenter', () => onEnemyCellHover(r, c));
                        cell.addEventListener('mouseleave', () => clearEnemyCellHover());
                        cell.addEventListener('click', () => onEnemyCellClick(r, c));
                    }
                    container.appendChild(cell);
                }
            }
        });
        setupPlacementGridEvents();
    }

    window.createRoom = function () {
        if (!bsMp) return alert('SDK nicht bereit');
        bsMp.createRoom().then(res => {
            if (res.success && res.room_code) {
                window.location.href = `/battleship/${res.room_code}`;
            } else {
                alert(res.error || 'Fehler beim Erstellen des Raumes');
            }
        }).catch(() => alert('Netzwerkfehler'));
    };

    window.joinRoomSubmit = function (e) {
        e.preventDefault();
        const input = document.getElementById('input-room-code');
        const code = (input.value || '').trim().toUpperCase();
        if (code) {
            window.location.href = `/battleship/${code}`;
        }
    };

    function joinExistingRoom(code) {
        roomCode = code;
        document.querySelectorAll('.active-room-display').forEach(el => el.textContent = code);

        if (!bsMp) return;
        bsMp.joinRoom(code).then(res => {
            if (res.error) {
                alert(res.error);
                window.location.href = '/battleship';
                return;
            }

            bsMp.startHeartbeat(code, 15000);

            bsMp.subscribe(code, (state) => {
                renderState(state);
            });

            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(() => {
                bsMp.getState(code).then(renderState).catch(() => { });
            }, 3000);

            if (res.state) {
                renderState(res.state);
            } else {
                bsMp.getState(code).then(renderState);
            }
        }).catch(() => {
            window.location.href = '/battleship';
        });
    }

    window.copyRoomLink = function () {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('Raum-Link kopiert!');
        }).catch(() => {
            prompt('Kopiere diesen Link:', url);
        });
    };

    window.leaveRoom = function () {
        if (pollInterval) clearInterval(pollInterval);
        if (bsMp && roomCode) {
            bsMp.leaveRoom(roomCode).finally(() => {
                window.location.href = '/battleship';
            });
        } else {
            window.location.href = '/battleship';
        }
    };

    window.leaveRoomToHub = function (e) {
        if (e) e.preventDefault();
        if (pollInterval) clearInterval(pollInterval);
        if (bsMp && roomCode) {
            bsMp.leaveRoom(roomCode).finally(() => {
                window.location.href = '/';
            });
        } else {
            window.location.href = '/';
        }
    };

    window.startGame = function () {
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'start_game').then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    window.restartMatch = function () {
        document.getElementById('battle-modal').classList.remove('active');
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'restart_game').then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    // --- SHIP GRAPHICS & SVGs ---

    function getShipOrientation(coords) {
        if (!coords || coords.length <= 1) return 'H';
        return (coords[0][0] === coords[1][0]) ? 'H' : 'V';
    }

    function getShipPartType(idx, size) {
        if (size <= 1) return 'single';
        if (idx === 0) return 'bow';
        if (idx === size - 1) return 'stern';
        return 'mid';
    }

    function getShipPartSVG(part, dir, isSunk) {
        const hull = isSunk ? '#3d0a0a' : '#1e293b';
        const deck = isSunk ? '#5c1414' : '#334155';
        const stroke = isSunk ? '#150303' : '#0f172a';
        const turret = isSunk ? '#7f1d1d' : '#475569';
        const barrel = isSunk ? '#ea580c' : '#00b4d8';
        const bridge = isSunk ? '#250808' : '#0f172a';
        const radar = isSunk ? '#dc2626' : '#00f5d4';

        if (part === 'single') {
            // Submarine conning tower & hull capsule
            return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                <ellipse cx="50" cy="50" rx="42" ry="24" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                <ellipse cx="50" cy="50" rx="34" ry="16" fill="${deck}"/>
                <rect x="38" y="38" width="24" height="24" rx="6" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                <line x1="50" y1="22" x2="50" y2="38" stroke="${radar}" stroke-width="3"/>
                <circle cx="50" cy="22" r="3.5" fill="${barrel}"/>
                <circle cx="50" cy="50" r="5" fill="${radar}"/>
            </svg>`;
        }

        if (dir === 'H') {
            if (part === 'bow') {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M100,12 L38,12 C18,12 4,32 4,50 C4,68 18,88 38,88 L100,88 Z" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <path d="M40,22 L100,22 L100,78 L40,78 C25,78 14,64 14,50 C14,36 25,22 40,22 Z" fill="${deck}"/>
                    <circle cx="56" cy="50" r="14" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <rect x="24" y="47" width="24" height="6" rx="2" fill="${barrel}"/>
                </svg>`;
            } else if (part === 'stern') {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,12 L62,12 C82,12 96,30 96,50 C96,70 82,88 62,88 L0,88 Z" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <path d="M0,22 L60,22 C74,22 86,34 86,50 C86,66 74,78 60,78 L0,78 Z" fill="${deck}"/>
                    <circle cx="44" cy="50" r="12" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <rect x="52" y="47" width="20" height="6" rx="2" fill="${barrel}"/>
                </svg>`;
            } else {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="0" y="12" width="100" height="76" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <rect x="0" y="22" width="100" height="56" fill="${deck}"/>
                    <rect x="22" y="30" width="56" height="40" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2.5"/>
                    <rect x="34" y="38" width="32" height="24" rx="2" fill="${radar}" fill-opacity="0.35" stroke="${radar}" stroke-width="1.5"/>
                    <line x1="50" y1="16" x2="50" y2="30" stroke="${radar}" stroke-width="3"/>
                    <circle cx="50" cy="16" r="4" fill="${barrel}"/>
                </svg>`;
            }
        } else {
            // dir === 'V'
            if (part === 'bow') {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M12,100 L12,38 C12,18 32,4 50,4 C68,4 88,18 88,38 L88,100 Z" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <path d="M22,40 L22,100 L78,100 L78,40 C78,25 64,14 50,14 C36,14 22,25 22,40 Z" fill="${deck}"/>
                    <circle cx="50" cy="56" r="14" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <rect x="47" y="24" width="6" height="24" rx="2" fill="${barrel}"/>
                </svg>`;
            } else if (part === 'stern') {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M12,0 L12,62 C12,82 30,96 50,96 C70,96 88,82 88,62 L88,0 Z" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <path d="M22,0 L22,60 C22,74 34,86 50,86 C66,86 78,74 78,60 L78,0 Z" fill="${deck}"/>
                    <circle cx="50" cy="44" r="12" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <rect x="47" y="52" width="6" height="20" rx="2" fill="${barrel}"/>
                </svg>`;
            } else {
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="12" y="0" width="76" height="100" fill="${hull}" stroke="${stroke}" stroke-width="4"/>
                    <rect x="22" y="0" width="56" height="100" fill="${deck}"/>
                    <rect x="30" y="22" width="40" height="56" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2.5"/>
                    <rect x="38" y="34" width="24" height="32" rx="2" fill="${radar}" fill-opacity="0.35" stroke="${radar}" stroke-width="1.5"/>
                    <line x1="16" y1="50" x2="30" y2="50" stroke="${radar}" stroke-width="3"/>
                    <circle cx="16" cy="50" r="4" fill="${barrel}"/>
                </svg>`;
            }
        }
    }

    // --- PLACEMENT LOGIC & TOUCH DRAG CONTROLS ---

    let dragState = null;

    function setupPlacementGridEvents() {
        const grid = document.getElementById('placement-grid');
        if (!grid) return;

        grid.addEventListener('pointerdown', (e) => {
            const cell = e.target.closest('.radar-cell');
            if (!cell) return;
            const r = parseInt(cell.getAttribute('data-row'), 10);
            const c = parseInt(cell.getAttribute('data-col'), 10);

            const touchedShip = placedFleet.find(s => s.coords.some(([sr, sc]) => sr === r && sc === c));

            if (touchedShip) {
                e.preventDefault();
                try {
                    grid.setPointerCapture(e.pointerId);
                } catch (_) { }

                const offsetIdx = touchedShip.coords.findIndex(([sr, sc]) => sr === r && sc === c);
                const shipSpecIdx = FLEET_SPEC.findIndex(s => s.id === touchedShip.id);
                const isAlreadySelected = (selectedShipIndex === shipSpecIdx);

                dragState = {
                    pointerId: e.pointerId,
                    ship: touchedShip,
                    shipSpecIdx: shipSpecIdx,
                    offsetIdx: offsetIdx >= 0 ? offsetIdx : 0,
                    startX: e.clientX,
                    startY: e.clientY,
                    hasMoved: false,
                    isAlreadySelected: isAlreadySelected,
                    validTargetCoords: null
                };

                selectedShipIndex = shipSpecIdx;
                orientation = getShipOrientation(touchedShip.coords);
                const label = document.getElementById('label-orient');
                if (label) label.textContent = orientation === 'H' ? 'HORIZONTAL' : 'VERTIKAL';
                renderShipList();
                renderPlacementGrid();
            } else {
                dragState = null;
            }
        });

        grid.addEventListener('pointermove', (e) => {
            if (!dragState) return;

            e.preventDefault();
            const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
            if (dist > 7) {
                dragState.hasMoved = true;
            }

            if (dragState.hasMoved) {
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                const cell = elem ? elem.closest('#placement-grid .radar-cell') : null;
                if (!cell) {
                    clearPlacementHover();
                    dragState.validTargetCoords = null;
                    return;
                }

                const tr = parseInt(cell.getAttribute('data-row'), 10);
                const tc = parseInt(cell.getAttribute('data-col'), 10);

                const shipOrient = getShipOrientation(dragState.ship.coords);
                const bowR = (shipOrient === 'H') ? tr : tr - dragState.offsetIdx;
                const bowC = (shipOrient === 'H') ? tc - dragState.offsetIdx : tc;

                const testCoords = getShipCoords(bowR, bowC, dragState.ship.size, shipOrient);
                const valid = isValidPlacement(testCoords, dragState.ship.id);

                clearPlacementHover();
                testCoords.forEach(([r, c]) => {
                    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
                        const previewCell = document.querySelector(`#placement-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                        if (previewCell) {
                            previewCell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
                        }
                    }
                });

                dragState.validTargetCoords = valid ? testCoords : null;
            }
        });

        const handlePointerEnd = (e) => {
            if (!dragState) return;

            try {
                if (grid.hasPointerCapture(dragState.pointerId)) {
                    grid.releasePointerCapture(dragState.pointerId);
                }
            } catch (_) { }

            if (dragState.hasMoved) {
                if (dragState.validTargetCoords) {
                    dragState.ship.coords = dragState.validTargetCoords;
                    AudioFX.playFire();
                }
            } else {
                if (dragState.isAlreadySelected) {
                    // Tap on already selected ship: rotate it!
                    const ship = dragState.ship;
                    const currentOrient = getShipOrientation(ship.coords);
                    const nextOrient = (currentOrient === 'H') ? 'V' : 'H';

                    let pivotR = ship.coords[0][0];
                    let pivotC = ship.coords[0][1];

                    if (nextOrient === 'V' && pivotR + ship.size > GRID_SIZE) {
                        pivotR = GRID_SIZE - ship.size;
                    }
                    if (nextOrient === 'H' && pivotC + ship.size > GRID_SIZE) {
                        pivotC = GRID_SIZE - ship.size;
                    }

                    const rotatedCoords = getShipCoords(pivotR, pivotC, ship.size, nextOrient);
                    if (isValidPlacement(rotatedCoords, ship.id)) {
                        ship.coords = rotatedCoords;
                        orientation = nextOrient;
                        const label = document.getElementById('label-orient');
                        if (label) label.textContent = orientation === 'H' ? 'HORIZONTAL' : 'VERTIKAL';
                        AudioFX.playSplash();
                    }
                }
            }

            dragState = null;
            clearPlacementHover();
            renderPlacementGrid();
            renderShipList();
            updatePlacementStatus();
        };

        grid.addEventListener('pointerup', handlePointerEnd);
        grid.addEventListener('pointercancel', handlePointerEnd);
    }

    window.toggleOrientation = function () {
        orientation = (orientation === 'H') ? 'V' : 'H';
        const label = document.getElementById('label-orient');
        if (label) label.textContent = orientation === 'H' ? 'HORIZONTAL' : 'VERTIKAL';

        // Rotate selected ship if already placed
        if (selectedShipIndex >= 0 && selectedShipIndex < FLEET_SPEC.length) {
            const spec = FLEET_SPEC[selectedShipIndex];
            const ship = placedFleet.find(s => s.id === spec.id);
            if (ship) {
                let pivotR = ship.coords[0][0];
                let pivotC = ship.coords[0][1];
                if (orientation === 'V' && pivotR + ship.size > GRID_SIZE) pivotR = GRID_SIZE - ship.size;
                if (orientation === 'H' && pivotC + ship.size > GRID_SIZE) pivotC = GRID_SIZE - ship.size;
                const rotatedCoords = getShipCoords(pivotR, pivotC, ship.size, orientation);
                if (isValidPlacement(rotatedCoords, ship.id)) {
                    ship.coords = rotatedCoords;
                    AudioFX.playSplash();
                    renderPlacementGrid();
                }
            }
        }
    };

    window.randomizePlacement = function () {
        if (!roomCode) return;
        const myUsername = currentUser ? currentUser.username : null;
        const myCmdId = (currentState && currentState.commanders && myUsername && currentState.commanders[myUsername]) || 'schmidt';
        const mode = (currentState && currentState.game_mode) || 'commanders';
        fetch(`/battleship/random_fleet?commander=${encodeURIComponent(myCmdId)}&mode=${encodeURIComponent(mode)}`, {
            headers: { 'X-Auth-Token': window.GameHub.auth.getToken() }
        })
            .then(res => res.json())
            .then(data => {
                if (data.fleet) {
                    placedFleet = data.fleet;
                    selectedShipIndex = -1;
                    renderPlacementGrid();
                    renderShipList();
                    updatePlacementStatus();
                }
            })
            .catch(() => {
                generateLocalRandomFleet();
            });
    };

    function generateLocalRandomFleet() {
        const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
        const fleet = [];
        FLEET_SPEC.forEach(spec => {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 200) {
                attempts++;
                const orient = Math.random() < 0.5 ? 'H' : 'V';
                const r = orient === 'H' ? Math.floor(Math.random() * GRID_SIZE) : Math.floor(Math.random() * (GRID_SIZE - spec.size + 1));
                const c = orient === 'H' ? Math.floor(Math.random() * (GRID_SIZE - spec.size + 1)) : Math.floor(Math.random() * GRID_SIZE);
                const coords = [];
                let collides = false;
                for (let i = 0; i < spec.size; i++) {
                    const cr = orient === 'H' ? r : r + i;
                    const cc = orient === 'H' ? c + i : c;
                    if (grid[cr][cc]) { collides = true; break; }
                    coords.push([cr, cc]);
                }
                if (!collides) {
                    coords.forEach(([cr, cc]) => grid[cr][cc] = true);
                    fleet.push({ id: spec.id, name: spec.name, size: spec.size, coords });
                    placed = true;
                }
            }
        });
        placedFleet = fleet;
        selectedShipIndex = -1;
        renderPlacementGrid();
        renderShipList();
        updatePlacementStatus();
    }

    function onPlacementHover(row, col) {
        if (selectedShipIndex < 0 || selectedShipIndex >= FLEET_SPEC.length) return;
        const spec = FLEET_SPEC[selectedShipIndex];
        const coords = getShipCoords(row, col, spec.size, orientation);
        const valid = isValidPlacement(coords, spec.id);

        coords.forEach(([r, c]) => {
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
                const cell = document.querySelector(`#placement-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
            }
        });
    }

    function clearPlacementHover() {
        document.querySelectorAll('#placement-grid .radar-cell').forEach(c => {
            c.classList.remove('preview-valid', 'preview-invalid');
        });
    }

    function onPlacementClick(row, col) {
        // If a placed ship occupies this cell, pointer down/up already handled selection/rotation
        const existingShip = placedFleet.find(s => s.coords.some(([r, c]) => r === row && c === col));
        if (existingShip) return;

        if (selectedShipIndex < 0 || selectedShipIndex >= FLEET_SPEC.length) return;
        const spec = FLEET_SPEC[selectedShipIndex];
        const coords = getShipCoords(row, col, spec.size, orientation);

        if (!isValidPlacement(coords, spec.id)) {
            return;
        }

        // Remove old placement of this ship if already placed
        placedFleet = placedFleet.filter(s => s.id !== spec.id);
        placedFleet.push({
            id: spec.id,
            name: spec.name,
            size: spec.size,
            coords: coords
        });

        AudioFX.playFire();

        // Advance to next unplaced ship
        const placedIds = new Set(placedFleet.map(s => s.id));
        const nextIdx = FLEET_SPEC.findIndex(s => !placedIds.has(s.id));
        selectedShipIndex = nextIdx;

        clearPlacementHover();
        renderPlacementGrid();
        renderShipList();
        updatePlacementStatus();
    }

    function getShipCoords(row, col, size, orient) {
        const coords = [];
        for (let i = 0; i < size; i++) {
            coords.push(orient === 'H' ? [row, col + i] : [row + i, col]);
        }
        return coords;
    }

    function isValidPlacement(coords, currentShipId) {
        for (const [r, c] of coords) {
            if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
        }

        const occupied = new Set();
        placedFleet.forEach(ship => {
            if (ship.id !== currentShipId) {
                ship.coords.forEach(([r, c]) => occupied.add(`${r},${c}`));
            }
        });

        for (const [r, c] of coords) {
            if (occupied.has(`${r},${c}`)) return false;
        }

        return true;
    }

    function renderPlacementGrid() {
        document.querySelectorAll('#placement-grid .radar-cell').forEach(c => {
            c.className = 'radar-cell';
            c.innerHTML = '';
        });

        const activeShipId = (selectedShipIndex >= 0 && selectedShipIndex < FLEET_SPEC.length)
            ? FLEET_SPEC[selectedShipIndex].id
            : null;

        placedFleet.forEach(ship => {
            const isSelected = (ship.id === activeShipId);
            const orient = getShipOrientation(ship.coords);

            ship.coords.forEach(([r, c], idx) => {
                const cell = document.querySelector(`#placement-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('ship-cell');
                    if (isSelected) {
                        cell.classList.add('selected-ship');
                    }
                    const part = getShipPartType(idx, ship.size);
                    cell.innerHTML = getShipPartSVG(part, orient, false);
                }
            });
        });
    }

    function renderShipList() {
        const container = document.getElementById('fleet-ship-list');
        if (!container) return;
        container.innerHTML = '';

        const myUsername = currentUser ? currentUser.username : null;
        const myCmdId = (currentState && currentState.commanders && myUsername && currentState.commanders[myUsername]) || 'schmidt';
        const cmd = COMMANDERS_DATA[myCmdId] || COMMANDERS_DATA['schmidt'];
        const activeFleetSpec = (currentState && currentState.game_mode === 'classic') ? FLEET_SPEC : (cmd.fleet || FLEET_SPEC);

        const placedIds = new Set(placedFleet.map(s => s.id));

        activeFleetSpec.forEach((spec, idx) => {
            const isPlaced = placedIds.has(spec.id);
            const isSelected = (idx === selectedShipIndex);

            const card = document.createElement('div');
            card.className = `ship-item-card ${isPlaced ? 'placed' : ''} ${isSelected ? 'selected' : ''}`;
            card.onclick = () => {
                selectedShipIndex = idx;
                renderShipList();
                renderPlacementGrid();
            };

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px;">
                    <div>
                        <div class="ship-name-text">${spec.name}</div>
                        <span style="font-size:0.75rem; color:#64748b; font-weight:800;">${spec.size} Segmente</span>
                    </div>
                    <div>
                        ${renderPolyShapeHTML(spec.shape || [[0, 0]])}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function updatePlacementStatus() {
        const btn = document.getElementById('btn-confirm-fleet');
        const msg = document.getElementById('placement-status-msg');
        const myUsername = currentUser ? currentUser.username : null;
        const myCmdId = (currentState && currentState.commanders && myUsername && currentState.commanders[myUsername]) || 'schmidt';
        const cmd = COMMANDERS_DATA[myCmdId] || COMMANDERS_DATA['schmidt'];
        const activeFleetSpec = (currentState && currentState.game_mode === 'classic') ? FLEET_SPEC : (cmd.fleet || FLEET_SPEC);

        const allPlaced = (placedFleet.length === activeFleetSpec.length);

        if (btn) btn.disabled = !allPlaced || myConfirmedReady;
        if (msg) {
            if (myConfirmedReady) {
                msg.textContent = 'Bereit gemeldet! Warte auf Gegner...';
                msg.style.color = '#00b4d8';
            } else if (allPlaced) {
                msg.textContent = 'Alle Schiffe platziert! Jetzt bereit melden.';
                msg.style.color = '#22c55e';
            } else {
                msg.textContent = `${placedFleet.length}/${activeFleetSpec.length} Schiffe platziert.`;
                msg.style.color = '#666';
            }
        }
    }

    window.confirmFleetPlacement = function () {
        if (!bsMp || !roomCode || placedFleet.length === 0) return;
        bsMp.action(roomCode, 'confirm_fleet', { fleet: placedFleet }).then(res => {
            if (res.error) {
                alert(res.error);
            } else {
                myConfirmedReady = true;
                myPrivateFleet = placedFleet;
                updatePlacementStatus();
                if (res.state) renderState(res.state);
            }
        });
    };

    // --- BATTLE LOGIC & ABILITY TARGETING ---

    window.setGameMode = function (mode) {
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'set_game_mode', { mode: mode }).then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    window.selectCommander = function (cid) {
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'select_commander', { commander: cid }).then(res => {
            if (res.error) alert(res.error);
            else if (res.state) renderState(res.state);
        });
    };

    function renderPolyShapeHTML(shape) {
        if (!shape || shape.length === 0) return '';
        const coords = new Set(shape.map(([r, c]) => `${r},${c}`));
        const maxR = Math.max(...shape.map(([r]) => r)) + 1;
        const maxC = Math.max(...shape.map(([, c]) => c)) + 1;
        let gridHTML = `<div class="poly-ship-preview" style="grid-template-columns: repeat(${maxC}, 8px); grid-template-rows: repeat(${maxR}, 8px);">`;
        for (let r = 0; r < maxR; r++) {
            for (let c = 0; c < maxC; c++) {
                const filled = coords.has(`${r},${c}`);
                gridHTML += `<div class="poly-cell ${filled ? '' : 'empty'}"></div>`;
            }
        }
        gridHTML += `</div>`;
        return gridHTML;
    }

    window.selectAbility = function (abilityId) {
        if (selectedAbility && selectedAbility.id === abilityId) {
            window.cancelAbilityMode();
            return;
        }
        const myUsername = currentUser ? currentUser.username : null;
        const myCmdId = (currentState && currentState.commanders && myUsername && currentState.commanders[myUsername]) || 'schmidt';
        const cmd = COMMANDERS_DATA[myCmdId] || COMMANDERS_DATA['schmidt'];
        const ab = (cmd.abilities || []).find(a => a.id === abilityId);
        if (!ab) return;

        const myEnergy = (currentState && currentState.energy && myUsername && currentState.energy[myUsername]) || 0;
        if (myEnergy < ab.cost) {
            alert(`Nicht genügend Energie (${myEnergy}/${ab.cost} benötigt)`);
            return;
        }

        selectedAbility = ab;
        abilityArmed = true;

        document.querySelectorAll('.diamond-btn').forEach(btn => {
            btn.classList.toggle('armed', btn.dataset.abilityId === abilityId);
        });

        const tooltipBox = document.getElementById('ability-tooltip-box');
        if (tooltipBox) {
            tooltipBox.style.display = 'flex';
            document.getElementById('tooltip-ability-name').textContent = ab.name;
            document.getElementById('tooltip-ability-desc').textContent = ab.desc;
            document.getElementById('tooltip-ability-cost').textContent = ab.cost;
        }

        const dirBtn = document.getElementById('btn-ability-dir');
        if (dirBtn) {
            dirBtn.style.display = (ab.type === 'torpedo' || ab.type === 'airstrike_3' || ab.type === 'recon_2') ? 'inline-flex' : 'none';
        }
        clearEnemyCellHover();
    };

    window.cancelAbilityMode = function () {
        selectedAbility = null;
        abilityArmed = false;
        document.querySelectorAll('.diamond-btn').forEach(btn => btn.classList.remove('armed'));
        const tooltipBox = document.getElementById('ability-tooltip-box');
        if (tooltipBox) tooltipBox.style.display = 'none';
        const dirBtn = document.getElementById('btn-ability-dir');
        if (dirBtn) dirBtn.style.display = 'none';
        clearEnemyCellHover();
    };

    window.toggleAbilityDir = function () {
        abilityDir = (abilityDir === 'H') ? 'V' : 'H';
        const txt = document.getElementById('ability-dir-text');
        if (txt) txt.textContent = abilityDir === 'H' ? 'HORIZONT' : 'VERTIKAL';
        clearEnemyCellHover();
    };

    function getTargetAbilityCells(row, col, abilityType, dir) {
        const cells = [];
        if (abilityType === 'sonar' || abilityType === 'bombardment_3x3') {
            const rMin = Math.max(0, row - 1), rMax = Math.min(GRID_SIZE - 1, row + 1);
            const cMin = Math.max(0, col - 1), cMax = Math.min(GRID_SIZE - 1, col + 1);
            for (let r = rMin; r <= rMax; r++) {
                for (let c = cMin; c <= cMax; c++) cells.push([r, c]);
            }
        } else if (abilityType === 'bombardment_2x2') {
            const rStart = Math.min(Math.max(0, row), GRID_SIZE - 2);
            const cStart = Math.min(Math.max(0, col), GRID_SIZE - 2);
            cells.push([rStart, cStart], [rStart, cStart + 1], [rStart + 1, cStart], [rStart + 1, cStart + 1]);
        } else if (abilityType === 'airstrike_3') {
            if (dir === 'H') {
                const cStart = Math.min(Math.max(0, col - 1), GRID_SIZE - 3);
                for (let i = 0; i < 3; i++) cells.push([row, cStart + i]);
            } else {
                const rStart = Math.min(Math.max(0, row - 1), GRID_SIZE - 3);
                for (let i = 0; i < 3; i++) cells.push([rStart + i, col]);
            }
        } else if (abilityType === 'recon_2') {
            if (dir === 'H') {
                const cStart = Math.min(col, GRID_SIZE - 2);
                cells.push([row, cStart], [row, cStart + 1]);
            } else {
                const rStart = Math.min(row, GRID_SIZE - 2);
                cells.push([rStart, col], [rStart + 1, col]);
            }
        } else if (abilityType === 'crossfire_5') {
            [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach(([r, c]) => {
                if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) cells.push([r, c]);
            });
        } else if (abilityType === 'torpedo') {
            if (dir === 'H') {
                for (let c = 0; c < GRID_SIZE; c++) cells.push([row, c]);
            } else {
                for (let r = 0; r < GRID_SIZE; r++) cells.push([r, col]);
            }
        } else {
            // precision or single
            cells.push([row, col]);
        }
        return cells;
    }

    function onEnemyCellHover(row, col) {
        if (!abilityArmed || !selectedAbility || !currentState) return;
        const cells = getTargetAbilityCells(row, col, selectedAbility.type, abilityDir);
        clearEnemyCellHover();
        cells.forEach(([r, c]) => {
            const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
            if (cell) cell.classList.add('preview-ability');
        });
    }

    function clearEnemyCellHover() {
        document.querySelectorAll('#enemy-battle-grid .radar-cell').forEach(c => {
            c.classList.remove('preview-ability');
        });
    }

    function onEnemyCellClick(row, col) {
        if (!bsMp || !roomCode) return;
        AudioFX.init();

        if (abilityArmed && selectedAbility && currentState) {
            const ab = selectedAbility;
            bsMp.action(roomCode, 'fire_ability', { ability_id: ab.id, row: row, col: col, dir: abilityDir }).then(res => {
                if (res.error) {
                    alert(res.error);
                } else {
                    window.cancelAbilityMode();
                    clearEnemyCellHover();
                    if (res.result && (res.result.ability === 'sonar' || res.result.sonar)) {
                        AudioFX.playSonar();
                    } else {
                        AudioFX.playFire();
                        const shots = (res.result && res.result.shots) || [];
                        const hasHit = shots.some(s => s.result === 'hit' || s.result === 'sunk');
                        if (hasHit) AudioFX.playExplosion();
                        else AudioFX.playSplash();
                    }
                    if (res.state) renderState(res.state);
                }
            });
            return;
        }

        // Regular Artillery Shot
        bsMp.action(roomCode, 'fire_shot', { row: row, col: col }).then(res => {
            if (res.error) {
                console.warn(res.error);
            } else {
                AudioFX.playFire();
                if (res.shot) {
                    if (res.shot.result === 'hit' || res.shot.result === 'sunk') AudioFX.playExplosion();
                    else AudioFX.playSplash();
                }
                if (res.state) renderState(res.state);
            }
        });
    }

    function fetchMyFleet(code) {
        if (!code) return;
        fetch(`/battleship/${code}/my_fleet`, {
            headers: { 'X-Auth-Token': window.GameHub.auth.getToken() }
        })
            .then(res => res.json())
            .then(data => {
                if (data.fleet && data.fleet.length > 0) {
                    myPrivateFleet = data.fleet;
                }
            })
            .catch(() => { });
    }

    // --- STATE RENDERER ---

    function updateAbilityButton(state) {
        const myUsername = currentUser ? currentUser.username : null;
        const isMyTurn = (state.turn === myUsername && state.status === 'battle');
        const myCmdId = (state.commanders && myUsername && state.commanders[myUsername]) || 'karslake';
        const cmd = COMMANDERS_DATA[myCmdId] || COMMANDERS_DATA['karslake'];
        const energy = (state.energy && myUsername && state.energy[myUsername]) || 0;
        const canAfford = (energy >= cmd.cost);

        const btn = document.getElementById('btn-activate-ability');
        if (!btn) return;

        btn.disabled = !isMyTurn || !canAfford;
        if (abilityArmed && isMyTurn && canAfford) {
            btn.classList.add('armed');
            btn.textContent = '🎯 ZIEL WÄHLEN... [ABBRECHEN]';
        } else {
            abilityArmed = false;
            btn.classList.remove('armed');
            btn.innerHTML = `⚡ ${cmd.abilityName.toUpperCase()} (${cmd.cost}⚡)`;
        }
    }

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
            console.warn('[Battleship] State received without status property:', state);
            return;
        }

        const myUsername = currentUser ? currentUser.username : null;
        const players = state.players || [];
        const isHost = (myUsername === state.host);

        // 1. LOBBY
        if (state.status === 'lobby') {
            document.getElementById('battle-modal').classList.remove('active');
            showScreen('screen-lobby');

            const p1 = players[0] || null;
            const p2 = players[1] || null;
            const nameEl1 = document.getElementById('name-p1');
            const nameEl2 = document.getElementById('name-p2');
            if (nameEl1) nameEl1.textContent = p1 ? (p1 + (p1 === state.host ? ' 👑' : '')) : 'Wartet...';
            if (nameEl2) nameEl2.textContent = p2 ? (p2 + (p2 === state.host ? ' 👑' : '')) : 'Wartet auf Beitritt...';

            const isSpectator = myUsername && !players.includes(myUsername);
            const specNotice = document.getElementById('spectator-notice');
            if (specNotice) specNotice.style.display = isSpectator ? 'block' : 'none';

            // Match Mode Toggles
            const gameMode = state.game_mode || 'commanders';
            const isCommanders = (gameMode === 'commanders');
            const btnCmd = document.getElementById('btn-mode-commanders');
            const btnCls = document.getElementById('btn-mode-classic');
            if (btnCmd && btnCls) {
                btnCmd.classList.toggle('active', isCommanders);
                btnCls.classList.toggle('active', !isCommanders);
                btnCmd.disabled = !isHost;
                btnCls.disabled = !isHost;
            }

            // Commander Selection Grid
            const cmdSection = document.getElementById('commanders-select-section');
            if (cmdSection) {
                cmdSection.style.display = isCommanders ? 'block' : 'none';
                if (isCommanders) {
                    const cmdGrid = document.getElementById('commander-cards-grid');
                    if (cmdGrid) {
                        const myCmdId = (state.commanders && myUsername && state.commanders[myUsername]) || 'schmidt';
                        cmdGrid.innerHTML = Object.values(COMMANDERS_DATA).map(c => `
                            <div class="commander-card ${c.id === myCmdId ? 'selected' : ''}" onclick="selectCommander('${c.id}')">
                                <div class="cmd-card-header">
                                    <div class="cmd-avatar">${c.icon}</div>
                                    <div class="cmd-info">
                                        <span class="cmd-nation">${c.nation}</span>
                                        <span class="cmd-name">${c.name}</span>
                                    </div>
                                </div>
                                <div class="cmd-ability-badge">
                                    <span>⚡ ${c.abilityName}</span>
                                    <span class="cmd-ability-cost">${c.cost}⚡</span>
                                </div>
                                <p class="cmd-desc">${c.desc}</p>
                                <div class="commander-fleet-preview-box">
                                    <div class="commander-fleet-title">Flotte (${c.fleet ? c.fleet.length : 5} Schiffe)</div>
                                    <div class="commander-fleet-shapes">
                                        ${(c.fleet || []).map(s => renderPolyShapeHTML(s.shape || [[0, 0]])).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            }

            const startBtn = document.getElementById('btn-start-game');
            if (startBtn) {
                if (isHost) {
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = (players.length < 2);
                    startBtn.textContent = players.length >= 2 ? 'FLOTTENAUFSTELLUNG STARTEN (2/2)' : `WARTE AUF GEGNER (${players.length}/2)`;
                } else {
                    startBtn.style.display = 'inline-flex';
                    startBtn.disabled = true;
                    startBtn.textContent = 'WARTE AUF HOST...';
                }
            }
            myConfirmedReady = false;
            return;
        }

        // 2. PLACEMENT
        if (state.status === 'placement') {
            document.getElementById('battle-modal').classList.remove('active');
            showScreen('screen-placement');

            // If we have not placed anything yet, generate a default layout
            if (placedFleet.length === 0) {
                window.randomizePlacement();
            }

            myConfirmedReady = state.ready ? Boolean(state.ready[myUsername]) : false;
            updatePlacementStatus();
            return;
        }

        // 3. BATTLE or FINISHED only
        if (state.status !== 'battle' && state.status !== 'finished') {
            return;
        }
        showScreen('screen-battle');

        // Fetch private fleet if not loaded
        if (!myPrivateFleet) {
            fetchMyFleet(roomCode);
        }

        const opponent = players.find(p => p !== myUsername) || 'Gegner';
        const scores = state.scores || {};
        const scoreDisp = document.getElementById('score-display');
        if (scoreDisp) {
            scoreDisp.textContent = `${myUsername || 'Du'}: ${scores[myUsername] || 0}  |  ${opponent}: ${scores[opponent] || 0}`;
        }

        const gameMode = state.game_mode || 'commanders';
        const isCommanders = (gameMode === 'commanders');

        // Tactical Header: Player Profile & Opponent Profile
        const myCmdId = (state.commanders && myUsername && state.commanders[myUsername]) || 'schmidt';
        const myCmd = COMMANDERS_DATA[myCmdId] || COMMANDERS_DATA['schmidt'];
        const myEnergy = (state.energy && myUsername && state.energy[myUsername]) || 0;

        const oppCmdId = (state.commanders && opponent && state.commanders[opponent]) || 'kelly';
        const oppCmd = COMMANDERS_DATA[oppCmdId] || COMMANDERS_DATA['kelly'];
        const oppEnergy = (state.energy && opponent && state.energy[opponent]) || 0;

        const myIcon = document.getElementById('my-commander-icon');
        const myName = document.getElementById('my-commander-name');
        const myUser = document.getElementById('my-player-username');
        const myEnergyPendant = document.getElementById('my-energy-pendant');
        if (myIcon) myIcon.textContent = myCmd.icon;
        if (myName) myName.textContent = myCmd.name;
        if (myUser) myUser.textContent = myUsername || 'Du';
        if (myEnergyPendant) myEnergyPendant.textContent = `⚡ ${myEnergy}`;

        const oppIcon = document.getElementById('enemy-commander-icon');
        const oppName = document.getElementById('enemy-commander-name');
        const oppUser = document.getElementById('enemy-player-username');
        const oppEnergyPendant = document.getElementById('enemy-energy-pendant');
        if (oppIcon) oppIcon.textContent = oppCmd.icon;
        if (oppName) oppName.textContent = oppCmd.name;
        if (oppUser) oppUser.textContent = opponent;
        if (oppEnergyPendant) oppEnergyPendant.textContent = `⚡ ${oppEnergy}`;

        // Turn indicator
        const isMyTurn = (state.turn === myUsername && state.status === 'battle');
        const turnText = document.getElementById('battle-turn-text');
        const hintEl = document.getElementById('enemy-grid-hint');

        if (turnText) {
            if (state.status === 'battle') {
                if (isMyTurn) {
                    turnText.innerHTML = `<span style="color:var(--bs-cyan);">DU BIST DRAN! WÄHLE EIN ZIEL.</span>`;
                    if (hintEl) hintEl.textContent = 'Klicke auf ein feindliches Feld oder nutze deine Spezialfähigkeiten!';
                } else {
                    turnText.innerHTML = `<span>${state.turn} ZIELT... WARTE AUF EINSCHLAG.</span>`;
                    if (hintEl) hintEl.textContent = 'Gegner ist am Zug...';
                }
            } else if (state.status === 'finished') {
                turnText.textContent = `${state.winner} HAT DIE SEESCHLACHT GEWONNEN!`;
            }
        }

        // Diamond Tactical Console (Screenshot 2 Match)
        const consoleEl = document.getElementById('commander-tactical-console');
        const clusterEl = document.getElementById('abilities-diamond-cluster');
        if (consoleEl && clusterEl) {
            if (!isCommanders) {
                consoleEl.style.display = 'none';
            } else {
                consoleEl.style.display = 'flex';
                clusterEl.innerHTML = (myCmd.abilities || []).map(ab => {
                    const canAfford = myEnergy >= ab.cost && isMyTurn;
                    const isArmed = selectedAbility && selectedAbility.id === ab.id;
                    return `
                        <button type="button" class="diamond-btn pos-${ab.pos} ${isArmed ? 'armed' : ''}" 
                                data-ability-id="${ab.id}" 
                                ${!canAfford ? 'disabled' : ''} 
                                onclick="selectAbility('${ab.id}')"
                                title="${ab.name} (${ab.cost}⚡): ${ab.desc}">
                            <div class="diamond-btn-inner">
                                <span class="diamond-icon">${ab.icon}</span>
                                <span class="diamond-cost-badge">${ab.cost}⚡</span>
                            </div>
                        </button>
                    `;
                }).join('');
            }
        }

        // Sonar Notification Banner
        const sonarNotice = document.getElementById('sonar-notification');
        const mySonar = state.sonar_result && myUsername && state.sonar_result[myUsername];
        if (sonarNotice) {
            if (mySonar) {
                sonarNotice.style.display = 'block';
                sonarNotice.textContent = `📡 SONAR-STATUS: ${mySonar.count} feindliche Schiffs-Segmente in Sektor (${mySonar.row + 1}, ${String.fromCharCode(65 + mySonar.col)}) geortet!`;
            } else {
                sonarNotice.style.display = 'none';
            }
        }

        // Render Enemy Grid (Target Ocean)
        const enemyShots = (state.shots && opponent && state.shots[opponent]) ? state.shots[opponent] : [];
        const enemySunkShips = (state.fleets && opponent && state.fleets[opponent]) ? state.fleets[opponent] : [];
        const sunkEnemyCoords = new Set();
        enemySunkShips.forEach(s => {
            if (s.sunk && s.coords) {
                s.coords.forEach(([r, c]) => sunkEnemyCoords.add(`${r},${c}`));
            }
        });

        const enemyShotMap = new Map();
        enemyShots.forEach(s => enemyShotMap.set(`${s.row},${s.col}`, s.result));

        const oppFleetSpec = (gameMode === 'classic') ? FLEET_SPEC : (oppCmd.fleet || FLEET_SPEC);
        const sunkIds = new Set(enemySunkShips.filter(s => s.sunk).map(s => s.id));
        let enemyAliveCount = oppFleetSpec.length - sunkIds.size;
        const enemyCounter = document.getElementById('enemy-fleet-counter');
        if (enemyCounter) enemyCounter.textContent = `${enemyAliveCount} Schiffe übrig`;

        // Opponent Fleet Silhouettes Bar (Screenshot 2 Match)
        const enemyStatusBar = document.getElementById('enemy-fleet-status-bar');
        if (enemyStatusBar) {
            enemyStatusBar.innerHTML = oppFleetSpec.map(spec => {
                const isSunk = sunkIds.has(spec.id);
                return `
                    <div class="fleet-silhouette-item ${isSunk ? 'sunk' : ''}">
                        <span>${isSunk ? '❌' : '🚢'}</span>
                        <span>${spec.name} (${spec.size})</span>
                    </div>
                `;
            }).join('');
        }

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (!cell) continue;

                cell.className = 'radar-cell';
                cell.innerHTML = '';
                const key = `${r},${c}`;
                const res = enemyShotMap.get(key);

                if (res === 'miss') {
                    cell.classList.add('shot-miss');
                } else if (res === 'hit' || res === 'sunk') {
                    if (sunkEnemyCoords.has(key)) {
                        cell.classList.add('shot-sunk');
                    } else {
                        cell.classList.add('shot-hit');
                    }
                }
            }
        }

        // Render Sunk Enemy Ships as SVG wreckage
        enemySunkShips.forEach(ship => {
            if (ship.sunk && ship.coords) {
                const orient = getShipOrientation(ship.coords);
                ship.coords.forEach(([r, c], idx) => {
                    const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) {
                        cell.classList.add('ship-cell', 'shot-sunk');
                        const part = getShipPartType(idx, ship.size || ship.coords.length);
                        cell.innerHTML = getShipPartSVG(part, orient, true);
                    }
                });
            }
        });

        // If finished, reveal remaining enemy ships
        if (state.status === 'finished' && state.fleets && state.fleets[opponent]) {
            state.fleets[opponent].forEach(ship => {
                if (!ship.sunk && ship.coords) {
                    const orient = getShipOrientation(ship.coords);
                    ship.coords.forEach(([r, c], idx) => {
                        const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                        if (cell) {
                            cell.classList.add('ship-cell');
                            const part = getShipPartType(idx, ship.size || ship.coords.length);
                            cell.innerHTML = getShipPartSVG(part, orient, false);
                        }
                    });
                }
            });
        }

        // Render Own Defense Grid (Mini-Map "DEINE FLOTTE")
        const myShots = (state.shots && myUsername && state.shots[myUsername]) ? state.shots[myUsername] : [];
        const myShotMap = new Map();
        myShots.forEach(s => myShotMap.set(`${s.row},${s.col}`, s.result));

        const myFleetToRender = myPrivateFleet || placedFleet || [];

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = document.querySelector(`#own-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (!cell) continue;

                cell.className = 'radar-cell';
                cell.innerHTML = '';
                const key = `${r},${c}`;

                const res = myShotMap.get(key);
                if (res === 'miss') {
                    cell.classList.add('shot-miss');
                } else if (res === 'hit' || res === 'sunk') {
                    cell.classList.add('shot-hit');
                }
            }
        }

        // Render own ships on mini-map
        let ownAliveCount = 0;
        myFleetToRender.forEach(ship => {
            const isSunk = Boolean(ship.sunk);
            if (!isSunk) ownAliveCount++;
            (ship.coords || []).forEach(([r, c]) => {
                const cell = document.querySelector(`#own-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('ship-cell');
                    if (isSunk) cell.classList.add('sunk');
                }
            });
        });

        const ownCounter = document.getElementById('own-fleet-counter');
        if (ownCounter) {
            ownCounter.textContent = `${ownAliveCount}/${myFleetToRender.length}`;
        }

        // Modal for Finished
        const modal = document.getElementById('battle-modal');
        if (state.status === 'finished') {
            const headline = document.getElementById('bs-modal-headline');
            const subtext = document.getElementById('bs-modal-subtext');
            const icon = document.getElementById('bs-modal-icon');

            if (state.winner === myUsername) {
                headline.textContent = 'SIEG AUF HOHER SEE!';
                subtext.textContent = 'Du hast alle Schiffe des Gegners auf den Meeresgrund geschickt!';
                icon.textContent = '🏆';
                AudioFX.playVictory();
            } else {
                headline.textContent = 'FLOTTE VERNICHTET!';
                subtext.textContent = `${state.winner} hat deine Seestreitkräfte versenkt.`;
                icon.textContent = '💥';
            }

            modal.classList.add('active');
        } else {
            modal.classList.remove('active');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
