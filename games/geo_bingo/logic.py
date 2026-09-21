"""Geo Bingo game engine logic and state machine."""
import time
from typing import Any, Dict, List, Optional, Tuple
from engine.heartbeat import process_heartbeat
from .items import generate_items


def get_initial_state() -> Dict[str, Any]:
    """Returns a clean initial state for a Geo Bingo room."""
    return {
        "players": [],
        "spectators": [],
        "host": None,
        "status": "lobby",             # lobby -> playing -> judging -> finished
        "phase": "lobby",              # lobby, exploration, judging, results
        "settings": {
            "item_count": 7,           # 5, 7, 10
            "time_limit": 600,         # seconds (0 = unlimited)
            "selected_items": [],      # explicit items chosen by host
            "host_custom_items": [],   # custom items created by host for this lobby
            "item_preset": "standard", # standard, easy, hard, custom
            "custom_items": [],        # list of custom item strings if preset == custom
            "blocked_countries": [],   # list of blocked country codes (e.g. ['DE', 'FR'])
        },
        "items": [],                   # List of items to search for this match
        "proofs": {},                  # {player: {item_idx_str: {pano_id, lat, lng, heading, pitch, fov, timestamp}}}
        "completed_count": {},         # {player: int}
        "judgements": {},              # {voter: {f"{target_player}_{item_idx}": bool}}
        "approved_results": {},        # {f"{target_player}_{item_idx}": bool}
        "player_custom_items": {},     # {username: [item1, item2, ...]}
        "judge_phase": {
            "item_index": 0,           # which item is currently being judged
            "target_player": None,     # whose proof is currently being reviewed
            "history": [],             # list of completed reviews
        },
        "scores": {},                  # {player: int} number of approved items
        "chat_messages": [],           # [{sender, text, time, item_idx}]
        "exploration_end_time": None,  # unix timestamp
        "winner": None,
        "logs": ["Spiel initialisiert."],
    }


def add_log(state: Dict[str, Any], message: str) -> None:
    """Appends an event to the game log, keeping maximum 100 entries."""
    logs = state.setdefault('logs', [])
    logs.append(message)
    if len(logs) > 100:
        state['logs'] = logs[-100:]


def setup_new_game(state: Dict[str, Any]) -> Dict[str, Any]:
    """Starts the match, generates items, and transitions to exploration."""
    settings = state.setdefault('settings', {})
    preset = settings.get('item_preset', 'standard')
    count = int(settings.get('item_count', 7))
    custom_items = settings.get('custom_items', [])
    selected_items = settings.get('selected_items', [])

    items = generate_items(count=count, selected_items=selected_items, preset=preset, custom_items=custom_items)
    state['items'] = items
    state['status'] = 'playing'
    state['phase'] = 'exploration'
    state['proofs'] = {p: {} for p in state.get('players', [])}
    state['completed_count'] = {p: 0 for p in state.get('players', [])}
    state['judgements'] = {p: {} for p in state.get('players', [])}
    state['approved_results'] = {}
    state['scores'] = {p: 0 for p in state.get('players', [])}
    state['winner'] = None
    state['rush_countdown'] = False
    state['rush_player'] = None

    time_limit = int(settings.get('time_limit', 600))
    if time_limit > 0:
        state['exploration_end_time'] = time.time() + time_limit
    else:
        state['exploration_end_time'] = None

    state['judge_phase'] = {
        "item_index": 0,
        "target_player": state['players'][0] if state.get('players') else None,
        "history": []
    }

    add_log(state, f"Spiel gestartet mit {len(items)} Suchobjekten ({preset.upper()}).")
    return state


def record_proof(
    state: Dict[str, Any],
    player: str,
    item_idx: int,
    proof_data: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """Records a player's proof for an item with pano_id, heading, pitch, fov."""
    if state.get('status') != 'playing' or state.get('phase') != 'exploration':
        return False, "Erkundungsphase ist nicht aktiv."

    items = state.get('items', [])
    if item_idx < 0 or item_idx >= len(items):
        return False, "Ungültiger Item-Index."

    pano_id = proof_data.get('pano_id')
    if not pano_id:
        return False, "Keine Pano-ID übermittelt."

    lat = float(proof_data.get('lat', 0.0))
    lng = float(proof_data.get('lng', 0.0))

    blocked_codes = state.get('settings', {}).get('blocked_countries', [])
    if blocked_codes:
        from .geo_countries import is_location_blocked
        is_blocked, country = is_location_blocked(lat, lng, blocked_codes)
        if is_blocked and country:
            country_name = country.get('name_de') or country.get('code')
            return False, f"🚫 Dieses Foto liegt in {country_name}! Dieses Land ist in dieser Runde gesperrt."

    player_proofs = state.setdefault('proofs', {}).setdefault(player, {})
    item_key = str(item_idx)

    player_proofs[item_key] = {
        "pano_id": str(pano_id),
        "lat": float(proof_data.get('lat', 0.0)),
        "lng": float(proof_data.get('lng', 0.0)),
        "heading": float(proof_data.get('heading', 0.0)),
        "pitch": float(proof_data.get('pitch', 0.0)),
        "zoom": float(proof_data.get('zoom', 1.0)),
        "fov": float(proof_data.get('fov', 90.0)),
        "timestamp": time.time(),
        "item_name": items[item_idx]
    }

    state.setdefault('completed_count', {})[player] = len(player_proofs)
    add_log(state, f"{player} hat '{items[item_idx]}' fotografiert ({len(player_proofs)}/{len(items)}).")

    # Check if this player found all items
    if len(player_proofs) >= len(items):
        players = state.get('players', [])
        # If playing alone or all players found all items -> instant transition
        if len(players) <= 1 or all(state.get('completed_count', {}).get(p, 0) >= len(items) for p in players):
            add_log(state, "Alle Items gefunden! Übergang zur Bewertung.")
            transition_to_judgement(state)
        else:
            # 10 second countdown for the other player(s)
            if not state.get('rush_countdown'):
                state['rush_countdown'] = True
                state['rush_player'] = player
                state['exploration_end_time'] = time.time() + 10.0
                add_log(state, f"⚡ {player} hat alle {len(items)} Items gefunden! Noch 10 Sekunden für alle anderen!")

    return True, None


def check_timer_expiration(state: Dict[str, Any]) -> bool:
    """Checks if the exploration time has expired and triggers judgement if so."""
    if state.get('status') == 'playing' and state.get('phase') == 'exploration':
        end_time = state.get('exploration_end_time')
        if end_time and time.time() >= end_time:
            if state.get('rush_countdown'):
                add_log(state, "10-Sekunden-Countdown abgelaufen! Übergang zur Bewertung.")
            else:
                add_log(state, "Zeit abgelaufen! Übergang zur Bewertung.")
            transition_to_judgement(state)
            return True
    return False


def transition_to_judgement(state: Dict[str, Any]) -> Dict[str, Any]:
    """Switches game status from exploration to judging round."""
    state['status'] = 'judging'
    state['phase'] = 'judging'

    players = state.get('players', [])
    first_target = players[0] if players else None

    state['judge_phase'] = {
        "item_index": 0,
        "target_player": first_target,
        "history": []
    }
    return state


def submit_judgement(
    state: Dict[str, Any],
    voter: str,
    target_player: str,
    item_idx: int,
    approved: bool
) -> Tuple[bool, Optional[str]]:
    """Records a player's vote on another player's proof and advances only upon consensus or majority."""
    if state.get('status') != 'judging':
        return False, "Bewertungsrunde ist nicht aktiv."

    players = state.get('players', [])
    if voter not in players:
        return False, "Nur aktive Spieler können abstimmen."

    judge_phase = state.get('judge_phase', {})
    current_idx = judge_phase.get('item_index', 0)
    current_target = judge_phase.get('target_player')

    if item_idx != current_idx or target_player != current_target:
        return False, "Nicht die aktive Prüfungsrunde."

    voter_judgements = state.setdefault('judgements', {}).setdefault(voter, {})
    review_key = f"{target_player}_{item_idx}"
    voter_judgements[review_key] = bool(approved)

    # Check if consensus or strict majority (> total_players / 2) has been reached
    judgements = state.get('judgements', {})
    total_players = len(players)

    yes_votes = sum(1 for p in players if judgements.get(p, {}).get(review_key) is True)
    no_votes = sum(1 for p in players if judgements.get(p, {}).get(review_key) is False)
    threshold = total_players / 2

    # In 1v1 (2 players): threshold is 1.0 -> requires 2 (both agree on Yes or both agree on No).
    # In 1v1v1 (3 players): threshold is 1.5 -> requires >= 2.
    # In solo (1 player): threshold is 0.5 -> requires 1.
    if yes_votes > threshold:
        state.setdefault('approved_results', {})[review_key] = True
        advance_judgement_step(state)
    elif no_votes > threshold:
        state.setdefault('approved_results', {})[review_key] = False
        advance_judgement_step(state)
    else:
        # No majority reached yet (e.g. 1 Yes vs 1 No in 1v1) -> do NOT advance!
        pass

    return True, None


def advance_judgement_step(state: Dict[str, Any]) -> None:
    """Advances through all items for player 1, then player 2, or concludes the match."""
    players = state.get('players', [])
    items = state.get('items', [])
    judge_phase = state.setdefault('judge_phase', {})

    current_idx = judge_phase.get('item_index', 0)
    current_target = judge_phase.get('target_player')

    if not players or not items:
        conclude_game(state)
        return

    # In 1v1: player 0's proof is reviewed by player 1, then player 1's proof is reviewed by player 0.
    target_idx = players.index(current_target) if current_target in players else 0

    if target_idx < len(players) - 1:
        # Move to next player for the SAME item index
        judge_phase['target_player'] = players[target_idx + 1]
    else:
        # Both players reviewed for this item -> move to NEXT item index
        next_item_idx = current_idx + 1
        if next_item_idx < len(items):
            judge_phase['item_index'] = next_item_idx
            judge_phase['target_player'] = players[0]
        else:
            # All items reviewed for all players -> conclude!
            conclude_game(state)


def conclude_game(state: Dict[str, Any]) -> None:
    """Calculates final approved scores and declares the winner."""
    state['status'] = 'finished'
    state['phase'] = 'results'

    players = state.get('players', [])
    items = state.get('items', [])
    approved_results = state.get('approved_results', {})
    proofs = state.get('proofs', {})

    scores = {p: 0 for p in players}

    for target in players:
        target_proofs = proofs.get(target, {})
        for idx in range(len(items)):
            key = f"{target}_{idx}"
            has_proof = str(idx) in target_proofs
            # Only award point if proof was actually submitted AND approved by consensus/majority
            if has_proof and approved_results.get(key) is True:
                scores[target] += 1

    state['scores'] = scores

    if not players:
        state['winner'] = None
        return

    max_score = max(scores.values()) if scores else 0
    top_players = [p for p in players if scores[p] == max_score]

    if len(top_players) == 1:
        winner = top_players[0]
        state['winner'] = winner
        add_log(state, f"🏆 {winner} gewinnt mit {max_score} Punkten!")
    elif len(top_players) > 1:
        state['winner'] = "Unentschieden"
        tie_names = " und ".join(top_players)
        add_log(state, f"🤝 Unentschieden zwischen {tie_names} mit je {max_score} Punkten!")
    else:
        state['winner'] = players[0]


def get_client_safe_state(state: Dict[str, Any], for_player: Optional[str] = None) -> Dict[str, Any]:
    """Sanitizes game state for broadcast or client consumption."""
    check_timer_expiration(state)

    status = state.get('status', 'lobby')
    phase = state.get('phase', 'lobby')

    client_proofs = {}
    all_proofs = state.get('proofs', {})

    if status == 'playing' and phase == 'exploration':
        # Players can only see their own photos during exploration to avoid cheating
        if for_player and for_player in all_proofs:
            client_proofs[for_player] = all_proofs[for_player]
    else:
        # In judging and results, proofs are revealed
        client_proofs = all_proofs

    # Active judgement review package
    active_review = None
    if status == 'judging':
        jp = state.get('judge_phase', {})
        idx = jp.get('item_index', 0)
        target = jp.get('target_player')
        items = state.get('items', [])
        item_name = items[idx] if idx < len(items) else ""
        target_proof = all_proofs.get(target, {}).get(str(idx)) if target else None

        review_key = f"{target}_{idx}"
        judgements = state.get('judgements', {})
        players = state.get('players', [])

        votes_map = {}
        for p in players:
            if p in judgements and review_key in judgements[p]:
                votes_map[p] = judgements[p][review_key]

        yes_count = sum(1 for v in votes_map.values() if v is True)
        no_count = sum(1 for v in votes_map.values() if v is False)
        voted_count = len(votes_map)
        total_voters = len(players)

        # Disagreement tie check: all voted but neither Yes nor No reached strict majority
        threshold = total_voters / 2
        is_disagreement = (voted_count == total_voters) and (yes_count <= threshold) and (no_count <= threshold)
        my_vote = votes_map.get(for_player) if for_player else None

        active_review = {
            "item_index": idx,
            "item_name": item_name,
            "target_player": target,
            "proof": target_proof,
            "total_items": len(items),
            "votes": votes_map,
            "voted_players": list(votes_map.keys()),
            "yes_count": yes_count,
            "no_count": no_count,
            "total_voters": total_voters,
            "is_disagreement": is_disagreement,
            "my_vote": my_vote
        }

    return {
        "players": state.get('players', []),
        "spectators": state.get('spectators', []),
        "host": state.get('host'),
        "status": status,
        "phase": phase,
        "settings": state.get('settings', {}),
        "items": state.get('items', []),
        "proofs": client_proofs,
        "completed_count": state.get('completed_count', {}),
        "judgements": state.get('judgements', {}),
        "approved_results": state.get('approved_results', {}),
        "player_custom_items": state.get('player_custom_items', {}),
        "judge_phase": state.get('judge_phase', {}),
        "active_review": active_review,
        "scores": state.get('scores', {}),
        "chat_messages": state.get('chat_messages', []),
        "winner": state.get('winner'),
        "exploration_end_time": state.get('exploration_end_time'),
        "rush_countdown": state.get('rush_countdown', False),
        "rush_player": state.get('rush_player'),
        "logs": state.get('logs', []),
        "room_code": state.get('room_code')
    }


def validate_game_integrity(state: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures a valid host exists and handles zombie rooms."""
    players = state.setdefault('players', [])
    if not players:
        state['host'] = None
    elif state.get('host') is None or state['host'] not in players:
        state['host'] = players[0]

    is_empty = len(players) == 0
    if is_empty:
        reset = get_initial_state()
        state.update(reset)
        state['logs'] = ["Raum zurückgesetzt."]

    return state


def handle_heartbeat(
    state: Dict[str, Any],
    room_code: str,
    player_name: str,
    force_offline: bool = False
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """Tracks heartbeat and handles timed out players."""
    hb_result = process_heartbeat(
        game_id='geobingo',
        room_code=room_code,
        username=player_name,
        force_offline=force_offline,
        kick_threshold=300.0,
        offline_threshold=45.0
    )

    kicked = hb_result.kicked_players
    for p in kicked:
        if p in state.get('players', []):
            state['players'].remove(p)
        if p in state.get('spectators', []):
            state['spectators'].remove(p)

    if kicked:
        state = validate_game_integrity(state)

    return state, hb_result.offline_players, kicked
