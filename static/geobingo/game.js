/**
 * ==========================================================================
 * Geo Bingo - Client Game Engine & Singleton Managers
 * ==========================================================================
 */

(function () {
    'use strict';

    // Game State variables
    let currentRoomCode = null;
    let currentUser = (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) ? window.GAMEHUB_CONFIG.user.username : 'Spieler';
    let gameState = null;
    let pusherChannel = null;
    let heartbeatInterval = null;
    let timerInterval = null;

    // Singleton Maps Objects
    let streetViewPanorama = null;
    let pickerMap = null;
    let streetViewService = null;
    let coverageLayer = null;

    // Initial Coordinates (Europe default)
    let currentLat = 48.8584;
    let currentLng = 2.2945;
    let localMyProofs = {};

    // DOM Elements
    const screens = {
        browser: document.getElementById('screen-browser'),
        lobby: document.getElementById('screen-lobby'),
        exploration: document.getElementById('screen-exploration'),
        judgement: document.getElementById('screen-judgement'),
        results: document.getElementById('screen-results')
    };

    function isStartLocationChosen() {
        if (!currentRoomCode) return false;
        if (sessionStorage.getItem('geobingo_start_' + currentRoomCode)) {
            return true;
        }
        if (gameState && gameState.proofs && gameState.proofs[currentUser] && Object.keys(gameState.proofs[currentUser]).length > 0) {
            sessionStorage.setItem('geobingo_start_' + currentRoomCode, '1');
            return true;
        }
        return false;
    }

    function attachStreetViewToStage(stageId) {
        const stage = document.getElementById(stageId);
        const container = document.getElementById('streetview-container');
        if (stage && container && container.parentElement !== stage) {
            stage.appendChild(container);
        }
    }

    /**
     * Screen Switcher (SPA Machine)
     */
    function showScreen(name) {
        Object.keys(screens).forEach(k => {
            if (screens[k]) {
                screens[k].classList.remove('active');
            }
        });
        if (screens[name]) {
            screens[name].classList.add('active');
        }

        if (name === 'exploration') {
            attachStreetViewToStage('exp-sv-stage');
            if (streetViewPanorama) {
                // Re-enable walking in exploration
                streetViewPanorama.setOptions({
                    clickToGo: true,
                    linksControl: true,
                    addressControl: false,
                    panControl: true,
                    zoomControl: true
                });
                setTimeout(() => {
                    if (streetViewPanorama && window.google) {
                        google.maps.event.trigger(streetViewPanorama, 'resize');
                    }
                }, 60);
            }

            if (!isStartLocationChosen()) {
                const modal = document.getElementById('map-modal');
                if (!modal || !modal.classList.contains('active')) {
                    openMapModal(true);
                }
            } else {
                ensureStreetViewInitialized();
            }
        } else if (name === 'judgement') {
            attachStreetViewToStage('judge-sv-stage');
            setTimeout(() => {
                if (streetViewPanorama && window.google) {
                    google.maps.event.trigger(streetViewPanorama, 'resize');
                }
            }, 60);
        }
    }

    // Initialize Pusher Client with Logging enabled
    var cfg = window.GAMEHUB_CONFIG || {};
    var pusherKey = cfg.pusherKey || "";
    var pusherCluster = cfg.pusherCluster || "eu";

    if (window.Pusher) {
        Pusher.logToConsole = false; // Interne unformatierte Pusher-Logs deaktivieren!
    }

    var pusher = (window.Pusher && pusherKey) ? new Pusher(pusherKey, {
        cluster: pusherCluster,
        channelAuthorization: {
            endpoint: '/pusher/auth',
            headersProvider: function () {
                const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
                return token ? { 'X-Auth-Token': token } : {};
            }
        }
    }) : null;

    if (pusher) {
        pusher.connection.bind('state_change', function (states) {
            console.log('%c[GeoBingo Pusher Connection]', 'color: #38d9a9; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;', states.current);
        });
    }

    /**
     * Room Lifecycle & Pusher Integration
     */
    function initPusher(code) {
        if (!pusher) return;

        const channelName = `geobingo-${code}`;
        if (pusherChannel) {
            pusherChannel.unbind_all();
            pusher.unsubscribe(pusherChannel.name);
        }

        console.log('%c[GeoBingo] Subscribing:', 'color: #ffd43b; font-weight: bold; background: #2a2200; padding: 2px 6px; border-radius: 3px;', channelName);
        pusherChannel = pusher.subscribe(channelName);

        pusherChannel.bind('pusher:subscription_succeeded', function () {
            console.log('%c[GeoBingo] Pusher Channel verbunden! ✅', 'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;');
        });

        pusherChannel.bind('state-update', function (payload) {
            if (window.GameDelta) {
                window.GameDelta.logUpdate('GeoBingo', payload);
                gameState = window.GameDelta.apply(gameState, payload);
            } else {
                gameState = payload;
            }

            // Falls die Erkundung läuft, stellen wir sicher, dass eigene gesicherte Proofs erhalten bleiben
            if (gameState && gameState.status === 'playing' && gameState.phase === 'exploration') {
                if (!gameState.proofs) gameState.proofs = {};
                if (!gameState.proofs[currentUser]) gameState.proofs[currentUser] = {};
                Object.assign(gameState.proofs[currentUser], localMyProofs);
            } else if (gameState && gameState.status === 'lobby') {
                localMyProofs = {};
            }

            renderState(gameState);
        });

        pusherChannel.bind('game-reset', function (payload) {
            console.log('%c[GeoBingo Event: game-reset (In-Memory Rematch)]', 'color: #ff6b6b; font-weight: bold; background: #3a1a1a; padding: 2px 6px; border-radius: 3px;', payload);
            handleGameReset(payload ? payload.state : null);
        });

        pusherChannel.bind('chat-message', function (msg) {
            if (gameState) {
                if (!gameState.chat_messages) gameState.chat_messages = [];
                gameState.chat_messages.push(msg);
                renderChatMessages();
            }
        });
    }



    function startHeartbeat(code) {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (!currentRoomCode) return;
            $.post(`/geobingo/${currentRoomCode}/heartbeat`, { room_code: currentRoomCode }, function (res) {
                if (res && res.state) {
                    gameState = res.state;
                    renderState(gameState);
                }
            });
        }, 15000);
    }

    // --- Global Actions bound to window ---

    window.createRoom = function () {
        $.post('/geobingo/create_room', function (res) {
            if (res && res.success && res.room_code) {
                enterRoom(res.room_code);
            }
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Fehler beim Erstellen des Raumes.');
        });
    };

    window.joinRoomByInput = function () {
        const input = document.getElementById('input-room-code');
        const code = (input.value || '').trim().toUpperCase();
        if (!code) {
            alert('Bitte gib einen 4-stelligen Raumcode ein.');
            return;
        }
        enterRoom(code);
    };

    window.joinRoomDirect = function (code) {
        enterRoom(code);
    };

    function enterRoom(code) {
        currentRoomCode = code.toUpperCase();
        sessionStorage.setItem('geobingo_room', currentRoomCode);

        $.post(`/geobingo/${currentRoomCode}/join`, { room_code: currentRoomCode }, function (state) {
            gameState = state;
            initPusher(currentRoomCode);
            startHeartbeat(currentRoomCode);
            syncCustomWordsToRoom();

            // If I am host, sync custom items and initialize selection if empty
            if (state && state.host === currentUser && state.status === 'lobby') {
                const settings = state.settings || {};
                if (userCustomItems.length > 0 && (!settings.host_custom_items || settings.host_custom_items.length === 0)) {
                    updateSetting('host_custom_items', userCustomItems);
                }
                if (!settings.selected_items || settings.selected_items.length === 0) {
                    const count = Number(settings.item_count || 7);
                    const defaultSelection = (window.GEO_GLOBAL_ITEMS || []).slice(0, count);
                    updateSetting('selected_items', defaultSelection);
                }
            }

            renderState(gameState);
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Konnte Raum nicht beitreten.');
        });
    }

    window.leaveGame = function () {
        if (!currentRoomCode) return;
        const oldCode = currentRoomCode;
        $.post(`/geobingo/${currentRoomCode}/leave_game`, { room_code: currentRoomCode }, function () {
            sessionStorage.removeItem('geobingo_start_' + oldCode);
            currentRoomCode = null;
            sessionStorage.removeItem('geobingo_room');
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (timerInterval) clearInterval(timerInterval);
            showScreen('browser');
            loadRoomList();
        });
    };

    window.confirmLeaveGame = function () {
        if (confirm('Möchtest du das laufende Spiel wirklich verlassen?')) {
            window.leaveGame();
        }
    };

    window.updateSetting = function (key, val) {
        if (!currentRoomCode) return;
        const payload = { room_code: currentRoomCode };
        payload[key] = val;

        $.ajax({
            url: `/geobingo/${currentRoomCode}/update_settings`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (res) {
                if (res && res.settings && gameState) {
                    gameState.settings = res.settings;
                    renderLobbySettings(gameState.settings);
                }
            }
        });
    };

    // --- User Custom Items & Account Storage ---
    let userCustomItems = [];
    let currentPoolFilter = 'all';
    const collapsedPoolSections = new Set();

    function syncCustomWordsToRoom() {
        if (!currentRoomCode) return;
        $.post(`/geobingo/${currentRoomCode}/sync_custom_words`, {
            room_code: currentRoomCode,
            custom_items: userCustomItems
        }, function (res) {
            if (res && res.player_custom_items && gameState) {
                gameState.player_custom_items = res.player_custom_items;
                if (gameState.status === 'lobby') {
                    renderLobbyWordPool(gameState.settings || {});
                }
            }
        });
    }

    function loadUserCustomItems() {
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        fetch('/api/save/geobingo', {
            headers: token ? { 'X-Auth-Token': token } : {}
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.state && Array.isArray(data.state.custom_items)) {
                userCustomItems = data.state.custom_items;
                localStorage.setItem('geobingo_custom_items', JSON.stringify(userCustomItems));
            } else {
                const local = localStorage.getItem('geobingo_custom_items');
                if (local) {
                    try { userCustomItems = JSON.parse(local) || []; } catch(e) {}
                }
            }
            if (currentRoomCode) {
                syncCustomWordsToRoom();
            }
            if (gameState && gameState.status === 'lobby') {
                renderLobbySettings(gameState.settings || {});
            }
        })
        .catch(() => {
            const local = localStorage.getItem('geobingo_custom_items');
            if (local) {
                try { userCustomItems = JSON.parse(local) || []; } catch(e) {}
            }
            if (currentRoomCode) {
                syncCustomWordsToRoom();
            }
        });
    }

    function saveUserCustomItems() {
        localStorage.setItem('geobingo_custom_items', JSON.stringify(userCustomItems));
        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
        fetch('/api/save/geobingo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'X-Auth-Token': token } : {})
            },
            body: JSON.stringify({ state: { custom_items: userCustomItems } })
        }).catch(err => console.warn('[GeoBingo] Cloud save failed:', err));

        if (gameState && gameState.host === currentUser) {
            updateSetting('host_custom_items', userCustomItems);
        }
        syncCustomWordsToRoom();
    }

    window.setPoolFilter = function (filter) {
        currentPoolFilter = filter;
        document.querySelectorAll('#pool-filter-slider .geo-filter-opt').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
        });
        if (gameState && gameState.settings) {
            renderLobbyWordPool(gameState.settings);
        }
    };

    window.toggleAddCustomWordInput = function () {
        const box = document.getElementById('add-custom-word-box');
        if (!box) return;
        const isHidden = (box.style.display === 'none' || !box.style.display);
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            const inp = document.getElementById('input-new-custom-word');
            if (inp) inp.focus();
        }
    };

    window.submitNewCustomWord = function () {
        const inp = document.getElementById('input-new-custom-word');
        if (!inp) return;
        const word = (inp.value || '').trim();
        if (!word) return;

        if (!userCustomItems.includes(word)) {
            userCustomItems.push(word);
            saveUserCustomItems();
        }

        if (gameState && gameState.host === currentUser) {
            const selected = Array.from(gameState.settings.selected_items || []);
            if (!selected.includes(word)) {
                selected.push(word);
                updateSetting('selected_items', selected);
            }
        }

        inp.value = '';
        window.toggleAddCustomWordInput();
        if (gameState && gameState.settings) {
            renderLobbyWordPool(gameState.settings);
        }
    };

    window.deleteCustomWord = function (word, e) {
        if (e) e.stopPropagation();
        if (!confirm(`Möchtest du das Suchobjekt "${word}" wirklich aus deinem Konto löschen?`)) return;

        userCustomItems = userCustomItems.filter(w => w !== word);
        saveUserCustomItems();

        if (gameState && gameState.host === currentUser) {
            const selected = (gameState.settings.selected_items || []).filter(w => w !== word);
            updateSetting('selected_items', selected);
        }

        if (gameState && gameState.settings) {
            renderLobbyWordPool(gameState.settings);
        }
    };

    window.toggleWordSelection = function (word) {
        if (!gameState || gameState.host !== currentUser) return;
        const selected = Array.from(gameState.settings.selected_items || []);
        const idx = selected.indexOf(word);
        if (idx >= 0) {
            selected.splice(idx, 1);
        } else {
            selected.push(word);
        }
        updateSetting('selected_items', selected);
    };

    window.randomizeSelection = function () {
        if (!gameState || gameState.host !== currentUser) return;
        const targetCount = Number(gameState.settings.item_count || 7);
        const globalItems = window.GEO_GLOBAL_ITEMS || [];

        const allCustom = [];
        if (gameState.player_custom_items) {
            Object.values(gameState.player_custom_items).forEach(arr => {
                if (Array.isArray(arr)) allCustom.push(...arr);
            });
        }
        userCustomItems.forEach(w => {
            if (!allCustom.includes(w)) allCustom.push(w);
        });

        const pool = Array.from(new Set([...globalItems, ...allCustom]));
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, targetCount);
        updateSetting('selected_items', picked);
    };

    window.clearSelectedItems = function () {
        if (!gameState || gameState.host !== currentUser) return;
        updateSetting('selected_items', []);
    };

    window.startGame = function () {
        if (!currentRoomCode) return;
        const minPlayers = (window.GAME_CONFIG && window.GAME_CONFIG.min_players) || 2;
        if (gameState && gameState.players && gameState.players.length < minPlayers) {
            alert(`Mindestens ${minPlayers} Spieler erforderlich!`);
            return;
        }
        $.post(`/geobingo/${currentRoomCode}/start_game`, { room_code: currentRoomCode }, function () {
            // Screen transition handled via Pusher state-update
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Start fehlgeschlagen.');
        });
    };

    function handleGameReset(newState) {
        console.log('%c[GeoBingo Rematch] Wechsle zur Lobby ohne Page-Reload. Singleton-Maps bleiben erhalten! ✅', 'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;');

        if (timerInterval) clearInterval(timerInterval);

        if (currentRoomCode) {
            sessionStorage.removeItem('geobingo_start_' + currentRoomCode);
        }

        localMyProofs = {};
        closeMapModal();

        // Reset Screen Exploration DOM
        const expChecklist = document.getElementById('exp-checklist');
        if (expChecklist) expChecklist.innerHTML = '';
        const mapChecklist = document.getElementById('map-checklist');
        if (mapChecklist) mapChecklist.innerHTML = '';

        const expProofCounter = document.getElementById('exp-proof-counter');
        if (expProofCounter) expProofCounter.textContent = '0 / 7';
        const mapProofCounter = document.getElementById('map-proof-counter');
        if (mapProofCounter) mapProofCounter.textContent = '0 / 7';

        const myScoreDisplay = document.getElementById('my-score-display');
        if (myScoreDisplay) myScoreDisplay.textContent = '0';
        const oppScoreDisplay = document.getElementById('opp-score-display');
        if (oppScoreDisplay) oppScoreDisplay.textContent = 'GEGNER: 0';

        const expScreen = document.getElementById('screen-exploration');
        if (expScreen) expScreen.classList.remove('checklist-collapsed');

        const mapChecklistWrapper = document.getElementById('map-checklist-wrapper');
        if (mapChecklistWrapper) mapChecklistWrapper.classList.add('collapsed');

        // Reset Results & Judgement DOM
        const resultsTable = document.getElementById('results-score-body');
        if (resultsTable) resultsTable.innerHTML = '';
        const noProofOverlay = document.getElementById('judge-no-proof-overlay');
        if (noProofOverlay) noProofOverlay.style.display = 'none';

        // Re-attach Street View to exploration stage and enable walking
        attachStreetViewToStage('exp-sv-stage');
        if (streetViewPanorama) {
            streetViewPanorama.setOptions({
                clickToGo: true,
                linksControl: true,
                addressControl: false
            });
        }

        if (newState) {
            gameState = newState;
        } else if (gameState) {
            gameState.status = 'lobby';
            gameState.phase = 'lobby';
            gameState.proofs = {};
            gameState.completed_count = {};
            gameState.scores = {};
            gameState.winner = null;
            gameState.active_review = null;
        }

        renderState(gameState);
    }

    window.resetGame = function () {
        if (!currentRoomCode) return;
        $.post(`/geobingo/${currentRoomCode}/reset_game`, { room_code: currentRoomCode }, function (res) {
            if (res && res.state) {
                handleGameReset(res.state);
            }
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Fehler beim Zurücksetzen.');
        });
    };

    window.loadRoomList = function () {
        $.get('/geobingo/rooms', function (res) {
            const container = document.getElementById('room-list-container');
            if (!container) return;
            container.innerHTML = '';

            const rooms = res.rooms || [];
            if (rooms.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:15px; color:#777; font-size:0.85rem;">Keine offenen Räume gefunden. Erstelle den ersten!</div>';
                return;
            }

            rooms.forEach(r => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#1c2921; padding:10px 12px; border:2px solid #000; box-shadow:2px 2px 0px #000;';
                row.innerHTML = `
                    <div>
                        <div style="font-weight:900; color:var(--geo-sand); letter-spacing:1px;">#${r.room_code}</div>
                        <div style="font-size:0.75rem; color:#aaa;">Host: ${r.host_username || 'Unbekannt'} • ${r.player_count}/2 Spieler</div>
                    </div>
                    <button class="geo-btn geo-btn-primary" style="min-height:36px; padding:6px 14px; font-size:0.8rem; width:auto;" onclick="joinRoomDirect('${r.room_code}')">
                        BEITRETEN
                    </button>
                `;
                container.appendChild(row);
            });
        });
    };

    /**
     * Exploration: Capture Proof
     */
    window.captureItemProof = function (itemIdx) {
        if (!currentRoomCode || !gameState) return;

        let proof = {};
        if (streetViewPanorama && streetViewPanorama.getPano) {
            const panoId = streetViewPanorama.getPano();
            const pov = streetViewPanorama.getPov() || { heading: 0, pitch: 0 };
            const pos = streetViewPanorama.getPosition();
            const zoom = streetViewPanorama.getZoom() || 1;

            if (!panoId) {
                console.warn('[GeoBingo] Panorama lädt noch...');
                // Falls Pano noch nicht fertig, noch 200ms warten
                setTimeout(() => {
                    const retryPano = streetViewPanorama.getPano();
                    if (retryPano) {
                        window.captureItemProof(itemIdx);
                    } else {
                        alert('Street View lädt gerade noch. Bitte kurz warten und erneut tippen.');
                    }
                }, 250);
                return;
            }

            proof = {
                pano_id: panoId,
                lat: pos ? pos.lat() : 0,
                lng: pos ? pos.lng() : 0,
                heading: pov.heading || 0,
                pitch: pov.pitch || 0,
                zoom: zoom,
                fov: 180 / Math.pow(2, zoom)
            };
        } else {
            proof = {
                pano_id: 'pending_pano',
                lat: currentLat,
                lng: currentLng,
                heading: 0,
                pitch: 0,
                zoom: 1,
                fov: 90
            };
        }

        proof.item_idx = itemIdx;
        proof.room_code = currentRoomCode;

        // Sofort im lokalen State markieren, damit der Haken stabil bleibt
        if (!gameState.proofs) gameState.proofs = {};
        if (!gameState.proofs[currentUser]) gameState.proofs[currentUser] = {};
        gameState.proofs[currentUser][String(itemIdx)] = proof;
        localMyProofs[String(itemIdx)] = proof;

        // Optisches Feedback direkt setzen
        const row = document.getElementById(`item-row-${itemIdx}`);
        if (row) {
            row.classList.add('is-done');
            const tag = row.querySelector('.geo-item-status-tag');
            if (tag) tag.textContent = '✓ FOTO GESPEICHERT';
        }

        $.post(`/geobingo/${currentRoomCode}/save_proof`, proof, function (res) {
            if (res && res.proofs_for_me) {
                gameState.proofs[currentUser] = res.proofs_for_me;
                localMyProofs = Object.assign({}, res.proofs_for_me);
            }
            renderExploration(gameState);
        }).fail(function (xhr) {
            // Bei Fehler zurücksetzen
            delete gameState.proofs[currentUser][String(itemIdx)];
            delete localMyProofs[String(itemIdx)];
            renderExploration(gameState);
            alert(xhr.responseJSON?.error || 'Fehler beim Speichern des Fotos.');
        });
    };


    /**
     * Judgement: Cast Vote
     */
    window.castVote = function (approved) {
        if (!currentRoomCode || !gameState || !gameState.active_review) return;

        const rev = gameState.active_review;
        $.post(`/geobingo/${currentRoomCode}/submit_judgement`, {
            room_code: currentRoomCode,
            target_player: rev.target_player,
            item_idx: rev.item_index,
            approved: approved
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Abstimmung fehlgeschlagen.');
        });
    };

    /**
     * Judgement Chat: Send Message
     */
    window.sendJudgeChatMessage = function () {
        const input = document.getElementById('input-judge-chat');
        if (!input || !currentRoomCode) return;
        const text = (input.value || '').trim();
        if (!text) return;

        input.value = '';
        $.post(`/geobingo/${currentRoomCode}/send_chat`, {
            room_code: currentRoomCode,
            message: text
        }).fail(function (xhr) {
            alert(xhr.responseJSON?.error || 'Fehler beim Senden der Nachricht.');
        });
    };

    function renderChatMessages() {
        const container = document.getElementById('judge-chat-messages');
        if (!container || !gameState) return;

        const messages = gameState.chat_messages || [];
        container.innerHTML = '';

        if (messages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'geo-chat-empty';
            empty.textContent = 'Noch keine Nachrichten. Schreibt hier, um euch zu einigen!';
            container.appendChild(empty);
            return;
        }

        messages.forEach(m => {
            const isMe = (m.sender === currentUser);
            const el = document.createElement('div');
            el.className = `geo-chat-msg ${isMe ? 'is-me' : 'is-other'}`;

            const meta = document.createElement('div');
            meta.className = 'geo-chat-meta';
            meta.innerHTML = `<span>${isMe ? 'Du' : escapeHtml(m.sender)}</span><span class="geo-chat-time">${escapeHtml(m.time || '')}</span>`;

            const txt = document.createElement('div');
            txt.className = 'geo-chat-text';
            txt.textContent = m.text || '';

            el.appendChild(meta);
            el.appendChild(txt);
            container.appendChild(el);
        });

        container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Rendering Logic according to Game State
     */
    function renderState(state) {
        if (!state) return;

        // Display Active Room Codes
        document.querySelectorAll('.active-room-code').forEach(el => el.textContent = state.room_code || '----');
        const lobbyBadge = document.getElementById('lobby-code-badge');
        if (lobbyBadge) lobbyBadge.textContent = state.room_code || '----';

        const status = state.status || 'lobby';
        const phase = state.phase || 'lobby';

        if (status === 'lobby') {
            if (currentRoomCode) {
                sessionStorage.removeItem('geobingo_start_' + currentRoomCode);
            }
            showScreen('lobby');
            renderLobby(state);
        } else if (status === 'playing' && phase === 'exploration') {
            showScreen('exploration');
            renderExploration(state);
        } else if (status === 'judging') {
            showScreen('judgement');
            renderJudgement(state);
        } else if (status === 'finished') {
            showScreen('results');
            renderResults(state);
        }
    }

    function renderLobby(state) {
        const grid = document.getElementById('lobby-players-grid');
        if (grid) {
            grid.innerHTML = '';
            (state.players || []).forEach(p => {
                const isHost = (p === state.host);
                const badge = document.createElement('div');
                badge.className = `geo-player-badge ${isHost ? 'is-host' : ''}`;
                badge.innerHTML = `<span>${isHost ? '⭐' : '👤'}</span> <span>${p}</span>`;
                grid.appendChild(badge);
            });
        }

        renderLobbySettings(state.settings || {});

        const isHost = (currentUser === state.host);
        const btnStart = document.getElementById('btn-start-game');
        const waitMsg = document.getElementById('lobby-wait-msg');

        if (btnStart && waitMsg) {
            if (isHost) {
                const playerCount = (state.players || []).length;
                const minPlayers = (window.GAME_CONFIG && window.GAME_CONFIG.min_players) || 2;
                btnStart.style.display = 'flex';
                if (playerCount < minPlayers) {
                    btnStart.disabled = true;
                    btnStart.style.opacity = '0.5';
                    btnStart.style.cursor = 'not-allowed';
                    btnStart.textContent = `▶ WARTE AUF MITSPIELER (MIN. ${minPlayers})`;
                } else {
                    btnStart.disabled = false;
                    btnStart.style.opacity = '1';
                    btnStart.style.cursor = 'pointer';
                    btnStart.textContent = '▶ SPIEL STARTEN';
                }
                waitMsg.style.display = 'none';
            } else {
                btnStart.style.display = 'none';
                waitMsg.style.display = 'block';
                waitMsg.textContent = `Warte auf Host (${state.host || 'Spielleiter'})...`;
            }
        }
    }

    function renderLobbyWordPool(settings) {
        const poolContainer = document.getElementById('lobby-word-pool');
        if (!poolContainer) return;

        const isHost = (currentUser === (gameState ? gameState.host : null));
        const globalItems = window.GEO_GLOBAL_ITEMS || [];
        const selectedItems = settings.selected_items || [];
        const targetCount = Number(settings.item_count || 7);

        // Update selected items counter badge
        const counterBadge = document.getElementById('pool-selected-counter');
        if (counterBadge) {
            counterBadge.textContent = `${selectedItems.length} / ${targetCount} GEWÄHLT`;
            if (selectedItems.length >= targetCount) {
                counterBadge.style.background = 'var(--geo-green-bright)';
                counterBadge.style.color = '#000';
            } else {
                counterBadge.style.background = '#000';
                counterBadge.style.color = 'var(--geo-sand)';
            }
        }

        // Active players in lobby
        const players = (gameState && gameState.players && gameState.players.length) ? gameState.players : [currentUser];

        // Gather all custom items per player
        const playerCustomMap = {};
        if (gameState && gameState.player_custom_items) {
            Object.keys(gameState.player_custom_items).forEach(p => {
                const arr = gameState.player_custom_items[p];
                playerCustomMap[p] = Array.isArray(arr) ? [...arr] : [];
            });
        }
        // Ensure every lobby player has an entry in the map
        players.forEach(p => {
            if (!playerCustomMap[p]) playerCustomMap[p] = [];
        });
        // Merge current user's local userCustomItems into their own section
        if (currentUser) {
            if (!playerCustomMap[currentUser]) playerCustomMap[currentUser] = [];
            userCustomItems.forEach(w => {
                if (!playerCustomMap[currentUser].includes(w)) {
                    playerCustomMap[currentUser].push(w);
                }
            });
        }

        // Dynamically update filter slider buttons
        const filterSlider = document.getElementById('pool-filter-slider');
        if (filterSlider) {
            const filterDefs = [
                { key: 'all', label: 'ALLE' },
                { key: 'global', label: 'GLOBAL' }
            ];
            players.forEach(p => {
                const isMe = (p === currentUser);
                filterDefs.push({
                    key: `player_${p}`,
                    label: isMe ? `${p.toUpperCase()} (DU)` : p.toUpperCase()
                });
            });

            const validKeys = filterDefs.map(f => f.key);
            if (!validKeys.includes(currentPoolFilter)) {
                currentPoolFilter = 'all';
            }

            filterSlider.innerHTML = '';
            filterDefs.forEach(f => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `geo-filter-opt ${currentPoolFilter === f.key ? 'active' : ''}`;
                btn.setAttribute('data-filter', f.key);
                btn.textContent = f.label;
                btn.onclick = () => window.setPoolFilter(f.key);
                filterSlider.appendChild(btn);
            });
        }

        poolContainer.innerHTML = '';

        // Helper to create a single word chip
        function createChip(item, owner) {
            const isSelected = selectedItems.includes(item);
            const isMyCustom = (owner === currentUser);

            const chip = document.createElement('div');
            chip.className = `geo-word-chip ${isSelected ? 'is-selected' : ''} ${!isHost ? 'is-readonly' : ''}`;
            if (isHost) {
                chip.onclick = () => window.toggleWordSelection(item);
            }
            chip.innerHTML = `<span>${item}</span>`;

            if (isMyCustom) {
                const delBtn = document.createElement('span');
                delBtn.className = 'geo-chip-delete';
                delBtn.title = 'Wort löschen';
                delBtn.textContent = '✕';
                delBtn.onclick = (e) => window.deleteCustomWord(item, e);
                chip.appendChild(delBtn);
            }
            return chip;
        }

        // Helper to append a section with small header and collapse/expand toggle
        function appendSection(secKey, title, countText, isGlobal, items, owner) {
            const sec = document.createElement('div');
            const isCollapsed = collapsedPoolSections.has(secKey);
            sec.className = `geo-pool-section ${isCollapsed ? 'is-collapsed' : ''}`;

            const header = document.createElement('div');
            header.className = `geo-pool-section-header ${isGlobal ? 'is-global' : ''}`;
            header.title = 'Klicken zum Ein-/Ausklappen';
            header.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span class="geo-pool-section-toggle-icon">${isCollapsed ? '▶' : '▼'}</span>
                    <span>${title}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="geo-pool-section-count">${countText}</span>
                    <span style="font-size: 0.65rem; color: #888; font-weight: 700;">[${isCollapsed ? 'AUSKLAPPEN' : 'EINKLAPPEN'}]</span>
                </div>
            `;

            header.onclick = function () {
                if (collapsedPoolSections.has(secKey)) {
                    collapsedPoolSections.delete(secKey);
                } else {
                    collapsedPoolSections.add(secKey);
                }
                renderLobbyWordPool(settings);
            };

            sec.appendChild(header);

            const chipsWrap = document.createElement('div');
            chipsWrap.className = 'geo-pool-section-chips';
            if (isCollapsed) {
                chipsWrap.style.display = 'none';
            }

            if (!items || items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'geo-pool-empty-hint';
                empty.textContent = (owner === currentUser)
                    ? 'Noch keine eigenen Wörter angelegt. Tippe oben auf "+ NEU"!'
                    : 'Keine eigenen Wörter angelegt.';
                chipsWrap.appendChild(empty);
            } else {
                items.forEach(item => {
                    chipsWrap.appendChild(createChip(item, owner));
                });
            }

            sec.appendChild(chipsWrap);
            poolContainer.appendChild(sec);
        }

        // Render based on current pool filter
        if (currentPoolFilter === 'all') {
            // Sektion 1: Global
            appendSection('global', '🌐 GLOBAL', `${globalItems.length} Begriffe`, true, globalItems, null);

            // Sektion 2+: Eigene Bereiche für jeden Spieler mit dessen Namen als Überschrift
            players.forEach(p => {
                const pItems = playerCustomMap[p] || [];
                const isMe = (p === currentUser);
                appendSection(`player_${p}`, `👤 ${p.toUpperCase()}${isMe ? ' (DU)' : ''}`, `${pItems.length} Begriffe`, false, pItems, p);
            });
        } else if (currentPoolFilter === 'global') {
            appendSection('global', '🌐 GLOBAL', `${globalItems.length} Begriffe`, true, globalItems, null);
        } else if (currentPoolFilter.startsWith('player_')) {
            const targetP = currentPoolFilter.replace('player_', '');
            const pItems = playerCustomMap[targetP] || [];
            const isMe = (targetP === currentUser);
            appendSection(`player_${targetP}`, `👤 ${targetP.toUpperCase()}${isMe ? ' (DU)' : ''}`, `${pItems.length} Begriffe`, false, pItems, targetP);
        } else {
            // Fallback
            appendSection('global', '🌐 GLOBAL', `${globalItems.length} Begriffe`, true, globalItems, null);
            players.forEach(p => {
                const pItems = playerCustomMap[p] || [];
                appendSection(`player_${p}`, `👤 ${p.toUpperCase()}${p === currentUser ? ' (DU)' : ''}`, `${pItems.length} Begriffe`, false, pItems, p);
            });
        }
    }

    function renderLobbySettings(settings) {
        // Render Word Pool
        renderLobbyWordPool(settings);

        // Count
        const count = String(settings.item_count || 7);
        document.querySelectorAll('#ctrl-count .geo-selector-opt').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-val') === count);
        });

        // Time
        const timeVal = String(settings.time_limit !== undefined ? settings.time_limit : 600);
        document.querySelectorAll('#ctrl-time .geo-selector-opt').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-val') === timeVal);
        });
    }

    function renderExploration(state) {
        // Render Checklist
        const checklist = document.getElementById('exp-checklist');
        if (checklist && state.items) {
            checklist.innerHTML = '';
            const myProofs = (state.proofs && state.proofs[currentUser]) || {};

            state.items.forEach((item, idx) => {
                const isDone = Boolean(myProofs[String(idx)]);
                const row = document.createElement('div');
                row.id = `item-row-${idx}`;
                row.className = `geo-item-row ${isDone ? 'is-done' : ''}`;
                row.onclick = () => captureItemProof(idx);
                row.innerHTML = `
                    <div class="geo-item-text">
                        <span>${isDone ? '✅' : '📷'}</span>
                        <span>${item}</span>
                    </div>
                    <div class="geo-item-status-tag">
                        ${isDone ? '✓ GESPEICHERT' : 'TIPPE ZUM FOTO'}
                    </div>
                `;
                checklist.appendChild(row);
            });
        }

        // Scores & Counter
        const myCount = (state.completed_count && state.completed_count[currentUser]) || 0;
        const total = (state.items || []).length;
        document.getElementById('exp-proof-counter').textContent = `${myCount} / ${total}`;
        document.getElementById('my-score-display').textContent = `${myCount} / ${total}`;

        const otherPlayers = (state.players || []).filter(p => p !== currentUser);
        const oppEl = document.getElementById('opp-score-display');
        if (oppEl) {
            if (otherPlayers.length === 1) {
                const opp = otherPlayers[0];
                const oppCount = (state.completed_count && state.completed_count[opp]) || 0;
                oppEl.textContent = `${opp}: ${oppCount}/${total}`;
            } else if (otherPlayers.length > 1) {
                const summary = otherPlayers.map(p => `${p}: ${(state.completed_count && state.completed_count[p]) || 0}/${total}`).join(' | ');
                oppEl.textContent = summary;
            } else {
                oppEl.textContent = 'GEGNER: 0';
            }
        }

        // Timer & Rush countdown
        updateTimerDisplay(state.exploration_end_time, state.rush_countdown, state.rush_player);

        // Synchronize Map Modal Checklist
        renderMapChecklist(state);
    }

    function updateTimerDisplay(endTime, isRush, rushPlayer) {
        const el = document.getElementById('exp-timer-display');
        if (el) {
            el.classList.toggle('is-rush', Boolean(isRush));
            if (isRush) {
                el.title = `RUSH! ${rushPlayer || 'Ein Spieler'} hat alle Items gefunden! 10 Sekunden verbleiben!`;
            } else {
                el.title = '';
            }
        }

        if (!endTime) {
            if (el) el.textContent = '∞';
            return;
        }

        function tick() {
            const now = Date.now() / 1000;
            const diff = Math.max(0, Math.floor(endTime - now));
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            const displayEl = document.getElementById('exp-timer-display');
            if (displayEl) displayEl.textContent = str;

            if (diff <= 0) {
                if (timerInterval) clearInterval(timerInterval);
                if (currentRoomCode) {
                    $.post('/geobingo/' + currentRoomCode + '/check_timer');
                }
            }
        }

        tick();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(tick, 1000);
    }

    window.zoomJudge = function (delta) {
        if (!streetViewPanorama) return;
        const currentZoom = streetViewPanorama.getZoom() || 1;
        streetViewPanorama.setZoom(Math.max(0, Math.min(5, currentZoom + delta)));
    };

    function renderJudgement(state) {
        if (timerInterval) clearInterval(timerInterval);

        const rev = state.active_review;
        if (!rev) return;

        document.getElementById('judge-step-indicator').textContent = `${rev.item_index + 1} / ${rev.total_items}`;
        document.getElementById('judge-item-name').textContent = rev.item_name || 'Suchobjekt';
        document.getElementById('judge-target-name').textContent = rev.target_player || 'Spieler';

        // Re-use live Street View container inside judging stage
        attachStreetViewToStage('judge-sv-stage');

        const noProofOverlay = document.getElementById('judge-no-proof-overlay');

        if (!rev.proof || !rev.proof.pano_id) {
            if (noProofOverlay) noProofOverlay.style.display = 'flex';
        } else {
            if (noProofOverlay) noProofOverlay.style.display = 'none';

            if (streetViewPanorama) {
                // Camera lock: Drag is blocked via transparent overlay, panControl disabled, zoom only
                streetViewPanorama.setOptions({
                    clickToGo: false,
                    linksControl: false,
                    addressControl: false,
                    panControl: false,
                    zoomControl: false,
                    enableCloseButton: false,
                    motionTracking: false,
                    motionTrackingControl: false
                });

                const targetHeading = Number(rev.proof.heading) || 0;
                const targetPitch = Number(rev.proof.pitch) || 0;

                streetViewPanorama.setPano(rev.proof.pano_id);
                streetViewPanorama.setPov({
                    heading: targetHeading,
                    pitch: targetPitch
                });

                const targetZoom = (rev.proof.zoom !== undefined) ? Number(rev.proof.zoom) : (rev.proof.fov ? Math.round(Math.log2(180 / Math.max(10, Number(rev.proof.fov)))) : 1);
                streetViewPanorama.setZoom(targetZoom);

                setTimeout(() => {
                    if (streetViewPanorama && window.google) {
                        google.maps.event.trigger(streetViewPanorama, 'resize');
                        streetViewPanorama.setPov({
                            heading: targetHeading,
                            pitch: targetPitch
                        });
                        streetViewPanorama.setZoom(targetZoom);
                    }
                }, 60);
            }
        }

        // --- Voting Controls, Consensus Check & Live Voter Status ---
        const btnYes = document.getElementById('btn-judge-yes');
        const btnNo = document.getElementById('btn-judge-no');
        const voteMsg = document.getElementById('judge-vote-msg');
        const votersList = document.getElementById('judge-voters-list');
        const disBox = document.getElementById('judge-disagreement-box');

        const votes = rev.votes || {};
        const votedPlayers = rev.voted_players || Object.keys(votes);
        const myVote = (rev.my_vote !== undefined) ? rev.my_vote : (votes[currentUser] !== undefined ? votes[currentUser] : null);
        const totalVoters = rev.total_voters || (state.players || []).length;
        const isDisagreement = Boolean(rev.is_disagreement);

        // Disagreement Warning Box & Agreement Chat
        const chatBox = document.getElementById('judge-chat-box');
        if (disBox) {
            if (isDisagreement) {
                disBox.style.display = 'flex';
                disBox.innerHTML = `
                    <span style="font-size: 1.2rem;">⚠️</span>
                    <div>
                        <strong>UNEINIG (${rev.yes_count || 0}x ZÄHLT vs. ${rev.no_count || 0}x NEIN):</strong>
                        Ihr müsst euch einig werden, bevor es weitergeht! Nutzt den Chat unten zur Absprache.
                    </div>
                `;
                if (chatBox) {
                    chatBox.style.display = 'flex';
                    renderChatMessages();
                }
            } else {
                disBox.style.display = 'none';
                if (chatBox) {
                    chatBox.style.display = 'none';
                }
            }
        }

        // Highlight selected vote button for currentUser
        if (btnYes && btnNo) {
            btnYes.classList.remove('is-active', 'is-dimmed');
            btnNo.classList.remove('is-active', 'is-dimmed');

            if (myVote === true) {
                btnYes.classList.add('is-active');
                btnNo.classList.add('is-dimmed');
            } else if (myVote === false) {
                btnNo.classList.add('is-active');
                btnYes.classList.add('is-dimmed');
            }
        }

        // Progress status text
        if (voteMsg) {
            if (isDisagreement) {
                voteMsg.textContent = 'Uneinig! Klicke auf ZÄHLT oder NEIN, um deine Stimme anzupassen.';
                voteMsg.style.color = '#ff8787';
            } else if (myVote !== null && myVote !== undefined) {
                if (votedPlayers.length >= totalVoters) {
                    voteMsg.textContent = '✓ Auswertung...';
                    voteMsg.style.color = 'var(--geo-green-bright)';
                } else {
                    voteMsg.textContent = `✓ Deine Stimme ist gespeichert (${myVote ? 'ZÄHLT' : 'NEIN'}). Warte auf Mitspieler... (${votedPlayers.length}/${totalVoters})`;
                    voteMsg.style.color = 'var(--geo-sand)';
                }
            } else {
                voteMsg.textContent = `Bitte abstimmen! (${votedPlayers.length}/${totalVoters} Stimmen)`;
                voteMsg.style.color = 'var(--geo-sand)';
            }
        }

        // Voter badges per player
        if (votersList && state.players) {
            votersList.innerHTML = '';
            state.players.forEach(p => {
                const hasVoted = (p in votes);
                const pVote = votes[p];
                const badge = document.createElement('div');
                const isMe = (p === currentUser);

                if (hasVoted) {
                    if (pVote === true) {
                        badge.className = 'geo-voter-badge has-voted-yes';
                        badge.innerHTML = `<span>✓</span> <span>${p}${isMe ? ' (Du)' : ''}: ZÄHLT</span>`;
                    } else {
                        badge.className = 'geo-voter-badge has-voted-no';
                        badge.innerHTML = `<span>✕</span> <span>${p}${isMe ? ' (Du)' : ''}: NEIN</span>`;
                    }
                } else {
                    badge.className = 'geo-voter-badge is-waiting';
                    badge.innerHTML = `<span>⏳</span> <span>${p}${isMe ? ' (Du)' : ''}: WARTET</span>`;
                }
                votersList.appendChild(badge);
            });
        }
    }

    function renderResults(state) {
        if (timerInterval) clearInterval(timerInterval);

        const winnerEl = document.getElementById('results-winner-text');
        if (winnerEl) {
            winnerEl.textContent = state.winner ? (state.winner === 'Unentschieden' ? 'UNENTSCHIEDEN!' : `${state.winner} GEWINNT!`) : 'SPIEL BEENDET';
        }

        const tbody = document.getElementById('results-score-body');
        if (tbody && state.scores) {
            tbody.innerHTML = '';
            Object.keys(state.scores).forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>👤 ${p}</td>
                    <td style="text-align:right; color:var(--geo-sand); font-weight:900; font-size:1.1rem;">
                        ${state.scores[p]} Punkte
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    /**
     * Maps Request Logger (Application-internal tracking)
     */
    const loggedMapsEvents = {};
    function logMapsUsage(action, details) {
        const eventKey = action + (details && details.room_code ? ('_' + details.room_code) : '');
        if (loggedMapsEvents[eventKey]) return;
        loggedMapsEvents[eventKey] = true;

        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token') || '';
        const userObj = window.GAMEHUB_USER || (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) || null;
        const username = (userObj && userObj.username) ? userObj.username : currentUser;

        try {
            fetch('/api/logs/maps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': token
                },
                credentials: 'same-origin',
                keepalive: true,
                body: JSON.stringify({
                    action: action,
                    page: window.location.pathname,
                    token: token,
                    username: username,
                    details: details || {}
                })
            }).catch(function (err) {
                console.warn('[GeoBingo] Maps logging request failed:', err);
            });
        } catch (e) {
            console.warn('[GeoBingo] Maps logging exception:', e);
        }
    }

    /**
     * Maps Rate Limiting & Pre-Check Client Guard
     */
    let isMapsBlocked = false;
    let mapsCooldownTimer = null;

    function formatRemainingTime(seconds) {
        if (seconds < 0) return 'Dauerhaft';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function showMapsCooldownBanner(stageContainer, penaltyInfo) {
        if (!stageContainer) return;
        let overlay = stageContainer.querySelector('.geo-cooldown-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'geo-cooldown-overlay';
            overlay.style.cssText = `
                position: absolute;
                inset: 0;
                background: rgba(18, 18, 24, 0.95);
                z-index: 999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 24px;
                color: #fff;
                font-family: inherit;
            `;
            stageContainer.style.position = 'relative';
            stageContainer.appendChild(overlay);
        }

        const isPerma = Boolean(penaltyInfo && penaltyInfo.is_permanent);
        let remaining = penaltyInfo && penaltyInfo.cooldown_seconds ? Number(penaltyInfo.cooldown_seconds) : 60;
        const strike = penaltyInfo && penaltyInfo.strike_count ? penaltyInfo.strike_count : 1;

        function renderContent() {
            if (isPerma) {
                overlay.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 12px;">🚫</div>
                    <div style="color: #ff6b6b; font-weight: 900; font-size: 1.3rem; letter-spacing: 1px; margin-bottom: 8px;">
                        KARTENZUGANG DAUERHAFT GESPERRT
                    </div>
                    <div style="color: #ccc; max-width: 420px; font-size: 0.9rem; line-height: 1.5;">
                        Aufgrund wiederholten Neuladens (F5-Spam) wurde dein Google Maps Kontingent gesperrt.<br>
                        Bitte wende dich an einen Administrator.
                    </div>
                `;
            } else {
                overlay.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 12px;">⏳</div>
                    <div style="color: #fcc419; font-weight: 900; font-size: 1.2rem; letter-spacing: 1px; margin-bottom: 6px;">
                        RATE-LIMIT: ZU VIELE KARTENAUFRUFE
                    </div>
                    <div style="font-size: 0.85rem; color: #aaa; margin-bottom: 16px;">
                        Sperrstufe: <strong>${strike} von 4</strong>
                    </div>
                    <div style="background: rgba(0,0,0,0.5); border: 2px solid #fcc419; border-radius: 8px; padding: 12px 24px; margin-bottom: 16px;">
                        <span style="font-size: 0.8rem; color: #bbb; display: block; font-weight: 700;">VERBLEIBENDE WARTEZEIT</span>
                        <strong style="font-size: 2rem; color: #fff; font-family: monospace; letter-spacing: 2px;">
                            ${formatRemainingTime(remaining)}
                        </strong>
                    </div>
                    <div style="color: #888; font-size: 0.8rem; max-width: 380px;">
                        Bitte vermeide wiederholtes Neuladen der Seite, um weitere Eskalationsstufen zu verhindern.
                    </div>
                `;
            }
        }

        renderContent();

        if (!isPerma) {
            if (mapsCooldownTimer) clearInterval(mapsCooldownTimer);
            mapsCooldownTimer = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearInterval(mapsCooldownTimer);
                    mapsCooldownTimer = null;
                    isMapsBlocked = false;
                    if (overlay && overlay.parentElement) {
                        overlay.parentElement.removeChild(overlay);
                    }
                } else {
                    renderContent();
                }
            }, 1000);
        }
    }

    function checkMapsAccess(onAllowed) {
        if (isMapsBlocked) return;

        const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token') || '';
        const userObj = window.GAMEHUB_USER || (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) || null;
        const username = (userObj && userObj.username) ? userObj.username : currentUser;

        fetch('/api/logs/maps/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': token
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                token: token,
                username: username
            })
        }).then(function (res) {
            return res.json().then(function (data) {
                return { status: res.status, data: data };
            });
        }).then(function (result) {
            if (result.status === 200 && result.data && result.data.allowed) {
                isMapsBlocked = false;
                if (onAllowed) onAllowed();
            } else if (result.status === 429 || (result.data && !result.data.allowed)) {
                isMapsBlocked = true;
                const svStage = document.getElementById('streetview-container') || document.getElementById('exp-sv-stage');
                const pickerStage = document.getElementById('picker-map-container');
                if (svStage) showMapsCooldownBanner(svStage, result.data);
                if (pickerStage) showMapsCooldownBanner(pickerStage, result.data);
            }
        }).catch(function (err) {
            console.warn('[GeoBingo] checkMapsAccess network check failed, allowing fallback:', err);
            if (onAllowed) onAllowed();
        });
    }

    /**
     * ==========================================================================
     * SINGLETON MANAGERS: Street View & 2D Picker Map
     * ==========================================================================
     */
    function ensureStreetViewInitialized(initialPanoOrLatLng) {
        const container = document.getElementById('streetview-container');
        if (!container) return;

        // Instantiated once when Google Maps SDK is loaded
        if (!streetViewPanorama && window.google && window.google.maps) {
            checkMapsAccess(function () {
                if (streetViewPanorama) return;
                const options = {
                    pov: { heading: 0, pitch: 0 },
                    zoom: 1,
                    addressControl: false,
                    showRoadLabels: false,
                    motionTracking: false,
                    motionTrackingControl: false
                };
                if (typeof initialPanoOrLatLng === 'string') {
                    options.pano = initialPanoOrLatLng;
                } else if (initialPanoOrLatLng && initialPanoOrLatLng.lat) {
                    options.position = initialPanoOrLatLng;
                } else {
                    options.position = { lat: currentLat, lng: currentLng };
                }
                streetViewPanorama = new google.maps.StreetViewPanorama(container, options);
                logMapsUsage('streetview_init', { room_code: currentRoomCode });
            });
        } else if (streetViewPanorama && initialPanoOrLatLng) {
            if (typeof initialPanoOrLatLng === 'string') {
                streetViewPanorama.setPano(initialPanoOrLatLng);
            } else if (initialPanoOrLatLng.lat) {
                streetViewPanorama.setPosition(initialPanoOrLatLng);
            }
        }
    }

    /**
     * 2D MAP PICKER & COVERAGE LAYER (Singleton)
     */
    function initPickerMap() {
        const mapContainer = document.getElementById('picker-map-container');
        if (!mapContainer || !window.google || !window.google.maps) return;

        // Real 2D Map with Street View Coverage Layer (Only instantiated ONCE)
        if (!pickerMap) {
            checkMapsAccess(function () {
                if (pickerMap) return;
                pickerMap = new google.maps.Map(mapContainer, {
                    center: { lat: currentLat, lng: currentLng },
                    zoom: 4,
                    mapTypeId: 'roadmap',
                    disableDefaultUI: false,
                    streetViewControl: false, // Pegman komplett deaktiviert - spart API-Kosten & verhindert Doppel-Panorama!
                    zoomControl: true,
                    fullscreenControl: false,
                    mapTypeControl: false
                });
                logMapsUsage('picker_map_init', { room_code: currentRoomCode });

                // Activate official blue Street View coverage line overlay
                coverageLayer = new google.maps.StreetViewCoverageLayer();
                coverageLayer.setMap(pickerMap);

                streetViewService = new google.maps.StreetViewService();

                // When user taps anywhere on the 2D map
                pickerMap.addListener('click', function (e) {
                    const clickedLatLng = e.latLng;
                    // Query nearest panorama within 250m to avoid black screens
                    streetViewService.getPanorama({
                        location: clickedLatLng,
                        radius: 250,
                        source: google.maps.StreetViewSource.OUTDOOR
                    }, function (data, status) {
                        if (status === google.maps.StreetViewStatus.OK && data && data.location) {
                            if (currentRoomCode) {
                                sessionStorage.setItem('geobingo_start_' + currentRoomCode, '1');
                            }
                            if (data.location.latLng) {
                                currentLat = data.location.latLng.lat();
                                currentLng = data.location.latLng.lng();
                            }
                            ensureStreetViewInitialized(data.location.pano);
                            closeMapModal();
                        } else {
                            alert('An dieser Stelle ist leider kein Street View verfügbar. Bitte tippe direkt auf eine blaue Straße!');
                        }
                    });
                });
            });
        }

        setTimeout(() => {
            if (pickerMap && window.google && window.google.maps) {
                google.maps.event.trigger(pickerMap, 'resize');
                pickerMap.setCenter({ lat: currentLat, lng: currentLng });
            }
        }, 150);
    }

    window.openMapModal = function (isStart) {
        const modal = document.getElementById('map-modal');
        if (modal) modal.classList.add('active');

        const modalTitle = document.getElementById('map-modal-title');
        const modalHint = document.getElementById('map-modal-hint');

        if (isStart || !isStartLocationChosen()) {
            if (modalTitle) modalTitle.innerHTML = '🗺️ STARTORT WÄHLEN';
            if (modalHint) modalHint.innerHTML = 'Tippe auf eine <strong>blaue Straße</strong>, um dein Spiel an diesem Ort zu beginnen!';
        } else {
            if (modalTitle) modalTitle.innerHTML = '🗺️ ORT WECHSELN';
            if (modalHint) modalHint.innerHTML = 'Tippe auf eine <strong>blaue Linie</strong>, um dich dorthin zu teleportieren!';
        }

        renderMapChecklist(gameState);
        initPickerMap();
    };

    window.closeMapModal = function () {
        const modal = document.getElementById('map-modal');
        if (modal) modal.classList.remove('active');
    };

    window.handleMapModalClose = function () {
        if (!isStartLocationChosen()) {
            if (confirm('Du hast noch keinen Startort gewählt. Möchtest du das laufende Spiel verlassen?')) {
                window.leaveGame();
            }
        } else {
            window.closeMapModal();
        }
    };

    /**
     * Map Modal Checklist Renderer
     */
    function renderMapChecklist(state) {
        const mapChecklist = document.getElementById('map-checklist');
        if (!mapChecklist || !state || !state.items) return;

        mapChecklist.innerHTML = '';
        const myProofs = (state.proofs && state.proofs[currentUser]) || {};

        state.items.forEach((item, idx) => {
            const isDone = Boolean(myProofs[String(idx)]);
            const row = document.createElement('div');
            row.className = `geo-item-row ${isDone ? 'is-done' : ''}`;
            row.style.minHeight = '38px';
            row.style.padding = '6px 10px';
            row.style.cursor = 'default';
            row.innerHTML = `
                <div class="geo-item-text" style="font-size:0.85rem;">
                    <span>${isDone ? '✅' : '🔍'}</span>
                    <span>${item}</span>
                </div>
                <div class="geo-item-status-tag" style="font-size:0.7rem; padding:2px 6px;">
                    ${isDone ? '✓ GESPEICHERT' : 'OFFEN'}
                </div>
            `;
            mapChecklist.appendChild(row);
        });

        const myCount = (state.completed_count && state.completed_count[currentUser]) || 0;
        const total = (state.items || []).length;
        const mapCounter = document.getElementById('map-proof-counter');
        if (mapCounter) {
            mapCounter.textContent = `${myCount} / ${total}`;
        }
    }

    /**
     * Collapsible Checklist Handlers for Exploration and Map Screens
     */
    window.toggleExpChecklist = function () {
        const expScreen = document.getElementById('screen-exploration');
        if (!expScreen) return;
        const isCollapsed = expScreen.classList.toggle('checklist-collapsed');
        const icon = document.getElementById('exp-checklist-toggle-icon');
        const txt = document.getElementById('exp-checklist-toggle-text');
        if (icon) icon.textContent = isCollapsed ? '▲' : '▼';
        if (txt) txt.textContent = isCollapsed ? '[ AUSKLAPPEN ]' : '[ EINKLAPPEN ]';

        setTimeout(() => {
            if (streetViewPanorama && window.google && window.google.maps) {
                google.maps.event.trigger(streetViewPanorama, 'resize');
            }
        }, 100);
    };

    window.toggleMapChecklist = function () {
        const box = document.getElementById('map-checklist-wrapper');
        if (!box) return;
        const isCollapsed = box.classList.toggle('collapsed');
        const icon = document.getElementById('map-checklist-toggle-icon');
        const txt = document.getElementById('map-checklist-toggle-text');
        if (icon) icon.textContent = isCollapsed ? '▲' : '▼';
        if (txt) txt.textContent = isCollapsed ? '[ AUSKLAPPEN ]' : '[ EINKLAPPEN ]';

        setTimeout(() => {
            if (pickerMap && window.google && window.google.maps) {
                google.maps.event.trigger(pickerMap, 'resize');
            }
        }, 100);
    };

    // Google Maps API Async Callback entrypoint
    window.initGoogleMapsServices = function () {
        console.log("[GeoBingo] Google Maps JavaScript SDK ready.");
        const mapModal = document.getElementById('map-modal');
        if (mapModal && mapModal.classList.contains('active')) {
            initPickerMap();
        }
        if (isStartLocationChosen()) {
            ensureStreetViewInitialized();
        }
    };

    // Initial Load & Room Reconnect Check
    $(document).ready(function () {
        loadUserCustomItems();
        loadRoomList();
        const savedRoom = sessionStorage.getItem('geobingo_room');
        if (savedRoom) {
            enterRoom(savedRoom);
        }

        const blocker = document.getElementById('judge-drag-blocker');
        if (blocker) {
            blocker.addEventListener('wheel', function (e) {
                e.preventDefault();
                window.zoomJudge(e.deltaY < 0 ? 1 : -1);
            }, { passive: false });
        }
    });

})();
