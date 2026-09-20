"""Secret Hitler route handlers supporting multi-room lobbies and persistent authentication."""
import uuid
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
from . import logic as secret_logic

secret_bp = Blueprint('secret_bp', __name__)


def trigger_update(room_code: str, state: dict, force_full: bool = False):
    """Broadcasts current game state or delta update via room-scoped Pusher channel."""
    code = room_code.upper().strip()
    channel_name = f'secret-{code}'
    state = secret_logic.validate_game_integrity(state)

    client = get_pusher_client()

    # 1. Policy Enacted Notification
    if 'last_enacted' in state:
        try:
            client.trigger(channel_name, 'policy-enacted', {'type': state['last_enacted']})
        except Exception:
            pass
        del state['last_enacted']

    # 2. Reshuffle Notification
    if state.get('deck_reshuffled'):
        try:
            client.trigger(channel_name, 'reshuffle-notification', {})
        except Exception:
            pass
        state['deck_reshuffled'] = False

    # 3. Safe State Payload
    payload = secret_logic.get_full_state(state)

    # 4. Vote Result Banner
    if 'vote_notification' in state:
        payload['vote_result'] = state['vote_notification']
        del state['vote_notification']

    # 5. Save updated state to storage
    storage = get_storage()
    storage.save_lobby(
        game_id='secret',
        room_code=code,
        state=state,
        player_count=len(state.get('players', [])),
        status=state.get('status', 'lobby')
    )

    # 6. Compute Delta vs Full Broadcast
    broadcast_payload, is_delta = broadcast_tracker.get_broadcast_payload(
        game_id='secret',
        room_code=code,
        current_safe_state=payload,
        force_full=force_full
    )

    if broadcast_payload is None:
        return

    # 7. Broadcast over room channel
    try:
        client.trigger(channel_name, 'state-update', broadcast_payload)
    except Exception as e:
        import logging
        logging.error(f"[Pusher Error] Failed to trigger {channel_name}/state-update: {e}", exc_info=True)


def record_game_results_if_ended(state: dict):
    """Records win/loss stats in storage when game reaches game_over."""
    if state.get('status') != 'game_over':
        return

    # Only record once
    if state.get('stats_recorded'):
        return
    state['stats_recorded'] = True

    storage = get_storage()
    msg = state.get('game_over_msg', '')
    liberals_won = 'LIBERALS WIN' in msg
    roles = state.get('roles', {})

    for player, role in roles.items():
        user = storage.get_user_by_username(player)
        if not user:
            continue
        uid = user['id']
        is_liberal = (role == 'Liberal')
        won = (is_liberal and liberals_won) or (not is_liberal and not liberals_won)

        storage.update_stats(
            user_id=uid,
            game_id='secret',
            games_played=1,
            wins=1 if won else 0,
            losses=0 if won else 1
        )


# --- PORTAL & ROOM MANAGEMENT ---

@secret_bp.route('/')
@login_required
def index():
    user = get_current_user()
    username = user['username'] if user else ''
    return render_template('secret.html', existing_name=username)


@secret_bp.route('/rooms', methods=['GET'])
@login_required
def get_rooms():
    active = list_rooms('secret')
    return jsonify({'success': True, 'rooms': active})


@secret_bp.route('/create_room', methods=['POST'])
@login_required
def create_new_room():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Nicht angemeldet'}), 401

    initial = secret_logic.get_initial_state()
    pref_avatar = request.form.get('avatar_pref') or user.get('avatar', 'avatar_1')
    pref_style = request.form.get('style_pref') or 'style_standard'
    initial['avatars'][user['username']] = pref_avatar
    initial['card_styles'][user['username']] = pref_style

    room_code = create_room(
        game_id='secret',
        host_username=user['username'],
        host_user_id=user['id'],
        initial_state=initial
    )
    return jsonify({'success': True, 'room_code': room_code})


@secret_bp.route('/join_game', methods=['POST'])
@secret_bp.route('/<room_code>/join', methods=['POST'])
@login_required
def join_game(room_code: str = None):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Nicht angemeldet"}), 401

    name = user['username']
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": f"Raum '{code}' nicht gefunden"}), 404

    client_uuid = request.form.get('uuid') or str(uuid.uuid4())
    pref_avatar = request.form.get('avatar_pref') or user.get('avatar', 'avatar_1')
    pref_style = request.form.get('style_pref') or 'style_standard'
    rejoin_only = request.form.get('rejoin_only') == 'true'

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

    if len(state['players']) >= 10:
        return jsonify({"error": "Raum ist voll (maximal 10 Spieler)"}), 400

    if name not in state['players']:
        state['players'].append(name)

    state.setdefault('player_uuids', {})[name] = client_uuid
    state.setdefault('avatars', {})[name] = pref_avatar or secret_logic.get_available_avatar(state)
    state.setdefault('card_styles', {})[name] = pref_style

    if state.get('host') is None:
        state['host'] = name

    trigger_update(code, state)
    return jsonify({**secret_logic.get_full_state(state), "your_uuid": client_uuid})


@secret_bp.route('/<room_code>/set_avatar', methods=['POST'])
@secret_bp.route('/set_avatar', methods=['POST'])
@login_required
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
        storage = get_storage()
        with storage._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT room_code, state_data FROM game_lobbies WHERE game_id = 'secret'")
            for row in cur.fetchall():
                try:
                    import json
                    st = json.loads(row['state_data']) if row['state_data'] else {}
                    if username in st.get('players', []) or username in st.get('spectators', []):
                        code = row['room_code']
                        break
                except Exception:
                    continue

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    # Check if avatar is taken by another player in the SAME style
    my_style = state.get('card_styles', {}).get(username, 'style_standard')
    for p, av in state.get('avatars', {}).items():
        if p != username:
            p_style = state.get('card_styles', {}).get(p, 'style_standard')
            if av == avatar and p_style == my_style:
                return jsonify({"error": "Dieser Avatar ist in diesem Stil bereits vergeben."}), 400

    state.setdefault('avatars', {})[username] = avatar
    trigger_update(code, state)
    return jsonify({"success": True, "avatar": avatar})


@secret_bp.route('/<room_code>/set_style', methods=['POST'])
@secret_bp.route('/set_style', methods=['POST'])
@login_required
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
        storage = get_storage()
        with storage._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT room_code, state_data FROM game_lobbies WHERE game_id = 'secret'")
            for row in cur.fetchall():
                try:
                    import json
                    st = json.loads(row['state_data']) if row['state_data'] else {}
                    if username in st.get('players', []) or username in st.get('spectators', []):
                        code = row['room_code']
                        break
                except Exception:
                    continue

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    # If new style causes avatar collision with another player, reassign avatar to an untaken one
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


@secret_bp.route('/<room_code>/leave_game', methods=['POST'])
@secret_bp.route('/leave_game', methods=['POST'])
@login_required
def leave(room_code: str = None):
    user = get_current_user()
    name = user['username'] if user else None
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    if not code or not name:
        return jsonify({"success": True})

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"success": True})

    if name in state.get('players', []):
        state['players'].remove(name)
    if name in state.get('spectators', []):
        state['spectators'].remove(name)

    for k in ('roles', 'votes', 'avatars', 'card_styles', 'player_uuids'):
        if name in state.get(k, {}):
            del state[k][name]

    if len(state.get('players', [])) == 0 and len(state.get('spectators', [])) == 0:
        get_storage().delete_lobby('secret', code)
        return jsonify({"success": True})

    state = secret_logic.validate_game_integrity(state)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/kick_player', methods=['POST'])
@secret_bp.route('/kick_player', methods=['POST'])
@login_required
def kick(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    target_name = request.form.get('name')

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    # Only host or self can kick
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
        pusher_client.trigger(f'secret-{code}', 'force-kick', {'name': target_name})
    except Exception:
        pass
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/start_game', methods=['POST'])
@secret_bp.route('/start_game', methods=['POST'])
@login_required
def start(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host'):
        return jsonify({"error": "Nur der Host kann das Spiel starten"}), 403

    if len(state['players']) < 5:
        return jsonify({"error": "Mindestens 5 Spieler erforderlich (Secret Hitler: 5 bis 10 Spieler)"}), 400

    state = secret_logic.setup_new_game(state)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/nominate_chancellor', methods=['POST'])
@secret_bp.route('/nominate_chancellor', methods=['POST'])
@login_required
def nominate(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    nominee = request.form.get('nominee')

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    current_pres = state['players'][state['president_index']]
    if user['username'] != current_pres:
        return jsonify({"error": "Nur der Präsident kann nominieren"}), 403

    if not nominee or nominee not in state['players']:
        return jsonify({"error": "Ungültiger Kandidat"}), 400

    if nominee in state.get('dead_players', []):
        return jsonify({"error": "Toter Spieler kann nicht nominiert werden"}), 400

    # Term limit checks
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


@secret_bp.route('/<room_code>/submit_vote', methods=['POST'])
@secret_bp.route('/submit_vote', methods=['POST'])
@login_required
def vote(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    voter = user['username']
    vote_val = request.form.get('vote') or data.get('vote')

    if not code:
        storage = get_storage()
        with storage._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT room_code, state_data FROM game_lobbies WHERE game_id = 'secret'")
            for row in cur.fetchall():
                try:
                    import json
                    st = json.loads(row['state_data']) if row['state_data'] else {}
                    if voter in st.get('players', []):
                        code = row['room_code']
                        break
                except Exception:
                    continue

    if not code:
        return jsonify({"error": "Kein Raumcode angegeben"}), 400

    if vote_val not in ('Ja', 'Nein'):
        return jsonify({"error": "Ungültige Stimme"}), 400

    state = get_room_state('secret', code)
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

    state = update_room_state('secret', code, apply_vote)
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/president_discard', methods=['POST'])
@secret_bp.route('/president_discard', methods=['POST'])
@login_required
def pres_discard(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    try:
        card_index = int(request.form.get('index', -1))
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Kartenindex"}), 400

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/chancellor_discard', methods=['POST'])
@secret_bp.route('/chancellor_discard', methods=['POST'])
@login_required
def chan_discard(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    try:
        card_index = int(request.form.get('index', -1))
    except (ValueError, TypeError):
        return jsonify({"error": "Ungültiger Kartenindex"}), 400

    state = get_room_state('secret', code)
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

    # Win Condition Check
    if secret_logic.check_win_conditions(state):
        record_game_results_if_ended(state)
        trigger_update(code, state)
        return jsonify({"success": True})

    # Check Executive Powers
    action_triggered = False
    if enacted == 'Fascist':
        action_triggered = secret_logic.perform_executive_action_check(state)

    if not action_triggered:
        state = secret_logic.advance_president(state)

    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/call_veto', methods=['POST'])
@secret_bp.route('/call_veto', methods=['POST'])
@secret_bp.route('/<room_code>/propose_veto', methods=['POST'])
@secret_bp.route('/propose_veto', methods=['POST'])
@login_required
def call_veto(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/respond_to_veto', methods=['POST'])
@secret_bp.route('/respond_to_veto', methods=['POST'])
@login_required
def respond_veto(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    consent = (request.form.get('consent') == 'true' or request.form.get('decision') == 'agree')

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/perform_action', methods=['POST'])
@secret_bp.route('/perform_action', methods=['POST'])
@login_required
def action(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    target = request.form.get('target')

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/change_avatar', methods=['POST'])
@secret_bp.route('/change_avatar', methods=['POST'])
@login_required
def change_avatar(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    new_avatar = request.form.get('avatar')

    state = get_room_state('secret', code)
    if not state or not new_avatar:
        return jsonify({"error": "Ungültige Anfrage"}), 400

    state.setdefault('avatars', {})[user['username']] = new_avatar
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/change_style', methods=['POST'])
@secret_bp.route('/change_style', methods=['POST'])
@login_required
def change_style(room_code: str = None):
    user = get_current_user()
    code = (room_code or request.form.get('room_code') or '').upper().strip()
    new_style = request.form.get('style')

    state = get_room_state('secret', code)
    if not state or not new_style:
        return jsonify({"error": "Ungültige Anfrage"}), 400

    state.setdefault('card_styles', {})[user['username']] = new_style
    trigger_update(code, state)
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/toggle_setting', methods=['POST'])
@secret_bp.route('/toggle_setting', methods=['POST'])
@login_required
def toggle_setting(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    setting = request.form.get('setting') or data.get('setting')

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"error": "Raum nicht gefunden"}), 404

    if user['username'] != state.get('host'):
        return jsonify({"error": "Nur der Host kann Einstellungen ändern"}), 403

    settings = state.setdefault('settings', {})
    if setting in settings:
        settings[setting] = not settings[setting]

    trigger_update(code, state)
    return jsonify({"success": True, "settings": settings})


@secret_bp.route('/<room_code>/reset_game', methods=['POST'])
@secret_bp.route('/reset_game', methods=['POST'])
@login_required
def reset_game(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()

    state = get_room_state('secret', code)
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

    broadcast_tracker.reset_room('secret', code)
    trigger_update(code, new_state, force_full=True)
    try:
        get_pusher_client().trigger(f'secret-{code}', 'game-reset', {})
    except Exception:
        pass
    return jsonify({"success": True})


@secret_bp.route('/<room_code>/end_action', methods=['POST'])
@secret_bp.route('/end_action', methods=['POST'])
@login_required
def end_action(room_code: str = None):
    """Concludes an executive action and advances to the next president."""
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    if not code:
        return jsonify({"error": "Kein Raumcode"}), 400

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/get_my_role', methods=['GET'])
@secret_bp.route('/get_my_role', methods=['GET'])
@secret_bp.route('/<room_code>/my_role', methods=['GET'])
@secret_bp.route('/my_role', methods=['GET'])
@login_required
def get_my_role(room_code: str = None):
    """Returns the authenticated player's secret role and faction information."""
    user = get_current_user()
    code = (room_code or request.args.get('room_code') or '').upper().strip()

    # If code not provided in request, attempt to find the user's active game
    if not code:
        storage = get_storage()
        with storage._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT room_code, state_data FROM game_lobbies WHERE game_id = 'secret'")
            for row in cur.fetchall():
                try:
                    import json
                    st = json.loads(row['state_data']) if row['state_data'] else {}
                    if user['username'] in st.get('players', []):
                        code = row['room_code']
                        break
                except Exception:
                    continue

    if not code:
        return jsonify({"role": None, "info": "Kein Raumcode angegeben."}), 400

    state = get_room_state('secret', code)
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

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"hand": [], "step": None})

    username = user['username']
    current_pres = state['players'][state['president_index']] if state.get('players') else None
    chancellor = state.get('chancellor_nominee')
    step = state.get('legislative_step')

    # Security check: only the active legislator can read policy cards
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

    state = get_room_state('secret', code)
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


@secret_bp.route('/<room_code>/heartbeat', methods=['POST'])
@secret_bp.route('/heartbeat', methods=['POST'])
@login_required
def heartbeat(room_code: str = None):
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    code = (room_code or request.form.get('room_code') or data.get('room_code') or '').upper().strip()
    status = request.form.get('status') or data.get('status')
    force_offline = (status == 'leaving')

    if not code:
        return jsonify({"status": "ok"})

    state = get_room_state('secret', code)
    if not state:
        return jsonify({"status": "room_closed", "room_closed": True})

    get_storage().touch_lobby('secret', code)

    state, offline_players, kicked_players = secret_logic.handle_heartbeat(
        state, code, user['username'], force_offline=force_offline
    )

    if kicked_players:
        trigger_update(code, state)

    payload = secret_logic.get_full_state(state)
    return jsonify({
        "status": "ok",
        "offline": offline_players,
        "kicked": kicked_players,
        "state": payload
    })
