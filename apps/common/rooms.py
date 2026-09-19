"""Common room lifecycle and management utilities for multiplayer games."""
import random
from typing import Any, Callable, Dict, List, Optional
from storage import get_storage

ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  # 32 unambiguous characters


def generate_room_code(length: int = 4) -> str:
    """Generates a random human-friendly alphanumeric room code."""
    return ''.join(random.choices(ROOM_CODE_CHARS, k=length))


def create_room(
    game_id: str,
    host_username: str,
    host_user_id: Optional[int],
    initial_state: Dict[str, Any]
) -> str:
    """Creates a new room in the storage layer with collision retry."""
    storage = get_storage()
    max_attempts = 20

    for _ in range(max_attempts):
        code = generate_room_code(4)
        if storage.load_lobby(game_id, code) is None:
            # Found unique code
            state = dict(initial_state)
            state['room_code'] = code
            state['host'] = host_username
            if 'players' not in state or not state['players']:
                state['players'] = [host_username]
            elif host_username not in state['players']:
                state['players'].insert(0, host_username)

            storage.save_lobby(
                game_id=game_id,
                room_code=code,
                state=state,
                host_user_id=host_user_id,
                player_count=len(state['players']),
                status=state.get('status', 'lobby')
            )
            return code

    raise RuntimeError("Konnte keinen eindeutigen Raumcode generieren. Bitte erneut versuchen.")


def join_room(
    game_id: str,
    room_code: str,
    username: str,
    max_players: int = 10,
    allow_spectator: bool = True
) -> Dict[str, Any]:
    """Adds a player or spectator to an existing room."""
    code = room_code.upper().strip()
    storage = get_storage()
    state = storage.load_lobby(game_id, code)

    if not state:
        raise ValueError(f"Raum '{code}' existiert nicht.")

    players = state.setdefault('players', [])
    spectators = state.setdefault('spectators', [])
    current_status = state.get('status', 'lobby')

    # If already a player, return state (reconnect)
    if username in players:
        return state

    # If already a spectator, return state
    if username in spectators:
        return state

    # If game is already playing
    if current_status != 'lobby':
        if allow_spectator:
            spectators.append(username)
            storage.save_lobby(
                game_id=game_id,
                room_code=code,
                state=state,
                player_count=len(players),
                status=current_status
            )
            return state
        else:
            raise ValueError("Das Spiel in diesem Raum hat bereits begonnen.")

    # In lobby phase
    if len(players) >= max_players:
        raise ValueError("Dieser Raum ist bereits voll.")

    players.append(username)
    storage.save_lobby(
        game_id=game_id,
        room_code=code,
        state=state,
        player_count=len(players),
        status='lobby'
    )
    return state


def leave_room(game_id: str, room_code: str, username: str) -> Optional[Dict[str, Any]]:
    """Removes a player from a room. Cleans up empty rooms or passes host."""
    code = room_code.upper().strip()
    storage = get_storage()
    state = storage.load_lobby(game_id, code)

    if not state:
        return None

    players = state.get('players', [])
    spectators = state.get('spectators', [])

    removed = False
    if username in players:
        players.remove(username)
        removed = True
    if username in spectators:
        spectators.remove(username)
        removed = True

    if not removed:
        return state

    # If room is now empty, delete it
    if len(players) == 0 and len(spectators) == 0:
        storage.delete_lobby(game_id, code)
        return None

    # If host left, pass host to first remaining active player
    if state.get('host') == username:
        state['host'] = players[0] if players else (spectators[0] if spectators else None)

    storage.save_lobby(
        game_id=game_id,
        room_code=code,
        state=state,
        player_count=len(players),
        status=state.get('status', 'lobby')
    )
    return state


def list_rooms(game_id: str) -> List[Dict[str, Any]]:
    """Returns active lobbies for the specified game."""
    storage = get_storage()
    return storage.list_lobbies(game_id)


def get_room_state(game_id: str, room_code: str) -> Optional[Dict[str, Any]]:
    """Loads current lobby state dictionary."""
    storage = get_storage()
    return storage.load_lobby(game_id, room_code.upper().strip())


def update_room_state(
    game_id: str,
    room_code: str,
    modifier_func: Callable[[Dict[str, Any]], Any]
) -> Dict[str, Any]:
    """Atomically loads, modifies, and persists room state."""
    code = room_code.upper().strip()
    storage = get_storage()
    state = storage.load_lobby(game_id, code)
    if not state:
        raise ValueError(f"Raum '{code}' existiert nicht mehr.")

    modifier_func(state)

    storage.save_lobby(
        game_id=game_id,
        room_code=code,
        state=state,
        player_count=len(state.get('players', [])),
        status=state.get('status', 'lobby')
    )
    return state
