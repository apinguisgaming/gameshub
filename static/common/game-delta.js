/**
 * Universal GameHub State Delta Patcher
 * Merges compact differential state payloads into client-side game state.
 * Reduces WebSocket payload bandwidth by 90-95% across all multiplayer games.
 */
(function (global) {
    'use strict';

    var GameDelta = {
        /**
         * Merges an incoming Pusher payload into the existing state.
         * If the payload is a full snapshot (_delta is falsy), it replaces the state.
         * If it is a delta (_delta is true), it merges changes in-place.
         *
         * @param {Object} currentState - The existing client-side state object.
         * @param {Object} incomingPayload - The data payload received from Pusher or HTTP.
         * @returns {Object} The updated full state object.
         */
        apply: function (currentState, incomingPayload) {
            if (!incomingPayload) return currentState || {};
            if (!currentState) currentState = {};

            // If incoming is not a delta, treat as full state replacement
            if (!incomingPayload._delta) {
                return incomingPayload;
            }

            // 1. Process append-only lists (e.g. new_logs)
            for (var prop in incomingPayload) {
                if (incomingPayload.hasOwnProperty(prop) && prop.indexOf('new_') === 0 && Array.isArray(incomingPayload[prop])) {
                    var targetKey = prop.substring(4); // strip 'new_'
                    if (!Array.isArray(currentState[targetKey])) {
                        currentState[targetKey] = [];
                    }
                    currentState[targetKey] = currentState[targetKey].concat(incomingPayload[prop]);
                }
            }

            // 2. Process modified, added, or removed keys in 'changes'
            if (incomingPayload.changes && typeof incomingPayload.changes === 'object') {
                for (var key in incomingPayload.changes) {
                    if (incomingPayload.changes.hasOwnProperty(key)) {
                        currentState[key] = incomingPayload.changes[key];
                    }
                }
            }

            return currentState;
        },

        /**
         * Clean console logger for state updates during local testing
         */
        logUpdate: function (gameId, incomingPayload) {
            if (incomingPayload && incomingPayload._delta) {
                var args = [
                    `%c[Pusher Delta: ${gameId}]`,
                    'color: #51cf66; font-weight: bold; background: #1a2a1a; padding: 2px 6px; border-radius: 3px;'
                ];
                if (incomingPayload.changes && Object.keys(incomingPayload.changes).length > 0) {
                    args.push(incomingPayload.changes);
                }
                if (incomingPayload.new_logs && incomingPayload.new_logs.length > 0) {
                    args.push({ new_logs: incomingPayload.new_logs });
                }
                console.log.apply(console, args);
            }
        }
    };

    global.GameDelta = GameDelta;
    global.applyStateDelta = GameDelta.apply;
})(typeof window !== 'undefined' ? window : this);
