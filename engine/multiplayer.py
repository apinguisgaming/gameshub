"""Reusable multiplayer Flask Blueprint factory and route helpers for GameHub.

Provides standard room lifecycle endpoints (create, join, leave, state, heartbeat, list_lobbies, rooms)
and an action dispatch engine (POST /<room_code>/action) for multiplayer games to plug into without
reimplementing boilerplate HTTP routes.
"""
import inspect
import logging
from typing import Any, Callable, Dict, List, Optional
from flask import Blueprint, jsonify, render_template, request
from apps.auth.decorators import get_current_user, login_required
from engine.broadcasting import broadcast_state_update
from engine.heartbeat import record_player_heartbeat
from engine.rooms import (
    create_room,
    get_room_state,
    join_room,
    leave_room,
    list_rooms,
)

logger = logging.getLogger(__name__)


def register_standard_room_routes(
    bp: Blueprint,
    game_id: str,
    initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
    custom_create_room_fn: Optional[Callable[[], Any]] = None,
) -> None:
    """Registers standard room discovery and creation endpoints on any game blueprint."""
    @bp.route('/rooms', methods=['GET'])
    @bp.route('/list_lobbies', methods=['GET'])
    @login_required
    def standard_get_rooms():
        active = list_rooms(game_id)
        return jsonify({'success': True, 'rooms': active, 'lobbies': active})

    if custom_create_room_fn:
        bp.add_url_rule('/create_room', f'{game_id}_std_create_room', custom_create_room_fn, methods=['POST'])
        bp.add_url_rule('/create', f'{game_id}_std_create', custom_create_room_fn, methods=['POST'])
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


class MultiplayerBlueprint(Blueprint):
    """Enhanced Flask Blueprint pre-wired with room lifecycle, action dispatch, and broadcasting."""

    def __init__(
        self,
        game_id: str,
        name: Optional[str] = None,
        import_name: str = __name__,
        url_prefix: Optional[str] = None,
        template: Optional[str] = None,
        initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
        sanitize_state_func: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        max_players: int = 10,
        allow_spectator: bool = True,
        template_context: Optional[Callable[[], Dict[str, Any]]] = None,
        custom_create_room_fn: Optional[Callable[[], Any]] = None,
        on_join: Optional[Callable] = None,
        on_leave: Optional[Callable] = None,
        on_heartbeat: Optional[Callable] = None,
        **kwargs: Any,
    ) -> None:
        bp_name = name or f"{game_id}_bp"
        prefix = url_prefix or f"/{game_id.replace('_', '-')}"
        super().__init__(bp_name, import_name, url_prefix=prefix, **kwargs)

        self.game_id = game_id
        self.template_file = template or f"{game_id}.html"
        self.initial_state_factory = initial_state_factory or (lambda: {"status": "lobby", "phase": "lobby"})
        self.sanitize_state_func = sanitize_state_func or (lambda s: s)
        self.max_players = max_players
        self.allow_spectator = allow_spectator
        self.template_context = template_context
        self.custom_create_room_fn = custom_create_room_fn
        self.on_join_fn = on_join
        self.on_leave_fn = on_leave
        self.on_heartbeat_fn = on_heartbeat

        self.action_handlers: Dict[str, Callable] = {}
        self._register_standard_routes()

    def trigger_update(
        self,
        room_code: str,
        state: Dict[str, Any],
        event_name: str = 'state-update',
        force_full: bool = False,
        extra_events: Optional[List[Any]] = None,
        custom_payload: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Broadcasts sanitized state or delta update via non-blocking Pusher dispatch and persists to SQLite."""
        code = room_code.upper().strip()
        payload = custom_payload if custom_payload is not None else self.sanitize_state_func(state)
        return broadcast_state_update(
            game_id=self.game_id,
            room_code=code,
            state=state,
            safe_state=payload,
            event_name=event_name,
            force_full=force_full,
            extra_events=extra_events or [],
        )

    def _call_handler(self, handler: Callable, room_code: str, user: Dict[str, Any], data: Dict[str, Any]) -> Any:
        """Invokes a handler with flexible parameter matching."""
        sig = inspect.signature(handler)
        params = sig.parameters
        kwargs: Dict[str, Any] = {}

        if 'room_code' in params:
            kwargs['room_code'] = room_code
        if 'user' in params:
            kwargs['user'] = user
        if 'state' in params:
            kwargs['state'] = get_room_state(self.game_id, room_code)
        if 'data' in params:
            kwargs['data'] = data
        elif 'payload' in params:
            kwargs['payload'] = data

        if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
            kwargs.setdefault('room_code', room_code)
            kwargs.setdefault('user', user)
            kwargs.setdefault('state', get_room_state(self.game_id, room_code))
            kwargs.setdefault('data', data)

        if not kwargs:
            if len(params) == 1:
                res = handler(room_code)
            elif len(params) == 0:
                res = handler()
            else:
                state = get_room_state(self.game_id, room_code)
                res = handler(room_code, user, state, data)
        else:
            res = handler(**kwargs)

        if isinstance(res, (tuple, str)) or hasattr(res, 'status_code'):
            return res
        if isinstance(res, dict):
            return jsonify(res)
        return jsonify({'success': True})

    def dispatch_action(self, room_code: str, action_name: str, user: Dict[str, Any], data: Dict[str, Any]) -> Any:
        """Dispatches an action to its registered handler."""
        handler = self.action_handlers.get(action_name)
        if not handler:
            return jsonify({'error': f"Unknown action '{action_name}'"}), 404
        code = room_code.upper().strip()
        return self._call_handler(handler, room_code=code, user=user, data=data)

    def action(self, name: str) -> Callable[[Callable], Callable]:
        """Decorator to register an action handler for both POST /<room_code>/action and POST /<room_code>/<name>."""
        def decorator(fn: Callable) -> Callable:
            self.action_handlers[name] = fn

            if not self._got_registered_once:
                @login_required
                def route_wrapper(room_code: Optional[str] = None) -> Any:
                    user = get_current_user()
                    data = request.get_json(silent=True) or request.form.to_dict() or {}
                    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
                    if not code:
                        return jsonify({'error': 'Kein Raumcode angegeben'}), 400
                    return self._call_handler(fn, room_code=code, user=user, data=data)

                endpoint_rc = f"{self.name}_{name}_rc"
                endpoint_root = f"{self.name}_{name}_root"
                if endpoint_rc not in self.view_functions:
                    self.add_url_rule(f'/<room_code>/{name}', endpoint_rc, route_wrapper, methods=['POST'])
                if endpoint_root not in self.view_functions:
                    self.add_url_rule(f'/{name}', endpoint_root, route_wrapper, methods=['POST'])
            return fn
        return decorator

    def _register_standard_routes(self) -> None:
        """Wires standard room discovery, creation, join, leave, state, and heartbeat endpoints."""
        bp = self
        game_id = self.game_id
        tpl = self.template_file
        init_state_fn = self.initial_state_factory
        sanitize_fn = self.sanitize_state_func
        max_players = self.max_players
        allow_spectator = self.allow_spectator
        custom_create_fn = self.custom_create_room_fn
        template_context_fn = self.template_context
        on_join_fn = self.on_join_fn
        on_leave_fn = self.on_leave_fn
        on_heartbeat_fn = self.on_heartbeat_fn

        @bp.route('/', methods=['GET'])
        @bp.route('/<room_code>', methods=['GET'])
        @login_required
        def index(room_code=None):
            user = get_current_user()
            username = user['username'] if user else ''
            ctx = {
                'room_code': room_code,
                'existing_name': username,
                'username': username,
                'game_id': game_id,
            }
            if template_context_fn:
                extra = template_context_fn()
                if extra:
                    ctx.update(extra)
            return render_template(tpl, **ctx)

        @bp.route('/rooms', methods=['GET'])
        @bp.route('/list_lobbies', methods=['GET'])
        @login_required
        def handle_list_lobbies():
            lobbies = list_rooms(game_id)
            return jsonify({'success': True, 'rooms': lobbies, 'lobbies': lobbies})

        @bp.route('/create', methods=['POST'])
        @bp.route('/create_room', methods=['POST'])
        @login_required
        def handle_create():
            if custom_create_fn:
                return custom_create_fn()

            user = get_current_user()
            username = user['username'] if user else 'Player'
            user_id = user['id'] if user else None

            initial_state = init_state_fn()
            code = create_room(game_id, username, user_id, initial_state)
            record_player_heartbeat(game_id, code, username)

            st = get_room_state(game_id, code) or initial_state
            safe = sanitize_fn(st)
            return jsonify({
                'success': True,
                'room_code': code,
                'state': safe,
                **safe,
            })

        @bp.route('/<room_code>/join', methods=['POST'])
        @bp.route('/join_game', methods=['POST'])
        @login_required
        def handle_join(room_code=None):
            user = get_current_user()
            username = user['username'] if user else 'Player'
            data = request.get_json(silent=True) or request.form.to_dict() or {}
            code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

            if not code:
                return jsonify({'error': 'Kein Raumcode angegeben'}), 400

            if on_join_fn:
                return bp._call_handler(on_join_fn, room_code=code, user=user, data=data)

            try:
                state = join_room(
                    game_id=game_id,
                    room_code=code,
                    username=username,
                    max_players=max_players,
                    allow_spectator=allow_spectator,
                )
                record_player_heartbeat(game_id, code, username)
                bp.trigger_update(code, state)
                safe = sanitize_fn(state)
                return jsonify({'success': True, 'state': safe, **safe})
            except ValueError as e:
                return jsonify({'success': False, 'error': str(e)}), 400

        @bp.route('/<room_code>/leave', methods=['POST'])
        @bp.route('/<room_code>/leave_game', methods=['POST'])
        @bp.route('/leave_game', methods=['POST'])
        @login_required
        def handle_leave(room_code=None):
            user = get_current_user()
            username = user['username'] if user else 'Player'
            data = request.get_json(silent=True) or request.form.to_dict() or {}
            code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

            if not code:
                return jsonify({'success': True})

            state = leave_room(game_id, code, username)
            if state and on_leave_fn:
                on_leave_fn(code, state, username)
            if state:
                bp.trigger_update(code, state)
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
            data = request.get_json(silent=True) or request.form.to_dict() or {}
            code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

            if not code:
                return jsonify({'success': True})

            if on_heartbeat_fn:
                return bp._call_handler(on_heartbeat_fn, room_code=code, user=user, data=data)

            record_player_heartbeat(game_id, code, username)
            return jsonify({'success': True})

        @bp.route('/<room_code>/action', methods=['POST'])
        @login_required
        def handle_action_endpoint(room_code):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Nicht angemeldet'}), 401
            data = request.get_json(silent=True) or request.form.to_dict() or {}
            action_name = data.get('action')
            if not action_name:
                return jsonify({'error': 'No action specified'}), 400
            return bp.dispatch_action(room_code, action_name, user, data)

        @bp.route('/<room_code>/<action_name>', methods=['POST'])
        @login_required
        def handle_named_action_endpoint(room_code, action_name):
            if action_name in bp.action_handlers:
                user = get_current_user()
                data = request.get_json(silent=True) or request.form.to_dict() or {}
                return bp.dispatch_action(room_code, action_name, user, data)
            return jsonify({'error': f"Unknown action '{action_name}'"}), 404


def create_multiplayer_blueprint(
    game_id: str,
    url_prefix: Optional[str] = None,
    template: Optional[str] = None,
    initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
    sanitize_state_func: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
    max_players: int = 10,
    allow_spectator: bool = True,
    template_context: Optional[Callable[[], Dict[str, Any]]] = None,
    custom_create_room_fn: Optional[Callable[[], Any]] = None,
    on_join: Optional[Callable] = None,
    on_leave: Optional[Callable] = None,
    on_heartbeat: Optional[Callable] = None,
    bp_name: Optional[str] = None,
    **kwargs: Any,
) -> MultiplayerBlueprint:
    """Factory creating an enhanced MultiplayerBlueprint configured with room lifecycle and action dispatch."""
    return MultiplayerBlueprint(
        game_id=game_id,
        name=bp_name,
        url_prefix=url_prefix,
        template=template,
        initial_state_factory=initial_state_factory,
        sanitize_state_func=sanitize_state_func,
        max_players=max_players,
        allow_spectator=allow_spectator,
        template_context=template_context,
        custom_create_room_fn=custom_create_room_fn,
        on_join=on_join,
        on_leave=on_leave,
        on_heartbeat=on_heartbeat,
        **kwargs,
    )
