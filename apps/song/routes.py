"""Song Guesser route handlers supporting multi-room lobbies and persistent authentication."""
import time
from flask import Blueprint, jsonify, render_template, request, session
from config import get_pusher_client
from storage import get_storage
from apps.auth.decorators import login_required, get_current_user
from apps.common.rooms import (
    create_room,
    join_room,
    leave_room,
    list_rooms,
    get_room_state,
    update_room_state,
)
from apps.common.delta import broadcast_tracker
from . import logic as song_logic

song_bp = Blueprint('song_bp', __name__)


def trigger_update(room_code: str, state: dict, event_name: str = 'state-update', custom_payload: dict = None, force_full: bool = False):
    """Broadcasts sanitized state or delta update via room-scoped Pusher channel and persists to storage."""
    code = room_code.upper().strip()
    channel_name = f'song-{code}'

    if custom_payload is not None:
        payload = custom_payload
    elif event_name == 'state-update':
        safe = song_logic.get_client_safe_state(state)
        payload, is_delta = broadcast_tracker.get_broadcast_payload('song', code, safe, force_full=force_full)
        if payload is None:
            return {'success': True, 'skipped': 'no_changes'}
    else:
        payload = song_logic.get_client_safe_state(state)

    storage = get_storage()
    storage.save_lobby(
        game_id='song',
        room_code=code,
        state=state,
        player_count=len(state.get('players', [])),
        status=state.get('status', 'lobby')
    )

    client = get_pusher_client()
    pusher_res = {'client_type': type(client).__name__, 'channel': channel_name, 'event': event_name}
    if type(client).__name__ == 'DummyPusher':
        pusher_res['error'] = getattr(client, 'error', 'Dummy client active (import failed)')
        return pusher_res

    try:
        trig = client.trigger(channel_name, event_name, payload)
        pusher_res['success'] = True
        pusher_res['result'] = str(trig)
    except Exception as e:
        import logging
        logging.error(f"[Pusher Error] Failed to trigger {channel_name}/{event_name}: {e}", exc_info=True)
        pusher_res['error'] = f"{type(e).__name__}: {e}"

    return pusher_res


def record_game_results_if_ended(state: dict):
    """Records match results and high scores to storage."""
    if state.get('status') != 'finished':
        return
    if state.get('stats_recorded'):
        return
    state['stats_recorded'] = True

    storage = get_storage()
    scores = state.get('scores', {})
    if not scores:
        return

    max_score = max(scores.values()) if scores else 0
    winners = [p for p, s in scores.items() if s == max_score and s > 0]

    for player, score in scores.items():
        user = storage.get_user_by_username(player)
        if not user:
            continue
        uid = user['id']
        won = player in winners
        storage.update_stats(
            user_id=uid,
            game_id='song',
            games_played=1,
            wins=1 if won else 0,
            losses=0 if won else 1,
            high_score=score
        )


# --- PORTAL & ROOM MANAGEMENT ---

@song_bp.route('/')
@login_required
def index():
    user = get_current_user()
    username = user['username'] if user else ''
    library = song_logic.load_songs_library()
    playlist_names = list(library.keys()) if library else []
    return render_template('song.html', existing_name=username, playlists=playlist_names)


@song_bp.route('/rooms', methods=['GET'])
@login_required
def get_rooms():
    active = list_rooms('song')
    return jsonify({'success': True, 'rooms': active})


@song_bp.route('/create_room', methods=['POST'])
@login_required
def create_new_room():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    initial = song_logic.get_initial_state()
    room_code = create_room(
        game_id='song',
        host_username=user['username'],
        host_user_id=user['id'],
        initial_state=initial
    )
    return jsonify({'success': True, 'room_code': room_code})


@song_bp.route('/join_game', methods=['POST'])
@song_bp.route('/<room_code>/join', methods=['POST'])
@login_required
def join_game(room_code: str = None):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    name = user['username']
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({'error': 'Kein Raumcode angegeben'}), 400

    state = get_room_state('song', code)
    if not state:
        return jsonify({'error': f"Raum '{code}' nicht gefunden"}), 404

    players = state.setdefault('players', [])
    scores = state.setdefault('scores', {})

    if name not in players:
        if state.get('status') in ('playing', 'finished'):
            # Join as spectator
            state.setdefault('spectators', []).append(name)
        else:
            if len(players) >= 4:
                return jsonify({'error': 'Raum ist voll (max. 4 Spieler)'}), 400
            players.append(name)
            scores[name] = 0

    if not state.get('host') or state['host'] not in players:
        state['host'] = name

    trigger_update(code, state)
    return jsonify(song_logic.get_client_safe_state(state))


@song_bp.route('/<room_code>/leave_game', methods=['POST'])
@song_bp.route('/leave_game', methods=['POST'])
@login_required
def leave(room_code: str = None):
    user = get_current_user()
    name = user['username'] if user else None
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    if not code or not name:
        return jsonify({'success': True})

    state = get_room_state('song', code)
    if not state:
        return jsonify({'success': True})

    if name in state.get('players', []):
        state['players'].remove(name)
    if name in state.get('spectators', []):
        state['spectators'].remove(name)
    if name in state.get('scores', []):
        del state['scores'][name]

    if len(state.get('players', [])) == 0 and len(state.get('spectators', [])) == 0:
        get_storage().delete_lobby('song', code)
        return jsonify({'success': True})

    if state.get('host') == name and state.get('players'):
        state['host'] = state['players'][0]

    trigger_update(code, state)
    return jsonify({'success': True})


@song_bp.route('/<room_code>/start_game', methods=['POST'])
@song_bp.route('/start_game', methods=['POST'])
@login_required
def start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann starten'}), 403

    if len(state.get('players', [])) < 2:
        return jsonify({'error': 'Mindestens 2 Spieler erforderlich (2 bis 4 Spieler)'}), 400

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


@song_bp.route('/<room_code>/finish_game', methods=['POST'])
@song_bp.route('/finish_game', methods=['POST'])
@login_required
def finish(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    state['status'] = 'finished'
    state['round']['active'] = False
    record_game_results_if_ended(state)
    trigger_update(code, state, 'game-over')
    return jsonify({'game_over': True})


@song_bp.route('/<room_code>/player_ready', methods=['POST'])
@song_bp.route('/player_ready', methods=['POST'])
@login_required
def player_ready(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    player = user['username']

    state = get_room_state('song', code)
    if not state:
        return jsonify({'status': 'waiting'})

    round_data = state.get('round', {})
    if round_data.get('status') != 'preloading':
        return jsonify({'status': round_data.get('status', 'waiting')})

    ready_players = round_data.setdefault('ready_players', [])
    if player not in ready_players:
        ready_players.append(player)

    active_players = state.get('players', [])
    if set(active_players).issubset(set(ready_players)):
        now = time.time()
        launch_delay = 1.2
        round_data['status'] = 'playing'
        round_data['start_time'] = now + launch_delay
        round_data['end_time'] = round_data['start_time'] + state['settings']['time_per_song']
        trigger_update(code, state, 'round-start')
        return jsonify({'status': 'started'})

    get_storage().save_lobby('song', code, state, len(active_players), state.get('status', 'playing'))
    return jsonify({'status': 'waiting'})


@song_bp.route('/<room_code>/force_start', methods=['POST'])
@song_bp.route('/force_start', methods=['POST'])
@login_required
def force_start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
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


@song_bp.route('/<room_code>/submit_guess', methods=['POST'])
@song_bp.route('/submit_guess', methods=['POST'])
@login_required
def submit_guess(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    player = user['username']
    guess_id = request.form.get('guess_id')

    try:
        elapsed = float(request.form.get('elapsed', 0.0))
    except (ValueError, TypeError):
        elapsed = 0.0

    state = get_room_state('song', code)
    if not state or not guess_id:
        return jsonify({'result': 'error'})

    result_status, points = song_logic.evaluate_guess(state, player, guess_id, elapsed)

    if result_status == 'correct':
        trigger_update(code, state)
        return jsonify({'result': 'correct', 'points': points, 'scores': state.get('scores')})
    elif result_status == 'wrong':
        trigger_update(code, state)
        return jsonify({'result': 'wrong', 'points': 0, 'scores': state.get('scores')})

    return jsonify({'result': result_status, 'scores': state.get('scores')})


@song_bp.route('/<room_code>/end_round', methods=['POST'])
@song_bp.route('/end_round', methods=['POST'])
@login_required
def end_round(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
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


@song_bp.route('/<room_code>/update_settings', methods=['POST'])
@song_bp.route('/update_settings', methods=['POST'])
@login_required
def update_settings(room_code: str = None):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
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


@song_bp.route('/<room_code>/reset_game', methods=['POST'])
@song_bp.route('/reset_game', methods=['POST'])
@login_required
def reset_game(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('song', code)
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

    trigger_update(code, new_state)
    try:
        get_pusher_client().trigger(f'song-{code}', 'game-reset', {})
    except Exception:
        pass
    return jsonify({'success': True})


@song_bp.route('/<room_code>/heartbeat', methods=['POST'])
@song_bp.route('/heartbeat', methods=['POST'])
@login_required
def heartbeat(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    status = request.form.get('status') or data.get('status')
    force_offline = (status == 'leaving')

    if not code:
        return jsonify({'offline': []})

    state = get_room_state('song', code)
    if not state:
        return jsonify({'offline': [], 'room_closed': True})

    get_storage().touch_lobby('song', code)

    state, offline, kicked = song_logic.handle_heartbeat(
        state, code, user['username'], force_offline=force_offline
    )

    if kicked:
        trigger_update(code, state)

    safe_state = song_logic.get_client_safe_state(state)
    return jsonify({'offline': offline, 'state': safe_state})