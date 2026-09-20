/**
 * static/common/game-lobby.js
 * Centralized client-side helper for multiplayer lobbies across GameHub.
 * DRY implementation for room discovery, code sharing, and heartbeat timers.
 */
(function (window) {
    'use strict';

    const GameLobby = {
        /**
         * Fetch active rooms for any game and render them cleanly into a container.
         * @param {string} gameId - e.g. 'geobingo', 'song', 'secret'
         * @param {string|HTMLElement} container - DOM element or selector
         * @param {Object} options - { onJoin: function(code), maxPlayers: number }
         */
        loadRooms: function (gameId, container, options) {
            options = options || {};
            const $el = typeof container === 'string' ? document.querySelector(container) : container;
            if (!$el) return;

            const url = `/${gameId}/rooms`;
            fetch(url, { headers: { 'Accept': 'application/json' } })
                .then(res => res.json())
                .then(data => {
                    const rooms = data.rooms || [];
                    if (rooms.length === 0) {
                        $el.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8; font-size:0.85rem;">Keine aktiven Räume gefunden.<br>Erstelle oben deinen eigenen!</div>';
                        return;
                    }

                    let html = '';
                    rooms.forEach(r => {
                        const isLobby = r.status === 'lobby';
                        const statusBadge = isLobby
                            ? '<span class="status-badge badge-lobby" style="background:#22c55e; color:#000; padding:2px 8px; font-weight:800; border-radius:4px; font-size:0.75rem;">LOBBY</span>'
                            : '<span class="status-badge badge-running" style="background:#eab308; color:#000; padding:2px 8px; font-weight:800; border-radius:4px; font-size:0.75rem;">SPIELT</span>';

                        const max = options.maxPlayers || (window.GAME_CONFIG && window.GAME_CONFIG.max_players) || 4;
                        const btnText = isLobby ? 'BEITRETEN' : 'ZUSCHAUEN';

                        html += `
                            <div class="lobby-room-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <strong style="font-size:1.1rem; letter-spacing:1px;">#${r.room_code}</strong>
                                        ${statusBadge}
                                    </div>
                                    <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">
                                        Host: <strong>${r.host_username || 'Unbekannt'}</strong> • ${r.player_count || 1}/${max} Spieler
                                    </div>
                                </div>
                                <button type="button" class="btn-lobby-join" data-code="${r.room_code}" style="padding:8px 16px; font-weight:800; cursor:pointer;">
                                    ${btnText}
                                </button>
                            </div>
                        `;
                    });

                    $el.innerHTML = html;

                    // Bind click handlers
                    $el.querySelectorAll('.btn-lobby-join').forEach(btn => {
                        btn.addEventListener('click', function () {
                            const code = this.getAttribute('data-code');
                            if (typeof options.onJoin === 'function') {
                                options.onJoin(code);
                            } else if (typeof window.joinRoom === 'function') {
                                window.joinRoom(code);
                            } else if (typeof window.joinRoomDirect === 'function') {
                                window.joinRoomDirect(code);
                            }
                        });
                    });
                })
                .catch(err => {
                    console.error('[GameLobby] Failed to fetch rooms:', err);
                    $el.innerHTML = '<div style="text-align:center; padding:12px; color:#ef4444; font-size:0.85rem;">Fehler beim Laden der Räume.</div>';
                });
        },

        /**
         * Copy room code or invite URL to clipboard.
         * @param {string} text - Room code or URL
         * @param {Function} onSuccess - Callback when copy succeeded
         */
        copyCode: function (text, onSuccess) {
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    if (typeof onSuccess === 'function') onSuccess(text);
                }).catch(() => {
                    this._fallbackCopy(text, onSuccess);
                });
            } else {
                this._fallbackCopy(text, onSuccess);
            }
        },

        _fallbackCopy: function (text, onSuccess) {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            temp.select();
            try {
                document.execCommand('copy');
                if (typeof onSuccess === 'function') onSuccess(text);
            } catch (e) {
                console.error('[GameLobby] Fallback copy failed:', e);
            }
            document.body.removeChild(temp);
        }
    };

    window.GameLobby = GameLobby;
})(window);
