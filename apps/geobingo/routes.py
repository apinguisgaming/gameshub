"""Geo Bingo route handlers supporting multi-room lobbies and real-time state sync."""
import logging
import time
from flask import Blueprint, jsonify, render_template, request
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
from . import logic as geobingo_logic
from . import items as geobingo_items

logger = logging.getLogger(__name__)
geobingo_bp = Blueprint('geobingo_bp', __name__)


def trigger_update(room_code: str, state: dict, force_full: bool = False):
    """Broadcasts sanitized state via room-scoped Pusher channel and saves to storage."""
    code = room_code.upper().strip()
    channel_name = f'geobingo-{code}'

    state = geobingo_logic.validate_game_integrity(state)
    payload = geobingo_logic.get_client_safe_state(state)

    storage = get_storage()
    storage.save_lobby(
        game_id='geobingo',
        room_code=code,
        state=state,
        player_count=len(state.get('players', [])),
        status=state.get('status', 'lobby')
    )

    broadcast_payload, is_delta = broadcast_tracker.get_broadcast_payload(
        game_id='geobingo',
        room_code=code,
        current_safe_state=payload,
        force_full=force_full
    )

    if broadcast_payload is None:
        return

    client = get_pusher_client()
    try:
        res = client.trigger(channel_name, 'state-update', broadcast_payload)
        logger.info(f"[Pusher] Sent state-update to {channel_name} (delta={is_delta}, res={res})")
    except Exception as e:
        logger.error(f"[Pusher Error] Failed to trigger {channel_name}/state-update: {e}", exc_info=True)



def record_game_results_if_ended(state: dict):
    """Saves win/loss statistics in storage when game reaches finished status."""
    if state.get('status') != 'finished':
        return
    if state.get('stats_recorded'):
        return
    state['stats_recorded'] = True

    storage = get_storage()
    scores = state.get('scores', {})
    winner = state.get('winner')

    try:
        for player, score in scores.items():
            user = storage.get_user_by_username(player)
            if not user:
                continue
            uid = user['id']
            won = (player == winner)
            storage.update_stats(
                user_id=uid,
                game_id='geobingo',
                games_played=1,
                wins=1 if won else 0,
                losses=0 if won else 1,
                high_score=score
            )
    except Exception as e:
        logger.error(f"[GeoBingo Stats Error] Failed to update stats: {e}", exc_info=True)


# --- PORTAL & ROOM MANAGEMENT ---

@geobingo_bp.route('/')
@login_required
def index():
    user = get_current_user()
    username = user['username'] if user else ''
    global_items = geobingo_items.get_global_items()
    return render_template('geobingo.html', existing_name=username, global_items=global_items)


@geobingo_bp.route('/rooms', methods=['GET'])
@login_required
def get_rooms():
    active = list_rooms('geobingo')
    return jsonify({'success': True, 'rooms': active})


@geobingo_bp.route('/create_room', methods=['POST'])
@login_required
def create_new_room():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    initial = geobingo_logic.get_initial_state()
    room_code = create_room(
        game_id='geobingo',
        host_username=user['username'],
        host_user_id=user['id'],
        initial_state=initial
    )
    return jsonify({'success': True, 'room_code': room_code})


@geobingo_bp.route('/join_game', methods=['POST'])
@geobingo_bp.route('/<room_code>/join', methods=['POST'])
@login_required
def join_game(room_code: str = None):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    name = user['username']
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({'error': 'Kein Raumcode angegeben'}), 400

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': f"Raum '{code}' nicht gefunden"}), 404

    players = state.setdefault('players', [])
    if name not in players:
        if state.get('status') in ('playing', 'judging', 'finished'):
            # Spectator
            state.setdefault('spectators', []).append(name)
        else:
            if len(players) >= 2:
                # 1v1 limit for match participants, extra can spectate
                state.setdefault('spectators', []).append(name)
            else:
                players.append(name)

    if not state.get('host') or state['host'] not in players:
        state['host'] = name

    trigger_update(code, state)
    return jsonify(geobingo_logic.get_client_safe_state(state, for_player=name))


@geobingo_bp.route('/<room_code>/leave_game', methods=['POST'])
@geobingo_bp.route('/leave_game', methods=['POST'])
@login_required
def leave(room_code: str = None):
    user = get_current_user()
    name = user['username'] if user else None
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    if not code or not name:
        return jsonify({'success': True})

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'success': True})

    if name in state.get('players', []):
        state['players'].remove(name)
    if name in state.get('spectators', []):
        state['spectators'].remove(name)

    if len(state.get('players', [])) == 0 and len(state.get('spectators', [])) == 0:
        get_storage().delete_lobby('geobingo', code)
        return jsonify({'success': True})

    if state.get('host') == name and state.get('players'):
        state['host'] = state['players'][0]

    if state.get('status') == 'judging':
        rem_players = state.get('players', [])
        if not rem_players:
            geobingo_logic.conclude_game(state)
        else:
            jp = state.get('judge_phase', {})
            idx = jp.get('item_index', 0)
            target = jp.get('target_player')
            if target not in rem_players:
                geobingo_logic.advance_judgement_step(state)
            else:
                review_key = f"{target}_{idx}"
                judgements = state.get('judgements', {})
                yes_votes = sum(1 for p in rem_players if judgements.get(p, {}).get(review_key) is True)
                no_votes = sum(1 for p in rem_players if judgements.get(p, {}).get(review_key) is False)
                threshold = len(rem_players) / 2
                if yes_votes > threshold:
                    state.setdefault('approved_results', {})[review_key] = True
                    geobingo_logic.advance_judgement_step(state)
                elif no_votes > threshold:
                    state.setdefault('approved_results', {})[review_key] = False
                    geobingo_logic.advance_judgement_step(state)

    trigger_update(code, state)
    return jsonify({'success': True})


@geobingo_bp.route('/<room_code>/update_settings', methods=['POST'])
@geobingo_bp.route('/update_settings', methods=['POST'])
@login_required
def update_settings(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann Einstellungen anpassen'}), 403

    settings = state.setdefault('settings', {})
    if 'item_count' in data:
        try:
            settings['item_count'] = int(data['item_count'])
        except (ValueError, TypeError):
            pass
    if 'time_limit' in data:
        try:
            settings['time_limit'] = int(data['time_limit'])
        except (ValueError, TypeError):
            pass
    if 'item_preset' in data:
        settings['item_preset'] = str(data['item_preset'])
    if 'selected_items' in data:
        raw_sel = data['selected_items']
        if isinstance(raw_sel, str):
            settings['selected_items'] = [i.strip() for i in raw_sel.split(',') if i.strip()]
        elif isinstance(raw_sel, list):
            settings['selected_items'] = [str(i).strip() for i in raw_sel if str(i).strip()]
    if 'host_custom_items' in data:
        raw_host_custom = data['host_custom_items']
        if isinstance(raw_host_custom, str):
            settings['host_custom_items'] = [i.strip() for i in raw_host_custom.split(',') if i.strip()]
        elif isinstance(raw_host_custom, list):
            settings['host_custom_items'] = [str(i).strip() for i in raw_host_custom if str(i).strip()]
    if 'custom_items' in data:
        raw_items = data['custom_items']
        if isinstance(raw_items, str):
            settings['custom_items'] = [i.strip() for i in raw_items.split(',') if i.strip()]
        elif isinstance(raw_items, list):
            settings['custom_items'] = [str(i).strip() for i in raw_items if str(i).strip()]

    trigger_update(code, state)
    return jsonify({'success': True, 'settings': settings})


@geobingo_bp.route('/<room_code>/sync_custom_words', methods=['POST'])
@geobingo_bp.route('/sync_custom_words', methods=['POST'])
@login_required
def sync_custom_words(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    username = user['username']

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    items = data.get('custom_items', [])
    if isinstance(items, str):
        items = [i.strip() for i in items.split(',') if i.strip()]
    elif isinstance(items, list):
        items = [str(i).strip() for i in items if str(i).strip()]

    player_custom = state.setdefault('player_custom_items', {})
    player_custom[username] = items

    trigger_update(code, state)
    return jsonify({'success': True, 'player_custom_items': player_custom})


@geobingo_bp.route('/<room_code>/start_game', methods=['POST'])
@geobingo_bp.route('/start_game', methods=['POST'])
@login_required
def start(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann das Spiel starten'}), 403

    if len(state.get('players', [])) < 1:
        return jsonify({'error': 'Mindestens 1 Spieler erforderlich'}), 400

    state = geobingo_logic.setup_new_game(state)
    trigger_update(code, state, force_full=True)
    return jsonify({'success': True})


@geobingo_bp.route('/<room_code>/save_proof', methods=['POST'])
@geobingo_bp.route('/save_proof', methods=['POST'])
@login_required
def save_proof(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    player = user['username']

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    try:
        item_idx = int(data.get('item_idx', -1))
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültiger Item-Index'}), 400

    proof_data = {
        'pano_id': data.get('pano_id'),
        'lat': float(data.get('lat', 0.0)),
        'lng': float(data.get('lng', 0.0)),
        'heading': float(data.get('heading', 0.0)),
        'pitch': float(data.get('pitch', 0.0)),
        'zoom': float(data.get('zoom', 1.0)),
        'fov': float(data.get('fov', 90.0))
    }

    success, err = geobingo_logic.record_proof(state, player, item_idx, proof_data)
    if not success:
        return jsonify({'error': err}), 400

    trigger_update(code, state)
    my_proofs = state.get('proofs', {}).get(player, {})
    return jsonify({
        'success': True,
        'completed_count': state.get('completed_count', {}).get(player, 0),
        'proofs_for_me': my_proofs
    })



@geobingo_bp.route('/<room_code>/submit_judgement', methods=['POST'])
@geobingo_bp.route('/submit_judgement', methods=['POST'])
@login_required
def submit_judgement(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    voter = user['username']

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    target_player = data.get('target_player')
    try:
        item_idx = int(data.get('item_idx', -1))
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültiger Item-Index'}), 400

    approved = data.get('approved')
    if isinstance(approved, str):
        approved = approved.lower() in ('true', '1', 'yes', 'ja')
    else:
        approved = bool(approved)

    success, err = geobingo_logic.submit_judgement(state, voter, target_player, item_idx, approved)
    if not success:
        return jsonify({'error': err}), 400

    if state.get('status') == 'finished':
        record_game_results_if_ended(state)

    trigger_update(code, state)
    return jsonify({'success': True})


@geobingo_bp.route('/<room_code>/send_chat', methods=['POST'])
@geobingo_bp.route('/send_chat', methods=['POST'])
@login_required
def send_chat(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    text = (data.get('message') or '').strip()

    if not text:
        return jsonify({'error': 'Leere Nachricht'}), 400

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    import datetime
    now_str = datetime.datetime.now().strftime("%H:%M")
    msg_obj = {
        "sender": user['username'],
        "text": text[:300],
        "time": now_str,
        "item_idx": state.get('judge_phase', {}).get('item_index')
    }

    state.setdefault('chat_messages', []).append(msg_obj)
    if len(state['chat_messages']) > 50:
        state['chat_messages'] = state['chat_messages'][-50:]

    try:
        get_pusher_client().trigger(f'geobingo-{code}', 'chat-message', msg_obj)
    except Exception:
        pass

    trigger_update(code, state)
    return jsonify({'success': True, 'message': msg_obj})


@geobingo_bp.route('/<room_code>/reset_game', methods=['POST'])
@geobingo_bp.route('/reset_game', methods=['POST'])
@login_required
def reset_game(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host') and user['username'] not in state.get('players', []):
        return jsonify({'error': 'Nur Spieler dieses Raums können zurücksetzen'}), 403

    saved_settings = state.get('settings', {})
    saved_players = state.get('players', [])
    saved_player_custom = state.get('player_custom_items', {})
    host = state.get('host')

    new_state = geobingo_logic.get_initial_state()
    new_state['room_code'] = code
    new_state['settings'] = saved_settings
    new_state['players'] = saved_players
    new_state['player_custom_items'] = saved_player_custom
    new_state['host'] = host

    broadcast_tracker.reset_room('geobingo', code)
    trigger_update(code, new_state, force_full=True)

    try:
        get_pusher_client().trigger(f'geobingo-{code}', 'game-reset', {'state': new_state})
    except Exception:
        pass

    return jsonify({'success': True, 'state': new_state})


@geobingo_bp.route('/<room_code>/heartbeat', methods=['POST'])
@geobingo_bp.route('/heartbeat', methods=['POST'])
@login_required
def heartbeat(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    status = data.get('status')
    force_offline = (status == 'leaving')

    if not code:
        return jsonify({'status': 'ok'})

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'status': 'room_closed', 'room_closed': True})

    get_storage().touch_lobby('geobingo', code)

    state, offline_players, kicked_players = geobingo_logic.handle_heartbeat(
        state, code, user['username'], force_offline=force_offline
    )

    if kicked_players or geobingo_logic.check_timer_expiration(state):
        trigger_update(code, state)

    safe_state = geobingo_logic.get_client_safe_state(state, for_player=user['username'])
    return jsonify({
        'status': 'ok',
        'offline': offline_players,
        'kicked': kicked_players,
        'state': safe_state
    })


@geobingo_bp.route('/<room_code>/check_timer', methods=['POST'])
@geobingo_bp.route('/check_timer', methods=['POST'])
@login_required
def check_timer(room_code: str = None):
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({'status': 'ok'})

    state = get_room_state('geobingo', code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if geobingo_logic.check_timer_expiration(state):
        trigger_update(code, state)

    return jsonify({'status': 'ok'})
