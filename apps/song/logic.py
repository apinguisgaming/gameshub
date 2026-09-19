"""Song Guesser game engine logic and state machine."""
import copy
import json
import os
import random
import time
from typing import Any, Dict, List, Optional, Tuple
from config import DATA_DIR
from apps.common.heartbeat import process_heartbeat

DATA_FILE = str(DATA_DIR / 'song_data.json')


def get_initial_state() -> Dict[str, Any]:
    """Generates default room state for Song Guesser."""
    return {
        "players": [],
        "spectators": [],
        "host": None,
        "status": "lobby",
        "scores": {},
        "round": {
            "active": False,
            "status": "waiting",
            "number": 0,
            "start_time": 0,
            "end_time": 0,
            "current_song": None,
            "correct_answer": None,
            "solved_by": [],
            "guesses": {},
            "ready_players": [],
            "is_last_round": False,
            "reveal_answer": None,
            "preload_url": None
        },
        "settings": {
            "time_per_song": 10,
            "total_songs": 10,
            "playlists": []
        },
        "played_songs": [],
        "last_active": time.time()
    }


def load_songs_library() -> Dict[str, List[Dict[str, Any]]]:
    """Reads available song playlists from static JSON data file."""
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _sample_round_data(
    library: Dict[str, List[Dict[str, Any]]],
    selected_playlists: List[str],
    played_songs: List[str],
    time_per_song: int
) -> Optional[Tuple[Dict[str, Any], List[Dict[str, Any]], int]]:
    """Helper to pick a random song and 3 distractors from selected playlists."""
    pool: List[Dict[str, Any]] = []
    if not selected_playlists:
        for pl in library.values():
            pool.extend(pl)
    else:
        for pl_name in selected_playlists:
            if pl_name in library:
                pool.extend(library[pl_name])

    if not pool:
        return None

    available_pool = [s for s in pool if s['id'] not in played_songs]
    if not available_pool:
        # If pool exhausted, allow repeating
        available_pool = pool

    correct_song = random.choice(available_pool)
    distractors = [s for s in pool if s['id'] != correct_song['id']]
    num_wrong = min(3, len(distractors))
    wrong_options = random.sample(distractors, num_wrong) if num_wrong > 0 else []

    options = [correct_song] + wrong_options
    random.shuffle(options)

    max_offset = max(0, 29 - time_per_song)
    start_offset = random.randint(0, int(max_offset)) if max_offset > 0 else 0

    return correct_song, options, start_offset


def start_new_round(state: Dict[str, Any]) -> Dict[str, Any]:
    """Transitions state into next song round."""
    current_round = state['round'].get('number', 0)
    max_rounds = state['settings']['total_songs']

    if current_round >= max_rounds:
        state['status'] = 'finished'
        state['round']['active'] = False
        return state

    library = load_songs_library()
    selected_playlists = state['settings'].get('playlists', [])
    played = state.get('played_songs', [])
    duration = state['settings'].get('time_per_song', 10)

    if state.get('next_round_cache'):
        cached = state['next_round_cache']
        correct_song = cached['correct_song']
        options = cached['options']
        start_offset = cached['start_offset']
        state['next_round_cache'] = None
    else:
        sampled = _sample_round_data(library, selected_playlists, played, duration)
        if not sampled:
            state['status'] = 'finished'
            state['round']['active'] = False
            return state
        correct_song, options, start_offset = sampled

    next_round_num = current_round + 1
    state['status'] = 'playing'
    state['round'] = {
        "active": True,
        "status": "preloading",
        "number": next_round_num,
        "start_time": 0,
        "end_time": 0,
        "solved_by": [],
        "guesses": {},
        "ready_players": [],
        "correct_answer": correct_song['id'],
        "is_last_round": (next_round_num >= max_rounds),
        "reveal_answer": None,
        "preload_url": None,
        "current_song": {
            "url": correct_song['preview_url'],
            "duration": duration,
            "offset": start_offset,
            "options": [
                {"id": s['id'], "label": f"{s.get('artist', '')} - {s.get('title', '')}"}
                for s in options
            ]
        }
    }

    state.setdefault('played_songs', []).append(correct_song['id'])
    state['last_active'] = time.time()
    return state


def prepare_next_round(state: Dict[str, Any]) -> Optional[str]:
    """Generates upcoming round into server cache to enable smooth client preloading."""
    current_round = state['round'].get('number', 0)
    if current_round >= state['settings']['total_songs']:
        return None

    library = load_songs_library()
    selected_playlists = state['settings'].get('playlists', [])
    played = state.get('played_songs', [])
    duration = state['settings'].get('time_per_song', 10)

    sampled = _sample_round_data(library, selected_playlists, played, duration)
    if not sampled:
        return None

    correct_song, options, start_offset = sampled
    state['next_round_cache'] = {
        "correct_song": correct_song,
        "options": options,
        "start_offset": start_offset
    }
    return correct_song.get('preview_url')


def evaluate_guess(state: Dict[str, Any], player: str, guess_id: str, elapsed: float) -> Tuple[str, int]:
    """Evaluates guess immediately without blocking server threads."""
    round_data = state.get('round', {})
    if round_data.get('status') != 'playing':
        return "inactive", 0

    target_id = str(round_data.get('correct_answer', ''))
    max_time = float(state['settings'].get('time_per_song', 10))
    elapsed_clamped = max(0.0, min(float(elapsed), max_time + 1.0))

    guesses = round_data.setdefault('guesses', {})
    if player in guesses and guesses[player].get('evaluated'):
        # Already guessed
        return "already_guessed", guesses[player].get('points', 0)

    is_correct = (str(guess_id) == target_id)
    points = 0

    if is_correct:
        solved_by = round_data.setdefault('solved_by', [])
        rank = len(solved_by)

        ratio = max(0.0, (max_time - min(elapsed_clamped, max_time)) / max_time)
        base_points = 10 + int(90 * ratio)
        bonus = 50 if rank == 0 else (25 if rank == 1 else 0)
        points = base_points + bonus

        solved_by.append(player)
        state['scores'][player] = state['scores'].get(player, 0) + points

    guesses[player] = {
        "guess_id": guess_id,
        "elapsed": elapsed_clamped,
        "evaluated": True,
        "points": points
    }

    return "correct" if is_correct else "wrong", points


def get_client_safe_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """Returns a client-safe snapshot of state with confidential answers sanitized."""
    safe = copy.deepcopy(state)

    # In lobby status, omit empty round runtime fields and played songs to keep payloads tiny
    if safe.get('status') == 'lobby':
        safe.pop('round', None)
        safe.pop('played_songs', None)
        safe.pop('last_active', None)
    else:
        # Sanitize active answer so client cannot inspect DOM/network packets
        if safe.get('round', {}).get('active'):
            safe['round']['correct_answer'] = None

    # CRITICAL CHEAT FIX: Never leak next round song in Pusher update!
    if 'next_round_cache' in safe:
        del safe['next_round_cache']

    return safe


def handle_heartbeat(
    state: Dict[str, Any],
    room_code: str,
    player_name: str,
    force_offline: bool = False
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """Heartbeat processing for Song Guesser using shared heartbeat manager."""
    hb_result = process_heartbeat(
        game_id='song',
        room_code=room_code,
        username=player_name,
        force_offline=force_offline,
        kick_threshold=60.0,
        offline_threshold=5.0
    )

    kicked = hb_result.kicked_players
    for p in kicked:
        if p in state.get('players', []):
            state['players'].remove(p)
        if p in state.get('spectators', []):
            state['spectators'].remove(p)
        if p in state.get('scores', []):
            del state['scores'][p]
        if p == state.get('host'):
            state['host'] = state['players'][0] if state.get('players') else None

    return state, hb_result.offline_players, kicked