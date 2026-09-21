"""Secret Hitler route handlers powered by GameHub Multiplayer Blueprint."""
import logging
import uuid
from flask import jsonify, render_template, request
from config import get_pusher_client
from storage import get_storage
from apps.auth.decorators import login_required, get_current_user
from engine.rooms import (
    create_room,
    get_room_state,
    update_room_state,
    validate_room_capacity,
    validate_game_start,
)
from engine.delta import broadcast_tracker
from engine.multiplayer import create_multiplayer_blueprint
from engine.stats import record_match_outcome
from . import logic as secret_logic

logger = logging.getLogger(__name__)
GAME_ID = 'secret_hitler'


def create_new_room():
    """Initializes Secret Hitler room with player's avatar and card preferences."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    initial = secret_logic.get_initial_state()
    pref_avatar = request.form.get('avatar_pref') or user.get('avatar', 'avatar_1')
    pref_style = request.form.get('style_pref') or 'style_standard'
    initial['avatars'][user['username']] = pref_avatar
    initial['card_styles'][user['username']] = pref_style

    room_code = create_room(
        game_id=GAME_ID,
        host_username=user['username'],
        host_user_id=user['id'],
        initial_state=initial
    )
    return jsonify({'success': True, 'room_code': room_code})


def handle_secret_join(room_code: str, user: dict, data: dict):
    """Custom join logic supporting client UUIDs, reconnects, styles, and spectators."""
    name = user['username']
    code = room_code.upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": f"Raum '{code}' nicht gefunden"}), 404

    client_uuid = data.get('uuid') or request.form.get('uuid') or str(uuid.uuid4())
    pref_avatar = data.get('avatar_pref') or request.form.get('avatar_pref') or user.get('avatar', 'avatar_1')
    pref_style = data.get('style_pref') or request.form.get('style_pref') or 'style_standard'
    rejoin_only = str(data.get('rejoin_only') or request.form.get('rejoin_only')).lower() == 'true'

    state = secret_logic.validate_game_integrity(state)

    # 1. Existing player reconnect
    if name in state.get('player_uuids', {}):
        state.setdefault('player_uuids', {})[name] = client_uuid
        if name not in state['players'] and state.get('status') == 'lobby':
            state['players'].append(name)
        if pref_avatar:
            state.setdefault('avatars', {})[name] = pref_avatar
        if pref_style:
            state.setdefault('card_styles', {})[name] = pref_style

        trigger_update(code, state)
        return jsonify({**secret_logic.get_full_state(state), "your_uuid": client_uuid})

    # 2. Spectator handling if game already in progress
    if state.get('status') in ('playing', 'game_over'):
        if rejoin_only:
            return jsonify({"error": "silent_fail"})
        if name not in state.setdefault('spectators', []):
            state['spectators'].append(name)
        state.setdefault('player_uuids', {})[name] = client_uuid
        trigger_update(code, state)
        return jsonify({**secret_logic.get_full_state(state), "your_uuid": client_uuid})

    # 3. New player join in lobby
    if rejoin_only:
        return jsonify({"error": "silent_fail"})

    cap_error = validate_room_capacity(GAME_ID, len(state['players']))
    if cap_error:
        return jsonify({"error": cap_error}), 400

    if name not in state['players']:
        state['players'].append(name)

    state.setdefault('player_uuids', {})[name] = client_uuid
    state.setdefault('avatars', {})[name] = pref_avatar or secret_logic.get_available_avatar(state)
    state.setdefault('card_styles', {})[name] = pref_style

    if state.get('host') is None:
        state['host'] = name

    trigger_update(code, state)
    return jsonify({**secret_logic.get_full_state(state), "your_uuid": client_uuid})


def handle_secret_leave(room_code: str, state: dict, username: str):
    """Cleans up user roles and preferences on leave."""
    for k in ('roles', 'votes', 'avatars', 'card_styles', 'player_uuids'):
        if username in state.get(k, {}):
            del state[k][username]
    secret_logic.validate_game_integrity(state)


def handle_secret_heartbeat(room_code: str, user: dict, data: dict):
    """Handles player presence and kicks inactive members."""
    status = data.get('status') or request.form.get('status')
    force_offline = (status == 'leaving')

    state = get_room_state(GAME_ID, room_code)
    if not state:
        return jsonify({"status": "room_closed", "room_closed": True})

    get_storage().touch_lobby(GAME_ID, room_code)

    state, offline_players, kicked_players = secret_logic.handle_heartbeat(
        state, room_code, user['username'], force_offline=force_offline
    )

    if kicked_players:
        trigger_update(room_code, state)

    payload = secret_logic.get_full_state(state)
    return jsonify({
        "status": "ok",
        "offline": offline_players,
        "kicked": kicked_players,
        "state": payload
    })


# Instantiate reusable multiplayer blueprint
secret_bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    bp_name='secret_bp',
    url_prefix='/secret-hitler',
    template='secret_hitler.html',
    initial_state_factory=secret_logic.get_initial_state,
    sanitize_state_func=secret_logic.get_full_state,
    max_players=10,
    allow_spectator=True,
    custom_create_room_fn=create_new_room,
    on_join=handle_secret_join,
    on_leave=handle_secret_leave,
    on_heartbeat=handle_secret_heartbeat,
)


def trigger_update(room_code: str, state: dict, force_full: bool = False):
    """Broadcasts current game state or delta update via non-blocking Pusher dispatch."""
    code = room_code.upper().strip()
    state = secret_logic.validate_game_integrity(state)

    extra_events = []
    # 1. Policy Enacted Notification
    if 'last_enacted' in state:
        extra_events.append(('policy-enacted', {'type': state['last_enacted']}))
        del state['last_enacted']

    # 2. Reshuffle Notification
    if state.get('deck_reshuffled'):
        extra_events.append(('reshuffle-notification', {}))
        state['deck_reshuffled'] = False

    # 3. Safe State Payload
    payload = secret_logic.get_full_state(state)

    # 4. Vote Result Banner
    if 'vote_notification' in state:
        payload['vote_result'] = state['vote_notification']
        del state['vote_notification']

    secret_bp.trigger_update(
        room_code=code,
        state=state,
        event_name='auto',
        force_full=force_full,
        extra_events=extra_events,
        custom_payload=payload
    )


def record_game_results_if_ended(state: dict):
    """Awards wins/losses to registered users in Secret Hitler in a single batch."""
    liberals_won = (state.get('winner') == 'Liberals')
    winners = []
    losers = []

    for player_name in state.get('players', []):
        role = state.get('roles', {}).get(player_name, '')
        is_liberal = (role == 'Liberal')
        won = (is_liberal and liberals_won) or (not is_liberal and not liberals_won)
        if won:
            winners.append(player_name)
        else:
            losers.append(player_name)

    record_match_outcome(game_id=GAME_ID, winners=winners, losers=losers)


# --- NON-ACTION GET ENDPOINTS ---

@secret_bp.route('/<room_code>/get_my_role', methods=['GET'])
@secret_bp.route('/get_my_role', methods=['GET'])
@secret_bp.route('/<room_code>/my_role', methods=['GET'])
@secret_bp.route('/my_role', methods=['GET'])
@login_required
def get_my_role(room_code: str = None):
    """Returns the authenticated player's secret role and faction information."""
    user = get_current_user()
    code = (room_code or request.args.get('room_code') or '').upper().strip()

    if not code:
        code = get_storage().find_player_room(GAME_ID, user['username'])

    if not code:
        return jsonify({"role": None, "info": "Kein Raumcode angegeben."}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"role": None, "info": "Raum nicht gefunden."}), 404

    username = user['username']
    role = state.get('roles', {}).get(username)
    if not role:
        return jsonify({"role": None, "info": "Keine Rolle zugewiesen."})

    players = state.get('players', [])
    roles = state.get('roles', {})

    if role == 'Liberal':
        info = "Du bist ein Liberaler. Finde die Faschisten und verabschiede 5 liberale Gesetze."
    elif role == 'Hitler':
        fascists = [p for p, r in roles.items() if r == 'Fascist']
        if len(players) <= 6:
            info = f"Du bist Hitler. Dein Mitfaschist: {', '.join(fascists) if fascists else 'Keiner'}."
        else:
            info = "Du bist Hitler. Du kennst deine Mitfaschisten nicht."
    elif role == 'Fascist':
        hitler = [p for p, r in roles.items() if r == 'Hitler']
        other_fascists = [p for p, r in roles.items() if r == 'Fascist' and p != username]
        parts = []
        if hitler:
            parts.append(f"Hitler: {hitler[0]}")
        if other_fascists:
            parts.append(f"Faschisten: {', '.join(other_fascists)}")
        info = "Du bist ein Faschist. " + (". ".join(parts) if parts else "")
    else:
        info = role

    return jsonify({"role": role, "info": info})


@secret_bp.route('/<room_code>/my_hand', methods=['GET'])
@secret_bp.route('/my_hand', methods=['GET'])
@login_required
def my_hand(room_code: str = None):
    """Returns confidential policy card hand strictly to the active President or Chancellor."""
    user = get_current_user()
    code = (room_code or request.args.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"hand": [], "step": None})

    username = user['username']
    current_pres = state['players'][state['president_index']] if state.get('players') else None
    chancellor = state.get('chancellor_nominee')
    step = state.get('legislative_step')

    if step == 'president_session' and username == current_pres:
        return jsonify({"hand": state.get('hand', []), "step": step})
    elif step == 'chancellor_session' and username == chancellor:
        return jsonify({"hand": state.get('hand', []), "step": step})
    elif step == 'veto_consent' and username in (current_pres, chancellor):
        return jsonify({"hand": state.get('hand', []), "step": step})

    return jsonify({"hand": [], "step": step})


@secret_bp.route('/<room_code>/my_action', methods=['GET'])
@secret_bp.route('/my_action', methods=['GET'])
@login_required
def my_action(room_code: str = None):
    """Returns executive action payload strictly to the authorized President."""
    user = get_current_user()
    code = (room_code or request.args.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"action": None, "payload": None})

    username = user['username']
    current_pres = state['players'][state['president_index']] if state.get('players') else None

    if username == current_pres and state.get('pending_action'):
        return jsonify({
            "action": state.get('pending_action'),
            "payload": state.get('action_payload')
        })

    return jsonify({"action": None, "payload": None})


# --- ACTIONS ---

@secret_bp.action('set_avatar')
def set_avatar(room_code: str = None):
    """Sets a player's avatar preferences in the room."""
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    avatar = request.form.get('avatar') or data.get('avatar')
    username = user['username']

    if not avatar:
        return jsonify({"error": "Kein Avatar angegeben"}), 400

    if not code:
        code = get_storage().find_player_room(GAME_ID, username)

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    my_style = state.get('card_styles', {}).get(username, 'style_standard')
    for p, av in state.get('avatars', {}).items():
        if p != username:
            p_style = state.get('card_styles', {}).get(p, 'style_standard')
            if av == avatar and p_style == my_style:
                return jsonify({"error": "Dieser Avatar ist in diesem Stil bereits vergeben."}), 400

    state.setdefault('avatars', {})[username] = avatar
    trigger_update(code, state)
    return jsonify({"success": True, "avatar": avatar})


@secret_bp.action('set_style')
def set_style(room_code: str = None):
    """Sets a player's card style preference in the room."""
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    style = request.form.get('style') or data.get('style')
    username = user['username']

    if not style:
        return jsonify({"error": "Kein Stil angegeben"}), 400

    if not code:
        code = get_storage().find_player_room(GAME_ID, username)

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    my_avatar = state.get('avatars', {}).get(username, 'avatar_1')
    collision = False
    for p, st in state.get('card_styles', {}).items():
        if p != username and st == style:
            if state.get('avatars', {}).get(p) == my_avatar:
                collision = True
                break

    if collision:
        taken_in_style = {
            state.get('avatars', {}).get(p)
            for p, st in state.get('card_styles', {}).items()
            if p != username and st == style
        }
        for i in range(1, 25):
            candidate = f"avatar_{i}"
            if candidate not in taken_in_style:
                state.setdefault('avatars', {})[username] = candidate
                break

    state.setdefault('card_styles', {})[username] = style
    trigger_update(code, state)
    return jsonify({"success": True, "style": style, "avatar": state.get('avatars', {}).get(username)})


@secret_bp.action('kick_player')
def kick(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    target_name = request.form.get('name') or (request.get_json(silent=True) or {}).get('name')

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host') and user['username'] != target_name:
        return jsonify({"error": "Keine Berechtigung"}), 403

    if target_name in state.get('players', []):
        state['players'].remove(target_name)
    if target_name in state.get('spectators', []):
        state['spectators'].remove(target_name)

    for k in ('roles', 'votes', 'avatars', 'card_styles', 'player_uuids'):
        if target_name in state.get(k, {}):
            del state[k][target_name]

    state = secret_logic.validate_game_integrity(state)
    try:
        client = get_pusher_client()
        if client:
            client.trigger(f'{GAME_ID}-{code}', 'force-kick', {'name': target_name})
    except Exception:
        pass
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('start_game')
def start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host'):
        return jsonify({"error": "Nur der Host kann das Spiel starten"}), 403

    start_error = validate_game_start(GAME_ID, len(state['players']))
    if start_error:
        return jsonify({"error": start_error}), 400

    state = secret_logic.setup_new_game(state)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('nominate_chancellor')
def nominate(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    nominee = request.form.get('nominee') or (request.get_json(silent=True) or {}).get('nominee')

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']]
    if user['username'] != current_pres:
        return jsonify({"error": "Nur der Präsident kann nominieren"}), 403

    if not nominee or nominee not in state['players']:
        return jsonify({"error": "Ungültiger Kandidat"}), 400

    if nominee in state.get('dead_players', []):
        return jsonify({"error": "Toter Spieler kann nicht nominiert werden"}), 400

    if len(state['players']) > 5:
        if nominee == state.get('previous_president') or nominee == state.get('previous_chancellor'):
            return jsonify({"error": "Amtszeitbeschränkung: Dieser Spieler war kürzlich im Amt."}), 400
    else:
        if nominee == state.get('previous_chancellor'):
            return jsonify({"error": "Amtszeitbeschränkung: War letzter Kanzler."}), 400

    state['chancellor_nominee'] = nominee
    state['phase'] = 'voting'
    state['votes'] = {}
    secret_logic.add_log(state, f"{current_pres} hat {nominee} als Kanzler nominiert.")

    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('submit_vote')
def vote(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    voter = user['username']
    vote_val = request.form.get('vote') or data.get('vote')

    if not code:
        code = get_storage().find_player_room(GAME_ID, voter)

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    if vote_val not in ('Ja', 'Nein'):
        return jsonify({"error": "Ungültige Stimme"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    def apply_vote(s):
        if voter not in s['players'] or voter in s.get('dead_players', []):
            return
        s.setdefault('votes', {})[voter] = vote_val
        living_voters = [p for p in s['players'] if p not in s.get('dead_players', [])]
        if len(s['votes']) >= len(living_voters):
            secret_logic.process_vote_outcome(s)
            record_game_results_if_ended(s)

    state = update_room_state(GAME_ID, code, apply_vote)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('president_discard')
def pres_discard(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    raw_idx = request.form.get('index') or (request.get_json(silent=True) or {}).get('index')

    try:
        card_index = int(raw_idx if raw_idx is not None else -1)
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Kartenindex"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']]
    if user['username'] != current_pres:
        return jsonify({"error": "Nicht autorisiert"}), 403

    if card_index < 0 or card_index >= len(state.get('hand', [])):
        return jsonify({"error": "Index außerhalb des Bereichs"}), 400

    discarded = state['hand'].pop(card_index)
    state.setdefault('discard_pile', []).append(discarded)
    state['legislative_step'] = 'chancellor_session'
    secret_logic.add_log(state, f"Präsident {current_pres} hat eine Karte an den Kanzler weitergegeben.")

    trigger_update(code, state)
    return jsonify({"success": True, "hand": state.get('hand', [])})


@secret_bp.action('chancellor_discard')
def chan_discard(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    raw_idx = request.form.get('index') or (request.get_json(silent=True) or {}).get('index')

    try:
        card_index = int(raw_idx if raw_idx is not None else -1)
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Kartenindex"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    chancellor = state.get('chancellor_nominee')
    if user['username'] != chancellor:
        return jsonify({"error": "Nicht autorisiert"}), 403

    if card_index < 0 or card_index >= len(state.get('hand', [])):
        return jsonify({"error": "Index außerhalb des Bereichs"}), 400

    discarded = state['hand'].pop(card_index)
    state.setdefault('discard_pile', []).append(discarded)

    enacted = state['hand'].pop(0)
    if enacted == 'Liberal':
        state['liberal_board'] = state.get('liberal_board', 0) + 1
    else:
        state['fascist_board'] = state.get('fascist_board', 0) + 1

    state['last_enacted'] = enacted
    secret_logic.add_log(state, f"Kanzler {chancellor} hat ein {enacted} Gesetz verabschiedet.")

    if secret_logic.check_win_conditions(state):
        record_game_results_if_ended(state)
        trigger_update(code, state)
        return jsonify({"success": True})

    action_triggered = False
    if enacted == 'Fascist':
        action_triggered = secret_logic.perform_executive_action_check(state)

    if not action_triggered:
        state = secret_logic.advance_president(state)

    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('call_veto')
@secret_bp.action('propose_veto')
def call_veto(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('chancellor_nominee'):
        return jsonify({"error": "Nur der Kanzler kann Veto einlegen"}), 403

    if state.get('fascist_board') != 5:
        return jsonify({"error": "Veto erst ab 5 faschistischen Gesetzen freigeschaltet"}), 400

    state['legislative_step'] = 'veto_consent'
    secret_logic.add_log(state, f"Kanzler {user['username']} bittet um Veto.")
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('respond_to_veto')
def respond_veto(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    consent = (request.form.get('consent') == 'true' or request.form.get('decision') == 'agree'
               or data.get('consent') is True or data.get('decision') == 'agree')

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']]
    if user['username'] != current_pres:
        return jsonify({"error": "Nur der Präsident entscheidet über das Veto"}), 403

    if consent:
        state.setdefault('discard_pile', []).extend(state.get('hand', []))
        state['hand'] = []
        state['election_tracker'] = state.get('election_tracker', 0) + 1
        secret_logic.add_log(state, "Präsident stimmte dem Veto zu. Gesetze verworfen.")

        if state['election_tracker'] >= 3:
            state = secret_logic.perform_chaos_enactment(state)
        else:
            state = secret_logic.advance_president(state)
    else:
        state['legislative_step'] = 'chancellor_session'
        state['veto_declined'] = True
        secret_logic.add_log(state, "Präsident lehnte das Veto ab. Kanzler muss verabschieden.")

    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('perform_action')
def action(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    target = request.form.get('target') or data.get('target')

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']]
    if user['username'] != current_pres:
        return jsonify({"error": "Nur der Präsident kann die Aktion ausführen"}), 403

    power = state.get('pending_action')

    if power == 'execution':
        if not target or target not in state['players']:
            return jsonify({"error": "Ungültiges Ziel"}), 400
        state.setdefault('dead_players', []).append(target)
        secret_logic.add_log(state, f"Präsident {current_pres} hat {target} exekutiert!")

        if secret_logic.check_win_conditions(state):
            record_game_results_if_ended(state)
            trigger_update(code, state)
            return jsonify({"success": True})

    elif power == 'investigate':
        target_role = state.get('roles', {}).get(target, 'Liberal')
        party = 'Fascist' if target_role in ('Fascist', 'Hitler') else 'Liberal'
        state['action_payload'] = party
        secret_logic.add_log(state, f"Präsident {current_pres} hat {target} untersucht.")
        trigger_update(code, state)
        return jsonify({"success": True, "result": party})

    elif power == 'special_election':
        if not target or target not in state['players']:
            return jsonify({"error": "Ungültiges Ziel"}), 400
        state['return_president_index'] = state['president_index']
        state['president_index'] = state['players'].index(target)
        state['phase'] = 'nominating'
        state['pending_action'] = None
        secret_logic.add_log(state, f"Sonderwahl: {target} ist der nächste Präsidentschaftskandidat.")
        trigger_update(code, state)
        return jsonify({"success": True})

    state = secret_logic.advance_president(state)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('change_avatar')
def change_avatar(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    new_avatar = request.form.get('avatar') or data.get('avatar')

    state = get_room_state(GAME_ID, code)
    if not state or not new_avatar:
        return jsonify({"error": "Ungültige Anfrage"}), 400

    state.setdefault('avatars', {})[user['username']] = new_avatar
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('change_style')
def change_style(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    new_style = request.form.get('style') or data.get('style')

    state = get_room_state(GAME_ID, code)
    if not state or not new_style:
        return jsonify({"error": "Ungültige Anfrage"}), 400

    state.setdefault('card_styles', {})[user['username']] = new_style
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.action('toggle_setting')
def toggle_setting(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    setting = request.form.get('setting') or data.get('setting')

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host'):
        return jsonify({"error": "Nur der Host kann Einstellungen ändern"}), 403

    settings = state.setdefault('settings', {})
    if setting in settings:
        settings[setting] = not settings[setting]

    trigger_update(code, state)
    return jsonify({"success": True, "settings": settings})


@secret_bp.action('reset_game')
def reset_game(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host'):
        return jsonify({"error": "Nur der Host kann das Spiel zurücksetzen"}), 403

    saved_settings = state.get('settings', {})
    saved_players = state.get('players', [])
    saved_avatars = state.get('avatars', {})
    saved_styles = state.get('card_styles', {})

    new_state = secret_logic.get_initial_state()
    new_state['room_code'] = code
    new_state['host'] = user['username']
    new_state['players'] = saved_players
    new_state['avatars'] = saved_avatars
    new_state['card_styles'] = saved_styles
    new_state['settings'] = saved_settings

    broadcast_tracker.reset_room(GAME_ID, code)
    trigger_update(code, new_state, force_full=True)
    try:
        get_pusher_client().trigger(f'{GAME_ID}-{code}', 'game-reset', {})
    except Exception:
        pass
    return jsonify({"success": True})


@secret_bp.action('end_action')
def end_action(room_code: str = None):
    """Concludes an executive action and advances to the next president."""
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({"error": "Kein Raumcode"}), 400

    state = get_room_state(GAME_ID, code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']] if state.get('players') else None
    if user['username'] != current_pres:
        return jsonify({"error": "Nur der Präsident kann die Aktion abschließen"}), 403

    state['pending_action'] = None
    state['action_payload'] = None
    state = secret_logic.advance_president(state)
    trigger_update(code, state)
    return jsonify({"success": True})
