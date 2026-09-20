        // CHANGE THIS for new games (e.g., 'werewolf', 'poker')
        const GAME_ID = 'secret';
        const Store = {
            // 1. Standard Get/Set (e.g., Last User, Avatar Pref)
            get: (key) => localStorage.getItem(`${GAME_ID}_${key}`),
            set: (key, val) => localStorage.setItem(`${GAME_ID}_${key}`, val),
            remove: (key) => localStorage.removeItem(`${GAME_ID}_${key}`),

            // 2. UUID Helper (Handles the unique logic: game_uuid_username)
            getUUID: (username) => localStorage.getItem(`${GAME_ID}_uuid_${username}`),
            setUUID: (username, uuid) => localStorage.setItem(`${GAME_ID}_uuid_${username}`, uuid),

            // 3. Session Storage (For the Manual Leave flag)
            getSession: (key) => sessionStorage.getItem(`${GAME_ID}_${key}`),
            setSession: (key, val) => sessionStorage.setItem(`${GAME_ID}_${key}`, val),
            removeSession: (key) => sessionStorage.removeItem(`${GAME_ID}_${key}`)
        };

        var cfg = window.GAMEHUB_CONFIG || {};
        var pusherKey = cfg.pusherKey || "";
        var pusherCluster = cfg.pusherCluster || "eu";
        Pusher.logToConsole = false;
        var pusher = new Pusher(pusherKey, {
            cluster: pusherCluster,
            channelAuthorization: {
                endpoint: '/pusher/auth',
                headersProvider: function () {
                    const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
                    return token ? { 'X-Auth-Token': token } : {};
                }
            }
        });

        pusher.connection.bind('state_change', function (states) {
            console.log('%c[SecretHitler Pusher Connection]', 'color: #38d9a9; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;', states.current);
        });

        var channel = null;
        var presenceChannel = null;

        var currentRoomCode = "";
        var myName = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) || (cfg.user && cfg.user.username) || "";
        var lastPhase = ""; // Track for animation
        var currentRenderedPlayers = [];
        var currentLogCount = 0;
        var isBannerBusy = false;
        var currentGameState = null;

        var roomListTimer = null;

        // Automatically inject currentRoomCode and X-Auth-Token into all requests
        $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
            const token = window.GAMEHUB_TOKEN || sessionStorage.getItem('gamehub_token');
            if (token) {
                jqXHR.setRequestHeader('X-Auth-Token', token);
            }
            let activeCode = currentRoomCode || (currentGameState && currentGameState.room_code) || Store.getSession('active_room') || (window.location.hash ? window.location.hash.substring(1).toUpperCase().trim() : '');
            if (activeCode) {
                if (!currentRoomCode) currentRoomCode = activeCode;
                if (options.type && options.type.toUpperCase() === 'POST') {
                    if (typeof options.data === 'string') {
                        if (options.data.indexOf('room_code=') === -1) {
                            options.data += (options.data ? '&' : '') + 'room_code=' + encodeURIComponent(activeCode);
                        }
                    } else if (typeof FormData !== 'undefined' && options.data instanceof FormData) {
                        if (!options.data.has('room_code')) {
                            options.data.append('room_code', activeCode);
                        }
                    } else if (typeof options.data === 'object' && options.data !== null) {
                        if (!options.data.room_code) {
                            options.data.room_code = activeCode;
                        }
                    } else if (!options.data) {
                        options.data = 'room_code=' + encodeURIComponent(activeCode);
                    }
                } else if (options.type && options.type.toUpperCase() === 'GET') {
                    if (options.url.indexOf('room_code=') === -1 && options.url.indexOf('/' + activeCode + '/') === -1) {
                        let sep = options.url.indexOf('?') === -1 ? '?' : '&';
                        options.url += sep + 'room_code=' + encodeURIComponent(activeCode);
                    }
                }
            }
        });

        $(document).ready(function () {
            if (window.GAMEHUB_USER && window.GAMEHUB_USER.username) {
                myName = window.GAMEHUB_USER.username;
            }
            // Check URL hash for room code (e.g. #A3X7)
            let hashRoom = window.location.hash ? window.location.hash.substring(1).toUpperCase().trim() : '';
            let savedRoom = Store.getSession('active_room') || '';
            let manualLeave = Store.getSession('manual_leave');

            if (manualLeave) {
                Store.removeSession('manual_leave');
                showRoomBrowser();
                return;
            }

            let initialRoom = hashRoom || savedRoom;
            if (initialRoom && initialRoom.length >= 3) {
                joinRoom(initialRoom);
            } else {
                showRoomBrowser();
            }
        });

        function showRoomBrowser() {
            stopHeartbeatLoop();
            if (presenceChannel) {
                try {
                    presenceChannel.unbind_all();
                    pusher.unsubscribe(presenceChannel.name);
                } catch(e) {}
                presenceChannel = null;
            }
            currentRoomCode = "";
            window.location.hash = "";
            $('.screen').hide();
            $('#room-browser-screen').show();
            loadRoomList(false);
            if (!roomListTimer) {
                roomListTimer = setInterval(function () {
                    if ($('#room-browser-screen').is(':visible')) {
                        loadRoomList(true);
                    }
                }, 3000);
            }
        }

        function loadRoomList(silent) {
            if (!silent) {
                $('#room-list-container').html('<div style="text-align:center; padding:15px; color:#aaa;">Lade Räume...</div>');
            }
            $.get('/secret/rooms', function (res) {
                if (!res.rooms || res.rooms.length === 0) {
                    $('#room-list-container').html('<div style="text-align:center; padding:20px; color:#777; background:#111; border:2px dashed #444;">Keine aktiven Räume gefunden.<br><span style="font-size:12px;">Erstelle den ersten Raum oben!</span></div>');
                    return;
                }
                let html = '';
                res.rooms.forEach(r => {
                    let statusLabel = r.status === 'lobby' ? '<span style="color:#51cf66;">LOBBY</span>' : '<span style="color:#ff922b;">SPIEL LÄUFT</span>';
                    let btnLabel = r.status === 'lobby' ? 'BEITRETEN' : 'ZUSCHAUEN';
                    html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#222; border:2px solid #444; padding:12px 16px;">
                            <div>
                                <span style="font-size:18px; font-weight:900; letter-spacing:2px; color:var(--text-gold);">${r.room_code}</span>
                                <span style="font-size:12px; color:#aaa; margin-left:10px;">Host: <strong>${r.host_username || 'Unbekannt'}</strong></span>
                                <div style="font-size:11px; color:#888; margin-top:3px;">Spieler: ${r.player_count}/10 • Status: ${statusLabel}</div>
                            </div>
                            <button onclick="joinRoom('${r.room_code}')" class="btn" style="width:auto; padding:6px 14px; font-size:12px; background:white; color:black; font-weight:800;">${btnLabel}</button>
                        </div>
                    `;
                });
                $('#room-list-container').html(html);
            }).fail(function () {
                $('#room-list-container').html('<div style="text-align:center; padding:15px; color:#ff6b6b;">Fehler beim Laden der Räume.</div>');
            });
        }

        function createRoom() {
            let savedAvatar = Store.get('avatar_pref');
            let savedStyle = Store.get('style_pref');
            $.post('/secret/create_room', { avatar_pref: savedAvatar, style_pref: savedStyle }, function (res) {
                if (res.success && res.room_code) {
                    joinRoom(res.room_code);
                } else {
                    showModal("Fehler", res.error || "Konnte Raum nicht erstellen.");
                }
            }).fail(function () {
                showModal("Fehler", "Serverfehler beim Erstellen.");
            });
        }

        function joinRoomByInput() {
            let code = $('#input-room-code').val().trim();
            if (!code || code.length < 3) {
                showModal("Hinweis", "Bitte einen gültigen Raumcode eingeben.", null, true, "OK");
                return;
            }
            joinRoom(code);
        }

        function joinRoom(code) {
            code = code.toUpperCase().trim();
            currentRoomCode = code;
            if (roomListTimer) { clearInterval(roomListTimer); roomListTimer = null; }
            window.location.hash = code;
            $('#lobby-room-code').text(code);
            $('.active-room-display').text(code);
            Store.setSession('active_room', code);

            // Subscribe to room-scoped channel
            if (channel) {
                channel.unbind_all();
                pusher.unsubscribe(channel.name);
            }
            console.log('%c[SecretHitler] Subscribing:', 'color: #ffd43b; font-weight: bold; background: #2a2200; padding: 2px 6px; border-radius: 3px;', 'secret-' + code);
            channel = pusher.subscribe('secret-' + code);
            channel.bind('pusher:subscription_succeeded', function () {
                console.log('%c[SecretHitler] Pusher Channel verbunden! ✅', 'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;');
            });
            channel.bind('state-update', data => {
                if (window.GameDelta) window.GameDelta.logUpdate('SecretHitler', data);
                updateUI(data);
            });

            channel.bind('game-reset', () => { location.reload(); });
            channel.bind('force-kick', data => {
                if (data.name === myName) {
                    Store.setSession('manual_leave', 'true');
                    showRoomBrowser();
                }
            });
            channel.bind('policy-enacted', data => {
                triggerAnnouncement(data.type);
            });
            channel.bind('reshuffle-notification', () => {
                $('#reshuffle-toast').fadeIn().delay(2000).fadeOut();
            });

            // Subscribe to presence channel for instant online/offline indicators
            if (presenceChannel) {
                try {
                    presenceChannel.unbind_all();
                    pusher.unsubscribe(presenceChannel.name);
                } catch(e) {}
                presenceChannel = null;
            }
            try {
                presenceChannel = pusher.subscribe('presence-secret-' + code);
                presenceChannel.bind('pusher:subscription_succeeded', function(members) {
                    let online = [];
                    members.each(function(m) {
                        if (m.info && m.info.username) online.push(m.info.username);
                    });
                    syncOnlineStatus(online);
                });
                presenceChannel.bind('pusher:member_added', function(member) {
                    if (member.info && member.info.username) {
                        markPlayerOnline(member.info.username);
                    }
                });
                presenceChannel.bind('pusher:member_removed', function(member) {
                    if (member.info && member.info.username) {
                        markPlayerOffline(member.info.username);
                    }
                });
            } catch(e) {}

            joinGame(code);
            startHeartbeatLoop();
        }

        // --- CORE FUNCTIONS ---
        function joinGame(code) {
            let savedAvatar = Store.get('avatar_pref');
            let savedStyle = Store.get('style_pref');
            let storedUUID = Store.getUUID(myName) || '';

            $.post('/secret/join_game', {
                room_code: code,
                avatar_pref: savedAvatar,
                style_pref: savedStyle,
                uuid: storedUUID
            }, function (res) {
                if (res.error) {
                    showModal("Fehler", res.error);
                    showRoomBrowser();
                } else {
                    if (res.your_uuid) Store.setUUID(myName, res.your_uuid);
                    updateUI(res);
                }
            }).fail(function () {
                showModal("Verbindungsfehler", "Konnte Raum nicht betreten.");
                showRoomBrowser();
            });
        }

        function leaveGame() {
            safeAction("Raum wirklich verlassen?", function () {
                $.post('/secret/leave_game', function () {
                    Store.setSession('manual_leave', 'true');
                    Store.removeSession('active_room');
                    showRoomBrowser();
                });
            });
        }

        // --- UI RENDERER ---
        function updateUI(data) {
            if (window.GameDelta) {
                currentGameState = window.GameDelta.apply(currentGameState, data);
            } else {
                currentGameState = data;
            }
            data = currentGameState;
            if (data && data.room_code) {
                currentRoomCode = data.room_code;
                Store.setSession('active_room', currentRoomCode);
            }
            if (!data || !data.players) return;
            let amIPlayer = data.players.includes(myName);
            let amISpectator = data.spectators && data.spectators.includes(myName);

            if (!myName || (!amIPlayer && !amISpectator)) {
                showRoomBrowser();
                return;
            }

            // 2. Screen Switching (Smart Switch)
            let currentScreen = $('.screen:visible').attr('id');
            let targetScreen = "";

            if (data.status === 'playing') targetScreen = 'game-screen';
            else if (data.status === 'game_over') targetScreen = 'summary-screen'; // Phase 7: Summary
            else targetScreen = 'lobby-screen';

            if (currentScreen !== targetScreen) {
                $('.screen').hide();
                $('#' + targetScreen).fadeIn(300);

                // Refresh role info when entering game screen
                if (targetScreen === 'game-screen') fetchMyRole();

                // Ensure Summary Screen HTML exists if we just switched to it
                if (targetScreen === 'summary-screen') renderGameOver(data);
            }

            // 3. Render Specific Screen Logic
            if (data.status === 'lobby') {
                updateLobby(data);
            }
            else if (data.status === 'game_over') {
                renderGameOver(data);
            }
            else {
                // --- PLAYING STATE ---

                // A. Race Condition Fix: Check for Injected Vote Result FIRST
                if (data.vote_result) {
                    showVoteBanner(data.vote_result);
                }

                // B. Phase Banner Logic
                if (lastPhase !== data.phase) {
                    lastPhase = data.phase;
                    triggerPhaseBanner(data.phase, data);
                }

                // C. HUD & Text Updates
                $('#hud-phase-text').text(data.phase.replace('_', ' '));

                // Host Controls
                if (myName === data.host) $('#host-restart-btn').show();
                else $('#host-restart-btn').hide();

                // Board Stats
                $('#deck-info').text(`Deck: ${data.deck_count} | Disc: ${data.discard_count}`);
                $('#lib-score').text(data.liberal_board);
                $('#fas-score').text(data.fascist_board);

                // D. Log Book Visibility (Settings Check)
                let logBtn = $('.utility-text span').last(); // The "VIEW LOG" span
                if (data.settings && data.settings.log_book === false) {
                    logBtn.hide();
                } else {
                    logBtn.show();
                }

                // E. Smart Rendering
                updatePlayerStrip(data); // DOM Diffing for players
                renderBoards(data);      // Board state
                updateLogs(data);        // Log book updates

                // F. Spectator vs Player Controls
                if (amISpectator) {
                    // Spectators see no buttons and no role button
                    $('#status-text').text("Spectating Game...");
                    $('#action-box').html("<h3 style='opacity:0.5; font-style:italic;'>YOU ARE AN OBSERVER</h3>");
                    $('.role-btn').hide();
                } else {
                    // Active Players see controls
                    $('.role-btn').show();
                    renderActionDesk(data);
                }

                // G. Election Tracker
                $('.tracker-dot').removeClass('tracker-active');
                for (let i = 0; i < data.election_tracker; i++) {
                    $(`#dot-${i}`).addClass('tracker-active');
                }
            }
        }

        function triggerPhaseBanner(phase, data) {

            // 1. CHECK FOR CONFLICTS
            if ($('#announcement-overlay').css('display') !== 'none') {

                setTimeout(() => triggerPhaseBanner(phase, data), 1000);
                return;
            }

            // NEW: If the Vote Banner is showing, wait 2 seconds then try again
            if (isBannerBusy) {

                setTimeout(() => triggerPhaseBanner(phase, data), 2000);
                return;
            }


            // 2. STANDARD LOGIC
            let title = "", sub = "";
            if (phase === 'nominating') { title = "NOMINATION"; sub = `President ${data.president} must pick a Chancellor.`; }
            else if (phase === 'voting') { title = "ELECTION"; sub = `Vote for Chancellor ${data.chancellor}.`; }
            else if (phase === 'legislative') { title = "LEGISLATIVE SESSION"; sub = "The government is enacting a policy."; }
            else if (phase === 'executive_action') { title = "EXECUTIVE ACTION"; sub = `President ${data.president} is using a power.`; }

            // Prevent duplicate triggers
            if ($('#phase-title').text() === title && $('#phase-overlay').hasClass('active')) return;

            $('#phase-title').text(title).css('color', 'white'); // Reset color
            $('#phase-subtitle').text(sub);

            let overlay = $('#phase-overlay');
            overlay.addClass('active');
            setTimeout(() => { overlay.removeClass('active'); }, 2500);
        }

        function renderActionDesk(data) {
            let box = $('#action-box');
            let txt = $('#status-text');

            // Prevent redrawing if content hasn't changed to keep animations smooth
            // (Simple check: if we have buttons and phase matches, be careful.
            // For now, we will rebuild buttons but use optimistic clicks to prevent lag feeling)
            box.empty();

            if (data.phase === 'nominating') {
                if (myName === data.president) {
                    txt.text("Select a Chancellor Nominee");
                    data.players.forEach(p => {
                        if (p !== myName && !data.dead_players.includes(p)) {
                            let isDisabled = false, reason = "";
                            if (p === data.prev_chan) { isDisabled = true; reason = "(Term Limit)"; }
                            if (data.players.length > 5 && p === data.prev_pres) { isDisabled = true; reason = "(Term Limit)"; }

                            if (isDisabled) {
                                box.append(`<button class="btn btn-neutral" style="opacity:0.5; cursor:not-allowed;" onclick="showModal('Invalid', 'Player is term limited.', null, true, 'OK')">${p} <span style='font-size:10px'>${reason}</span></button>`);
                            } else {
                                // OPTIMISTIC UPDATE
                                box.append(`<button class="btn btn-neutral" onclick="safeAction('Nominate ${p}?', () => optimisticPost('/secret/nominate_chancellor', {nominee:'${p}'}, this))">${p}</button>`);
                            }
                        }
                    });
                } else {
                    txt.text(`President ${data.president} is thinking...`);
                }
            }
            else if (data.phase === 'voting') {
                if (data.dead_players.includes(myName)) { txt.text("You are dead. You cannot vote."); }
                else if (data.votes[myName]) { txt.text("Vote Registered. Waiting..."); }
                else {
                    txt.text("Cast your Vote");
                    // OPTIMISTIC UPDATE
                    box.append(`<button class="btn btn-ja" onclick="optimisticPost('/secret/submit_vote', {vote:'Ja'}, this)">JA!</button>`);
                    box.append(`<button class="btn btn-nein" onclick="optimisticPost('/secret/submit_vote', {vote:'Nein'}, this)">NEIN!</button>`);
                }
            }
            else if (data.phase === 'legislative') {
                if (data.legislative_step === 'veto_agenda') {
                    if (myName === data.president) {
                        txt.text("Chancellor proposes a Veto. Agree?");
                        // OPTIMISTIC UPDATE
                        box.append(`<button class="btn btn-ja" onclick="safeAction('Agree to discard all cards?', () => optimisticPost('/secret/respond_to_veto', {decision:'agree'}, this))">AGREE (DISCARD ALL)</button>`);
                        box.append(`<button class="btn btn-nein" onclick="optimisticPost('/secret/respond_to_veto', {decision:'disagree'}, this)">DISAGREE (FORCE ENACT)</button>`);
                    } else { txt.text("Chancellor has proposed a Veto..."); }
                    return;
                }

                let isPresStep = (data.legislative_step === 'president_session');
                let activePlayer = isPresStep ? data.president : data.chancellor;

                if (myName === activePlayer) {
                    txt.text(isPresStep ? "Select a Policy to DISCARD" : "Select a Policy to ENACT");
                    let handDiv = $('<div class="card-hand"></div>');
                    let handUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/my_hand') : '/secret/my_hand';
                    
                    $.get(handUrl, function (handRes) {
                        let handCards = (handRes && handRes.hand) ? handRes.hand : [];
                        handDiv.empty();
                        handCards.forEach((card, i) => {
                            let cls = (card === 'Liberal') ? 'card-lib' : 'card-fas';
                            let btn = $(`<div class="card-btn ${cls}"></div>`);

                            // CARD CLICK ANIMATION LOGIC
                            if (isPresStep) {
                                btn.click(function () {
                                    let self = this;
                                    safeAction('DISCARD this policy?', function () {
                                        $(self).addClass('discarding'); // Fly away
                                        let discardUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/president_discard') : '/secret/president_discard';
                                        $.post(discardUrl, { index: i });
                                    });
                                });
                            } else {
                                let cardToDiscard = (i === 0) ? 1 : 0;
                                btn.click(function () {
                                    let self = this;
                                    safeAction('ENACT this policy?', function () {
                                        let enactUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/chancellor_discard') : '/secret/chancellor_discard';
                                        $.post(enactUrl, { index: cardToDiscard });
                                    });
                                });
                            }
                            handDiv.append(btn);
                        });
                    });
                    box.append(handDiv);

                    if (!isPresStep && data.fascist_board === 5 && !data.veto_declined) {
                        let vetoUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/call_veto') : '/secret/call_veto';
                        box.append(`<div style="width:100%; margin-top:15px; border-top:1px solid rgba(255,255,255,0.2); padding-top:10px;">
                    <button class="btn btn-gold" style="font-size:14px; padding:10px;" onclick="safeAction('Propose Veto to President?', () => optimisticPost('${vetoUrl}', {}, this))">⚠ PROPOSE VETO</button>
                </div>`);
                    }
                } else { txt.text(`${activePlayer} is handling legislation...`); }
            }
            else if (data.phase === 'executive_action') {
                if (myName === data.president) {
                    let action = data.pending_action;
                    if (data.has_action_payload || data.action_payload) {
                        txt.text("Action Complete. Review info.");
                        let btn = $(`<button class="btn btn-gold">VIEW RESULT</button>`);
                        btn.click(function () {
                            let actionUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/my_action') : '/secret/my_action';
                            let endUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/end_action') : '/secret/end_action';
                            $.get(actionUrl, function (res) {
                                let content = res.payload;
                                if (Array.isArray(content)) {
                                    content = content.join(', ');
                                } else if (!content && data.action_payload) {
                                    content = data.action_payload;
                                }
                                showModal('EXECUTIVE ACTION RESULT', String(content || 'Action Complete'), () => optimisticPost(endUrl, {}, btn[0]), false, 'ACKNOWLEDGE');
                            });
                        });
                        box.append(btn);
                    } else {
                        if (action === 'peek') {
                            txt.text("Policy Peek: Review Top 3 Cards");
                            let peekBtn = $(`<button class="btn btn-gold">PEEK TOP 3 POLICIES</button>`);
                            peekBtn.click(function () {
                                let peekUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/my_action') : '/secret/my_action';
                                let endUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/end_action') : '/secret/end_action';
                                $.get(peekUrl, function (res) {
                                    let cards = Array.isArray(res.payload) ? res.payload.join(', ') : (res.payload || 'No cards');
                                    showModal('POLICY PEEK', cards, () => optimisticPost(endUrl, {}, peekBtn[0]), false, 'ACKNOWLEDGE');
                                });
                            });
                            box.append(peekBtn);
                        } else {
                            let verb = action === 'execution' ? "EXECUTE" : (action === 'investigate' ? "INVESTIGATE" : "ELECT SPECIAL");
                            txt.text(`Select a player to ${verb}`);
                            data.players.forEach(p => {
                                if (p !== myName && !data.dead_players.includes(p)) {
                                    let actionUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/perform_action') : '/secret/perform_action';
                                    box.append(`<button class="btn btn-neutral" onclick="safeAction('${verb} ${p}?', () => optimisticPost('${actionUrl}', {target:'${p}'}, this))">${p}</button>`);
                                }
                            });
                        }
                    }
                } else { txt.text(`President ${data.president} is performing an Executive Action...`); }
            }
        }

        function renderBoards(data) {
            $('.policy-slot').removeClass('filled lib-filled fas-filled');

            $('#lib-track .policy-slot').each(function (i) {
                if (i < data.liberal_board) {
                    $(this).addClass('filled lib-filled');
                    $(this).css('transition-delay', (i * 0.1) + 's'); // Cascade effect
                }
            });
            $('#fas-track .policy-slot').each(function (i) {
                if (i < data.fascist_board) {
                    $(this).addClass('filled fas-filled');
                    $(this).css('transition-delay', (i * 0.1) + 's');
                }
            });
        }

        function updateLobby(data) {
            let playerRowsContainer = $('#lobby-player-rows');
            let settingsContainer = $('#lobby-settings-panel');
            let activePlayerIds = [];

            // --- 1. UPDATE/CREATE PLAYER ROWS ---
            data.players.forEach(p => {
                let isMe = (p === myName);
                let isHost = (p === data.host);
                let avatar = (data.avatars && data.avatars[p]) ? data.avatars[p] : 'avatar_1';
                let cardStyle = (data.card_styles && data.card_styles[p]) ? data.card_styles[p] : 'style_standard';

                let safeName = p.replace(/[^a-zA-Z0-9]/g, '_');
                let rowId = `lobby-pcard-${safeName}`;
                activePlayerIds.push(rowId);

                let row = $(`#${rowId}`);

                // A. CREATE (If doesn't exist)
                if (row.length === 0) {
                    // NOTE: Changed class from 'lobby-row' to 'lobby-card'
                    row = $(`<div id="${rowId}" class="lobby-card"></div>`);

                    // Inner HTML Structure
                    let leftSide = $(`<div style="display:flex; align-items:center; flex-grow:1;"></div>`);
                    let avatarDiv = $(`<div class="lobby-avatar"></div>`);
                    let infoDiv = $(`<div style="display:flex; flex-direction:column; justify-content:center;"></div>`);
                    let nameSpan = $(`<span class="lobby-name"></span>`);

                    // Kick Button (Right Side)
                    let kickBtn = $(`<button class="kick-button" title="Kick Player">✕</button>`);
                    kickBtn.click((e) => {
                        e.stopPropagation(); // Prevent clicking row
                        safeAction(`Kick ${p}?`, () => $.post('/secret/kick_player', { name: p }));
                    });

                    // Assemble
                    infoDiv.append(nameSpan);
                    leftSide.append(avatarDiv).append(infoDiv);
                    row.append(leftSide).append(kickBtn);
                    playerRowsContainer.append(row);
                }

                // B. UPDATE ATTRIBUTES (Run every time)

                // 1. Apply Card Style Class
                row.removeClass('style_standard style_classified style_blueprint style_noir style_executive style_industrial style_propaganda style_archive style_terminal style_bauhaus style_imperial style_uniform');
                row.addClass(cardStyle);

                // 2. Avatar Image
                let avatarDiv = row.find('.lobby-avatar');
                // --- CHANGE: Look in the style folder ---
                avatarDiv.css('background-image', `url('/static/img/${cardStyle}/${avatar}.png')`);

                // 3. Edit Button (Only for me)
                if (isMe && avatarDiv.find('.edit-avatar-btn').length === 0) {
                    let editBtn = $(`<div class="edit-avatar-btn">✎</div>`);

                    // --- CHANGE THIS LINE ---
                    // Remove 'data' from the call. Just call openAvatarModal()
                    editBtn.click((e) => { e.stopPropagation(); openAvatarModal(); });

                    avatarDiv.append(editBtn);
                }

                // 4. Name & Host Badge
                let nameHtml = `${p}`;
                if (isHost) {
                    nameHtml += ` <span class="host-badge">HOST</span>`;
                }
                row.find('.lobby-name').html(nameHtml);

                // 5. Kick Button Visibility
                if (myName === data.host && !isMe) {
                    row.find('.kick-button').show();
                } else {
                    row.find('.kick-button').hide();
                }
            });

            // --- 2. REMOVE LEFT PLAYERS ---
            playerRowsContainer.children().each(function () {
                if (!activePlayerIds.includes(this.id)) {
                    $(this).slideUp(200, function () { $(this).remove(); });
                }
            });

            // --- 3. SETTINGS PANEL (Redesigned) ---
            if (settingsContainer.children().length === 0) {
                let settingsHtml = `<div style="font-family:'Manrope', sans-serif; font-size:18px; color:var(--text-gold); margin-bottom:15px; text-transform:uppercase; letter-spacing:2px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">MISSION PARAMETERS</div>`;

                settingsHtml += '<div class="settings-grid">';

                let settingsList = [
                    { id: 'log_book', label: 'LOG BOOK', desc: 'Maintain official records.' },
                    { id: 'reveal_on_death', label: 'MARTYRDOM', desc: 'Reveal identity on execution.' },
                    { id: 'blind_voting', label: 'BLIND VOTING', desc: 'Conceal ballot details.' }
                ];

                settingsList.forEach(s => {
                    settingsHtml += `
                    <div id="setting-btn-${s.id}" class="setting-block-btn">
                        <div class="s-title">${s.label}</div>
                        <div class="s-desc">${s.desc}</div>
                        <div class="s-status">OFF</div>
                    </div>`;
                });

                settingsHtml += '</div>';
                settingsContainer.html(settingsHtml);
            }

            // Update Toggles / Buttons
            ['log_book', 'reveal_on_death', 'blind_voting'].forEach(settingId => {
                let btn = $(`#setting-btn-${settingId}`);
                let isHost = (myName === data.host);
                let isActive = data.settings && data.settings[settingId];

                // Visual State
                if (isActive) {
                    btn.addClass('active');
                    btn.find('.s-status').text('ENABLED');
                } else {
                    btn.removeClass('active');
                    btn.find('.s-status').text('DISABLED');
                }

                // Host Control logic
                // Remove old listeners to prevent duplication if re-rendering (though we check children length 0)
                btn.off('click');

                if (isHost) {
                    btn.removeClass('disabled-btn');
                    btn.click(() => {
                        let willBeActive = !btn.hasClass('active');
                        btn.toggleClass('active', willBeActive);
                        btn.find('.s-status').text(willBeActive ? 'ENABLED' : 'DISABLED');
                        if (currentGameState && currentGameState.settings) {
                            currentGameState.settings[settingId] = willBeActive;
                        }
                        optimisticPost('/secret/toggle_setting', { setting: settingId });
                    });
                } else {
                    btn.addClass('disabled-btn');
                }
            });

            // --- 4. ADMIN CONTROLS ---
            if (myName === data.host) $('#admin-controls').show(); else $('#admin-controls').hide();
        }

        // --- HELPER UI ---
        function safeAction(msg, action) {
            showModal("CONFIRM", msg, action, false);
        }

        function showModal(title, text, yesCallback, isAlert, yesText = "CONFIRM") {
            $('#modal-title').text(title);

            // LOGIC: Check if the text looks like a list of cards (Array or String with card names)
            let isCardList = Array.isArray(text) || (typeof text === 'string' && (text.includes('Liberal') || text.includes('Fascist')));

            if (isCardList) {
                // 1. Convert input (String or Array) into a clean Array
                let items = [];
                if (Array.isArray(text)) {
                    items = text;
                } else {
                    // Clean up string: remove brackets, quotes, and split by comma
                    // Handles "Fascist,Liberal" AND "['Fascist', 'Liberal']"
                    items = text.replace(/[\[\]']/g, '').split(',');
                }

                // 2. Build HTML for Visual Cards
                let html = "<div style='display:flex; gap:15px; justify-content:center; margin:25px 0;'>";
                items.forEach(c => {
                    let cleanName = c.trim();
                    if (!cleanName) return;

                    // Assign CSS class based on name
                    let cls = cleanName.includes('Liberal') ? 'card-lib' : 'card-fas';

                    // Create the card div (non-clickable)
                    html += `<div class="card-btn ${cls}" style="width:80px; height:120px; cursor:default; box-shadow: 4px 4px 0px black; transform:none;"></div>`;
                });
                html += "</div>";

                // 3. Inject HTML
                $('#modal-desc').hide();
                $('#modal-content-area').html(html);

            } else {
                // Standard Text Modal (For Investigations, Kicks, etc.)
                $('#modal-desc').show().text(text);
                $('#modal-content-area').empty();
            }

            // Button Logic (Cancel / Confirm)
            $('#modal-yes').text(yesText).off('click');

            if (yesCallback) {
                $('#modal-yes').show().on('click', function () {
                    $('#modal-overlay').fadeOut();
                    yesCallback();
                });
                $('#modal-no').show().off('click').on('click', () => $('#modal-overlay').fadeOut());
            } else {
                // Alert mode (OK button only)
                $('#modal-yes').on('click', () => $('#modal-overlay').fadeOut());
                $('#modal-no').hide();
            }

            $('#modal-overlay').css('display', 'flex').hide().fadeIn(200);
        }

        function openRoleModal() {
            $('#role-reveal-modal').css('display', 'flex').hide().fadeIn(200);
            $('#role-flip-container').removeClass('flipped'); // Reset flip
        }

        function fetchMyRole() {
            let activeCode = currentRoomCode || (currentGameState && currentGameState.room_code) || Store.getSession('active_room') || (window.location.hash ? window.location.hash.substring(1).toUpperCase().trim() : '');
            let roleUrl = activeCode ? ('/secret/' + activeCode + '/get_my_role') : '/secret/get_my_role';
            $.get(roleUrl, function (data) {
                if (!data || !data.role) return;
                // 1. Set the Name and Info Text
                $('#my-role-name').text(data.role);
                $('#my-role-info').text(data.info);

                // 2. Determine Image & Colors
                let img = '';
                let color = '';

                if (data.role === 'Liberal') {
                    img = 'role_liberal.png';
                    color = '#3498db'; // Blue text
                } else if (data.role === 'Fascist') {
                    img = 'role_fascist.png';
                    color = '#e74c3c'; // Red text
                } else if (data.role === 'Hitler') {
                    img = 'role_hitler.png';
                    color = '#c0392b'; // Dark Red text
                }

                // 3. Apply Styling
                $('.role-back').css({
                    'background-image': `url('/static/img/${img}')`,
                    'border-color': color // Colored border matches role
                });

                $('#my-role-name').css('color', color); // Colored text matches role
            });
        }

        function updateLogs(data) {
            if (!data.logs) return;

            // Only append NEW logs
            if (data.logs.length > currentLogCount) {
                let newLogs = data.logs.slice(currentLogCount);
                newLogs.forEach(l => {
                    $('#log-content').append(`<div class="log-entry">- ${l}</div>`);
                });

                // Scroll to bottom
                let d = $('#log-content');
                d.scrollTop(d.prop("scrollHeight"));

                currentLogCount = data.logs.length;
            }
        }
        // 1. SMART PLAYER STRIP (DOM Diffing)
        function updatePlayerStrip(data) {
            let container = $('#player-strip');
            let activeIds = [];

            data.players.forEach(p => {
                let safeName = p.replace(/[^a-zA-Z0-9]/g, '_');
                let safeId = 'game-pcard-' + safeName;
                activeIds.push(safeId);

                let card = $('#' + safeId);
                let isMe = (p === myName);
                let isDead = (data.dead_players && data.dead_players.includes(p));

                // 1. GET VARIABLES (Using 'avatarKey' correctly)
                let avatarKey = (data.avatars && data.avatars[p]) ? data.avatars[p] : 'avatar_1';
                let styleClass = (data.card_styles && data.card_styles[p]) ? data.card_styles[p] : 'style_standard';

                // --- CHANGE: Look in the style folder ---
                let bgUrl = `/static/img/${styleClass}/${avatarKey}.png`;

                // 2. CREATE CARD (If doesn't exist)
                if (card.length === 0) {
                    card = $(`
                <div id="${safeId}" class="player-card ${styleClass}"> <!-- Added styleClass here -->
                    <div class="role-badge badge-pres" style="display:none; background:#e67e22; border:1px solid white;">PRESIDENT</div>
                    <div class="role-badge badge-chan" style="display:none; background:#7f8c8d; border:1px solid white;">CHANCELLOR</div>
                    <div class="crown" style="display:none; position:absolute; top:4px; right:4px; font-size:16px;">👑</div>
                    <div class="skull-icon" style="display:none; position:absolute; top:50px; left:50%; transform:translateX(-50%); font-size:40px; text-shadow:0 0 5px black;">💀</div>
                    <div class="disconnect-icon">⚠️</div>
                    <div class="kick-btn" style="display:none; position:absolute; top:-5px; left:-5px; background:red; color:white; width:15px; height:15px; border-radius:0; font-size:10px; justify-content:center; align-items:center; cursor:pointer;">x</div>

                    <div class="avatar-circle" style="background-image: url('${bgUrl}');"></div>

                    <div style="font-size:14px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${p}</div>
                    <div class="vote-bubble" style="color:#7f8c8d; bottom: 5px;">...</div>
                </div>
            `);
                    card.find('.kick-btn').click((e) => { e.stopPropagation(); safeAction(`Kick ${p}?`, () => $.post('/secret/kick_player', { name: p })); });
                    container.append(card);
                }

                // 3. UPDATE ATTRIBUTES

                // NEW: Update Style Class (Remove old ones, add new one)
                card.removeClass('style_standard style_classified style_blueprint style_noir style_executive style_industrial style_propaganda style_archive style_terminal style_bauhaus style_imperial style_uniform');
                card.addClass(styleClass);

                // Update Avatar
                card.find('.avatar-circle').css('background-image', `url('${bgUrl}')`);

                if (isMe) card.addClass('is-me'); else card.removeClass('is-me');
                if (isDead) card.addClass('dead'); else card.removeClass('dead');

                toggleDisplay(card.find('.badge-pres'), p === data.president);
                toggleDisplay(card.find('.badge-chan'), p === data.chancellor);
                toggleDisplay(card.find('.crown'), p === data.host);
                toggleDisplay(card.find('.skull-icon'), isDead);

                let canKick = (myName === data.host && p !== myName);
                card.find('.kick-btn').css('display', canKick ? 'flex' : 'none');

                let bubble = card.find('.vote-bubble');
                if (data.phase === 'legislative' && data.last_result && data.last_result.details && data.last_result.details[p]) {
                    let v = data.last_result.details[p];
                    let color = (v === 'Ja') ? '#27ae60' : '#c0392b';
                    bubble.text(v).css('color', color).addClass('show');
                } else if (data.phase === 'voting' && data.votes[p]) {
                    bubble.text("READY").css('color', '#7f8c8d').addClass('show');
                } else {
                    bubble.removeClass('show');
                }
            });

            container.children('.player-card').each(function () {
                if (!activeIds.includes(this.id)) { $(this).remove(); }
            });
        }

        // 2. HELPER: Toggle display without breaking layout
        function toggleDisplay(elem, condition) {
            if (condition) { if (!elem.is(':visible')) elem.fadeIn(200); }
            else { if (elem.is(':visible')) elem.hide(); }
        }

        // 3. HELPER: Optimistic Click (Instant Feedback)
        function optimisticPost(url, data, btnElement) {
            if (btnElement) $(btnElement).addClass('processing'); // Visual feedback
            if (!data) data = {};
            let activeCode = currentRoomCode || (currentGameState && currentGameState.room_code) || Store.getSession('active_room') || '';
            if (activeCode && typeof data === 'object' && !data.room_code) {
                data.room_code = activeCode;
            }
            $.post(url, data, function (res) {
                if (res.error) {
                    if (btnElement) $(btnElement).removeClass('processing');
                    showModal("Error", res.error, null, true);
                }
            });
        }
        $('#join-btn').click(() => {
            let n = $('#username').val();
            if (!n) showModal("Alert", "Please enter a name", null, true, "OK");
            else joinGame(n);
        });

        function openAvatarModal() {
            // Get the freshest data from global storage
            let data = currentGameState;
            let myAvatar = (data.avatars && data.avatars[myName]) ? data.avatars[myName] : '';
            let myStyle = (data.card_styles && data.card_styles[myName]) ? data.card_styles[myName] : 'style_standard';

            // HELPER: Checks if an avatar is taken GIVEN a specific style
            function checkTaken(avId, styleId) {
                return data.players.some(p => {
                    if (p === myName) return false; // Ignore myself
                    let pAv = data.avatars[p] || 'avatar_1';
                    let pSt = data.card_styles[p] || 'style_standard';
                    return (pAv === avId && pSt === styleId);
                });
            }

            // 2. Generate Avatar Grid
            let grid = $('#avatar-grid');
            grid.empty();

            for (let i = 1; i <= 24; i++) {
                let id = `avatar_${i}`;
                let isSelected = (id === myAvatar);

                // Check based on CURRENT style initially
                let isTaken = checkTaken(id, myStyle);

                let imgUrl = `/static/img/${myStyle}/${id}.png`;

                let el = $(`<div class="avatar-option ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}"
                      data-avatar-id="${id}"
                      style="background-image:url('${imgUrl}');"></div>`);

                // CLICK HANDLER FOR AVATAR
                el.click(function () {
                    if ($(this).hasClass('taken')) return; // Prevent clicking taken ones

                    $('.avatar-option').removeClass('selected');
                    $(this).addClass('selected');
                    $.post('/secret/set_avatar', { avatar: id }, function (res) {
                        if (res.success) Store.set('avatar_pref', id);
                        else showModal("Error", res.error, null, true);
                    });
                });
                grid.append(el);
            }

            // 3. Generate Style Grid
            let sGrid = $('#style-grid');
            sGrid.empty();

            let styles = [
                { id: 'style_standard', name: 'Standard' },
                { id: 'style_classified', name: 'Classified' },
                { id: 'style_blueprint', name: 'Blueprint' },
                { id: 'style_noir', name: 'Noir' },
                { id: 'style_executive', name: 'Executive' },
                { id: 'style_industrial', name: 'Industrial' },
                { id: 'style_propaganda', name: 'Propaganda' },
                { id: 'style_archive', name: 'Archive' },
                { id: 'style_terminal', name: 'Terminal' },
                { id: 'style_bauhaus', name: 'Bauhaus' },
                { id: 'style_imperial', name: 'Imperial' },
                { id: 'style_uniform', name: 'Uniform' }
            ];

            styles.forEach(s => {
                let isSel = (s.id === myStyle);
                let el = $(`<div class="style-option ${s.id} ${isSel ? 'selected' : ''}"
                     style="display:flex; justify-content:center; align-items:center; font-size:12px; font-weight:bold;">
                     ${s.name}
                   </div>`);

                // CLICK HANDLER FOR STYLE
                el.click(function () {
                    let self = this;

                    // Try to set style
                    $.post('/secret/set_style', { style: s.id }, function (res) {
                        if (res.success) {
                            Store.set('style_pref', s.id);

                            // Visual Update
                            $('.style-option').removeClass('selected');
                            $(self).addClass('selected');

                            // --- REFRESH AVATAR GRID ---
                            // 1. Update Images
                            // 2. Update 'Taken' status based on NEW style
                            $('#avatar-grid .avatar-option').each(function () {
                                let avId = $(this).attr('data-avatar-id');

                                // New Image URL
                                let newUrl = `/static/img/${s.id}/${avId}.png`;
                                $(this).css('background-image', `url('${newUrl}')`);

                                // New Taken Status
                                let nowTaken = checkTaken(avId, s.id);
                                if (nowTaken) $(this).addClass('taken');
                                else $(this).removeClass('taken');
                            });
                        } else {
                            showModal("Unavailable", res.error, null, true);
                        }
                    });
                });
                sGrid.append(el);
            });

            switchIdentityTab('avatar');
            $('#avatar-modal').css('display', 'flex').hide().fadeIn(200);
        }

        function switchIdentityTab(tab) {
            let btns = $('.toggle-btn');
            let slider = $('.identity-toggle');

            btns.removeClass('active');

            if (tab === 'avatar') {
                $(btns[0]).addClass('active');
                slider.removeClass('right');
                $('#avatar-grid').show();
                $('#style-grid').hide();
            } else {
                $(btns[1]).addClass('active');
                slider.addClass('right');
                $('#avatar-grid').hide();
                $('#style-grid').css('display', 'grid');
            }
        }

        function triggerAnnouncement(data) {
            let overlay = $('#announcement-overlay');
            let card = $('#announce-card');
            let text = $('#announce-text');

            // Hard Reset
            card.removeAttr('style');
            card.removeClass('card-lib card-fas');
            card.empty();
            card.css('background-size', '100% 100%'); // Ensure images fit

            let type = data;

            // A. POLICIES
            if (type === 'Liberal') {
                card.addClass('card-lib');
                text.html("LIBERAL POLICY<br>ENACTED"); text.css('color', '#3498db'); card.css('box-shadow', '0 0 50px #3498db');
            }
            else if (type === 'Fascist') {
                card.addClass('card-fas');
                text.html("FASCIST POLICY<br>ENACTED"); text.css('color', '#c0392b'); card.css('box-shadow', '0 0 50px #c0392b');
            }

            // B. EXECUTIONS / REVEALS
            else if (type.startsWith('Reveal_')) {
                let role = type.replace('Reveal_', '');
                let imgName = (role === 'Hitler') ? 'role_hitler.png' : (role === 'Liberal' ? 'role_liberal.png' : 'role_fascist.png');
                let color = (role === 'Liberal') ? '#3498db' : '#c0392b';

                card.css('background-image', `url('/static/img/${imgName}')`);
                text.html(`${role.toUpperCase()}<br>EXECUTED`);
                text.css('color', color);
                card.css('box-shadow', `0 0 50px ${color}`);
            }

            // C. FALLBACK
            else if (type === 'Hitler') {
                card.css('background-image', "url('/static/img/role_hitler.png')");
                text.html("HITLER<br>EXECUTED"); text.css('color', '#c0392b');
            }

            // Play
            overlay.css('display', 'flex');
            setTimeout(() => { overlay.addClass('active'); }, 10);
            setTimeout(() => { overlay.removeClass('active'); setTimeout(() => { overlay.hide(); }, 300); }, 3500);
        }

        function renderGameOver(data) {
            let screen = $('#summary-screen');

            // 1. Create Screen if it doesn't exist in HTML yet
            if (screen.length === 0) {
                $('body').append(`<div id="summary-screen" class="screen">
            <div id="winner-banner" class="winner-banner"></div>
            <div id="summary-grid" class="summary-grid"></div>
            <div id="host-newgame-btn" style="display:none; margin-top:30px;">
                <button class="btn btn-ja" onclick="$.post('/secret/reset_game')">START NEW GAME</button>
            </div>
        </div>`);
                screen = $('#summary-screen');
            }

            // 2. Set Winner Text
            let color = data.game_over_msg.includes("LIBERALS") ? '#3498db' : '#c0392b';
            $('#winner-banner').text(data.game_over_msg).css('color', color).css('border-color', color);

            // 3. Render Role Grid
            let grid = $('#summary-grid');
            grid.empty();

            data.players.forEach(p => {
                let role = data.all_roles[p]; // Server sends this now
                let img = 'role_fascist.png';
                if (role === 'Liberal') img = 'role_liberal.png';
                if (role === 'Hitler') img = 'role_hitler.png';

                let card = $(`
            <div class="summary-card" style="background-image:url('/static/img/${img}'); border-color:${color}">
                <div class="summary-name">${p}</div>
            </div>
        `);
                grid.append(card);
            });

            // 4. Host Controls
            if (myName === data.host) $('#host-newgame-btn').show();
        }

        function showVoteBanner(data) {
            let overlay = $('#phase-overlay');
            let title = $('#phase-title');
            let sub = $('#phase-subtitle');

            isBannerBusy = true; // Lock the banner

            let color = data.passed ? '#27ae60' : '#c0392b';
            let titleText = data.passed ? "VOTE PASSED" : "VOTE FAILED";
            let subText = `JA: ${data.ja}  —  NEIN: ${data.nein}`;

            title.text(titleText).css('color', color);
            sub.text(subText).css('color', 'white').css('font-weight', 'bold');

            overlay.addClass('active');

            // Hide after 2.5 seconds and unlock
            setTimeout(() => {
                overlay.removeClass('active');
                setTimeout(() => {
                    isBannerBusy = false; // Unlock so Phase Banner can show
                    title.css('color', 'white'); // Reset color
                }, 300);
            }, 2500);
        }

        // --- ROBUST HEARTBEAT SYSTEM ---

        var heartbeatTimer = null;

        function markPlayerOnline(username) {
            let safeName = username.replace(/[^a-zA-Z0-9]/g, '_');
            let el = $(`#lobby-pcard-${safeName}, #game-pcard-${safeName}`);
            el.removeClass('offline');
            el.find('.disconnect-icon').hide();
        }

        function markPlayerOffline(username) {
            let safeName = username.replace(/[^a-zA-Z0-9]/g, '_');
            let el = $(`#lobby-pcard-${safeName}, #game-pcard-${safeName}`);
            el.addClass('offline');
            el.find('.disconnect-icon').show();
        }

        function syncOnlineStatus(onlineList) {
            $('.player-card, .lobby-card').each(function () {
                let card = $(this);
                let pName = card.data('player-name') || card.find('.player-name, .lobby-pcard-name').text().trim();
                if (pName && !onlineList.includes(pName)) {
                    card.addClass('offline');
                    card.find('.disconnect-icon').show();
                } else if (pName) {
                    card.removeClass('offline');
                    card.find('.disconnect-icon').hide();
                }
            });
        }

        // Function to send a single heartbeat (lightweight server-side touch)
        function sendHeartbeat() {
            if (!myName || !currentRoomCode) return;

            let hbUrl = currentRoomCode ? ('/secret/' + currentRoomCode + '/heartbeat') : '/secret/heartbeat';
            $.post(hbUrl, { room_code: currentRoomCode }, function (res) {
                if (res.room_closed) {
                    showRoomBrowser();
                    return;
                }

                // Fallback offline display if Pusher presence is not connected
                if (res.offline && (!presenceChannel || !presenceChannel.subscribed)) {
                    res.offline.forEach(p => markPlayerOffline(p));
                }
                if (res.state) {
                    updateUI(res.state);
                }
            });
        }

        // Function to start the loop (30s lightweight keepalive - presence is instant via Pusher)
        function startHeartbeatLoop() {
            if (heartbeatTimer) return;
            sendHeartbeat();
            heartbeatTimer = setInterval(sendHeartbeat, 30000); // 30s keepalive
        }

        // Function to stop the loop
        function stopHeartbeatLoop() {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        }

        // 2. Handle Minimizing / Switching Apps (Mobile Fix)
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === 'hidden') {
                stopHeartbeatLoop();
                if (currentRoomCode) {
                    let data = new FormData();
                    data.append('status', 'leaving');
                    data.append('room_code', currentRoomCode);
                    navigator.sendBeacon('/secret/heartbeat', data);
                }
            } else if (document.visibilityState === 'visible') {
                if (currentRoomCode) {
                    startHeartbeatLoop();
                }
            }
        });

        // 3. Handle Tab Closing (Desktop)
        $(window).on('beforeunload', function () {
            if (currentRoomCode) {
                let data = new FormData();
                data.append('status', 'leaving');
                data.append('room_code', currentRoomCode);
                navigator.sendBeacon('/secret/heartbeat', data);
            }
        });

        // Global Window Exports for inline HTML event handlers
        window.createRoom = createRoom;
        window.joinRoomByInput = joinRoomByInput;
        window.joinRoom = joinRoom;
        window.loadRoomList = loadRoomList;
        window.leaveGame = leaveGame;
        window.safeAction = safeAction;
        window.openRoleModal = openRoleModal;
        window.switchIdentityTab = switchIdentityTab;
        window.showRoomBrowser = showRoomBrowser;
        if (typeof openIdentityModal !== 'undefined') window.openIdentityModal = openIdentityModal;
        if (typeof selectAvatar !== 'undefined') window.selectAvatar = selectAvatar;
        if (typeof selectCardStyle !== 'undefined') window.selectCardStyle = selectCardStyle;
