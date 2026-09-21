"""Asynchronous and unified Pusher broadcasting engine for GameHub.

Provides non-blocking WebSocket broadcasts so user HTTP requests return immediately (~15ms),
while Pusher network latency executes in background worker threads.
"""
from concurrent.futures import ThreadPoolExecutor
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
from config import get_pusher_client
from storage import get_storage
from engine.delta import broadcast_tracker

logger = logging.getLogger(__name__)

# Worker pool dedicated to background Pusher I/O
_broadcast_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="gamehub-pusher")


def broadcast_state_update(
    game_id: str,
    room_code: str,
    state: Dict[str, Any],
    safe_state: Optional[Dict[str, Any]] = None,
    event_name: str = 'state-update',
    force_full: bool = False,
    extra_events: Optional[List[Tuple[str, Any]]] = None,
    channel_name: Optional[str] = None,
    save_to_storage: bool = True
) -> Dict[str, Any]:
    """Persists room state synchronously, then dispatches Pusher broadcast asynchronously.

    Args:
        game_id: Canonical game identifier (e.g. 'secret_hitler')
        room_code: Unique room code
        state: Raw authoritative room state dictionary
        safe_state: Sanitized state stripped of private information (defaults to state)
        event_name: Pusher event name ('state-update' or 'auto' for 'delta-state'/'full-state')
        force_full: If True, forces full state broadcast bypassing delta
        extra_events: List of (event_name, payload) tuples triggered on channel
        channel_name: Custom channel override (defaults to f"{game_id}-{code}")
        save_to_storage: Whether to synchronously write state to game_lobbies table

    Returns:
        Immediate success dictionary
    """
    code = room_code.upper().strip()
    target_channel = channel_name or f"{game_id}-{code}"
    client_safe = safe_state if safe_state is not None else state

    # 1. Synchronous storage persist for immediate read consistency
    if save_to_storage:
        storage = get_storage()
        storage.save_lobby(
            game_id=game_id,
            room_code=code,
            state=state,
            player_count=len(state.get('players', [])),
            status=state.get('status', 'lobby')
        )

    # 2. Async Pusher dispatch in background thread pool
    def _dispatch():
        client = get_pusher_client()
        if not client:
            return

        # Fire any extra events first (e.g., 'policy-enacted', 'force-kick')
        if extra_events:
            for extra_name, extra_data in extra_events:
                try:
                    client.trigger(target_channel, extra_name, extra_data)
                except Exception as e:
                    logger.error(f"[Pusher] Failed extra event {target_channel}/{extra_name}: {e}")

        # Compute delta vs full state
        payload, is_delta = broadcast_tracker.get_broadcast_payload(
            game_id=game_id,
            room_code=code,
            current_safe_state=client_safe,
            force_full=force_full
        )

        if payload is None:
            return

        if event_name == 'auto':
            actual_event = 'delta-state' if is_delta else 'full-state'
        else:
            actual_event = event_name

        try:
            client.trigger(target_channel, actual_event, payload)
            logger.info(f"[Pusher] Dispatched {actual_event} to {target_channel} (delta={is_delta})")
        except Exception as e:
            logger.error(f"[Pusher] Failed state broadcast to {target_channel}: {e}", exc_info=True)

    _broadcast_pool.submit(_dispatch)
    return {'success': True}
