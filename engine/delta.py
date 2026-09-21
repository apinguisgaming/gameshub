"""Modular State Delta Engine for multiplayer games on GameHub.

Provides efficient differential state computation and caching to minimize
Pusher WebSocket message sizes, payload bandwidth, and quota consumption.
"""

import copy
import threading
from typing import Dict, Any, Optional, Tuple


def compute_state_delta(
    prev_state: Dict[str, Any],
    curr_state: Dict[str, Any],
    append_only_keys: Tuple[str, ...] = ('logs',)
) -> Optional[Dict[str, Any]]:
    """Computes a compact delta dictionary containing only modified or added keys.

    Args:
        prev_state: The snapshot of the state that was previously broadcasted.
        curr_state: The new state snapshot to broadcast.
        append_only_keys: Tuple of list keys (e.g. 'logs') that should be sent
            as new appended items rather than resending the entire list.

    Returns:
        A dictionary in the format:
        {
            "_delta": True,
            "changes": { ...changed keys... },
            "new_logs": [ ...new entries... ] (if append-only key had new items)
        }
        or None if no changes occurred between snapshots.
    """
    if not prev_state:
        return None

    changes: Dict[str, Any] = {}
    delta_payload: Dict[str, Any] = {"_delta": True}

    # 1. Compare current keys against previous
    for key, val in curr_state.items():
        if key in append_only_keys and isinstance(val, list):
            prev_list = prev_state.get(key)
            if isinstance(prev_list, list):
                if len(val) >= len(prev_list) and val[:len(prev_list)] == prev_list:
                    new_items = val[len(prev_list):]
                    if new_items:
                        delta_payload[f'new_{key}'] = new_items
                    continue
                elif val == prev_list:
                    continue

        if key not in prev_state or prev_state[key] != val:
            changes[key] = val

    # 2. Check for removed keys
    for key in prev_state:
        if key not in curr_state:
            changes[key] = None

    has_changes = bool(changes)
    has_appended_items = any(k.startswith('new_') for k in delta_payload if k != '_delta')

    if not has_changes and not has_appended_items:
        return None

    if changes:
        delta_payload["changes"] = changes

    return delta_payload


def apply_state_delta(target_state: Dict[str, Any], delta: Dict[str, Any]) -> Dict[str, Any]:
    """Applies a delta dictionary to an existing state snapshot in-place."""
    if not delta or not delta.get('_delta'):
        return delta if delta else target_state

    # Apply appended list items
    for key, val in delta.items():
        if key.startswith('new_') and isinstance(val, list):
            original_key = key[4:]  # strip 'new_'
            if original_key not in target_state or not isinstance(target_state[original_key], list):
                target_state[original_key] = []
            target_state[original_key].extend(val)

    # Apply changed / removed keys
    for key, val in delta.get('changes', {}).items():
        target_state[key] = val

    return target_state


class BroadcastTracker:
    """Thread-safe multi-game, multi-room broadcast state tracker.

    Maintains the last broadcasted state for active rooms across all games
    to transparently deliver compact deltas to connected clients.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _key(self, game_id: str, room_code: str) -> str:
        return f"{game_id.lower().strip()}_{room_code.upper().strip()}"

    def get_broadcast_payload(
        self,
        game_id: str,
        room_code: str,
        current_safe_state: Dict[str, Any],
        force_full: bool = False
    ) -> Tuple[Optional[Dict[str, Any]], bool]:
        """Calculates either a delta or full payload to broadcast.

        Returns:
            (payload, is_delta)
            If payload is None, no changes exist and no Pusher event needs to be sent.
        """
        key = self._key(game_id, room_code)
        with self._lock:
            prev = self._cache.get(key)
            if force_full or prev is None:
                safe_copy = copy.deepcopy(current_safe_state)
                self._cache[key] = safe_copy
                return safe_copy, False

            delta = compute_state_delta(prev, current_safe_state)
            if delta is None:
                return None, False

            # Update cached snapshot only when changed
            self._cache[key] = copy.deepcopy(current_safe_state)
            return delta, True

    def reset_room(self, game_id: str, room_code: str) -> None:
        """Resets the room broadcast cache, forcing next update to be a full state."""
        key = self._key(game_id, room_code)
        with self._lock:
            self._cache.pop(key, None)

    def clear_room(self, game_id: str, room_code: str) -> None:
        """Removes the room from cache when deleted or finished."""
        self.reset_room(game_id, room_code)


# Singleton instance shared across all multiplayer modules
broadcast_tracker = BroadcastTracker()
