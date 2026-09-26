"""Battleship (Schiffe Versenken) routes and multiplayer actions."""
import logging
from flask import jsonify, request
from apps.auth.decorators import login_required, get_current_user
from engine.rooms import (
    get_room_state,
    validate_game_start,
)
from engine.multiplayer import create_multiplayer_blueprint
from engine.stats import record_match_outcome
from . import logic as bs_logic

logger = logging.getLogger(__name__)
GAME_ID = 'battleship'


def handle_bs_join(room_code: str, user: dict, data: dict):
    """Custom join handler managing player capacity and spectator assignment."""
    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'error': f"Raum '{room_code}' nicht gefunden"}), 404

    name = user['username']
    players = state.setdefault('players', [])
    spectators = state.setdefault('spectators', [])

    if name not in players and name not in spectators:
        if state.get('status') in ('placement', 'battle', 'finished') or len(players) >= 2:
            spectators.append(name)
        else:
            players.append(name)
            state.setdefault('scores', {})[name] = 0

    if not state.get('host') or state['host'] not in players:
        state['host'] = players[0] if players else (spectators[0] if spectators else name)

    trigger_update(room_code, state)
    return jsonify(bs_logic.get_client_safe_state(state, for_player=name))


def handle_bs_leave(room_code: str, state: dict, username: str):
    """Handles forfeit or room cleanup on player leave."""
    players = state.get('players', [])
    spectators = state.get('spectators', [])

    if username in spectators:
        spectators.remove(username)

    if username in players:
        players.remove(username)
        if state.get('status') in ('placement', 'battle') and players:
            remaining_player = players[0]
            state['status'] = 'finished'
            state['winner'] = remaining_player
            scores = state.setdefault('scores', {})
            scores[remaining_player] = scores.get(remaining_player, 0) + 1
            record_game_results_if_ended(state)
        elif len(players) < 2:
            state['status'] = 'lobby'
            state['fleets'] = {}
            state['shots'] = {}
            state['ready'] = {}
            state['winner'] = None


battleship_bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    bp_name='battleship_bp',
    url_prefix='/battleship',
    template='battleship.html',
    initial_state_factory=bs_logic.get_initial_state,
    sanitize_state_func=bs_logic.get_client_safe_state,
    max_players=2,
    min_players=2,
    allow_spectator=True,
    on_join=handle_bs_join,
    on_leave=handle_bs_leave,
)


def trigger_update(room_code: str, state: dict, event_name: str = 'state-update', force_full: bool = False):
    """Broadcasts sanitized state via Pusher and saves to SQLite storage."""
    code = room_code.upper().strip()
    payload = bs_logic.get_client_safe_state(state)
    return battleship_bp.trigger_update(
        room_code=code,
        state=state,
        event_name=event_name,
        force_full=force_full,
        custom_payload=payload
    )


def record_game_results_if_ended(state: dict):
    """Persists match results to storage in a single transaction."""
    if state.get('status') != 'finished' or state.get('stats_recorded'):
        return

    winner = state.get('winner')
    players = state.get('players', [])
    if winner and winner in players:
        losers = [p for p in players if p != winner]
        state['stats_recorded'] = True
        record_match_outcome(
            game_id=GAME_ID,
            winners=[winner],
            losers=losers,
            scores=state.get('scores', {})
        )


@battleship_bp.route('/<room_code>/my_fleet', methods=['GET'])
@battleship_bp.route('/my_fleet', methods=['GET'])
@login_required
def get_my_fleet(room_code=None):
    """Returns the caller's private fleet layout."""
    user = get_current_user()
    code = (room_code or request.args.get('room_code') or '').upper().strip()
    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    fleet = state.get('fleets', {}).get(user['username'], [])
    return jsonify({'success': True, 'fleet': fleet})


@battleship_bp.route('/random_fleet', methods=['GET'])
@login_required
def get_random_fleet():
    """Generates a random valid placement for the client."""
    commander = request.args.get('commander')
    mode = request.args.get('mode', 'commanders')
    fleet = bs_logic.generate_random_fleet(commander_id=commander, game_mode=mode)
    return jsonify({'success': True, 'fleet': fleet})


@battleship_bp.action('start_game')
def action_start_game(room_code: str, user: dict, state: dict, data: dict):
    """Host advances lobby to placement phase."""
    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann das Spiel starten'}), 403

    err = validate_game_start(GAME_ID, len(state.get('players', [])))
    if err:
        return jsonify({'error': err}), 400

    success, msg = bs_logic.start_placement(state)
    if not success:
        return jsonify({'error': msg}), 400

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.action('confirm_fleet')
def action_confirm_fleet(room_code: str, user: dict, state: dict, data: dict):
    """Player confirms their placed ships."""
    fleet = data.get('fleet', [])
    success, msg = bs_logic.confirm_placement(state, user['username'], fleet)
    if not success:
        return jsonify({'error': msg}), 400

    trigger_update(room_code, state)
    return jsonify({'success': True, 'message': msg, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.action('fire_shot')
def action_fire_shot(room_code: str, user: dict, state: dict, data: dict):
    """Player fires an attack at a target grid cell."""
    row = data.get('row')
    col = data.get('col')
    if row is None or col is None:
        return jsonify({'error': 'Zeile und Spalte erforderlich'}), 400

    try:
        row, col = int(row), int(col)
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültige Koordinaten'}), 400

    success, msg, shot_record = bs_logic.fire_shot(state, user['username'], row, col)
    if not success:
        return jsonify({'error': msg}), 400

    if state.get('status') == 'finished':
        record_game_results_if_ended(state)

    trigger_update(room_code, state)
    return jsonify({
        'success': True,
        'message': msg,
        'shot': shot_record,
        'state': bs_logic.get_client_safe_state(state, for_player=user['username'])
    })


@battleship_bp.action('restart_game')
def action_restart_game(room_code: str, user: dict, state: dict, data: dict):
    """Starts a rematch going back to fleet placement."""
    players = state.get('players', [])
    if user['username'] not in players and user['username'] != state.get('host'):
        return jsonify({'error': 'Nur Spieler oder Host können Revanche starten'}), 403

    success, msg = bs_logic.start_placement(state)
    if not success:
        return jsonify({'error': msg}), 400

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.action('reset_lobby')
def action_reset_lobby(room_code: str, user: dict, state: dict, data: dict):
    """Resets room back to lobby."""
    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann zurück zur Lobby'}), 403

    state['status'] = 'lobby'
    state['fleets'] = {}
    state['shots'] = {}
    state['ready'] = {}
    state['winner'] = None
    state['last_shot'] = None

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.route('/commanders', methods=['GET'])
@login_required
def get_commanders():
    """Returns available commanders and their tactical abilities."""
    return jsonify({'success': True, 'commanders': bs_logic.COMMANDERS})


@battleship_bp.action('set_game_mode')
def action_set_game_mode(room_code: str, user: dict, state: dict, data: dict):
    """Host sets the match mode: classic or commanders."""
    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann den Spielmodus ändern'}), 403

    mode = data.get('mode', 'commanders')
    if mode not in ('classic', 'commanders'):
        return jsonify({'error': 'Ungültiger Spielmodus'}), 400

    state['game_mode'] = mode
    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.action('select_commander')
def action_select_commander(room_code: str, user: dict, state: dict, data: dict):
    """Player chooses their commanding naval officer."""
    cid = data.get('commander')
    if cid not in bs_logic.COMMANDERS:
        return jsonify({'error': 'Unbekannter Kommandant'}), 400

    state.setdefault('commanders', {})[user['username']] = cid
    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': bs_logic.get_client_safe_state(state, for_player=user['username'])})


@battleship_bp.action('fire_ability')
def action_fire_ability(room_code: str, user: dict, state: dict, data: dict):
    """Player executes their special Commander tactical strike."""
    row = data.get('row')
    col = data.get('col')
    direction = data.get('dir', 'H')
    ability_id = data.get('ability_id')

    if row is None or col is None:
        return jsonify({'error': 'Zielkoordinaten erforderlich'}), 400

    try:
        row, col = int(row), int(col)
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültige Koordinaten'}), 400

    success, msg, result_data = bs_logic.execute_ability(state, user['username'], row, col, direction, ability_id=ability_id)
    if not success:
        return jsonify({'error': msg}), 400

    if state.get('status') == 'finished':
        record_game_results_if_ended(state)

    trigger_update(room_code, state)
    return jsonify({
        'success': True,
        'message': msg,
        'result': result_data,
        'state': bs_logic.get_client_safe_state(state, for_player=user['username'])
    })
