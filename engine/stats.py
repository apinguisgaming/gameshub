"""Unified gameplay statistics recorder for GameHub.

Provides single-transaction batch persistence for player outcomes (wins/losses/scores),
eliminating N individual database connections on match completion.
"""
from typing import Any, Dict, List, Optional
from storage import get_storage


def record_match_outcome(
    game_id: str,
    winners: List[str],
    losers: List[str],
    scores: Optional[Dict[str, Any]] = None
) -> None:
    """Records match wins, losses, games played, and scores in a single batched database transaction.

    Args:
        game_id: Canonical game ID (e.g. 'secret_hitler', 'song_guesser')
        winners: List of winning usernames
        losers: List of losing usernames
        scores: Optional mapping of username -> score/high_score
    """
    storage = get_storage()
    records: List[Dict[str, Any]] = []
    scores = scores or {}

    all_players = set(winners) | set(losers) | set(scores.keys())
    for username in all_players:
        user = storage.get_user_by_username(username)
        if not user:
            continue

        is_win = username in winners
        is_loss = username in losers
        user_score = scores.get(username)

        rec = {
            'user_id': user['id'],
            'game_id': game_id,
            'games_played': 1,
            'wins': 1 if is_win else 0,
            'losses': 1 if is_loss else 0,
        }
        if user_score is not None:
            rec['high_score'] = int(user_score)

        records.append(rec)

    if records:
        storage.batch_update_stats(records)
