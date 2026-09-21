"""GameHub Engine Package.

Provides shared runtime infrastructure: registry, rooms, heartbeat, delta broadcasting,
singleplayer auto-router, multiplayer blueprint factory, and logging.
"""
from engine.registry import (
    GameManifest,
    register_game,
    get_game,
    get_all_games,
    get_game_by_path,
    clear_registry,
)
from engine.rooms import (
    generate_room_code,
    create_room,
    join_room,
    leave_room,
    list_rooms,
    get_room_state,
    update_room_state,
    validate_room_capacity,
    validate_game_start,
)
from engine.heartbeat import (
    record_player_heartbeat,
    process_heartbeat,
    clear_player,
    clear_room,
    HeartbeatResult,
)
from engine.delta import (
    compute_state_delta,
    apply_state_delta,
    BroadcastTracker,
    broadcast_tracker,
)
from engine.singleplayer import register_singleplayer_routes
from engine.multiplayer import (
    create_multiplayer_blueprint,
    register_standard_room_routes,
)

# Compatibility alias for multiplayer blueprint module
from engine import multiplayer as multiplayer_bp

__all__ = [
    'GameManifest',
    'register_game',
    'get_game',
    'get_all_games',
    'get_game_by_path',
    'clear_registry',
    'generate_room_code',
    'create_room',
    'join_room',
    'leave_room',
    'list_rooms',
    'get_room_state',
    'update_room_state',
    'validate_room_capacity',
    'validate_game_start',
    'record_player_heartbeat',
    'process_heartbeat',
    'clear_player',
    'clear_room',
    'HeartbeatResult',
    'compute_state_delta',
    'apply_state_delta',
    'BroadcastTracker',
    'broadcast_tracker',
    'register_singleplayer_routes',
    'create_multiplayer_blueprint',
    'register_standard_room_routes',
    'multiplayer_bp',
]
