"""Consolidated heartbeat tracking and player timeout manager."""
import time
from typing import Dict, List, NamedTuple, Tuple


class HeartbeatResult(NamedTuple):
    offline_players: List[str]
    kicked_players: List[str]


# In-memory heartbeat cache: (game_id, room_code, username) -> last_seen_unix_timestamp
HEARTBEAT_CACHE: Dict[Tuple[str, str, str], float] = {}


def process_heartbeat(
    game_id: str,
    room_code: str,
    username: str,
    force_offline: bool = False,
    kick_threshold: float = 60.0,
    offline_threshold: float = 5.0
) -> HeartbeatResult:
    """Updates last-seen timestamp for a user and checks timeout status of room players.
    
    Returns HeartbeatResult containing lists of players that are offline or should be kicked.
    """
    code = room_code.upper().strip()
    now = time.time()
    key = (game_id, code, username)

    if force_offline:
        HEARTBEAT_CACHE[key] = now - 10.0
    else:
        HEARTBEAT_CACHE[key] = now

    offline_players: List[str] = []
    kicked_players: List[str] = []

    # Check all active players for this room
    prefix = (game_id, code)
    room_keys = [k for k in HEARTBEAT_CACHE.keys() if k[0] == prefix[0] and k[1] == prefix[1]]

    for rk in room_keys:
        p_name = rk[2]
        last_seen = HEARTBEAT_CACHE.get(rk, 0.0)
        diff = now - last_seen

        if diff > kick_threshold:
            kicked_players.append(p_name)
            del HEARTBEAT_CACHE[rk]
        elif diff > offline_threshold:
            offline_players.append(p_name)

    return HeartbeatResult(offline_players=offline_players, kicked_players=kicked_players)


def clear_player(game_id: str, room_code: str, username: str) -> None:
    """Removes a player from the heartbeat cache on explicit departure."""
    key = (game_id, room_code.upper().strip(), username)
    if key in HEARTBEAT_CACHE:
        del HEARTBEAT_CACHE[key]


def clear_room(game_id: str, room_code: str) -> None:
    """Removes all players belonging to a room from heartbeat cache."""
    code = room_code.upper().strip()
    keys_to_delete = [k for k in HEARTBEAT_CACHE.keys() if k[0] == game_id and k[1] == code]
    for k in keys_to_delete:
        del HEARTBEAT_CACHE[k]
