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

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    const ICONS_SVG = {
        // Commanders
        anchor: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>`,
        medal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
        crosshair: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="1" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="23"></line><line x1="1" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="23" y2="12"></line><circle cx="12" cy="12" r="3"></circle></svg>`,
        radar_dish: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.93 19.07A10 10 0 0 1 12 2a10 10 0 0 1 7.07 17.07"></path><path d="M7.76 16.24A6 6 0 0 1 12 6a6 6 0 0 1 4.24 10.24"></path><circle cx="12" cy="12" r="2"></circle></svg>`,

        // Abilities
        sonar: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0 1 10-10"></path><path d="M6 12a6 6 0 0 1 6-6"></path><path d="M10 12a2 2 0 0 1 2-2"></path><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>`,
        target: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line></svg>`,
        torpedo: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path></svg>`,
        plane: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"></path></svg>`,
        lightning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        blast: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14l3-3 2 2 4-6 3 3 4-2-2 7H4z"></path><circle cx="12" cy="12" r="2" fill="currentColor"></circle></svg>`,
        flare: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg>`,
        swords: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line><circle cx="12" cy="12" r="9"></circle></svg>`,
        bomb: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"></circle><line x1="12" y1="1" x2="12" y2="6"></line><line x1="4" y1="13" x2="1" y2="13"></line><line x1="23" y1="13" x2="20" y2="13"></line></svg>`
    };

    const COMMANDERS_DATA = {
        'schmidt': {
            id: 'schmidt',
            name: 'Johannes Schmidt',
            nation: 'Kriegsmarine',
            icon: ICONS_SVG.anchor,
            title: 'U-Boot-Ass',
            ability: 'torpedo',
            abilityName: 'Torpedo-Salve',
            cost: 4,
            desc: 'Feuere ihn durch eine Zeile oder Spalte. Hält an, wenn er ein Schiff trifft.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'U-Boot-Sonar', icon: ICONS_SVG.sonar, cost: 3, desc: 'Platziere auf beschossenem Feld: Scannt 3x3 Umfeld & setzt eine Fahne mit der Anzahl benachbarter Schiffsteile.', type: 'sonar' },
                { id: 'mine', pos: 'left', name: 'Schnell-Torpedo', icon: ICONS_SVG.target, cost: 2, desc: 'Präzisions-Schuss auf 1 Zielfeld mit +2 Energie bei Treffer.', type: 'precision' },
                { id: 'torpedo', pos: 'right', name: 'Torpedo', icon: ICONS_SVG.torpedo, cost: 4, desc: 'Feuere ihn durch eine Zeile oder Spalte. Hält an, wenn er ein Schiff trifft.', type: 'torpedo' },
                { id: 'wolfpack', pos: 'bottom', name: 'Rudeltaktik (Ultimate)', icon: ICONS_SVG.blast, cost: 10, desc: 'Massives Torpedobombardement auf ein 3x3 Zielgebiet.', type: 'bombardment_3x3' }
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
            icon: ICONS_SVG.medal,
            title: 'Luftüberlegenheit',
            ability: 'airstrike',
            abilityName: 'Luftschlag',
            cost: 5,
            desc: 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.',
            abilities: [
                { id: 'radar', pos: 'top', name: 'Radar-Scan', icon: ICONS_SVG.sonar, cost: 3, desc: 'Platziere auf beschossenem Feld: Scannt 3x3 Umfeld & setzt eine Fahne mit der Anzahl benachbarter Schiffsteile.', type: 'sonar' },
                { id: 'recon', pos: 'left', name: 'Spähflug', icon: ICONS_SVG.plane, cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.', type: 'recon_2' },
                { id: 'airstrike', pos: 'right', name: 'Luftschlag', icon: ICONS_SVG.lightning, cost: 5, desc: 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.', type: 'airstrike_3' },
                { id: 'carpet_bomb', pos: 'bottom', name: 'Teppichbombardement (Ultimate)', icon: ICONS_SVG.blast, cost: 10, desc: 'Vernichtendes 3x3 Bombardement auf das Zielareal.', type: 'bombardment_3x3' }
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
            icon: ICONS_SVG.crosshair,
            title: 'Artillerie-General',
            ability: 'bombardment',
            abilityName: 'Schweres Bombardement',
            cost: 6,
            desc: 'Feuert eine 2x2 Salve auf den gewählten Bereich.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'Horchposten', icon: ICONS_SVG.sonar, cost: 3, desc: 'Platziere auf beschossenem Feld: Scannt 3x3 Umfeld & setzt eine Fahne mit der Anzahl benachbarter Schiffsteile.', type: 'sonar' },
                { id: 'flare', pos: 'left', name: 'Leuchtgranate', icon: ICONS_SVG.flare, cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder auf feindliche Einheiten.', type: 'recon_2' },
                { id: 'crossfire', pos: 'right', name: 'Kreuzfeuer', icon: ICONS_SVG.swords, cost: 5, desc: 'Artilleriefeuer im Kreuzmuster (5 Felder: Zentrum + 4 Nachbarn).', type: 'crossfire_5' },
                { id: 'bombardment', pos: 'bottom', name: 'Schweres Bombardement (Ultimate)', icon: ICONS_SVG.blast, cost: 10, desc: 'Feuert eine verheerende 3x3 Salve auf den gewählten Bereich.', type: 'bombardment_3x3' }
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
            icon: ICONS_SVG.radar_dish,
            title: 'Sonar-Kommandeurin',
            ability: 'sonar',
            abilityName: 'Aufklärungs-Sonar',
            cost: 3,
            desc: 'Platziere auf beschossenem Feld: Scannt 3x3 Umfeld & setzt eine Fahne mit der Anzahl benachbarter Schiffsteile.',
            abilities: [
                { id: 'sonar', pos: 'top', name: 'Aufklärungs-Sonar', icon: ICONS_SVG.sonar, cost: 3, desc: 'Platziere auf beschossenem Feld: Scannt 3x3 Umfeld & setzt eine Fahne mit der Anzahl benachbarter Schiffsteile.', type: 'sonar' },
                { id: 'ping', pos: 'left', name: 'Peilungs-Ping', icon: ICONS_SVG.target, cost: 2, desc: 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.', type: 'recon_2' },
                { id: 'depth_charge', pos: 'right', name: 'Wasserbomben', icon: ICONS_SVG.bomb, cost: 5, desc: 'Schachbrett-Salve (4 Felder im 2x2 Sektor).', type: 'bombardment_2x2' },
                { id: 'orbital_strike', pos: 'bottom', name: 'Präzisions-Bombardement (Ultimate)', icon: ICONS_SVG.blast, cost: 10, desc: 'Volle 3x3 Salve auf den gewählten Zielbereich.', type: 'bombardment_3x3' }
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

    let lastSonarResult = null;
    let sonarFlags = new Map();

    function isEnemyCellTargeted(row, col) {
        if (!currentState || !currentUser) return false;
        const myUsername = currentUser.username;
        const opponent = (currentState.players || []).find(p => p !== myUsername);
        const shots = (currentState.shots && opponent && currentState.shots[opponent]) || [];
        return shots.some(s => s.row === row && s.col === col);
    }

    function showNotification(message, type = 'info', duration = 3500) {
        let container = document.getElementById('bs-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'bs-toast-container';
            container.className = 'bs-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `bs-toast toast-${type}`;

        let iconSvg = '';
        if (type === 'error' || type === 'danger') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else if (type === 'success') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        } else if (type === 'sonar') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f5d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
        } else {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            <span class="bs-toast-icon">${iconSvg}</span>
            <span class="bs-toast-msg">${message}</span>
            <button type="button" class="bs-toast-close" onclick="this.parentElement.remove()">✕</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }
    window.showNotification = showNotification;

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
        if (!bsMp) return showNotification('SDK nicht bereit', 'error');
        bsMp.createRoom().then(res => {
            if (res.success && res.room_code) {
                window.location.href = `/battleship/${res.room_code}`;
            } else {
                showNotification(res.error || 'Fehler beim Erstellen des Raumes', 'error');
            }
        }).catch(() => showNotification('Netzwerkfehler', 'error'));
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
                showNotification(res.error, 'error');
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
            showNotification('Raum-Link in die Zwischenablage kopiert! 📋', 'success');
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
            if (res.error) showNotification(res.error, 'error');
            else if (res.state) renderState(res.state);
        });
    };

    window.restartMatch = function () {
        document.getElementById('battle-modal').classList.remove('active');
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'restart_game').then(res => {
            if (res.error) showNotification(res.error, 'error');
            else if (res.state) renderState(res.state);
        });
    };

    // --- SHIP GRAPHICS & SVGs ---

    function getShipPartSVGByMask(mask, isSunk) {
        const hull = isSunk ? '#3d0a0a' : '#1e293b';
        const deck = isSunk ? '#5c1414' : '#334155';
        const stroke = isSunk ? '#150303' : '#0f172a';
        const turret = isSunk ? '#7f1d1d' : '#475569';
        const accent = isSunk ? '#ea580c' : '#00b4d8';
        const bridge = isSunk ? '#250808' : '#0f172a';
        const sw = 3.5;

        // Bit 0 = N (1), Bit 1 = E (2), Bit 2 = S (4), Bit 3 = W (8)
        switch (mask) {
            case 0: // Single isolated block (no neighbors)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="14" y="22" width="72" height="56" rx="26" fill="${hull}" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="22" y="30" width="56" height="40" rx="18" fill="${deck}"/>
                    <circle cx="50" cy="50" r="11" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="4.5" fill="${accent}"/>
                </svg>`;

            case 1: // Connected North -> end pointing South
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M14,0 L14,58 C14,76 32,88 50,88 C68,88 86,76 86,58 L86,0 Z" fill="${hull}"/>
                    <path d="M22,0 L22,54 C22,68 34,78 50,78 C66,78 78,68 78,54 L78,0 Z" fill="${deck}"/>
                    <line x1="14" y1="0" x2="14" y2="58" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="86" y1="0" x2="86" y2="58" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M14,58 C14,76 32,88 50,88 C68,88 86,76 86,58" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="50" cy="44" r="10" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="50" y1="44" x2="50" y2="64" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                </svg>`;

            case 4: // Connected South -> end pointing North (Bow)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M14,100 L14,42 C14,24 32,12 50,12 C68,12 86,24 86,42 L86,100 Z" fill="${hull}"/>
                    <path d="M22,100 L22,46 C22,32 34,22 50,22 C66,22 78,32 78,46 L78,100 Z" fill="${deck}"/>
                    <line x1="14" y1="42" x2="14" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="86" y1="42" x2="86" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M14,42 C14,24 32,12 50,12 C68,12 86,24 86,42" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="50" cy="56" r="10" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="50" y1="56" x2="50" y2="36" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                </svg>`;

            case 8: // Connected West -> end pointing East (Bow)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,14 L58,14 C76,14 88,32 88,50 C88,68 76,86 58,86 L0,86 Z" fill="${hull}"/>
                    <path d="M0,22 L54,22 C68,22 78,34 78,50 C78,66 68,78 54,78 L0,78 Z" fill="${deck}"/>
                    <line x1="0" y1="14" x2="58" y2="14" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="0" y1="86" x2="58" y2="86" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M58,14 C76,14 88,32 88,50 C88,68 76,86 58,86" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="44" cy="50" r="10" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="44" y1="50" x2="64" y2="50" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                </svg>`;

            case 2: // Connected East -> end pointing West (Bow)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M100,14 L42,14 C24,14 12,32 12,50 C12,68 24,86 42,86 L100,86 Z" fill="${hull}"/>
                    <path d="M100,22 L46,22 C32,22 22,34 22,50 C22,66 32,78 46,78 L100,78 Z" fill="${deck}"/>
                    <line x1="42" y1="14" x2="100" y2="14" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="42" y1="86" x2="100" y2="86" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M42,14 C24,14 12,32 12,50 C12,68 24,86 42,86" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="56" cy="50" r="10" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="56" y1="50" x2="36" y2="50" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                </svg>`;

            case 5: // Straight Vertical: North (1) + South (4)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="14" y="0" width="72" height="100" fill="${hull}"/>
                    <rect x="22" y="0" width="56" height="100" fill="${deck}"/>
                    <line x1="14" y1="0" x2="14" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="86" y1="0" x2="86" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="34" y="32" width="32" height="36" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="50" y1="20" x2="50" y2="32" stroke="${accent}" stroke-width="2.5"/>
                    <circle cx="50" cy="50" r="5" fill="${accent}"/>
                </svg>`;

            case 10: // Straight Horizontal: East (2) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="0" y="14" width="100" height="72" fill="${hull}"/>
                    <rect x="0" y="22" width="100" height="56" fill="${deck}"/>
                    <line x1="0" y1="14" x2="100" y2="14" stroke="${stroke}" stroke-width="${sw}"/>
                    <line x1="0" y1="86" x2="100" y2="86" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="32" y="34" width="36" height="32" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="20" y1="50" x2="32" y2="50" stroke="${accent}" stroke-width="2.5"/>
                    <circle cx="50" cy="50" r="5" fill="${accent}"/>
                </svg>`;

            case 6: // Corner: South (4) + East (2)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M14,100 L14,24 C14,18 18,14 24,14 L100,14 L100,86 L86,86 L86,100 Z" fill="${hull}"/>
                    <path d="M22,100 L22,28 C22,24 24,22 28,22 L100,22 L100,78 L78,78 L78,100 Z" fill="${deck}"/>
                    <path d="M14,100 L14,24 C14,18 18,14 24,14 L100,14" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M100,86 L86,86 L86,100" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="48" cy="48" r="15" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="48" y1="48" x2="68" y2="68" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="48" cy="48" r="4.5" fill="${accent}"/>
                </svg>`;

            case 12: // Corner: South (4) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,14 L76,14 C82,14 86,18 86,24 L86,100 L14,100 L14,86 L0,86 Z" fill="${hull}"/>
                    <path d="M0,22 L72,22 C76,22 78,24 78,28 L78,100 L22,100 L22,78 L0,78 Z" fill="${deck}"/>
                    <path d="M0,14 L76,14 C82,14 86,18 86,24 L86,100" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M0,86 L14,86 L14,100" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="52" cy="48" r="15" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="52" y1="48" x2="32" y2="68" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="52" cy="48" r="4.5" fill="${accent}"/>
                </svg>`;

            case 3: // Corner: North (1) + East (2)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M14,0 L14,76 C14,82 18,86 24,86 L100,86 L100,14 L86,14 L86,0 Z" fill="${hull}"/>
                    <path d="M22,0 L22,72 C22,76 24,78 28,78 L100,78 L100,22 L78,22 L78,0 Z" fill="${deck}"/>
                    <path d="M14,0 L14,76 C14,82 18,86 24,86 L100,86" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M100,14 L86,14 L86,0" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="48" cy="52" r="15" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="48" y1="52" x2="68" y2="32" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="48" cy="52" r="4.5" fill="${accent}"/>
                </svg>`;

            case 9: // Corner: North (1) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,86 L76,86 C82,86 86,82 86,76 L86,0 L14,0 L14,14 L0,14 Z" fill="${hull}"/>
                    <path d="M0,78 L72,78 C76,78 78,76 78,72 L78,0 L22,0 L22,22 L0,22 Z" fill="${deck}"/>
                    <path d="M0,86 L76,86 C82,86 86,82 86,76 L86,0" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M0,14 L14,14 L14,0" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <circle cx="52" cy="52" r="15" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <line x1="52" y1="52" x2="32" y2="32" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="52" cy="52" r="4.5" fill="${accent}"/>
                </svg>`;

            case 7: // T-Junction: North (1) + East (2) + South (4)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M14,0 L14,100 L86,100 L86,86 L100,86 L100,14 L86,14 L86,0 Z" fill="${hull}"/>
                    <path d="M22,0 L22,100 L78,100 L78,78 L100,78 L100,22 L78,22 L78,0 Z" fill="${deck}"/>
                    <line x1="14" y1="0" x2="14" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M86,0 L86,14 L100,14" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M100,86 L86,86 L86,100" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="30" y="30" width="40" height="40" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="6" fill="${accent}"/>
                </svg>`;

            case 13: // T-Junction: North (1) + South (4) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M86,0 L86,100 L14,100 L14,86 L0,86 L0,14 L14,14 L14,0 Z" fill="${hull}"/>
                    <path d="M78,0 L78,100 L22,100 L22,78 L0,78 L0,22 L22,22 L22,0 Z" fill="${deck}"/>
                    <line x1="86" y1="0" x2="86" y2="100" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M0,14 L14,14 L14,0" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M14,100 L14,86 L0,86" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="30" y="30" width="40" height="40" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="6" fill="${accent}"/>
                </svg>`;

            case 14: // T-Junction: East (2) + South (4) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,14 L100,14 L100,86 L86,86 L86,100 L14,100 L14,86 L0,86 Z" fill="${hull}"/>
                    <path d="M0,22 L100,22 L100,78 L78,78 L78,100 L22,100 L22,78 L0,78 Z" fill="${deck}"/>
                    <line x1="0" y1="14" x2="100" y2="14" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M0,86 L14,86 L14,100" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M86,100 L86,86 L100,86" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="30" y="30" width="40" height="40" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="6" fill="${accent}"/>
                </svg>`;

            case 11: // T-Junction: North (1) + East (2) + West (8)
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <path d="M0,86 L100,86 L100,14 L86,14 L86,0 L14,0 L14,14 L0,14 Z" fill="${hull}"/>
                    <path d="M0,78 L100,78 L100,22 L78,22 L78,0 L22,0 L22,22 L0,22 Z" fill="${deck}"/>
                    <line x1="0" y1="86" x2="100" y2="86" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M0,14 L14,14 L14,0" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <path d="M86,0 L86,14 L100,14" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
                    <rect x="30" y="30" width="40" height="40" rx="4" fill="${bridge}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="6" fill="${accent}"/>
                </svg>`;

            case 15: // 4-way Cross / Interior block: N + E + S + W
            default:
                return `<svg viewBox="0 0 100 100" class="ship-svg ${isSunk ? 'sunk' : ''}">
                    <rect x="0" y="0" width="100" height="100" fill="${hull}"/>
                    <rect x="0" y="0" width="100" height="100" fill="${deck}"/>
                    <rect x="24" y="24" width="52" height="52" rx="6" fill="${bridge}" stroke="${stroke}" stroke-width="2.5"/>
                    <circle cx="50" cy="50" r="14" fill="${turret}" stroke="${stroke}" stroke-width="2"/>
                    <circle cx="50" cy="50" r="6" fill="${accent}"/>
                </svg>`;
        }
    }

    function getShipPartSVG(part, dir, isSunk) {
        let mask = 0;
        if (part === 'single') mask = 0;
        else if (dir === 'H') {
            if (part === 'bow') mask = 8;
            else if (part === 'stern') mask = 2;
            else mask = 10;
        } else {
            if (part === 'bow') mask = 4;
            else if (part === 'stern') mask = 1;
            else mask = 5;
        }
        return getShipPartSVGByMask(mask, isSunk);
    }

    function getShipOrientation(coords) {
        if (!coords || coords.length <= 1) return 'H';
        const isHorizontal = coords.every(([r, c]) => r === coords[0][0]);
        if (isHorizontal) return 'H';
        const isVertical = coords.every(([r, c]) => c === coords[0][1]);
        if (isVertical) return 'V';
        return (coords[1][0] === coords[0][0]) ? 'H' : 'V';
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
                    tappedR: r,
                    tappedC: c,
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

                const deltaR = tr - dragState.tappedR;
                const deltaC = tc - dragState.tappedC;
                const testCoords = dragState.ship.coords.map(([sr, sc]) => [sr + deltaR, sc + deltaC]);

                const inBounds = testCoords.every(([r, c]) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE);
                const valid = inBounds && isValidPlacement(testCoords, dragState.ship.id);

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
                    const isHorizontal = ship.coords.every(([r, c]) => r === ship.coords[0][0]);
                    const isVertical = ship.coords.every(([r, c]) => c === ship.coords[0][1]);

                    if (isHorizontal || isVertical) {
                        const currentOrient = isHorizontal ? 'H' : 'V';
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
                    } else {
                        // General polyomino 90-degree rotation
                        const minR = Math.min(...ship.coords.map(c => c[0]));
                        const minC = Math.min(...ship.coords.map(c => c[1]));
                        const maxR = Math.max(...ship.coords.map(c => c[0]));
                        const maxC = Math.max(...ship.coords.map(c => c[1]));
                        const h = maxR - minR;
                        let cand = ship.coords.map(([r, c]) => [minR + (c - minC), minC + (h - (r - minR))]);
                        const candMaxR = Math.max(...cand.map(c => c[0]));
                        const candMaxC = Math.max(...cand.map(c => c[1]));
                        const shiftR = candMaxR >= GRID_SIZE ? (candMaxR - GRID_SIZE + 1) : 0;
                        const shiftC = candMaxC >= GRID_SIZE ? (candMaxC - GRID_SIZE + 1) : 0;
                        cand = cand.map(([r, c]) => [r - shiftR, c - shiftC]);
                        if (isValidPlacement(cand, ship.id)) {
                            ship.coords = cand;
                            AudioFX.playSplash();
                        }
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
            const coordSet = new Set(ship.coords.map(([r, c]) => `${r},${c}`));

            ship.coords.forEach(([r, c]) => {
                const cell = document.querySelector(`#placement-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('ship-cell');
                    if (isSelected) {
                        cell.classList.add('selected-ship');
                    }
                    const hasN = coordSet.has(`${r - 1},${c}`);
                    const hasE = coordSet.has(`${r},${c + 1}`);
                    const hasS = coordSet.has(`${r + 1},${c}`);
                    const hasW = coordSet.has(`${r},${c - 1}`);
                    const mask = (hasN ? 1 : 0) | (hasE ? 2 : 0) | (hasS ? 4 : 0) | (hasW ? 8 : 0);
                    cell.innerHTML = getShipPartSVGByMask(mask, false);
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
                showNotification(res.error, 'error');
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
            if (res.error) showNotification(res.error, 'error');
            else if (res.state) renderState(res.state);
        });
    };

    let currentCommanderSlideIdx = 0;
    const commanderKeysList = ['schmidt', 'karslake', 'ferrara', 'kelly'];
    let carouselScrollListenerAttached = false;
    let initialSlidePositioned = false;

    window.selectCommander = function (cid) {
        if (!bsMp || !roomCode) return;
        bsMp.action(roomCode, 'select_commander', { commander: cid }).then(res => {
            if (res.error) showNotification(res.error, 'error');
            else if (res.state) renderState(res.state);
        });
    };

    window.prevCommanderSlide = function () {
        const total = commanderKeysList.length;
        window.goToCommanderSlide((currentCommanderSlideIdx - 1 + total) % total);
    };

    window.nextCommanderSlide = function () {
        const total = commanderKeysList.length;
        window.goToCommanderSlide((currentCommanderSlideIdx + 1) % total);
    };

    window.goToCommanderSlide = function (targetIdx) {
        const container = document.getElementById('commander-carousel-container');
        if (!container) return;
        const total = commanderKeysList.length;
        if (targetIdx < 0 || targetIdx >= total) return;
        currentCommanderSlideIdx = targetIdx;
        
        const track = document.getElementById('commander-carousel-track');
        const slide = track ? track.children[targetIdx] : null;
        if (slide) {
            slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            container.scrollTo({ left: targetIdx * container.clientWidth, behavior: 'smooth' });
        }
        updateCommanderDots(targetIdx);
    };

    function updateCommanderDots(activeIdx) {
        const dots = document.querySelectorAll('#commander-carousel-dots .carousel-dot');
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === activeIdx);
        });
    }

    function renderCommanderCarousel(myCmdId) {
        const track = document.getElementById('commander-carousel-track');
        const dotsContainer = document.getElementById('commander-carousel-dots');
        const container = document.getElementById('commander-carousel-container');
        if (!track || !dotsContainer || !container) return;

        const commanders = Object.values(COMMANDERS_DATA);

        // If track is already populated, simply update selection states
        if (track.children.length === commanders.length) {
            commanders.forEach((c, idx) => {
                const slide = track.children[idx];
                if (!slide) return;
                const card = slide.querySelector('.commander-card');
                const isSelected = (c.id === myCmdId);
                if (card) {
                    card.classList.toggle('selected', isSelected);
                    const statusWrap = card.querySelector('.cmd-select-status');
                    if (statusWrap) {
                        statusWrap.innerHTML = '';
                    }
                    const footerWrap = card.querySelector('.cmd-card-footer');
                    if (footerWrap) {
                        footerWrap.innerHTML = isSelected
                            ? '<div class="btn-commander-active">✓ AKTUELL AUSGEWÄHLT</div>'
                            : `<button type="button" class="btn-primary btn-select-full" onclick="event.stopPropagation(); selectCommander('${c.id}')">★ DIESEN KOMMANDANTEN WÄHLEN</button>`;
                    }
                }
            });
            return;
        }

        // Generate slides HTML
        track.innerHTML = commanders.map((c) => {
            const isSelected = (c.id === myCmdId);
            return `
                <div class="commander-card-slide" data-cid="${c.id}">
                    <div class="commander-card ${isSelected ? 'selected' : ''}" onclick="selectCommander('${c.id}')">
                        <div class="cmd-card-header">
                            <div class="cmd-avatar">${c.icon}</div>
                            <div class="cmd-info">
                                <span class="cmd-nation">${c.nation}</span>
                                <h4 class="cmd-name">${c.name}</h4>
                                <span class="cmd-subtitle">${c.title}</span>
                            </div>
                            <div class="cmd-select-status"></div>
                        </div>

                        <!-- 4 Spezialangriffe (Klar lesbare Liste ohne Abschneiden) -->
                        <div class="cmd-abilities-box">
                            <div class="cmd-abilities-title">4 SPEZIALANGRIFFE & TAKTIKEN</div>
                            <div class="cmd-abilities-list">
                                ${(c.abilities || []).map((ab) => `
                                    <div class="cmd-ability-row ${ab.pos === 'bottom' ? 'ultimate' : ''}">
                                        <div class="cmd-ab-headline">
                                            <div class="cmd-ab-left">
                                                <span class="cmd-ab-icon">${ab.icon}</span>
                                                <strong class="cmd-ab-name">${ab.name.replace(/\s*\(Ultimate\)/i, '')}</strong>
                                                ${ab.pos === 'bottom' ? '<span class="cmd-ab-ult-tag">ULTIMATE</span>' : ''}
                                            </div>
                                            <span class="cmd-ab-cost">${ab.cost} <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
                                        </div>
                                        <p class="cmd-ab-desc">${ab.desc}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Fleet Preview -->
                        <div class="commander-fleet-preview-box">
                            <div class="commander-fleet-title">FLOTTE (${c.fleet ? c.fleet.length : 5} SCHIFFE MIT SONDERFORMEN)</div>
                            <div class="commander-fleet-shapes">
                                ${(c.fleet || []).map(s => renderPolyShapeHTML(s.shape || [[0, 0]])).join('')}
                            </div>
                        </div>

                        <!-- Bottom Select Button -->
                        <div class="cmd-card-footer">
                            ${isSelected ? `
                                <div class="btn-commander-active">✓ AKTUELL AUSGEWÄHLT</div>
                            ` : `
                                <button type="button" class="btn-primary btn-select-full" onclick="event.stopPropagation(); selectCommander('${c.id}')">
                                    ★ DIESEN KOMMANDANTEN WÄHLEN
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Generate dots HTML
        dotsContainer.innerHTML = commanders.map((c, idx) => `
            <button type="button" class="carousel-dot ${idx === currentCommanderSlideIdx ? 'active' : ''}" 
                onclick="goToCommanderSlide(${idx})" 
                title="${c.name}"
                aria-label="Gehe zu ${c.name}"></button>
        `).join('');

        // Attach scroll event for responsive swiping
        if (!carouselScrollListenerAttached) {
            let scrollDebounce = null;
            container.addEventListener('scroll', () => {
                if (scrollDebounce) clearTimeout(scrollDebounce);
                scrollDebounce = setTimeout(() => {
                    const slideWidth = container.clientWidth;
                    if (!slideWidth) return;
                    const idx = Math.round(container.scrollLeft / slideWidth);
                    if (idx >= 0 && idx < commanders.length && idx !== currentCommanderSlideIdx) {
                        currentCommanderSlideIdx = idx;
                        updateCommanderDots(idx);
                    }
                }, 40);
            }, { passive: true });
            carouselScrollListenerAttached = true;
        }

        // Scroll initially to my selected commander if not yet positioned
        if (!initialSlidePositioned) {
            const initialIdx = commanderKeysList.indexOf(myCmdId);
            if (initialIdx >= 0) {
                currentCommanderSlideIdx = initialIdx;
                setTimeout(() => {
                    window.goToCommanderSlide(initialIdx);
                }, 80);
            }
            initialSlidePositioned = true;
        }
    }

    function renderPolyShapeHTML(shape, isSunk = false) {
        if (!shape || shape.length === 0) return '';
        const coords = new Set(shape.map(([r, c]) => `${r},${c}`));
        const maxR = Math.max(...shape.map(([r]) => r)) + 1;
        const maxC = Math.max(...shape.map(([, c]) => c)) + 1;
        const cellClass = isSunk ? 'poly-cell sunk' : 'poly-cell';
        let gridHTML = `<div class="poly-ship-preview ${isSunk ? 'sunk' : ''}" style="grid-template-columns: repeat(${maxC}, 8px); grid-template-rows: repeat(${maxR}, 8px);">`;
        for (let r = 0; r < maxR; r++) {
            for (let c = 0; c < maxC; c++) {
                const filled = coords.has(`${r},${c}`);
                gridHTML += `<div class="${filled ? cellClass : 'poly-cell empty'}"></div>`;
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
            showNotification(`Nicht genügend Energie (${myEnergy}/${ab.cost}⚡ benötigt)`, 'error');
            return;
        }

        selectedAbility = ab;
        abilityArmed = true;

        document.querySelectorAll('.diamond-btn').forEach(btn => {
            btn.classList.toggle('armed', btn.dataset.abilityId === abilityId);
        });

        // Expanded Active Drawer
        const drawer = document.getElementById('ability-active-drawer');
        if (drawer) {
            drawer.style.display = 'block';
            const iconEl = document.getElementById('drawer-ability-icon');
            if (iconEl) iconEl.innerHTML = ab.icon;
            const nameEl = document.getElementById('drawer-ability-name');
            if (nameEl) nameEl.textContent = ab.name;
            const costEl = document.getElementById('drawer-ability-cost');
            if (costEl) costEl.textContent = `${ab.cost} ⚡`;
            const descEl = document.getElementById('drawer-ability-desc');
            if (descEl) descEl.textContent = ab.desc;

            const isDirectional = (ab.type === 'torpedo' || ab.type === 'airstrike_3' || ab.type === 'recon_2');
            const dirCtrl = document.getElementById('drawer-dir-controls');
            if (dirCtrl) {
                dirCtrl.style.display = isDirectional ? 'flex' : 'none';
                const dirTxt = document.getElementById('drawer-dir-text');
                if (dirTxt) dirTxt.textContent = abilityDir === 'H' ? 'WAAGERECHT ↔' : 'SENKRECHT ↕';
            }
        }

        clearEnemyCellHover();
    };

    window.cancelAbilityMode = function () {
        selectedAbility = null;
        abilityArmed = false;
        document.querySelectorAll('.diamond-btn').forEach(btn => btn.classList.remove('armed'));
        const drawer = document.getElementById('ability-active-drawer');
        if (drawer) drawer.style.display = 'none';
        clearEnemyCellHover();
    };

    window.toggleAbilityDir = function () {
        abilityDir = (abilityDir === 'H') ? 'V' : 'H';
        const dirTxt = document.getElementById('drawer-dir-text');
        if (dirTxt) dirTxt.textContent = abilityDir === 'H' ? 'WAAGERECHT ↔' : 'SENKRECHT ↕';
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
        const myUsername = currentUser ? currentUser.username : null;
        if (!currentState || currentState.turn !== myUsername || !abilityArmed || !selectedAbility) return;
        clearEnemyCellHover();

        if (selectedAbility.type === 'sonar') {
            if (!isEnemyCellTargeted(row, col)) {
                const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) cell.classList.add('preview-invalid');
                return;
            }
        }

        const cells = getTargetAbilityCells(row, col, selectedAbility.type, abilityDir);
        cells.forEach(([r, c]) => {
            const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
            if (cell) cell.classList.add('preview-ability');
        });
    }

    function clearEnemyCellHover() {
        document.querySelectorAll('#enemy-battle-grid .radar-cell').forEach(c => {
            c.classList.remove('preview-ability', 'preview-invalid');
        });
    }

    function onEnemyCellClick(row, col) {
        if (!bsMp || !roomCode) return;
        AudioFX.init();

        const myUsername = currentUser ? currentUser.username : null;

        // Guard: Don't send action requests when it is not your turn or game is not in active battle!
        if (!currentState || currentState.status !== 'battle' || currentState.turn !== myUsername) {
            return;
        }

        if (abilityArmed && selectedAbility) {
            const ab = selectedAbility;

            if (ab.type === 'sonar' && !isEnemyCellTargeted(row, col)) {
                showNotification('Sonar kann nur auf einem bereits beschossenen Feld platziert werden!', 'error');
                return;
            }

            bsMp.action(roomCode, 'fire_ability', { ability_id: ab.id, row: row, col: col, dir: abilityDir }).then(res => {
                if (res.error) {
                    showNotification(res.error, 'error');
                } else {
                    window.cancelAbilityMode();
                    clearEnemyCellHover();
                    if (res.result && (res.result.ability === 'sonar' || res.result.sonar)) {
                        AudioFX.playSonar();
                        const sonarData = res.result.sonar || (res.state && res.state.sonar_result && res.state.sonar_result[myUsername]);
                        if (sonarData) {
                            lastSonarResult = sonarData;
                            const count = sonarData.count;
                            const rCenter = sonarData.row !== undefined ? sonarData.row : row;
                            const cCenter = sonarData.col !== undefined ? sonarData.col : col;

                            if (res.state) renderState(res.state);

                            // Trigger single circular 360-degree radar sweep centered at clicked cell
                            const gridEl = document.getElementById('enemy-battle-grid');
                            const centerCell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${rCenter}"][data-col="${cCenter}"]`);
                            if (gridEl && centerCell) {
                                const sweep = document.createElement('div');
                                sweep.className = 'sonar-circular-radar-sweep';
                                sweep.style.left = `${centerCell.offsetLeft + centerCell.offsetWidth / 2}px`;
                                sweep.style.top = `${centerCell.offsetTop + centerCell.offsetHeight / 2}px`;
                                const size = Math.round(centerCell.offsetWidth * 3);
                                sweep.style.width = `${size}px`;
                                sweep.style.height = `${size}px`;
                                gridEl.appendChild(sweep);

                                setTimeout(() => {
                                    if (sweep.parentNode) sweep.remove();
                                    // Once radar sweep finishes, show the static flag!
                                    sonarFlags.set(`${rCenter},${cCenter}`, count);
                                    if (currentState) renderBattleScreen(currentState);
                                    const colLetter = String.fromCharCode(65 + cCenter);
                                    const rowNum = rCenter + 1;
                                    showNotification(`🚩 SONAR-SCAN (${colLetter}${rowNum}): ${count} benachbarte(s) Schiffsteil(e) geortet!`, 'sonar', 5000);
                                }, 950);
                            } else {
                                sonarFlags.set(`${rCenter},${cCenter}`, count);
                                if (currentState) renderBattleScreen(currentState);
                            }
                        }
                    } else {
                        AudioFX.playFire();
                        const shots = (res.result && res.result.shots) || [];
                        const hasHit = shots.some(s => s.result === 'hit' || s.result === 'sunk');
                        if (hasHit) {
                            AudioFX.playExplosion();
                            showNotification(res.message || 'Volltreffer erzielt!', 'success', 3500);
                        } else {
                            AudioFX.playSplash();
                            showNotification(res.message || 'Wasser verfehlt.', 'info', 3000);
                        }
                    }
                    if (res.state) renderState(res.state);
                }
            });
            return;
        }

        // Regular Artillery Shot: ignore if already targeted
        if (isEnemyCellTargeted(row, col)) {
            return;
        }

        bsMp.action(roomCode, 'fire_shot', { row: row, col: col }).then(res => {
            if (res.error) {
                showNotification(res.error, 'error');
            } else {
                AudioFX.playFire();
                if (res.shot) {
                    if (res.shot.result === 'hit' || res.shot.result === 'sunk') {
                        AudioFX.playExplosion();
                        showNotification(res.shot.result === 'sunk' ? 'Gegnerisches Schiff versenkt!' : 'Treffer!', 'success', 2500);
                    } else {
                        AudioFX.playSplash();
                    }
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

        if (state.status === 'lobby' || state.status === 'placement') {
            lastSonarResult = null;
            sonarFlags.clear();
        }

        // 1. LOBBY
        if (state.status === 'lobby') {
            document.getElementById('battle-modal').classList.remove('active');
            showScreen('screen-lobby');

            const p1 = players[0] || null;
            const p2 = players[1] || null;
            const nameEl1 = document.getElementById('name-p1');
            const nameEl2 = document.getElementById('name-p2');
            const crownSVG = ' <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffbe0b" stroke="#111" stroke-width="1.8" style="display:inline-block; vertical-align:-1px;"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path></svg>';
            if (nameEl1) nameEl1.innerHTML = p1 ? (escapeHtml(p1) + (p1 === state.host ? crownSVG : '')) : 'Wartet...';
            if (nameEl2) nameEl2.innerHTML = p2 ? (escapeHtml(p2) + (p2 === state.host ? crownSVG : '')) : 'Wartet auf Beitritt...';

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

            // Commander Selection Carousel
            const cmdSection = document.getElementById('commanders-select-section');
            if (cmdSection) {
                cmdSection.style.display = isCommanders ? 'block' : 'none';
                if (isCommanders) {
                    const myCmdId = (state.commanders && myUsername && state.commanders[myUsername]) || 'schmidt';
                    renderCommanderCarousel(myCmdId);
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
            scoreDisp.textContent = `${scores[myUsername] || 0} : ${scores[opponent] || 0}`;
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
        if (myIcon) myIcon.innerHTML = myCmd.icon;
        if (myName) myName.textContent = myCmd.name;
        if (myUser) myUser.textContent = myUsername || 'Du';
        if (myEnergyPendant) myEnergyPendant.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#ffbe0b" stroke="#111" stroke-width="1.5" style="display:inline-block; vertical-align:-1px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${myEnergy}`;

        const oppIcon = document.getElementById('enemy-commander-icon');
        const oppName = document.getElementById('enemy-commander-name');
        const oppUser = document.getElementById('enemy-player-username');
        const oppEnergyPendant = document.getElementById('enemy-energy-pendant');
        if (oppIcon) oppIcon.innerHTML = oppCmd.icon;
        if (oppName) oppName.textContent = oppCmd.name;
        if (oppUser) oppUser.textContent = opponent;
        if (oppEnergyPendant) oppEnergyPendant.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#ffbe0b" stroke="#111" stroke-width="1.5" style="display:inline-block; vertical-align:-1px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> ${oppEnergy}`;

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

        const enemyGrid = document.getElementById('enemy-battle-grid');
        if (enemyGrid) {
            enemyGrid.classList.toggle('not-my-turn', !isMyTurn);
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
                                <span class="diamond-cost-badge">${ab.cost} <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:inline-block; vertical-align:-1px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
                            </div>
                        </button>
                    `;
                }).join('');
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

        // Opponent Fleet Shapes Strip (Mini Poly-Shapes, red when sunk)
        const enemyStatusBar = document.getElementById('enemy-fleet-status-bar');
        if (enemyStatusBar) {
            enemyStatusBar.innerHTML = oppFleetSpec.map(spec => {
                const isSunk = sunkIds.has(spec.id);
                const shape = spec.shape || Array.from({ length: spec.size }, (_, i) => [0, i]);
                return `
                    <div class="enemy-shape-unit ${isSunk ? 'sunk' : ''}" title="${spec.name} (${spec.size})${isSunk ? ' - Versenkt' : ''}">
                        ${renderPolyShapeHTML(shape, isSunk)}
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
                const coordSet = new Set(ship.coords.map(([r, c]) => `${r},${c}`));
                ship.coords.forEach(([r, c]) => {
                    const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) {
                        cell.classList.add('ship-cell', 'shot-sunk');
                        const hasN = coordSet.has(`${r - 1},${c}`);
                        const hasE = coordSet.has(`${r},${c + 1}`);
                        const hasS = coordSet.has(`${r + 1},${c}`);
                        const hasW = coordSet.has(`${r},${c - 1}`);
                        const mask = (hasN ? 1 : 0) | (hasE ? 2 : 0) | (hasS ? 4 : 0) | (hasW ? 8 : 0);
                        cell.innerHTML = getShipPartSVGByMask(mask, true);
                    }
                });
            }
        });

        // If finished, reveal remaining enemy ships
        if (state.status === 'finished' && state.fleets && state.fleets[opponent]) {
            state.fleets[opponent].forEach(ship => {
                if (!ship.sunk && ship.coords) {
                    const coordSet = new Set(ship.coords.map(([r, c]) => `${r},${c}`));
                    ship.coords.forEach(([r, c]) => {
                        const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                        if (cell) {
                            cell.classList.add('ship-cell');
                            const hasN = coordSet.has(`${r - 1},${c}`);
                            const hasE = coordSet.has(`${r},${c + 1}`);
                            const hasS = coordSet.has(`${r + 1},${c}`);
                            const hasW = coordSet.has(`${r},${c - 1}`);
                            const mask = (hasN ? 1 : 0) | (hasE ? 2 : 0) | (hasS ? 4 : 0) | (hasW ? 8 : 0);
                            cell.innerHTML = getShipPartSVGByMask(mask, false);
                        }
                    });
                }
            });
        }

        // Sync & Render Real Static Sonar Flag Badges (persisting on hit/miss cells)
        const serverFlags = (state.sonar_flags && myUsername && state.sonar_flags[myUsername]) ? state.sonar_flags[myUsername] : (state.sonar_flags || {});
        if (serverFlags && typeof serverFlags === 'object') {
            Object.entries(serverFlags).forEach(([k, v]) => {
                if (typeof v === 'number') sonarFlags.set(k, v);
            });
        }

        sonarFlags.forEach((count, key) => {
            const [r, c] = key.split(',').map(Number);
            const cell = document.querySelector(`#enemy-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
            if (cell) {
                let pin = cell.querySelector('.sonar-flag-real-container');
                if (!pin) {
                    pin = document.createElement('div');
                    pin.className = 'sonar-flag-real-container';
                    cell.appendChild(pin);
                }
                pin.innerHTML = `
                    <svg class="sonar-flag-svg-real" viewBox="0 0 32 32" width="28" height="28">
                        <line x1="8" y1="3" x2="8" y2="29" stroke="rgba(0,0,0,0.6)" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="7" y1="3" x2="7" y2="29" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="7" cy="3" r="2" fill="#ffbe0b" stroke="#78350f" stroke-width="0.5"/>
                        <path d="M 8 4 L 29 4 L 24 12 L 29 20 L 8 20 Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.2"/>
                        <text x="16" y="12.5" fill="#ffffff" font-family="'Share Tech Mono', 'Courier New', monospace" font-weight="900" font-size="11.5" text-anchor="middle" dominant-baseline="central">${count}</text>
                    </svg>
                `;
                pin.title = `Sonar-Fahne: ${count} benachbarte Schiffsteile`;
            }
        });

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
            const coordSet = new Set((ship.coords || []).map(([r, c]) => `${r},${c}`));
            (ship.coords || []).forEach(([r, c]) => {
                const cell = document.querySelector(`#own-battle-grid .radar-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('ship-cell');
                    if (isSunk) cell.classList.add('sunk');
                    const hasN = coordSet.has(`${r - 1},${c}`);
                    const hasE = coordSet.has(`${r},${c + 1}`);
                    const hasS = coordSet.has(`${r + 1},${c}`);
                    const hasW = coordSet.has(`${r},${c - 1}`);
                    const mask = (hasN ? 1 : 0) | (hasE ? 2 : 0) | (hasS ? 4 : 0) | (hasW ? 8 : 0);
                    cell.innerHTML = getShipPartSVGByMask(mask, isSunk);
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
                icon.innerHTML = '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ffbe0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path></svg>';
                AudioFX.playVictory();
            } else {
                headline.textContent = 'FLOTTE VERNICHTET!';
                subtext.textContent = `${state.winner} hat deine Seestreitkräfte versenkt.`;
                icon.innerHTML = '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
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
