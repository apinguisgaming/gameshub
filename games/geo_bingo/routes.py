"""Geo Bingo route handlers powered by GameHub Multiplayer Blueprint."""
import datetime
import logging
from flask import jsonify, request
from config import get_pusher_client
from storage import get_storage
from apps.auth.decorators import login_required, get_current_user
from engine.rooms import (
    get_room_state,
    validate_room_capacity,
    validate_game_start,
)
from engine.delta import broadcast_tracker
from engine.multiplayer import create_multiplayer_blueprint
from engine.stats import record_match_outcome
from . import logic as geobingo_logic
from . import items as geobingo_items
from . import geo_countries as geobingo_geo

logger = logging.getLogger(__name__)
GAME_ID = 'geo_bingo'


def get_template_context():
    """Provides items and available countries to the template."""
    global_items = geobingo_items.get_global_items()
    available_countries = geobingo_geo.get_all_countries_for_ui()
    return {
        'global_items': global_items,
        'available_countries': available_countries
    }


def handle_geobingo_join(room_code: str, user: dict, data: dict):
    """Custom join handler with max player capacity and spectator assignment."""
    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'error': f"Raum '{room_code}' nicht gefunden"}), 404

    name = user['username']
    players = state.setdefault('players', [])
    if name not in players:
        if state.get('status') in ('playing', 'judging', 'finished'):
            state.setdefault('spectators', []).append(name)
        else:
            cap_error = validate_room_capacity(GAME_ID, len(players))
            if cap_error:
                state.setdefault('spectators', []).append(name)
            else:
                players.append(name)

    if not state.get('host') or state['host'] not in players:
        state['host'] = name

    trigger_update(room_code, state)
    return jsonify(geobingo_logic.get_client_safe_state(state, for_player=name))


def handle_geobingo_leave(room_code: str, state: dict, username: str):
    """Cleans up player from active judgement phase if game is in progress."""
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


def handle_geobingo_heartbeat(room_code: str, user: dict, data: dict):
    """Handles geo bingo player heartbeats, timer expirations, and presence."""
    status = data.get('status') or request.form.get('status')
    force_offline = (status == 'leaving')

    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({'status': 'room_closed', 'room_closed': True})

    get_storage().touch_lobby(GAME_ID, room_code)

    state, offline_players, kicked_players = geobingo_logic.handle_heartbeat(
        state, room_code, user['username'], force_offline=force_offline
    )

    if kicked_players or geobingo_logic.check_timer_expiration(state):
        trigger_update(room_code, state)

    safe_state = geobingo_logic.get_client_safe_state(state, for_player=user['username'])
    return jsonify({
        'status': 'ok',
        'offline': offline_players,
        'kicked': kicked_players,
        'state': safe_state
    })


# Instantiate reusable multiplayer blueprint
geobingo_bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    bp_name='geobingo_bp',
    url_prefix='/geo-bingo',
    template='geo_bingo.html',
    initial_state_factory=geobingo_logic.get_initial_state,
    sanitize_state_func=geobingo_logic.get_client_safe_state,
    max_players=4,
    allow_spectator=True,
    template_context=get_template_context,
    on_join=handle_geobingo_join,
    on_leave=handle_geobingo_leave,
    on_heartbeat=handle_geobingo_heartbeat,
)


def trigger_update(room_code: str, state: dict, force_full: bool = False, extra_events: list = None):
    """Broadcasts sanitized state via non-blocking Pusher dispatch and saves to storage."""
    code = room_code.upper().strip()
    state = geobingo_logic.validate_game_integrity(state)
    payload = geobingo_logic.get_client_safe_state(state)

    geobingo_bp.trigger_update(
        room_code=code,
        state=state,
        event_name='state-update',
        force_full=force_full,
        extra_events=extra_events or [],
        custom_payload=payload
    )


def record_game_results_if_ended(state: dict):
    """Saves win/loss statistics in storage when game reaches finished status in a single transaction."""
    if state.get('status') != 'finished':
        return
    if state.get('stats_recorded'):
        return
    state['stats_recorded'] = True

    scores = state.get('scores', {})
    winner = state.get('winner')
    winners = [winner] if winner else []
    losers = [p for p in scores.keys() if p != winner]

    record_match_outcome(game_id=GAME_ID, winners=winners, losers=losers, scores=scores)


# --- ADDITIONAL NON-ACTION ENDPOINTS ---

@geobingo_bp.route('/<room_code>/check_location', methods=['POST'])
@geobingo_bp.route('/check_location', methods=['POST'])
@login_required
def check_location(room_code: str = None):
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    try:
        lat = float(data.get('lat', 0.0))
        lng = float(data.get('lng', 0.0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Ungültige Koordinaten'}), 400

    state = get_room_state(GAME_ID, code) if code else None
    blocked_codes = state.get('settings', {}).get('blocked_countries', []) if state else []

    is_blocked, country = geobingo_geo.is_location_blocked(lat, lng, blocked_codes)
    return jsonify({
        'blocked': is_blocked,
        'country': country
    })


@geobingo_bp.route('/<room_code>/country_polygons', methods=['GET', 'POST'])
@geobingo_bp.route('/country_polygons', methods=['GET', 'POST'])
@login_required
def country_polygons(room_code: str = None):
    codes_param = request.args.get('codes')
    if not codes_param and request.is_json:
        codes_param = (request.get_json(silent=True) or {}).get('codes')

    if isinstance(codes_param, str):
        codes = [c.strip().upper() for c in codes_param.split(',') if c.strip()]
    elif isinstance(codes_param, list):
        codes = [str(c).strip().upper() for c in codes_param if str(c).strip()]
    else:
        codes = []

    code = (room_code or '').upper().strip()
    if code and not codes:
        state = get_room_state(GAME_ID, code)
        if state:
            codes = state.get('settings', {}).get('blocked_countries', [])

    polys = geobingo_geo.get_polygons_for_countries(codes)
    return jsonify({'success': True, 'countries': polys})


# --- ACTIONS ---

@geobingo_bp.action('update_settings')
def update_settings(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
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
    if 'blocked_countries' in data:
        raw_blocked = data['blocked_countries']
        if isinstance(raw_blocked, str):
            settings['blocked_countries'] = [c.strip().upper() for c in raw_blocked.split(',') if c.strip()]
        elif isinstance(raw_blocked, list):
            settings['blocked_countries'] = [str(c).strip().upper() for c in raw_blocked if str(c).strip()]

    trigger_update(code, state)
    return jsonify({'success': True, 'settings': settings})


@geobingo_bp.action('sync_custom_words')
def sync_custom_words(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    username = user['username']

    state = get_room_state(GAME_ID, code)
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


@geobingo_bp.action('start_game')
def start(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if user['username'] != state.get('host'):
        return jsonify({'error': 'Nur der Host kann das Spiel starten'}), 403

    start_error = validate_game_start(GAME_ID, len(state.get('players', [])))
    if start_error:
        return jsonify({'error': start_error}), 400

    state = geobingo_logic.setup_new_game(state)
    trigger_update(code, state, force_full=True)
    return jsonify({'success': True})


@geobingo_bp.action('save_proof')
def save_proof(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    player = user['username']

    state = get_room_state(GAME_ID, code)
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


@geobingo_bp.action('submit_judgement')
def submit_judgement(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    voter = user['username']

    state = get_room_state(GAME_ID, code)
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


@geobingo_bp.action('send_chat')
def send_chat(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    text = (data.get('message') or '').strip()

    if not text:
        return jsonify({'error': 'Leere Nachricht'}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

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

    trigger_update(code, state, extra_events=[('chat-message', msg_obj)])
    return jsonify({'success': True, 'message': msg_obj})


@geobingo_bp.action('reset_game')
def reset_game(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
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

    broadcast_tracker.reset_room(GAME_ID, code)
    trigger_update(code, new_state, force_full=True, extra_events=[('game-reset', {'state': new_state})])

    return jsonify({'success': True, 'state': new_state})


@geobingo_bp.action('check_timer')
def check_timer(room_code: str = None):
    data = request.get_json(silent=True) or request.form.to_dict()
    code = (room_code or data.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({'status': 'ok'})

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({'error': 'Raum nicht gefunden'}), 404

    if geobingo_logic.check_timer_expiration(state):
        trigger_update(code, state)

    return jsonify({'status': 'ok'})
