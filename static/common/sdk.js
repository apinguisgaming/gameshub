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
                    }).then(res => res.json());
                },

                /**
                 * Subscribes to Pusher presence channel with automatic delta state patcher.
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
                            authEndpoint: '/pusher/auth',
                            auth: {
                                headers: token ? { 'X-Auth-Token': token } : {}
                            }
                        });
                    }

                    const channelName = `presence-${gameId}-${roomCode}`;
                    const channel = window.pusherClient.subscribe(channelName);
                    activePusherChannel = channel;

                    channel.bind('state-update', function (payload) {
                        if (payload && payload._delta && window.applyStateDelta && currentState) {
                            currentState = window.applyStateDelta(currentState, payload);
                        } else {
                            currentState = payload;
                        }
                        if (typeof onStateUpdate === 'function') {
                            onStateUpdate(currentState, payload);
                        }
                    });

                    channel.bind('delta-state', function (payload) {
                        if (window.applyStateDelta && currentState) {
                            currentState = window.applyStateDelta(currentState, payload);
                        } else {
                            currentState = payload;
                        }
                        if (typeof onStateUpdate === 'function') {
                            onStateUpdate(currentState, payload);
                        }
                    });

                    channel.bind('full-state', function (payload) {
                        currentState = payload;
                        if (typeof onStateUpdate === 'function') {
                            onStateUpdate(currentState, payload);
                        }
                    });

                    if (typeof onExtraEvent === 'function') {
                        channel.bind_global(function (eventName, data) {
                            if (!['state-update', 'delta-state', 'full-state', 'pusher:subscription_succeeded'].includes(eventName)) {
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
