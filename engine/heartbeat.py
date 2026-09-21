"""Consolidated heartbeat tracking and player timeout manager (SQLite-backed)."""
import time
from typing import List, NamedTuple
from storage import get_storage


class HeartbeatResult(NamedTuple):
    offline_players: List[str]
    kicked_players: List[str]


def process_heartbeat(
    game_id: str,
    room_code: str,
    username: str,
    force_offline: bool = False,
    kick_threshold: float = 300.0,
    offline_threshold: float = 45.0
) -> HeartbeatResult:
    """Updates last-seen timestamp and checks timeout status of room players.
    
    Uses SQLite storage instead of an in-memory dict for multi-worker WSGI safety.
    """
    code = room_code.upper().strip()
    now = time.time()
    storage = get_storage()

    # Update current player's heartbeat
    ts = (now - 10.0) if force_offline else now
    storage.upsert_heartbeat(game_id, code, username, ts)

    heartbeats = storage.get_room_heartbeats(game_id, code)

    offline_players: List[str] = []
    kicked_players: List[str] = []

    for p_name, last_seen in heartbeats.items():
        diff = now - last_seen
        if diff > kick_threshold:
            kicked_players.append(p_name)
            storage.delete_heartbeat(game_id, code, p_name)
        elif diff > offline_threshold:
            offline_players.append(p_name)

    return HeartbeatResult(offline_players=offline_players, kicked_players=kicked_players)


def clear_player(game_id: str, room_code: str, username: str) -> None:
    """Removes a player from the heartbeat tracking on explicit departure."""
    get_storage().delete_heartbeat(game_id, room_code.upper().strip(), username)


def clear_room(game_id: str, room_code: str) -> None:
    """Removes all heartbeat records belonging to a room."""
    get_storage().delete_room_heartbeats(game_id, room_code.upper().strip())


def record_player_heartbeat(game_id: str, room_code: str, username: str) -> None:
    """Convenience helper to record a player heartbeat."""
    process_heartbeat(game_id, room_code, username)

