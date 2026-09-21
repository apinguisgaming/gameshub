/**
 * Song Guesser Client Engine
 */

(function () {
    'use strict';

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
        console.log('%c[SongGuesser Pusher Connection]', 'color: #38d9a9; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;', states.current);
    });


    var channel = null;
    var presenceChannel = null;
    var currentRoomCode = "";
    var myName = (window.GAMEHUB_USER && window.GAMEHUB_USER.username) || (cfg.user && cfg.user.username) || "";
    var isHost = false;
    var currentGameState = null;

    var audio = null;
    var audioUnlocked = false;
    var timerInterval = null;
    var heartbeatTimer = null;
    var hasGuessed = false;
    var roundStartTime = 0;
    var nextAudio = new Audio();

    var roomListTimer = null;
    var lastLobbySig = "";

    // Setup global AJAX timeout (8s)
    $.ajaxSetup({ timeout: 8000 });

    // Inject room_code automatically into all jQuery POST requests (auth token handled by tab-auth.js)
    $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        if (currentRoomCode && options.type && options.type.toUpperCase() === 'POST') {
            if (typeof options.data === 'string') {
                if (options.data.indexOf('room_code=') === -1) {
                    options.data += (options.data ? '&' : '') + 'room_code=' + encodeURIComponent(currentRoomCode);
                }
            } else if (typeof FormData !== 'undefined' && options.data instanceof FormData) {
                if (!options.data.has('room_code')) {
                    options.data.append('room_code', currentRoomCode);
                }
            } else if (typeof options.data === 'object' && options.data !== null) {
                if (!options.data.room_code) {
                    options.data.room_code = currentRoomCode;
                }
            } else if (!options.data) {
                options.data = 'room_code=' + encodeURIComponent(currentRoomCode);
            }
        }
    });

    $(document).ready(function () {
        if (window.GAMEHUB_USER && window.GAMEHUB_USER.username) {
            myName = window.GAMEHUB_USER.username;
        }
        if ($('#game-audio').length === 0) {
            $('body').append('<audio id="game-audio" preload="auto" playsinline></audio>');
        }
        audio = document.getElementById('game-audio');

        $('.screen').hide();

        let hashRoom = window.location.hash ? window.location.hash.substring(1).toUpperCase().trim() : '';
        let savedRoom = sessionStorage.getItem('song_active_room') || '';

        if (hashRoom || savedRoom) {
            joinRoom(hashRoom || savedRoom);
        } else {
            showRoomBrowser();
        }

        $('body').one('click', function () {
            if (!audioUnlocked) {
                audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQAAAAA=";
                audio.play().then(() => {
                    audio.pause();
                    audioUnlocked = true;
                }).catch(e => console.log("Audio unlock"));
            }
        });

        $(document).on('click', '.gamehub-back-btn', function () {
            sessionStorage.removeItem('song_active_room');
            if (currentRoomCode) {
                let d = new FormData();
                d.append('status', 'leaving');
                d.append('room_code', currentRoomCode);
                try { navigator.sendBeacon('/song/heartbeat', d); } catch(e) {}
            }
        });
    });

    function showRoomBrowser() {
        stopHeartbeatLoop();
        currentRoomCode = "";
        sessionStorage.removeItem('song_active_room');
        window.location.hash = "";
        $('.screen').hide();
        $('#screen-room-browser').show();
        loadRoomList(false);
        if (!roomListTimer) {
            roomListTimer = setInterval(function () {
                if ($('#screen-room-browser').is(':visible')) {
                    loadRoomList(true);
                }
            }, 3000);
        }
    }

    function loadRoomList(silent) {
        if (!silent) {
            $('#song-room-list').html('<div class="room-list-loading">Lade Sessions...</div>');
        }
        $.get('/song/rooms', function (res) {
            if (!res.rooms || res.rooms.length === 0) {
                $('#song-room-list').html('<div style="text-align:center; padding:16px; color:#94a3b8; border:1.5px dashed rgba(255,255,255,0.2); border-radius:6px; font-size:0.85rem;">Keine aktiven Sessions.<br>Erstelle oben einen neuen Raum!</div>');
                return;
            }
            let html = '';
            res.rooms.forEach(r => {
                let isLobby = r.status === 'lobby';
                let statusClass = isLobby ? 'status-lobby' : 'status-playing';
                let statusText = isLobby ? 'LOBBY' : 'IN SPIEL';
                let btnText = isLobby ? 'BEITRETEN' : 'ZUSCHAUEN';
                html += `
                    <div class="room-item-row">
                        <div class="room-info">
                            <div class="room-code-title">
                                <span class="room-code">${r.room_code}</span>
                                <span class="room-status ${statusClass}">${statusText}</span>
                            </div>
                            <div class="room-meta">Host: <strong>${r.host_username || 'Unbekannt'}</strong> • ${r.player_count}/12 Spieler</div>
                        </div>
                        <button onclick="joinRoom('${r.room_code}')" class="btn-action btn-room-join">${btnText}</button>
                    </div>
                `;
            });
            $('#song-room-list').html(html);
        }).fail(function () {
            $('#song-room-list').html('<div style="text-align:center; padding:10px; color:#ef4444; font-size:0.85rem;">Fehler beim Laden der Räume.</div>');
        });
    }

    function createRoom() {
        $.post('/song/create_room', function (res) {
            if (res.success && res.room_code) {
                joinRoom(res.room_code);
            } else {
                alert(res.error || "Konnte Raum nicht erstellen.");
            }
        }).fail(function () {
            alert("Serverfehler beim Erstellen.");
        });
    }

    function joinRoomByInput() {
        let code = $('#input-room-code').val().trim().toUpperCase();
        if (!code || code.length < 3) return alert("Gültigen Raumcode eingeben!");
        joinRoom(code);
    }

    function bindPusherEvents() {
        channel.bind('settings-update', function (data) {
            if (data && data.settings) {
                if (data.key === 'time_per_song' || !data.key) {
                    updateControlVisuals('ctrl-time', data.settings.time_per_song);
                }
                if (data.key === 'total_songs' || !data.key) {
                    updateControlVisuals('ctrl-count', data.settings.total_songs);
                }
                if (data.key === 'playlists' || !data.key) {
                    const plNames = data.settings.playlists || [];
                    $('.playlist-card').removeClass('selected');
                    plNames.forEach(pl => {
                        $(`.playlist-card[data-playlist="${pl}"]`).addClass('selected');
                    });
                    $('#pl-summary').text(plNames.length > 0 ? plNames.length + " AUSGEWÄHLT" : "ALLE (Standard)");
                }
                if (data.key === 'playlists_open' || !data.key) {
                    if (typeof data.settings.playlists_open !== 'undefined') {
                        togglePlaylists(data.settings.playlists_open, true);
                    }
                }
            }
        });

        channel.bind('state-update', function (data) {
            if (window.GameDelta) window.GameDelta.logUpdate('Song', data);
            updateUI(data);
        });

        channel.bind('round-preload', function(data) {
            if (!myName) return;
            updateUI(data);

            $('#options-container').empty();
            $('#timer-display').text("LADEN...");
            $('.vinyl-container').removeClass('spinning');

            let song = data.round.current_song;
            audio.src = song.url;

            $(audio).one('loadedmetadata', function() {
                audio.currentTime = song.offset || 0;
            });

            let fallback = setTimeout(() => {
                $.post('/song/player_ready');
            }, 4000);

            $(audio).one('canplaythrough', function() {
                clearTimeout(fallback);
                $.post('/song/player_ready');
            });

            audio.load();

            if (isHost) {
                setTimeout(() => {
                    $.post('/song/force_start');
                }, 5000);
            }
        });

        channel.bind('round-start', function (data) {
            if (!myName) return;
            if (data && data.scores) {
                renderGameLeaderboard(data.scores, data.players || []);
            }

            hasGuessed = false;
            roundStartTime = Date.now();

            const $container = $('#options-container');
            $container.empty().removeClass('disabled');

            let song = data.round.current_song;

            song.options.forEach(opt => {
                const $btn = $('<button></button>')
                    .addClass('btn-option')
                    .attr('id', 'btn-' + opt.id)
                    .attr('data-id', opt.id)
                    .text(opt.label)
                    .on('click', function () {
                        clickOption(opt.id);
                    });
                $container.append($btn);
            });

            if (audio.currentTime < song.offset) {
                audio.currentTime = song.offset || 0;
            }

            let playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    $('#audio-overlay').css('display', 'flex');
                });
            }

            $('.vinyl-container').addClass('spinning');
            startLocalTimer(song.duration);
        });

        channel.bind('round-end', function (data) {
            if (data && data.scores) {
                renderGameLeaderboard(data.scores, data.players || []);
            }
            let correctId = data.round.reveal_answer;
            let isLastRound = data.round.is_last_round;

            let correctBtn = $(document.getElementById('btn-' + correctId));
            if (correctBtn.length === 0) {
                correctBtn = $(`.btn-option[data-id="${correctId}"]`);
            }

            $('.btn-option').prop('disabled', true);
            correctBtn.addClass('correct');
            $('.btn-option').not(correctBtn).addClass('wrong');

            $('.vinyl-container').removeClass('spinning');
            audio.pause();

            if (data.round.preload_url) {
                nextAudio.src = data.round.preload_url;
                nextAudio.load();
            }

            let nextTime = 5;
            let label = isLastRound ? "FINALE: " : "NEXT: ";
            $('#timer-display').text(label + nextTime);

            let intermission = setInterval(() => {
                nextTime--;
                if (nextTime > 0) {
                    $('#timer-display').text(label + nextTime);
                } else {
                    clearInterval(intermission);
                    $('#timer-display').text("LOADING...");
                }
            }, 1000);

            if (isHost) {
                setTimeout(() => {
                    if (isLastRound) {
                        $.post('/song/finish_game', { room_code: currentRoomCode });
                    } else {
                        $.post('/song/start_game', { room_code: currentRoomCode });
                    }
                }, 5000);
            }
        });

        channel.bind('game-over', function (data) {
            updateUI(data);
        });

        channel.bind('game-reset', function () {
            console.log('%c[SongGuesser] In-Memory Game Reset', 'color: #51cf66; font-weight: bold;');
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            clearInterval(timerInterval);
            hasGuessed = false;
            $('#options-container').empty();
            $('.vinyl-container').removeClass('spinning');
            $('#timer-display').text('--:--');
            if (currentGameState) {
                currentGameState.status = 'lobby';
                updateUI(currentGameState);
            } else {
                $('.screen').hide();
                $('#screen-lobby').show();
            }
        });
    }

    function startLocalTimer(duration) {
        clearInterval(timerInterval);
        let display = $('#timer-display');
        let localStart = Date.now();

        timerInterval = setInterval(() => {
            let elapsed = (Date.now() - localStart) / 1000;
            let timeLeft = duration - elapsed;

            if (timeLeft <= 0) {
                timeLeft = 0;
                clearInterval(timerInterval);
                audio.pause();
                $('.vinyl-container').removeClass('spinning');

                if (isHost) {
                    $.post('/song/end_round', { room_code: currentRoomCode });
                }
            }

            let s = Math.ceil(timeLeft);
            display.text(`00:${s < 10 ? '0' + s : s}`);
        }, 100);
    }

    function clickOption(id) {
        if (hasGuessed) return;
        hasGuessed = true;

        let elapsed = 0;
        if (roundStartTime > 0) {
            elapsed = (Date.now() - roundStartTime) / 1000;
        }

        let btn = $(document.getElementById('btn-' + id));
        if (btn.length === 0) {
            btn = $(`.btn-option[data-id="${id}"]`);
        }

        btn.css('border-color', 'var(--c-white)').css('background', 'rgba(255,255,255,0.2)');
        $('.btn-option').prop('disabled', true);

        $.post('/song/submit_guess', { guess_id: id, elapsed: elapsed }, function (res) {
            if (res.scores) {
                renderGameLeaderboard(res.scores);
            }
            if (res.result === 'correct') {
                btn.addClass('correct');
                let pts = res.points || 0;
                btn.append(`<div class="floating-points">+ ${pts}</div>`);
                setTimeout(() => { btn.find('.floating-points').remove(); }, 1500);
            } else {
                btn.addClass('wrong');
            }
        }).fail(function () {
            $('.btn-option').prop('disabled', false);
            btn.css('border-color', '').css('background', '');
            showToast("Antwort konnte nicht übermittelt werden.");
        });
    }

    function forceAudioPlay() {
        $('#audio-overlay').hide();
        audio.pause();
        let playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                audio.load();
            });
        }
    }

    function joinRoom(code) {
        code = code.toUpperCase().trim();
        currentRoomCode = code;
        if (roomListTimer) { clearInterval(roomListTimer); roomListTimer = null; }
        sessionStorage.setItem('song_active_room', code);
        window.location.hash = code;
        $('#song-lobby-code').text(code);
        $('.active-room-display').text(code);

        if (channel) {
            channel.unbind_all();
            pusher.unsubscribe(channel.name);
        }
        console.log('%c[SongGuesser] Subscribing:', 'color: #ffd43b; font-weight: bold; background: #2a2200; padding: 2px 6px; border-radius: 3px;', 'song-' + code);
        channel = pusher.subscribe('song-' + code);
        channel.bind('pusher:subscription_succeeded', function () {
            console.log('%c[SongGuesser] Pusher Channel verbunden! ✅', 'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;');
        });
        bindPusherEvents();


        if (presenceChannel) {
            try {
                presenceChannel.unbind_all();
                pusher.unsubscribe(presenceChannel.name);
            } catch(e) {}
            presenceChannel = null;
        }
        try {
            presenceChannel = pusher.subscribe('presence-song-' + code);
            presenceChannel.bind('pusher:subscription_succeeded', function(members) {
                let online = [];
                members.each(function(m) {
                    if (m.info && m.info.username) online.push(m.info.username);
                });
                syncSongOnlineStatus(online);
            });
            presenceChannel.bind('pusher:member_added', function(member) {
                if (member.info && member.info.username) {
                    $(`#p-row-${member.info.username}`).removeClass('offline');
                }
            });
            presenceChannel.bind('pusher:member_removed', function(member) {
                if (member.info && member.info.username) {
                    $(`#p-row-${member.info.username}`).addClass('offline');
                }
            });
        } catch(e) {}

        $.post('/song/join_game', { room_code: code }, function (data) {
            if (data.error) {
                alert(data.error);
                showRoomBrowser();
            } else {
                updateUI(data);
                startHeartbeatLoop();
            }
        }).fail(function () {
            alert("Verbindungsfehler beim Beitreten.");
            showRoomBrowser();
        });
    }

    function leaveGame() {
        sessionStorage.removeItem('song_active_room');
        window.location.hash = "";
        let code = currentRoomCode;
        currentRoomCode = "";
        if (channel) {
            try {
                channel.unbind_all();
                pusher.unsubscribe(channel.name);
            } catch(e) {}
            channel = null;
        }
        if (presenceChannel) {
            try {
                presenceChannel.unbind_all();
                pusher.unsubscribe(presenceChannel.name);
            } catch(e) {}
            presenceChannel = null;
        }
        if (code) {
            $.post('/song/leave_game', { room_code: code }).always(function () {
                showRoomBrowser();
            });
        } else {
            showRoomBrowser();
        }
    }

    function confirmLeaveGame() {
        if ($('#screen-game').is(':visible')) {
            if (confirm("Möchtest du das laufende Spiel wirklich verlassen?")) {
                leaveGame();
            }
        } else {
            leaveGame();
        }
    }

    function showToast(msg) {
        let container = $('#toast-container');
        if (container.length === 0) {
            container = $('<div id="toast-container" class="toast-container" aria-live="polite"></div>').appendTo('body');
        }
        let bubble = $('<div class="toast-bubble"></div>').text(msg);
        container.append(bubble);
        setTimeout(() => bubble.addClass('show'), 20);
        setTimeout(() => {
            bubble.removeClass('show');
            setTimeout(() => bubble.remove(), 250);
        }, 2200);
    }

    function copyRoomCode() {
        let code = currentRoomCode || $('#song-lobby-code').text() || $('.active-room-display').first().text() || '';
        code = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
        if (!code || code === '----') return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(function () {
                showToast("Raumcode kopiert: " + code);
            }).catch(function () {
                fallbackCopy(code);
            });
        } else {
            fallbackCopy(code);
        }
    }

    function fallbackCopy(code) {
        try {
            let $temp = $('<input>').val(code).appendTo('body').select();
            document.execCommand('copy');
            $temp.remove();
            showToast("Raumcode kopiert: " + code);
        } catch (e) {
            showToast("Code: " + code);
        }
    }

    function startGame() {
        const minPlayers = (window.GAME_CONFIG && window.GAME_CONFIG.min_players) || 2;
        if (currentGameState && currentGameState.players && currentGameState.players.length < minPlayers) {
            alert(`⚠️ Mindestens ${minPlayers} Spieler erforderlich!`);
            return;
        }
        const selected = [];
        $('.playlist-card.selected').each(function () {
            selected.push($(this).data('playlist') || $(this).text().trim());
        });

        $.post('/song/update_settings', { key: 'playlists', value: selected.join(','), room_code: currentRoomCode }, function () {
            $.post('/song/start_game', { room_code: currentRoomCode }, function (response) {
                if (response.error) {
                    alert("⚠️ START FAILED: " + response.error);
                }
            }).fail(function (xhr) {
                alert("⚠️ Start fehlgeschlagen: " + ((xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText));
            });
        }).fail(function (xhr) {
            alert("⚠️ Einstellungen konnten nicht gespeichert werden: " + ((xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText));
        });
    }

    function resetGame() {
        if (!isHost && !confirm("Möchtest du das Spiel abbrechen und zur Lobby zurückkehren?")) return;
        let code = currentRoomCode;
        $.post('/song/reset_game', { room_code: code }, function () {
            if (code) {
                $.post('/song/join_game', { room_code: code }, function (data) {
                    if (data && !data.error) updateUI(data);
                });
            }
        }).fail(function () {
            leaveGame();
        });
    }

    function updateSetting(key, val) {
        if (!isHost && key !== 'playlists_open') {
            console.warn("[updateSetting] Blocked: current client is not host.", { myName: myName, currentRoomCode: currentRoomCode });
            return;
        }
        if (key === 'time_per_song') updateControlVisuals('ctrl-time', val);
        if (key === 'total_songs') updateControlVisuals('ctrl-count', val);
        console.log("[updateSetting] Sending update:", key, val, "for room:", currentRoomCode);
        $.post('/song/update_settings', { key: key, value: val, room_code: currentRoomCode }, function (res) {
            if (res.error) {
                console.error("[updateSetting] Server returned error:", res.error);
            } else {
                console.log("[updateSetting] Server success:", res);
            }
        }).fail(function (xhr) {
            console.error("[updateSetting] Request failed:", xhr.status, xhr.responseText);
        });
    }

    function togglePlaylist(el) {
        if (!isHost) {
            console.warn("[togglePlaylist] Blocked: current client is not host.");
            return;
        }
        $(el).toggleClass('selected');

        const selected = [];
        $('.playlist-card.selected').each(function () {
            selected.push($(this).data('playlist') || $(this).text().trim());
        });
        $('#pl-summary').text(selected.length > 0 ? selected.length + " AUSGEWÄHLT" : "ALLE (Standard)");
        updateSetting('playlists', selected.join(','));
    }

    function togglePlaylists(forceState, fromPusher) {
        const el = document.getElementById('playlist-container');
        const icon = document.getElementById('pl-icon');
        if (!el) return;

        let shouldOpen;
        if (typeof forceState === 'boolean') {
            shouldOpen = forceState;
        } else {
            shouldOpen = !el.classList.contains('open');
        }

        if (shouldOpen) {
            el.classList.add('open');
        } else {
            el.classList.remove('open');
        }

        if (icon) {
            icon.style.transform = shouldOpen ? "rotate(180deg)" : "rotate(0deg)";
        }

        if (!fromPusher && currentRoomCode) {
            updateSetting('playlists_open', shouldOpen);
        }
    }

    function updateUI(data) {
        if (!data) return;
        if (window.GameDelta) {
            currentGameState = window.GameDelta.apply(currentGameState, data);
            data = currentGameState;
        } else {
            currentGameState = data;
        }
        if (!myName && window.GAMEHUB_USER && window.GAMEHUB_USER.username) {
            myName = window.GAMEHUB_USER.username;
        }
        if (data.host) {
            isHost = Boolean(myName && data.host.trim().toLowerCase() === myName.trim().toLowerCase());
        }
        if (isHost) $('.host-only-btn').show(); else $('.host-only-btn').hide();

        if (data.status === 'lobby') {
            if ($('#screen-lobby').is(':hidden')) {
                $('.screen').hide();
                $('#screen-lobby').show();
            }
            if (audio) { audio.pause(); }
            renderLobby(data);
        }
        else if (data.status === 'finished') {
            if ($('#screen-result').is(':hidden')) {
                $('.screen').hide();
                $('#screen-result').show();
            }
            renderResult(data);
        }
        else {
            if ($('#screen-game').is(':hidden')) {
                $('.screen').hide();
                $('#screen-game').show();
            }
            renderGame(data);
        }
    }

    function renderLobby(data) {
        let sig = JSON.stringify([data.players, data.host, data.scores, data.settings, isHost]);
        if (sig === lastLobbySig && $('#player-list').children().length > 0) return;
        lastLobbySig = sig;

        const list = $('#player-list');
        list.empty();

        (data.players || []).forEach(p => {
            let classes = 'player-row';
            if (p === myName) classes += ' me';
            if (p === data.host) classes += ' host';

            list.append(`<div id="p-row-${p}" class="${classes}">
                <span>${p}</span>
                <span style="font-size:0.8rem;">${(data.scores && data.scores[p]) || 0} PTS</span>
            </div>`);
        });

        if (data.settings) {
            updateControlVisuals('ctrl-time', data.settings.time_per_song);
            updateControlVisuals('ctrl-count', data.settings.total_songs);

            const plNames = data.settings.playlists || [];
            $('.playlist-card').removeClass('selected');
            plNames.forEach(pl => {
                $(`.playlist-card[data-playlist="${pl}"]`).addClass('selected');
            });

            $('#pl-summary').text(plNames.length > 0 ? plNames.length + " AUSGEWÄHLT" : "ALLE (Standard)");

            if (typeof data.settings.playlists_open !== 'undefined') {
                togglePlaylists(data.settings.playlists_open, true);
            }
        }

        if (isHost) {
            $('#wait-msg').hide();
            $('.settings-panel').removeClass('read-only');
            const count = (data.players || []).length;
            const minPlayers = (window.GAME_CONFIG && window.GAME_CONFIG.min_players) || 2;
            if (count < minPlayers) {
                $('#btn-start').prop('disabled', true).css({ opacity: '0.5', cursor: 'not-allowed' }).text(`WARTE AUF MITSPIELER (MIN. ${minPlayers})`);
            } else {
                $('#btn-start').prop('disabled', false).css({ opacity: '1', cursor: 'pointer' }).text('SPIEL STARTEN');
            }
        } else {
            $('#wait-msg').show();
            $('.settings-panel').addClass('read-only');
        }
    }

    function renderGameLeaderboard(scores, players) {
        const board = $('#game-leaderboard');
        if (board.length === 0) return;

        let allNames = Array.from(new Set([...(players || []), ...Object.keys(scores || {})]));
        if (allNames.length === 0) {
            board.html('<div style="text-align:center; color:rgba(255,255,255,0.4); padding:10px; font-size:0.8rem;">Warte auf Punktestand...</div>');
            return;
        }

        let sorted = allNames.map(name => ({
            name: name,
            score: (scores && typeof scores[name] === 'number') ? scores[name] : 0
        }));
        sorted.sort((a, b) => b.score - a.score);

        board.empty();
        sorted.forEach((p, idx) => {
            let rank = idx + 1;
            let isMe = Boolean(myName && p.name.trim().toLowerCase() === myName.trim().toLowerCase());
            let medal = rank === 1 ? '🥇 ' : (rank === 2 ? '🥈 ' : (rank === 3 ? '🥉 ' : ''));

            board.append(`
                <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-player">
                        <span class="lb-rank">${rank}.</span>
                        <span class="lb-name">${medal}${p.name}</span>
                        ${isMe ? '<span class="lb-you-badge">DU</span>' : ''}
                    </div>
                    <div class="lb-score">
                        ${p.score} <span class="lb-pts">PTS</span>
                    </div>
                </div>
            `);
        });
    }

    function renderGame(data) {
        renderGameLeaderboard(data.scores || {}, data.players || []);

        if (data.round && data.settings) {
            let cur = data.round.number;
            let max = data.settings.total_songs;
            $('#round-counter').text(`ROUND ${cur} / ${max}`);
        }

        if (data.round && data.round.status === 'playing' && data.round.current_song) {
            if (audio.paused && !audio.ended) {
                let serverStartTime = data.round.start_time;
                let now = Date.now() / 1000;

                let timePassed = Math.max(0, now - serverStartTime);
                let timeRemaining = data.round.current_song.duration - timePassed;

                if (timeRemaining > 0) {
                    audio.src = data.round.current_song.url;
                    audio.currentTime = data.round.current_song.offset + timePassed;

                    let playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(e => {
                            $('#audio-overlay').css('display', 'flex');
                        });
                    }

                    $('.vinyl-container').addClass('spinning');
                    startLocalTimer(timeRemaining);
                }
            }
        }
    }

    function renderResult(data) {
        if (audio) { audio.pause(); }
        $('.vinyl-container').removeClass('spinning');

        const board = $('#final-leaderboard');
        board.empty();

        let sortedPlayers = Object.keys(data.scores || {}).map(key => {
            return { name: key, score: data.scores[key] };
        });

        sortedPlayers.sort((a, b) => b.score - a.score);

        sortedPlayers.forEach((p, index) => {
            let rank = index + 1;
            let medal = "";
            if (rank === 1) medal = "🥇 ";
            if (rank === 2) medal = "🥈 ";
            if (rank === 3) medal = "🥉 ";

            let isMe = (p.name === myName);

            board.append(`
                <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
                    <div class="lb-player">
                        <span class="lb-rank">${rank}.</span>
                        <span class="lb-name">${medal}${p.name}</span>
                        ${isMe ? '<span class="lb-you-badge">DU</span>' : ''}
                    </div>
                    <div class="lb-score">${p.score} <span class="lb-pts">PTS</span></div>
                </div>
            `);
        });
    }

    function updateControlVisuals(id, val) {
        $(`#${id} .control-opt`).removeClass('active');
        $(`#${id} .control-opt[data-val="${val}"]`).addClass('active');
    }

    function syncSongOnlineStatus(onlineList) {
        $('.player-row').each(function () {
            let row = $(this);
            let pName = row.data('player') || row.attr('id').replace('p-row-', '');
            if (pName && !onlineList.includes(pName)) {
                row.addClass('offline');
            } else if (pName) {
                row.removeClass('offline');
            }
        });
    }

    function sendHeartbeat() {
        if (!myName || !currentRoomCode) return;
        let hbUrl = currentRoomCode ? ('/song/' + currentRoomCode + '/heartbeat') : '/song/heartbeat';
        $.post(hbUrl, { status: 'active', room_code: currentRoomCode }, function (res) {
            if (res.room_closed) {
                showRoomBrowser();
                return;
            }
            if (res.offline && (!presenceChannel || !presenceChannel.subscribed)) {
                $('.player-row').removeClass('offline');
                res.offline.forEach(p => { $(`#p-row-${p}`).addClass('offline'); });
            }
            if (res.state) {
                if (res.state.status === 'lobby') {
                    updateUI(res.state);
                } else if (res.state.status === 'finished') {
                    if ($('#screen-result').is(':hidden')) {
                        updateUI(res.state);
                    }
                } else if (res.state.status === 'playing') {
                    if ($('#screen-game').is(':hidden')) {
                        updateUI(res.state);
                    } else if (res.state.scores) {
                        renderGameLeaderboard(res.state.scores, res.state.players || []);
                    }
                }
            }
        });
    }

    function startHeartbeatLoop() {
        if (heartbeatTimer) return;
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, 30000);
    }

    function stopHeartbeatLoop() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === 'hidden') {
            stopHeartbeatLoop();
            if (myName && currentRoomCode) {
                let d = new FormData();
                d.append('status', 'leaving');
                d.append('room_code', currentRoomCode);
                navigator.sendBeacon('/song/heartbeat', d);
            }
        } else if (document.visibilityState === 'visible') {
            if (myName && currentRoomCode) {
                startHeartbeatLoop();
                $.post('/song/join_game', { room_code: currentRoomCode });
            }
        }
    });

    $(window).on('beforeunload', function () {
        if (myName && currentRoomCode) {
            let d = new FormData();
            d.append('status', 'leaving');
            d.append('room_code', currentRoomCode);
            navigator.sendBeacon('/song/heartbeat', d);
        }
    });

    // Expose functions for inline HTML event handlers
    window.createRoom = createRoom;
    window.joinRoomByInput = joinRoomByInput;
    window.loadRoomList = loadRoomList;
    window.joinRoom = joinRoom;
    window.leaveGame = leaveGame;
    window.confirmLeaveGame = confirmLeaveGame;
    window.copyRoomCode = copyRoomCode;
    window.showToast = showToast;
    window.startGame = startGame;
    window.resetGame = resetGame;
    window.updateSetting = updateSetting;
    window.togglePlaylist = togglePlaylist;
    window.togglePlaylists = togglePlaylists;
    window.forceAudioPlay = forceAudioPlay;
    window.clickOption = clickOption;
})();
