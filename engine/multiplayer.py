"""Reusable multiplayer Flask Blueprint factory and route helpers for GameHub.

Provides standard room lifecycle endpoints (create, join, leave, state, heartbeat, list_lobbies, rooms)
for multiplayer games to plug into without reimplementing boilerplate HTTP routes.
"""
from typing import Any, Callable, Dict, Optional
from flask import Blueprint, jsonify, render_template, request
from config import get_pusher_client
from apps.auth.decorators import get_current_user, login_required
from engine.heartbeat import record_player_heartbeat
from engine.rooms import create_room, get_room_state, join_room, leave_room, list_rooms


def register_standard_room_routes(
    bp: Blueprint,
    game_id: str,
    initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
    custom_create_room_fn: Optional[Callable[[], Any]] = None,
) -> None:
    """Registers standard room discovery and creation endpoints on any game blueprint.

    Endpoints:
      - GET /rooms, GET /list_lobbies -> returns active room list
      - POST /create_room, POST /create -> creates room and returns room_code
    """
    @bp.route('/rooms', methods=['GET'])
    @bp.route('/list_lobbies', methods=['GET'])
    @login_required
    def standard_get_rooms():
        active = list_rooms(game_id)
        return jsonify({'success': True, 'rooms': active, 'lobbies': active})

    if custom_create_room_fn:
        bp.add_url_rule('/create_room', f'{game_id}_create_room', custom_create_room_fn, methods=['POST'])
        bp.add_url_rule('/create', f'{game_id}_create', custom_create_room_fn, methods=['POST'])
    elif initial_state_factory:
        @bp.route('/create_room', methods=['POST'])
        @bp.route('/create', methods=['POST'])
        @login_required
        def standard_create_room():
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Nicht angemeldet'}), 401

            initial = initial_state_factory()
            room_code = create_room(
                game_id=game_id,
                host_username=user['username'],
                host_user_id=user['id'],
                initial_state=initial
            )
            record_player_heartbeat(game_id, room_code, user['username'])
            return jsonify({'success': True, 'room_code': room_code})


def create_multiplayer_blueprint(
    game_id: str,
    url_prefix: Optional[str] = None,
    template: Optional[str] = None,
    initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
    sanitize_state_func: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
    max_players: int = 10,
    allow_spectator: bool = True
) -> Blueprint:
    """Creates a configured Blueprint providing standard room management."""
    bp_name = f"multiplayer_{game_id}"
    prefix = url_prefix or f"/{game_id}"
    bp = Blueprint(bp_name, __name__, url_prefix=prefix)

    tpl = template or f"{game_id}.html"
    init_state_fn = initial_state_factory or (lambda: {"status": "lobby", "phase": "lobby"})
    sanitize_fn = sanitize_state_func or (lambda s: s)

    def _trigger_update(room_code: str, state: Dict[str, Any], event: str = "state_updated"):
        client = get_pusher_client()
        if client:
            try:
                safe_state = sanitize_fn(state)
                client.trigger(f"presence-{game_id}-{room_code}", event, safe_state)
            except Exception:
                pass

    @bp.route('/')
    @bp.route('/<room_code>')
    @login_required
    def index(room_code=None):
        return render_template(tpl, room_code=room_code)

    @bp.route('/create', methods=['POST'])
    @bp.route('/create_room', methods=['POST'])
    @login_required
    def handle_create():
        user = get_current_user()
        username = user['username'] if user else 'Player'
        user_id = user['id'] if user else None

        initial_state = init_state_fn()
        code = create_room(game_id, username, user_id, initial_state)
        record_player_heartbeat(game_id, code, username)

        return jsonify({
            'success': True,
            'room_code': code,
            'state': sanitize_fn(get_room_state(game_id, code))
        })

    @bp.route('/<room_code>/join', methods=['POST'])
    @login_required
    def handle_join(room_code):
        user = get_current_user()
        username = user['username'] if user else 'Player'

        try:
            state = join_room(
                game_id=game_id,
                room_code=room_code,
                username=username,
                max_players=max_players,
                allow_spectator=allow_spectator
            )
            record_player_heartbeat(game_id, room_code, username)
            _trigger_update(room_code, state)
            return jsonify({'success': True, 'state': sanitize_fn(state)})
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @bp.route('/<room_code>/leave', methods=['POST'])
    @bp.route('/<room_code>/leave_game', methods=['POST'])
    @bp.route('/leave_game', methods=['POST'])
    @login_required
    def handle_leave(room_code=None):
        user = get_current_user()
        username = user['username'] if user else 'Player'
        code = (room_code or request.form.get('room_code') or '').upper().strip()

        if not code:
            return jsonify({'success': True})

        state = leave_room(game_id, code, username)
        if state:
            _trigger_update(code, state)
        return jsonify({'success': True})

    @bp.route('/<room_code>/state', methods=['GET'])
    @login_required
    def handle_get_state(room_code):
        state = get_room_state(game_id, room_code)
        if not state:
            return jsonify({'error': 'Raum nicht gefunden'}), 404
        return jsonify(sanitize_fn(state))

    @bp.route('/<room_code>/heartbeat', methods=['POST'])
    @bp.route('/heartbeat', methods=['POST'])
    @login_required
    def handle_heartbeat(room_code=None):
        user = get_current_user()
        username = user['username'] if user else 'Player'
        code = (room_code or request.form.get('room_code') or '').upper().strip()
        if code:
            record_player_heartbeat(game_id, code, username)
        return jsonify({'success': True})

    @bp.route('/rooms', methods=['GET'])
    @bp.route('/list_lobbies', methods=['GET'])
    @login_required
    def handle_list_lobbies():
        lobbies = list_rooms(game_id)
        return jsonify({'success': True, 'rooms': lobbies, 'lobbies': lobbies})

    return bp
