/**
 * GameHub Unified Client SDK
 * static/common/sdk.js
 * 
 * Provides unified, zero-boilerplate client APIs for authentication, cloud save,
 * multiplayer room management, action dispatching, Pusher subscription, and delta patching.
 */
(function (window) {
    'use strict';

    const GameHub = {
        version: '2.0.0',

        /**
         * Authentication and session management.
         */
        auth: {
            getToken: function () {
                if (window.getAuthToken) return window.getAuthToken();
                return (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.token) ||
                    sessionStorage.getItem('gamehub_auth_token') || null;
            },

            getUser: function () {
                if (window.getCurrentUser) return window.getCurrentUser();
                return (window.GAMEHUB_CONFIG && window.GAMEHUB_CONFIG.user) || null;
            },

            fetch: function (url, options) {
                options = options || {};
                options.headers = options.headers || {};
                const token = this.getToken();
                if (token && !options.headers['X-Auth-Token']) {
                    options.headers['X-Auth-Token'] = token;
                }
                if (!options.headers['Accept']) {
                    options.headers['Accept'] = 'application/json';
                }
                return fetch(url, options);
            },

            logout: function () {
                return this.fetch('/api/auth/logout', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        sessionStorage.removeItem('gamehub_auth_token');
                        window.location.href = '/?login=1';
                        return data;
                    });
            }
        },

        /**
         * User-scoped Cloud Save for singleplayer games.
         */
        storage: {
            save: function (gameId, state) {
                return GameHub.auth.fetch(`/api/save/${gameId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: state })
                }).then(res => res.json());
            },

            load: function (gameId) {
                return GameHub.auth.fetch(`/api/save/${gameId}`)
                    .then(res => res.json());
            }
        },

        /**
         * Multiplayer room management and real-time state synchronization.
         */
        multiplayer: function (gameId, options) {
            options = options || {};
            const prefix = options.routePrefix || `/${gameId.replace(/_/g, '-')}`;
            let activeHeartbeatInterval = null;
            let activePusherChannel = null;
            let currentState = null;

            return {
                getPrefix: function () {
                    return prefix;
                },

                getState: function (roomCode) {
                    return GameHub.auth.fetch(`${prefix}/${roomCode}/state`)
                        .then(res => res.json())
                        .then(state => {
                            currentState = state;
                            return state;
                        });
                },

                createRoom: function (customData) {
                    const opts = { method: 'POST' };
                    if (customData) {
                        opts.headers = { 'Content-Type': 'application/json' };
                        opts.body = JSON.stringify(customData);
                    }
                    return GameHub.auth.fetch(`${prefix}/create`, opts)
                        .then(res => res.json());
                },

                joinRoom: function (roomCode, customData) {
                    const opts = { method: 'POST' };
                    if (customData) {
                        opts.headers = { 'Content-Type': 'application/json' };
                        opts.body = JSON.stringify(customData);
                    }
                    return GameHub.auth.fetch(`${prefix}/${roomCode}/join`, opts)
                        .then(res => res.json())
                        .then(res => {
                            if (res && res.state) currentState = res.state;
                            return res;
                        });
                },

                leaveRoom: function (roomCode) {
                    this.stopHeartbeat();
                    if (activePusherChannel && window.pusherClient) {
                        try {
                            window.pusherClient.unsubscribe(activePusherChannel.name);
                        } catch (e) { }
                    }
                    return GameHub.auth.fetch(`${prefix}/${roomCode}/leave`, { method: 'POST' })
                        .then(res => res.json());
                },

                /**
                 * Dispatches an action to POST /<prefix>/<roomCode>/action
                 */
                action: function (roomCode, actionName, payload) {
                    payload = payload || {};
                    payload.action = actionName;
                    return GameHub.auth.fetch(`${prefix}/${roomCode}/action`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).then(res => res.json())
                    .then(res => {
                        if (res && res.state) {
                            currentState = res.state;
                        }
                        return res;
                    });
                },

                /**
                 * Subscribes to Pusher game channel with automatic delta state patcher and console logging.
                 */
                subscribe: function (roomCode, onStateUpdate, onExtraEvent) {
                    if (!window.Pusher || !window.GAMEHUB_CONFIG || !window.GAMEHUB_CONFIG.pusherKey) {
                        console.warn('[GameHubSDK] Pusher client not configured.');
                        return null;
                    }

                    if (!window.pusherClient) {
                        const token = GameHub.auth.getToken();
                        window.pusherClient = new window.Pusher(window.GAMEHUB_CONFIG.pusherKey, {
                            cluster: window.GAMEHUB_CONFIG.pusherCluster || 'eu',
                            channelAuthorization: {
                                endpoint: '/pusher/auth',
                                headersProvider: function () {
                                    const t = GameHub.auth.getToken();
                                    return t ? { 'X-Auth-Token': t } : {};
                                }
                            },
                            authEndpoint: '/pusher/auth',
                            auth: {
                                headers: token ? { 'X-Auth-Token': token } : {}
                            }
                        });

                        window.pusherClient.connection.bind('state_change', function (states) {
                            console.log(
                                '%c[GameHub Pusher Connection]',
                                'color: #38d9a9; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;',
                                states.current
                            );
                        });
                    }

                    if (activePusherChannel) {
                        try {
                            activePusherChannel.unbind_all();
                            if (window.pusherClient) {
                                window.pusherClient.unsubscribe(activePusherChannel.name);
                            }
                        } catch (e) { }
                        activePusherChannel = null;
                    }

                    // Target authoritative state broadcast channel: <gameId>-<roomCode>
                    const channelName = `${gameId}-${roomCode}`;
                    console.log(
                        '%c[GameHub Pusher Subscribing]',
                        'color: #ffd43b; font-weight: bold; background: #2a2200; padding: 2px 6px; border-radius: 3px;',
                        channelName
                    );

                    const channel = window.pusherClient.subscribe(channelName);
                    activePusherChannel = channel;

                    channel.bind('pusher:subscription_succeeded', function () {
                        console.log(
                            '%c[GameHub Pusher Verbunden] 🚀',
                            'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;',
                            channelName
                        );
                    });

                    channel.bind('pusher:subscription_error', function (err) {
                        console.warn('[GameHub Pusher Subscription Error]', channelName, err);
                    });

                    const handleIncomingState = (eventName, payload) => {
                        console.log(
                            '%c[GameHub Pusher Event]',
                            'color: #74c0fc; font-weight: bold; background: #0c2438; padding: 2px 6px; border-radius: 3px;',
                            eventName,
                            payload
                        );

                        if (payload && payload._delta) {
                            if (window.GameDelta && typeof window.GameDelta.apply === 'function') {
                                currentState = window.GameDelta.apply(currentState || {}, payload);
                            } else if (typeof window.applyStateDelta === 'function') {
                                currentState = window.applyStateDelta(currentState || {}, payload);
                            } else {
                                currentState = currentState || {};
                                if (payload.changes && typeof payload.changes === 'object') {
                                    for (let k in payload.changes) {
                                        if (payload.changes.hasOwnProperty(k)) {
                                            currentState[k] = payload.changes[k];
                                        }
                                    }
                                }
                            }
                        } else if (payload) {
                            currentState = payload;
                        }
                        if (typeof onStateUpdate === 'function') {
                            onStateUpdate(currentState, payload);
                        }
                    };

                    channel.bind('state-update', function (payload) {
                        handleIncomingState('state-update', payload);
                    });

                    channel.bind('delta-state', function (payload) {
                        handleIncomingState('delta-state', payload);
                    });

                    channel.bind('full-state', function (payload) {
                        handleIncomingState('full-state', payload);
                    });

                    if (typeof onExtraEvent === 'function') {
                        channel.bind_global(function (eventName, data) {
                            if (!['state-update', 'delta-state', 'full-state', 'pusher:subscription_succeeded', 'pusher:subscription_error'].includes(eventName)) {
                                console.log(
                                    '%c[GameHub Pusher Extra Event]',
                                    'color: #ff922b; font-weight: bold; background: #2b1704; padding: 2px 6px; border-radius: 3px;',
                                    eventName,
                                    data
                                );
                                onExtraEvent(eventName, data);
                            }
                        });
                    }

                    return channel;
                },

                startHeartbeat: function (roomCode, intervalMs) {
                    this.stopHeartbeat();
                    const interval = intervalMs || 15000;
                    const sendHeartbeat = () => {
                        GameHub.auth.fetch(`${prefix}/${roomCode}/heartbeat`, { method: 'POST' }).catch(() => { });
                    };
                    sendHeartbeat();
                    activeHeartbeatInterval = setInterval(sendHeartbeat, interval);
                },

                stopHeartbeat: function () {
                    if (activeHeartbeatInterval) {
                        clearInterval(activeHeartbeatInterval);
                        activeHeartbeatInterval = null;
                    }
                }
            };
        },

        /**
         * Lobby helpers.
         */
        lobby: window.GameLobby || {}
    };

    window.GameHub = GameHub;

})(window);
