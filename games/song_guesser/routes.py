"""Song Guesser route handlers powered by GameHub Multiplayer Blueprint."""
import time
from flask import jsonify, request
from config import get_pusher_client
from storage import get_storage
from apps.auth.decorators import login_required, get_current_user
from engine.rooms import (
    get_room_state,
    validate_room_capacity,
    validate_game_start,
)
from engine.multiplayer import create_multiplayer_blueprint
from engine.stats import record_match_outcome
from . import logic as song_logic

GAME_ID = 'song_guesser'


def get_template_context():
    """Provides playlist names to the lobby template."""
    library = song_logic.load_songs_library()
    playlist_names = list(library.keys()) if library else []
    return {'playlists': playlist_names}


def handle_song_join(room_code: str, user: dict, data: dict):
    """Custom join handler initializing player scores or spectator role."""
    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'error': f"Raum '{room_code}' nicht gefunden"}), 404

    name = user['username']
    players = state.setdefault('players', [])
    scores = state.setdefault('scores', {})

    if name not in players:
        if state.get('status') in ('playing', 'finished'):
            state.setdefault('spectators', []).append(name)
        else:
            cap_error = validate_room_capacity(GAME_ID, len(players))
            if cap_error:
                return jsonify({'error': cap_error}), 400
            players.append(name)
            scores[name] = 0

    if not state.get('host') or state['host'] not in players:
        state['host'] = name

    trigger_update(room_code, state)
    return jsonify(song_logic.get_client_safe_state(state))


def handle_song_leave(room_code: str, state: dict, username: str):
    """Cleans up player score when leaving."""
    if username in state.get('scores', {}):
        del state['scores'][username]


def handle_song_heartbeat(room_code: str, user: dict, data: dict):
    """Handles song guesser heartbeat with inactive player kicking."""
    status = data.get('status') or request.form.get('status')
    force_offline = (status == 'leaving')

    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'offline': [], 'room_closed': True})

    get_storage().touch_lobby(GAME_ID, room_code)

    state, offline, kicked = song_logic.handle_heartbeat(
        state, room_code, user['username'], force_offline=force_offline
    )

    if kicked:
        trigger_update(room_code, state)

    safe_state = song_logic.get_client_safe_state(state)
    return jsonify({'offline': offline, 'state': safe_state})


# Instantiate reusable multiplayer blueprint
song_bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    bp_name='song_bp',
    url_prefix='/song-guesser',
    template='song_guesser.html',
    initial_state_factory=song_logic.get_initial_state,
    sanitize_state_func=song_logic.get_client_safe_state,
    template_context=get_template_context,
    on_join=handle_song_join,
    on_leave=handle_song_leave,
    on_heartbeat=handle_song_heartbeat,
)


def trigger_update(room_code: str, state: dict, event_name: str = 'state-update', custom_payload: dict = None, force_full: bool = False, extra_events: list = None):
    """Broadcasts sanitized state or delta update via non-blocking Pusher dispatch and persists to storage."""
    code = room_code.upper().strip()
    payload = custom_payload if custom_payload is not None else song_logic.get_client_safe_state(state)
    return song_bp.trigger_update(
        room_code=code,
        state=state,
        event_name=event_name,
        force_full=force_full,
        extra_events=extra_events or [],
        custom_payload=payload
    )


def record_game_results_if_ended(state: dict):
    """Records match results and high scores to storage in a single transaction."""
    if state.get('status') != 'finished':
        return
    if state.get('stats_recorded'):
        return
    state['stats_recorded'] = True

    scores = state.get('scores', {})
    if not scores:
        return

    max_score = max(scores.values()) if scores else 0
    winners = [p for p, s in scores.items() if s == max_score and s > 0]
    losers = [p for p in scores.keys() if p not in winners]

    record_match_outcome(game_id=GAME_ID, winners=winners, losers=losers, scores=scores)


# --- NON-ACTION ENDPOINTS ---

@song_bp.route('/clock', methods=['GET'])
def get_clock():
    """Returns authoritative server timestamp for client audio playback synchronization."""
    return jsonify({'server_time': time.time()})


# --- ACTIONS ---

@song_bp.action('start_game')
def start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann starten'}), 403

    start_error = validate_game_start(GAME_ID, len(state.get('players', [])))
    if start_error:
        return jsonify({'error': start_error}), 400

    if state.get('status') in ['lobby', 'finished']:
        state['status'] = 'playing'
        state['round']['number'] = 0
        state['scores'] = {p: 0 for p in state['players']}
        state['played_songs'] = []
        state['next_round_cache'] = None
        state['stats_recorded'] = False

    state = song_logic.start_new_round(state)

    if state.get('status') == 'finished':
        record_game_results_if_ended(state)
        trigger_update(code, state, 'game-over')
        return jsonify({'game_over': True})

    if state.get('round', {}).get('active'):
        trigger_update(code, state, 'round-preload')
        return jsonify({'success': True})

    record_game_results_if_ended(state)
    trigger_update(code, state, 'game-over')
    return jsonify({'game_over': True})


@song_bp.action('finish_game')
def finish(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    state['status'] = 'finished'
    state['round']['active'] = False
    record_game_results_if_ended(state)
    trigger_update(code, state, 'game-over')
    return jsonify({'game_over': True})


@song_bp.action('player_ready')
def player_ready(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    player = user['username']

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'status': 'waiting'})

    round_data = state.get('round', {})
    if round_data.get('status') != 'preloading':
        return jsonify({'status': round_data.get('status', 'waiting')})

    ready_players = round_data.setdefault('ready_players', [])
    if player not in ready_players:
        ready_players.append(player)

    active_players = state.get('players', [])
    storage = get_storage()
    heartbeats = storage.get_room_heartbeats(GAME_ID, code)
    now_ts = time.time()
    online_players = [p for p in active_players if (now_ts - heartbeats.get(p, 0)) <= 45.0]
    expected_players = online_players if online_players else active_players

    if set(expected_players).issubset(set(ready_players)):
        now = time.time()
        launch_delay = 1.2
        round_data['status'] = 'playing'
        round_data['start_time'] = now + launch_delay
        round_data['end_time'] = round_data['start_time'] + state['settings']['time_per_song']
        trigger_update(code, state, 'round-start')
        return jsonify({'status': 'started'})

    storage.save_lobby(GAME_ID, code, state, len(active_players), state.get('status', 'playing'))
    return jsonify({'status': 'waiting'})


@song_bp.action('force_start')
def force_start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    round_data = state.get('round', {})
    if round_data.get('status') == 'preloading':
        now = time.time()
        round_data['status'] = 'playing'
        round_data['start_time'] = now + 1.0
        round_data['end_time'] = round_data['start_time'] + state['settings']['time_per_song']
        trigger_update(code, state, 'round-start')

    return jsonify({'success': True})


@song_bp.action('submit_guess')
def submit_guess(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    player = user['username']
    guess_id = request.form.get('guess_id') or (request.get_json(silent=True) or {}).get('guess_id')

    try:
        raw_elapsed = request.form.get('elapsed') or (request.get_json(silent=True) or {}).get('elapsed') or 0.0
        client_elapsed = float(raw_elapsed)
    except (ValueError, TypeError):
        client_elapsed = 0.0

    state = get_room_state(GAME_ID, code)
    if not state or not guess_id:
        return jsonify({'result': 'error'})

    now = time.time()
    round_start = state.get('round', {}).get('start_time')
    if round_start:
        elapsed = max(0.0, now - round_start)
    else:
        elapsed = client_elapsed

    result_status, points = song_logic.evaluate_guess(state, player, guess_id, elapsed)

    if result_status == 'correct':
        trigger_update(code, state)
        return jsonify({'result': 'correct', 'points': points, 'scores': state.get('scores')})
    elif result_status == 'wrong':
        trigger_update(code, state)
        return jsonify({'result': 'wrong', 'points': 0, 'scores': state.get('scores')})

    return jsonify({'result': result_status, 'scores': state.get('scores')})


@song_bp.action('end_round')
def end_round(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann die Runde beenden'}), 403

    state['status'] = 'reveal'
    state['round']['active'] = False
    state['round']['reveal_answer'] = state['round'].get('correct_answer')

    is_last = state['round'].get('number', 0) >= state['settings']['total_songs']
    state['round']['is_last_round'] = is_last

    if not is_last:
        state['round']['preload_url'] = song_logic.prepare_next_round(state)
    else:
        state['round']['preload_url'] = None

    trigger_update(code, state, 'round-end')
    return jsonify({'success': True})


@song_bp.action('update_settings')
def update_settings(room_code: str = None):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': f"Raum '{code}' nicht gefunden"}), 404

    key = request.form.get('key') or data.get('key')
    val = request.form.get('value') if request.form.get('value') is not None else data.get('value')

    host_name = (state.get('host') or '').strip().lower()
    my_name = (user.get('username') or '').strip().lower()
    if my_name != host_name and key != 'playlists_open':
        return jsonify({'error': f"Nur der Host ({state.get('host')}) kann Einstellungen anpassen"}), 403

    if key == 'playlists':
        state['settings']['playlists'] = [p.strip() for p in val.split(',') if p.strip()] if val else []
    elif key in ['time_per_song', 'total_songs']:
        try:
            state['settings'][key] = int(val)
        except (ValueError, TypeError):
            pass
    elif key == 'playlists_open':
        state['settings']['playlists_open'] = str(val).lower() in ['true', '1', 'yes']

    delta = {
        'key': key,
        'value': state['settings'].get(key),
        'settings': state['settings']
    }
    pusher_status = trigger_update(code, state, event_name='settings-update', custom_payload=delta)
    return jsonify({'success': True, 'settings': state.get('settings'), 'pusher': pusher_status})


@song_bp.action('reset_game')
def reset_game(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann zurücksetzen'}), 403

    saved_settings = state.get('settings', {})
    saved_players = state.get('players', [])
    host = state.get('host')

    new_state = song_logic.get_initial_state()
    new_state['settings'] = saved_settings
    new_state['players'] = saved_players
    new_state['host'] = host
    new_state['scores'] = {p: 0 for p in saved_players}

    trigger_update(code, new_state, extra_events=[('game-reset', {})])
    return jsonify({'success': True})