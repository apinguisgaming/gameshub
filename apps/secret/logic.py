"""Secret Hitler game engine logic and state machine."""
import random
from typing import Any, Dict, List, Optional, Tuple
from apps.common.heartbeat import process_heartbeat, clear_player

# --- BOARD POWERS CONFIGURATION ---
# Slots are 0-indexed (Slot 1 on fascist board is index 0)
BOARD_CONFIGS = {
    5: {2: "peek", 3: "execution", 4: "execution"},
    6: {2: "peek", 3: "execution", 4: "execution"},
    7: {1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
    8: {1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
    9: {0: "investigate", 1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
    10: {0: "investigate", 1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
    11: {0: "investigate", 1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
    12: {0: "investigate", 1: "investigate", 2: "special_election", 3: "execution", 4: "execution"},
}


def get_initial_state() -> Dict[str, Any]:
    """Generates a default, clean game state."""
    return {
        "players": [],
        "host": None,
        "status": "lobby",
        "roles": {},
        "phase": "nominating",
        "president_index": 0,
        "chancellor_nominee": None,
        "votes": {},
        "last_vote_result": None,
        "liberal_board": 0,
        "fascist_board": 0,
        "deck": [],
        "discard_pile": [],
        "legislative_step": None,
        "hand": [],
        "game_over_msg": None,
        "election_tracker": 0,
        "previous_president": None,
        "previous_chancellor": None,
        "veto_declined": False,
        "deck_reshuffled": False,
        "logs": ["Spiel initialisiert."],
        "settings": {
            "log_book": True,
            "reveal_on_death": False,
            "blind_voting": False,
        },
        "avatars": {},
        "card_styles": {},
        "spectators": [],
        "player_uuids": {},
        "dead_players": [],
        "pending_action": None,
        "action_payload": None,
        "return_president_index": None,
    }


def _reshuffle_deck_if_needed(state: Dict[str, Any], min_cards: int) -> bool:
    """Shuffles discard pile back into deck if remaining cards are below min_cards."""
    if len(state['deck']) < min_cards:
        discard = state.get('discard_pile', [])
        state['deck'].extend(discard)
        state['discard_pile'] = []
        random.shuffle(state['deck'])
        state['deck_reshuffled'] = True
        return True
    return False


def setup_new_game(state: Dict[str, Any]) -> Dict[str, Any]:
    """Initializes and starts a new Secret Hitler match."""
    players = state['players']
    count = len(players)

    # Assign Roles cleanly based on player count
    if count == 2:
        roles = ['Hitler', 'Liberal']
    elif count in (3, 4):
        roles = ['Hitler', 'Fascist'] + ['Liberal'] * (count - 2)
    else:
        # Standard rules: 5 players = 1F, 6 = 1F, 7 = 2F, 8 = 2F, 9 = 3F, 10 = 3F
        fascist_count = (count - 1) // 2 - 1
        liberal_count = count - 1 - fascist_count
        roles = ['Hitler'] + ['Fascist'] * fascist_count + ['Liberal'] * liberal_count

    random.shuffle(roles)
    state['roles'] = {p: roles[i] for i, p in enumerate(players)}

    # Deck setup: 6 Liberal, 11 Fascist
    state['deck'] = ['Liberal'] * 6 + ['Fascist'] * 11
    random.shuffle(state['deck'])
    state['discard_pile'] = []

    state['status'] = 'playing'
    state['phase'] = 'nominating'
    state['president_index'] = random.randint(0, len(players) - 1)

    state['election_tracker'] = 0
    state['previous_president'] = None
    state['previous_chancellor'] = None

    state['dead_players'] = []
    state['pending_action'] = None
    state['action_payload'] = None
    state['return_president_index'] = None

    state['chancellor_nominee'] = None
    state['votes'] = {}
    state['last_vote_result'] = None
    state['liberal_board'] = 0
    state['fascist_board'] = 0
    state['game_over_msg'] = None
    state['veto_declined'] = False
    state['deck_reshuffled'] = False

    add_log(state, "Neues Spiel gestartet. Rollen wurden verteilt.")
    return state


def draw_policies(state: Dict[str, Any], amount: int) -> Dict[str, Any]:
    """Draws top policies from the deck with auto-reshuffle."""
    _reshuffle_deck_if_needed(state, amount)
    drawn = []
    for _ in range(amount):
        if state['deck']:
            drawn.append(state['deck'].pop(0))
    state['hand'] = drawn
    return state


def advance_president(state: Dict[str, Any]) -> Dict[str, Any]:
    """Advances the presidential placard to the next eligible living player."""
    players = state['players']
    if not players:
        return state

    living_players = [p for p in players if p not in state.get('dead_players', [])]
    if not living_players:
        return state

    # Check if returning from a Special Election
    if state.get('return_president_index') is not None:
        current = state['return_president_index']
        state['return_president_index'] = None
    else:
        current = state.get('president_index', 0)

    # Advance index, skipping dead players safely (bounded loop)
    for _ in range(len(players)):
        current = (current + 1) % len(players)
        if players[current] not in state.get('dead_players', []):
            break

    state['president_index'] = current
    state['phase'] = 'nominating'
    state['chancellor_nominee'] = None
    state['legislative_step'] = None
    state['pending_action'] = None
    state['veto_declined'] = False
    return state


def perform_executive_action_check(state: Dict[str, Any]) -> bool:
    """Checks if the current fascist board triggers an executive power."""
    player_count = len(state['players'])
    slot_index = state['fascist_board'] - 1

    config = BOARD_CONFIGS.get(player_count, {})
    power = config.get(slot_index)

    if power:
        state['phase'] = 'executive_action'
        state['pending_action'] = power
        state['legislative_step'] = None

        if power == 'peek':
            _reshuffle_deck_if_needed(state, 3)
            state['action_payload'] = state['deck'][:3]

        return True
    return False


def check_win_conditions(state: Dict[str, Any]) -> bool:
    """Checks for victory conditions (policy count or Hitler status)."""
    msg = None
    if state['liberal_board'] >= 5:
        msg = "LIBERALS WIN (5 Policies)"
    elif state['fascist_board'] >= 6:
        msg = "FASCISTS WIN (6 Policies)"

    # Check if Hitler was killed
    hitler_alive = False
    for p, r in state.get('roles', {}).items():
        if r == 'Hitler' and p not in state.get('dead_players', []):
            hitler_alive = True

    if not hitler_alive and state.get('status') == 'playing':
        msg = "LIBERALS WIN (Hitler Executed)"

    if msg:
        state['game_over_msg'] = msg
        state['status'] = 'game_over'
        add_log(state, msg)
        return True
    return False


def perform_chaos_enactment(state: Dict[str, Any]) -> Dict[str, Any]:
    """Enacts top policy from deck due to 3 failed elections."""
    _reshuffle_deck_if_needed(state, 1)

    if state['deck']:
        card = state['deck'].pop(0)
        if card == 'Liberal':
            state['liberal_board'] += 1
        else:
            state['fascist_board'] += 1
        state['last_enacted'] = card
        add_log(state, f"Chaos! {card} Policy verabschiedet.")

    state['election_tracker'] = 0
    state['previous_president'] = None
    state['previous_chancellor'] = None

    if check_win_conditions(state):
        return state

    return advance_president(state)


def process_vote_outcome(state: Dict[str, Any]) -> Dict[str, Any]:
    """Tallies votes and transitions to legislative or chaos phase."""
    living_voters = [p for p in state['players'] if p not in state.get('dead_players', [])]
    required_votes = (len(living_voters) // 2) + 1

    votes = state.get('votes', {})
    ja = list(votes.values()).count('Ja')
    nein = list(votes.values()).count('Nein')

    passed = ja >= required_votes

    vote_details = {}
    if not state.get('settings', {}).get('blind_voting', False):
        vote_details = votes.copy()

    state['last_vote_result'] = {
        "passed": passed,
        "ja": ja,
        "nein": nein,
        "details": vote_details
    }
    state['vote_notification'] = state['last_vote_result']

    result_str = "ANGENOMMEN" if passed else "ABGELEHNT"
    add_log(state, f"Wahl {result_str} (Ja: {ja}, Nein: {nein}).")

    if passed:
        chancellor = state['chancellor_nominee']
        if state['fascist_board'] >= 3 and state.get('roles', {}).get(chancellor) == 'Hitler':
            state['game_over_msg'] = "FASCISTS WIN (Hitler Elected Chancellor)"
            state['status'] = 'game_over'
            add_log(state, state['game_over_msg'])
            return state

        current_pres = state['players'][state['president_index']]
        state['previous_president'] = current_pres
        state['previous_chancellor'] = chancellor
        state['election_tracker'] = 0

        state['phase'] = 'legislative'
        state = draw_policies(state, 3)
        state['legislative_step'] = 'president_session'
    else:
        state['election_tracker'] = state.get('election_tracker', 0) + 1
        if state['election_tracker'] >= 3:
            add_log(state, "Wahlzähler hat 3 erreicht. Chaos-Gesetz!")
            state = perform_chaos_enactment(state)
            state['last_vote_result']['chaos'] = True
        else:
            state = advance_president(state)

    return state


def get_full_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """Prepares safe state snapshot for connected clients."""
    data = {
        'players': state['players'],
        'spectators': state.get('spectators', []),
        'host': state['host'],
        'status': state['status'],
        'phase': state['phase'],
        'president': state['players'][state['president_index']] if state.get('players') else "",
        'chancellor': state.get('chancellor_nominee'),
        'votes': state.get('votes', {}),
        'last_result': state.get('last_vote_result'),
        'liberal_board': state.get('liberal_board', 0),
        'fascist_board': state.get('fascist_board', 0),
        'deck_count': len(state.get('deck', [])),
        'discard_count': len(state.get('discard_pile', [])),
        'legislative_step': state.get('legislative_step'),
        'game_over_msg': state.get('game_over_msg'),
        'hand': state.get('hand', []),
        'election_tracker': state.get('election_tracker', 0),
        'prev_pres': state.get('previous_president'),
        'prev_chan': state.get('previous_chancellor'),
        'dead_players': state.get('dead_players', []),
        'pending_action': state.get('pending_action'),
        'action_payload': state.get('action_payload'),
        'veto_declined': state.get('veto_declined', False),
        'logs': state.get('logs', []),
        'settings': state.get('settings', {}),
        'avatars': state.get('avatars', {}),
        'card_styles': state.get('card_styles', {}),
        'room_code': state.get('room_code')
    }

    if state.get('status') == 'game_over':
        data['all_roles'] = state.get('roles', {})

    return data


def add_log(state: Dict[str, Any], message: str) -> Dict[str, Any]:
    """Appends an event to the game logs, keeping up to 100 entries."""
    logs = state.setdefault('logs', [])
    logs.append(message)
    if len(logs) > 100:
        state['logs'] = logs[-100:]
    return state


def get_available_avatar(state: Dict[str, Any]) -> str:
    """Returns the filename of an unused avatar (avatar_1 to avatar_12)."""
    used = set(state.get('avatars', {}).values())
    options = list(range(1, 13))
    random.shuffle(options)
    for i in options:
        name = f"avatar_{i}"
        if name not in used:
            return name
    return "avatar_1"


def validate_game_integrity(state: Dict[str, Any]) -> Dict[str, Any]:
    """Performs integrity checks, host reassignment, and zombie room cleanup."""
    players = state.setdefault('players', [])

    if not players:
        state['host'] = None
    elif state.get('host') is None or state['host'] not in players:
        state['host'] = players[0]

    is_empty = len(players) == 0
    is_zombie = state.get('status') != 'lobby' and len(players) < 2

    if is_empty or is_zombie:
        reset_values = {
            'status': 'lobby',
            'phase': 'nominating',
            'roles': {},
            'votes': {},
            'last_vote_result': None,
            'president_index': 0,
            'chancellor_nominee': None,
            'election_tracker': 0,
            'liberal_board': 0,
            'fascist_board': 0,
            'deck': [],
            'discard_pile': [],
            'hand': [],
            'dead_players': [],
            'pending_action': None,
            'action_payload': None,
            'legislative_step': None,
            'spectators': [],
            'return_president_index': None,
            'veto_declined': False,
        }
        state.update(reset_values)
        if is_empty:
            state['logs'] = ["Spiel initialisiert."]
        else:
            state.setdefault('logs', []).append("Spiel wegen Spielermangel zurückgesetzt.")

    if players and state.get('president_index', 0) >= len(players):
        state['president_index'] = 0

    active_users = set(players)
    if 'spectators' in state:
        state['spectators'] = [s for s in state['spectators'] if s not in active_users]
        active_users.update(state['spectators'])

    for dict_key in ('player_uuids', 'card_styles', 'avatars'):
        if dict_key in state:
            state[dict_key] = {k: v for k, v in state[dict_key].items() if k in active_users}

    return state


def handle_heartbeat(
    state: Dict[str, Any],
    room_code: str,
    player_name: str,
    force_offline: bool = False
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """Tracks heartbeat and removes timed-out players for a specific room."""
    hb_result = process_heartbeat(
        game_id='secret',
        room_code=room_code,
        username=player_name,
        force_offline=force_offline,
        kick_threshold=120.0,
        offline_threshold=5.0
    )

    kicked = hb_result.kicked_players
    for p in kicked:
        if p in state.get('players', []):
            state['players'].remove(p)
        if p in state.get('spectators', []):
            state['spectators'].remove(p)
        for key in ('roles', 'votes', 'avatars', 'card_styles', 'player_uuids'):
            if p in state.get(key, {}):
                del state[key][p]

    if kicked:
        state = validate_game_integrity(state)

    return state, hb_result.offline_players, kicked