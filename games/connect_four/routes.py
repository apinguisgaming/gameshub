"""4-Gewinnt route handlers powered by GameHub Multiplayer Blueprint."""
import logging
from flask import jsonify, request
from apps.auth.decorators import login_required, get_current_user
from engine.rooms import (
    get_room_state,
    validate_room_capacity,
    validate_game_start,
)
from engine.multiplayer import create_multiplayer_blueprint
from engine.stats import record_match_outcome
from . import logic as c4_logic

logger = logging.getLogger(__name__)
GAME_ID = 'connect_four'


def handle_c4_join(room_code: str, user: dict, data: dict):
    """Custom join handler managing player capacity and spectator role."""
    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'error': f"Raum '{room_code}' nicht gefunden"}), 404

    name = user['username']
    players = state.setdefault('players', [])
    spectators = state.setdefault('spectators', [])

    if name not in players and name not in spectators:
        if state.get('status') in ('playing', 'finished') or len(players) >= 2:
            spectators.append(name)
        else:
            players.append(name)
            state.setdefault('scores', {})[name] = 0

    if not state.get('host') or state['host'] not in players:
        state['host'] = players[0] if players else (spectators[0] if spectators else name)

    trigger_update(room_code, state)
    return jsonify(c4_logic.get_client_safe_state(state))


def handle_c4_leave(room_code: str, state: dict, username: str):
    """Handles player forfeit or room cleanup when leaving."""
    players = state.get('players', [])
    spectators = state.get('spectators', [])

    if username in spectators:
        spectators.remove(username)

    if username in players:
        players.remove(username)
        # If game was in progress, the remaining player wins by forfeit
        if state.get('status') == 'playing' and players:
            remaining_player = players[0]
            state['status'] = 'finished'
            state['winner'] = remaining_player
            scores = state.setdefault('scores', {})
            scores[remaining_player] = scores.get(remaining_player, 0) + 1
            record_game_results_if_ended(state)
        elif len(players) < 2:
            state['status'] = 'lobby'
            state['board'] = [[None for _ in range(c4_logic.COLS)] for _ in range(c4_logic.ROWS)]
            state['winner'] = None
            state['winning_cells'] = []


connect_four_bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    bp_name='connect_four_bp',
    url_prefix='/connect-four',
    template='connect_four.html',
    initial_state_factory=c4_logic.get_initial_state,
    sanitize_state_func=c4_logic.get_client_safe_state,
    max_players=2,
    min_players=2,
    allow_spectator=True,
    on_join=handle_c4_join,
    on_leave=handle_c4_leave,
)


def trigger_update(room_code: str, state: dict, event_name: str = 'state-update', force_full: bool = False):
    """Broadcasts sanitized state via Pusher and saves to SQLite storage."""
    code = room_code.upper().strip()
    payload = c4_logic.get_client_safe_state(state)
    return connect_four_bp.trigger_update(
        room_code=code,
        state=state,
        event_name=event_name,
        force_full=force_full,
        custom_payload=payload
    )


def record_game_results_if_ended(state: dict):
    """Records match winner/loser in database once on match completion."""
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


@connect_four_bp.action('start_game')
def action_start_game(room_code: str, user: dict, state: dict, data: dict):
    """Host action to start the match."""
    username = user['username']
    if username != state.get('host'):
        return jsonify({'error': 'Nur der Host kann das Spiel starten'}), 403

    err = validate_game_start(GAME_ID, len(state.get('players', [])))
    if err:
        return jsonify({'error': err}), 400

    success, msg = c4_logic.start_game(state)
    if not success:
        return jsonify({'error': msg}), 400

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': c4_logic.get_client_safe_state(state)})


@connect_four_bp.action('drop_disc')
def action_drop_disc(room_code: str, user: dict, state: dict, data: dict):
    """Active player drops a disc into a column."""
    username = user['username']
    col = data.get('col')
    if col is None:
        return jsonify({'error': 'Spalte nicht angegeben'}), 400

    try:
        col = int(col)
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültige Spaltenangabe'}), 400

    success, msg = c4_logic.drop_disc(state, username, col)
    if not success:
        return jsonify({'error': msg}), 400

    if state.get('status') == 'finished':
        record_game_results_if_ended(state)

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': c4_logic.get_client_safe_state(state)})


@connect_four_bp.action('restart_game')
def action_restart_game(room_code: str, user: dict, state: dict, data: dict):
    """Restarts a finished game for another round."""
    username = user['username']
    players = state.get('players', [])
    if username not in players and username != state.get('host'):
        return jsonify({'error': 'Nur teilnehmende Spieler können die Revanche starten'}), 403

    success, msg = c4_logic.restart_game(state)
    if not success:
        return jsonify({'error': msg}), 400

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': c4_logic.get_client_safe_state(state)})


@connect_four_bp.action('reset_lobby')
def action_reset_lobby(room_code: str, user: dict, state: dict, data: dict):
    """Host resets game back to lobby."""
    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann zurück zur Lobby'}), 403

    state['status'] = 'lobby'
    state['board'] = [[None for _ in range(c4_logic.COLS)] for _ in range(c4_logic.ROWS)]
    state['winning_cells'] = []
    state['winner'] = None
    state['is_draw'] = False

    trigger_update(room_code, state)
    return jsonify({'success': True, 'state': c4_logic.get_client_safe_state(state)})
