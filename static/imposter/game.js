/**
 * Impostor // Bauhaus Game Engine
 */
const Game = {
    data: {},
    selectedCategories: new Set(),
    players: [],
    currentPlayerIndex: 0,
    currentCategory: '',
    currentWord: '',
    impostorCount: 1, // Default
    timerInterval: null,
    voteSelection: new Set(),
    gameDuration: 300,
    currentImpostorHint: '',
    hintMode: 'word',
    timerEndTimestamp: null,
    gamePhase: 'setup', // 'setup', 'pass', 'voting', 'results'

    init: async function() {
        try {
            const response = await fetch('/static/imposter/words.json');
            this.data = await response.json();
            
            const grid = document.getElementById('category-grid');
            let allKeys = Object.keys(this.data);
            
            const defaults = [
                "Tiere", "Berufe", "Orte", "Essen & Trinken", "Sportarten", 
                "Fahrzeuge", "Länder & Regionen", "Farben", "Haushalt & Wohnen", "Weltall", "Technik", "Musikinstrumente", "Wetter", "Pflanzen"
            ];

            allKeys.sort((a, b) => {
                const isA = defaults.includes(a);
                const isB = defaults.includes(b);
                if (isA && !isB) return -1;
                if (!isA && isB) return 1;
                return 0;
            });

            allKeys.forEach(cat => {
                const btn = document.createElement('div');
                btn.innerText = cat;
                btn.dataset.cat = cat;
                if (defaults.includes(cat)) {
                    this.selectedCategories.add(cat);
                    btn.className = 'cat-btn selected';
                } else {
                    btn.className = 'cat-btn';
                }
                btn.onclick = () => this.toggleCategory(cat, btn);
                grid.appendChild(btn);
            });

            this.updateCategoryUI();
            for(let i=0; i<4; i++) this.addPlayerInput();

            await this.loadState();

        } catch (e) {
            console.error(e);
            alert("Ladefehler. Bitte Seite neu laden.");
        }
    },

    showError: function(msg) {
        const popup = document.getElementById('error-popup');
        popup.innerText = msg;
        popup.classList.add('show');
        
        // Nach 3 Sekunden wieder ausblenden
        setTimeout(() => {
            popup.classList.remove('show');
        }, 3000);
    },

    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    // --- IMPOSTOR SELECTOR ---
    setImpostors: function(num) {
        this.impostorCount = num;
        document.querySelectorAll('.imp-opt').forEach(el => el.classList.remove('active'));
        document.getElementById('imp-' + num).classList.add('active');
    },

    // --- UX: Accordion & Status ---
    toggleCategoryMenu: function() {
        document.getElementById('cat-content-area').classList.toggle('open');
    },

    updateCategoryUI: function() {
        const total = Object.keys(this.data).length;
        const selected = this.selectedCategories.size;
        const statusText = document.getElementById('cat-status-text');
        const toggleAllBtn = document.getElementById('btn-toggle-all');

        if (selected === total) {
            statusText.innerText = "ALLE";
            statusText.style.background = "var(--c-blue)";
            statusText.style.color = "white";
            toggleAllBtn.innerText = "Alles abwählen";
        } else if (selected === 0) {
            statusText.innerText = "KEINE";
            statusText.style.background = "var(--c-red)";
            statusText.style.color = "white";
            toggleAllBtn.innerText = "Alles auswählen";
        } else {
            statusText.innerText = `${selected} AUSGEWÄHLT`;
            statusText.style.background = "var(--c-yellow)";
            statusText.style.color = "black";
            toggleAllBtn.innerText = "Alles auswählen";
        }
    },

    toggleCategory: function(cat, btnElement) {
        if (this.selectedCategories.has(cat)) {
            this.selectedCategories.delete(cat);
            btnElement.classList.remove('selected');
        } else {
            this.selectedCategories.add(cat);
            btnElement.classList.add('selected');
        }
        this.updateCategoryUI();
    },

    toggleAllCategories: function() {
        const allKeys = Object.keys(this.data);
        const btns = document.querySelectorAll('.cat-btn');
        const shouldSelectAll = this.selectedCategories.size !== allKeys.length;

        this.selectedCategories.clear();
        
        btns.forEach(btn => {
            if (shouldSelectAll) {
                this.selectedCategories.add(btn.dataset.cat);
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        this.updateCategoryUI();
    },

    // --- PLAYER GRID LOGIC ---
    addPlayerInput: function() {
        const container = document.getElementById('player-grid');
        const count = container.children.length + 1;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'player-wrapper';
        
        let defaultName = `Spieler ${count}`;
        if (count === 1 && window.GAMEHUB_USER && window.GAMEHUB_USER.username) {
            defaultName = window.GAMEHUB_USER.username;
        }
        
        wrapper.innerHTML = `
            <input type="text" class="player-input" placeholder="Name" value="${defaultName}">
            <button class="btn-remove-mini" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(wrapper);
    },

    // --- GAME LOOP ---
    start: function() {
        const inputs = document.querySelectorAll('.player-input');
        let playerNames = [];
        inputs.forEach(input => {
            const name = input.value.trim();
            if(name) playerNames.push(name);
        });

        if (playerNames.length < 3) {
            this.showError("Mindestens 3 Spieler erforderlich!");
            return;
        }
        if (this.selectedCategories.size === 0) {
            this.showError("Wähle mindestens eine Kategorie!");
            document.getElementById('cat-content-area').classList.add('open');
            return;
        }
        if (this.impostorCount >= playerNames.length) {
            this.showError("Zu viele Verräter!");
            return;
        }

        const catsArray = Array.from(this.selectedCategories);
        this.currentCategory = catsArray[Math.floor(Math.random() * catsArray.length)];
        
        const categoryData = this.data[this.currentCategory];
        const allWordsObject = categoryData[0];
        const allKeys = Object.keys(allWordsObject);
        const wordKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        const hintsArray = allWordsObject[wordKey];
        
        this.currentWord = wordKey;
        this.currentImpostorHint = hintsArray[Math.floor(Math.random() * hintsArray.length)];

        this.players = playerNames.map(name => ({ name: name, role: 'citizen' }));
        
        let assigned = 0;
        while (assigned < this.impostorCount) {
            let idx = Math.floor(Math.random() * this.players.length);
            if (this.players[idx].role === 'citizen') {
                this.players[idx].role = 'impostor';
                assigned++;
            }
        }

        this.shuffleArray(this.players);
        this.currentPlayerIndex = 0;
        
        this.gamePhase = 'pass';
        this.saveState(); 

        this.preparePassScreen();
        this.switchScreen('screen-pass');
    },

    updatePassScreen: function() {
        const player = this.players[this.currentPlayerIndex];
        document.getElementById('pass-player-name').innerText = player.name;
    },

    // --- DRAG REVEAL LOGIC ---
    dragStartY: 0,
    dragCurrentY: 0,
    isDragging: false,
    hasSeenRole: false,

    preparePassScreen: function() {
        const player = this.players[this.currentPlayerIndex];
        document.getElementById('pass-player-name').innerText = player.name;
        
        this.hasSeenRole = false;
        document.getElementById('btn-confirm-role').classList.remove('visible');
        
        const cover = document.getElementById('drag-cover');
        cover.style.transition = 'transform 0.3s ease-out';
        cover.style.transform = 'translateY(0)';
        
        const secretDiv = document.getElementById('secret-layer-content');
        
        if (player.role === 'impostor') {
            let labelText = "";
            let valueText = "";
            
            if (this.hintMode === 'word') {
                labelText = "Dein Hinweis-Wort:";
                valueText = this.currentImpostorHint;
            } else if (this.hintMode === 'cat') {
                labelText = "Deine Kategorie:";
                valueText = this.currentCategory;
            } else {
                labelText = "Du weißt nichts!";
                valueText = "???";
            }

            secretDiv.innerHTML = `
                <div style="border: 4px solid var(--c-red); padding: 15px; width: 100%;">
                    <span style="color: var(--c-red); font-size: 2.2rem; font-weight: 900; display:block; margin-bottom: 10px;">VERRÄTER</span>
                    <hr style="border: 1px solid black; margin: 10px 0;">
                    <span style="font-size: 0.85rem; text-transform: uppercase; font-weight: 700;">${labelText}</span><br>
                    <strong style="font-size: 1.6rem; color: var(--c-black);">${valueText}</strong>
                </div>
            `;
        } else {
            secretDiv.innerHTML = `
                <div style="border: 4px solid var(--c-blue); padding: 15px; width: 100%;">
                    <span style="color: var(--c-blue); font-size: 2.2rem; font-weight: 900; display:block; margin-bottom: 10px;">${this.currentWord}</span>
                    <hr style="border: 1px solid black; margin: 10px 0;">
                    <span style="font-size: 0.85rem; text-transform: uppercase; font-weight: 700;">Kategorie:</span><br>
                    <strong style="font-size: 1.2rem; color: var(--c-black);">${this.currentCategory}</strong>
                </div>
            `;
        }

        this.initDragEvents();
    },

    initDragEvents: function() {
        const cover = document.getElementById('drag-cover');
        const container = document.getElementById('drag-container');

        container.onmousedown = (e) => this.dragStart(e.clientY);
        document.onmousemove = (e) => this.dragMove(e.clientY);
        document.onmouseup = () => this.dragEnd();

        container.ontouchstart = (e) => this.dragStart(e.touches[0].clientY);
        document.ontouchmove = (e) => this.dragMove(e.touches[0].clientY);
        document.ontouchend = () => this.dragEnd();
    },

    dragStart: function(y) {
        this.isDragging = true;
        this.dragStartY = y;
        const cover = document.getElementById('drag-cover');
        cover.style.transition = 'none';
    },

    dragMove: function(y) {
        if (!this.isDragging) return;
        
        let diff = y - this.dragStartY;
        if (diff > 0) diff = 0;
        if (diff < -250) diff = -250;

        this.dragCurrentY = diff;
        
        const cover = document.getElementById('drag-cover');
        cover.style.transform = `translateY(${diff}px)`;
    },

    dragEnd: function() {
        if (!this.isDragging) return;
        this.isDragging = false;

        const cover = document.getElementById('drag-cover');
        cover.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        if (this.dragCurrentY < -100) {
            this.hasSeenRole = true;
            document.getElementById('btn-confirm-role').classList.add('visible');
        }

        cover.style.transform = 'translateY(0)';
    },

    next: function() {
        const card = document.querySelector('#screen-pass .card');
        card.classList.add('anim-slide-out');

        setTimeout(() => {
            this.currentPlayerIndex++;
            card.classList.remove('anim-slide-out');

            if (this.currentPlayerIndex < this.players.length) {
                this.preparePassScreen();
                this.saveState();

                card.classList.add('anim-slide-in');
                setTimeout(() => {
                    card.classList.remove('anim-slide-in');
                }, 400);

            } else {
                this.setupVotingScreen();
                this.switchScreen('screen-game');
            }
        }, 350); 
    },

    setDuration: function(minutes) {
        if (minutes === 0) {
            this.gameDuration = 0;
        } else {
            this.gameDuration = minutes * 60;
        }

        document.querySelectorAll('[id^="time-"]').forEach(el => el.classList.remove('active'));
        document.getElementById('time-' + minutes).classList.add('active');
    },

    setHintMode: function(mode) {
        this.hintMode = mode;
        document.querySelectorAll('[id^="hint-"]').forEach(el => el.classList.remove('active'));
        document.getElementById('hint-' + mode).classList.add('active');
    },

    // --- TIMER LOGIC ---
    startTimer: function() {
        const display = document.getElementById('game-timer');
        
        if (this.gameDuration === 0) {
            display.innerText = "∞";
            return;
        }

        let seconds = this.gameDuration;
        
        const format = (s) => {
            const m = Math.floor(s / 60).toString().padStart(2, '0');
            const sec = (s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        };
        display.innerText = format(seconds);

        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            seconds--;
            display.innerText = format(seconds);

            if (seconds <= 0) {
                clearInterval(this.timerInterval);
                display.innerText = "00:00";
                display.style.color = "var(--c-red)"; 
            }
        }, 1000);
    },

    // --- VOTING LOGIC ---
    setupVotingScreen: function() {
        this.gamePhase = 'voting';
        this.voteSelection.clear();
        
        document.getElementById('btn-game-action').innerText = "Auswahl bestätigen";
        document.getElementById('btn-game-action').style.background = "var(--c-black)";
        document.getElementById('vote-instruction').style.opacity = "1";
        document.getElementById('vote-limit-display').innerText = this.impostorCount;
        
        document.getElementById('game-timer').innerText = "05:00";
        if (this.gameDuration > 0) {
            this.timerEndTimestamp = Date.now() + (this.gameDuration * 1000);
        } else {
            this.timerEndTimestamp = null;
        }
        this.startTimer();

        const grid = document.getElementById('voting-grid');
        grid.innerHTML = '';

        this.players.forEach((player, index) => {
            const card = document.createElement('div');
            card.className = 'vote-card';
            card.innerHTML = `
                <span class="vote-name">${player.name}</span>
                <div class="vote-status">◻</div>
            `;
            card.onclick = () => this.toggleVote(index, card);
            card.dataset.idx = index;
            grid.appendChild(card);
        });

        this.saveState();
    },

    toggleVote: function(index, cardEl) {
        if (this.gamePhase !== 'voting') return; 

        const statusDiv = cardEl.querySelector('.vote-status');

        if (this.voteSelection.has(index)) {
            this.voteSelection.delete(index);
            cardEl.classList.remove('selected');
            statusDiv.innerText = "◻";
        } else {
            if (this.voteSelection.size >= this.impostorCount) {
                this.showError(`Maximal ${this.impostorCount} wählen!`);
                return;
            }
            this.voteSelection.add(index);
            cardEl.classList.add('selected');
            statusDiv.innerText = "◼";
        }
    },

    handleGameAction: function() {
        if (this.gamePhase === 'voting') {
            this.resolveGame();
        } else {
            this.reset();
        }
    },

    resolveGame: function() {
        if (this.voteSelection.size === 0) {
            this.showError("Wähle mindestens einen Spieler!");
            return;
        }

        this.gamePhase = 'results';
        clearInterval(this.timerInterval);

        const grid = document.getElementById('voting-grid');
        const cards = grid.children;
        let foundImpostors = 0;

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            const card = cards[i];
            const statusDiv = card.querySelector('.vote-status');
            const isSelected = this.voteSelection.has(i);

            if (player.role === 'impostor') {
                if (isSelected) {
                    card.className = 'vote-card res-correct';
                    statusDiv.innerHTML = "ERWISCHT";
                    foundImpostors++;
                } else {
                    card.className = 'vote-card res-missed';
                    statusDiv.innerHTML = "VERRÄTER";
                }
            } else {
                if (isSelected) {
                    card.className = 'vote-card res-wrong';
                    statusDiv.innerHTML = "UNSCHULDIG";
                } else {
                    card.style.opacity = "0.4";
                    statusDiv.innerHTML = "";
                }
            }
        }

        const btn = document.getElementById('btn-game-action');
        btn.innerText = "Neues Spiel starten";
        btn.style.background = "var(--c-blue)";
        
        if (foundImpostors === this.impostorCount) {
            this.showError("SIEG! Alle Verräter gefunden!");
        } else {
            this.showError("Runde vorbei. Analyse läuft...");
        }

        this.saveState();
    },

    reset: function() {
        this.gamePhase = 'setup';
        try {
            localStorage.removeItem(this.getSaveKey());
        } catch(e) {}
        this.switchScreen('screen-setup');
    },

    switchScreen: function(id) {
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        window.scrollTo(0,0);
    },

    getSaveKey: function() {
        const uname = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) ? window.GAMEHUB_USER.username : 'guest';
        return 'imposter_state_' + uname;
    },

    saveState: function() {
        const state = {
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            currentCategory: this.currentCategory,
            currentWord: this.currentWord,
            currentImpostorHint: this.currentImpostorHint,
            impostorCount: this.impostorCount,
            hintMode: this.hintMode,
            gameDuration: this.gameDuration,
            gamePhase: this.gamePhase,
            timerEndTimestamp: this.timerEndTimestamp,
            voteSelection: Array.from(this.voteSelection)
        };

        try {
            localStorage.setItem(this.getSaveKey(), JSON.stringify(state));
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
            fetch('/api/save/imposter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? {'X-Auth-Token': token} : {})
                },
                body: JSON.stringify({ state: state })
            }).catch(() => {});
        } catch(e) { console.error("Save failed", e); }
    },

    loadState: async function() {
        try {
            let state = null;
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
            try {
                const res = await fetch('/api/save/imposter', {
                    headers: token ? {'X-Auth-Token': token} : {}
                });
                if (res.ok) {
                    const cloud = await res.json();
                    if (cloud && cloud.state) {
                        state = cloud.state;
                        localStorage.setItem(this.getSaveKey(), JSON.stringify(state));
                    }
                }
            } catch(e) {}

            if (!state) {
                const local = localStorage.getItem(this.getSaveKey());
                if (local) {
                    try { state = JSON.parse(local); } catch(e) {}
                }
            }
            
            if (state && state.gamePhase && state.gamePhase !== 'setup') {
                this.restoreGame(state);
            }
        } catch(e) { console.error("Load failed", e); }
    },

    restoreGame: function(state) {
        this.players = state.players;
        this.currentPlayerIndex = state.currentPlayerIndex;
        this.currentCategory = state.currentCategory;
        this.currentWord = state.currentWord;
        this.currentImpostorHint = state.currentImpostorHint;
        this.impostorCount = state.impostorCount;
        this.hintMode = state.hintMode;
        this.gameDuration = state.gameDuration;
        this.gamePhase = state.gamePhase;
        this.timerEndTimestamp = state.timerEndTimestamp;
        this.voteSelection = new Set(state.voteSelection || []);

        if (this.gamePhase === 'pass') {
            this.preparePassScreen();
            this.switchScreen('screen-pass');
        } 
        else if (this.gamePhase === 'voting' || this.gamePhase === 'results') {
            document.getElementById('vote-instruction').style.opacity = "1";
            document.getElementById('vote-limit-display').innerText = this.impostorCount;
            
            if (this.gamePhase === 'voting' && this.timerEndTimestamp) {
                const now = Date.now();
                const remaining = Math.ceil((this.timerEndTimestamp - now) / 1000);
                if (remaining > 0) this.resumeTimer(remaining);
                else document.getElementById('game-timer').innerText = "00:00";
            } else if (this.gameDuration === 0) {
                document.getElementById('game-timer').innerText = "∞";
            }

            const grid = document.getElementById('voting-grid');
            grid.innerHTML = '';

            this.players.forEach((player, index) => {
                const card = document.createElement('div');
                
                if (this.gamePhase === 'results') {
                    const isSelected = this.voteSelection.has(index);
                    if (player.role === 'impostor') {
                        if (isSelected) card.className = 'vote-card res-correct';
                        else card.className = 'vote-card res-missed';
                    } else {
                        if (isSelected) card.className = 'vote-card res-wrong';
                        else card.className = 'vote-card';
                    }
                } else {
                    if (this.voteSelection.has(index)) card.className = 'vote-card selected';
                    else card.className = 'vote-card';
                }
                
                let statusText = "◻";
                if (this.gamePhase === 'voting') {
                    statusText = this.voteSelection.has(index) ? "◼" : "◻";
                } else {
                    if (player.role === 'impostor') statusText = this.voteSelection.has(index) ? "ERWISCHT" : "VERRÄTER";
                    else statusText = this.voteSelection.has(index) ? "UNSCHULDIG" : "";
                }

                card.innerHTML = `
                    <span class="vote-name">${player.name}</span>
                    <div class="vote-status">${statusText}</div>
                `;
                
                if (this.gamePhase === 'voting') {
                    card.onclick = () => this.toggleVote(index, card);
                }
                card.dataset.idx = index;
                grid.appendChild(card);
            });

            const btn = document.getElementById('btn-game-action');
            if (this.gamePhase === 'results') {
                btn.innerText = "Neues Spiel starten";
                btn.style.background = "var(--c-blue)";
            } else {
                btn.innerText = "Auswahl bestätigen";
                btn.style.background = "var(--c-black)";
            }

            this.switchScreen('screen-game');
        }
    },

    resumeTimer: function(remainingSeconds) {
        const display = document.getElementById('game-timer');
        let seconds = remainingSeconds;
        
        const format = (s) => {
            const m = Math.floor(s / 60).toString().padStart(2, '0');
            const sec = (s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        };
        display.innerText = format(seconds);

        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            seconds--;
            display.innerText = format(seconds);
            if (seconds <= 0) clearInterval(this.timerInterval);
        }, 1000);
    },
};

document.addEventListener('DOMContentLoaded', () => Game.init());
