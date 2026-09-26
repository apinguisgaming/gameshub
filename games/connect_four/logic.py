"""Game rules and state management for 4-Gewinnt (Connect Four)."""
from typing import Any, Dict, List, Optional, Tuple

ROWS = 6
COLS = 7


def get_initial_state() -> Dict[str, Any]:
    """Generates a fresh initial state for a 4-Gewinnt room."""
    return {
        'status': 'lobby',  # 'lobby', 'playing', 'finished'
        'players': [],
        'spectators': [],
        'host': None,
        'board': [[None for _ in range(COLS)] for _ in range(ROWS)],
        'player_colors': {},  # {username: 'red' | 'yellow'}
        'turn': None,
        'winner': None,
        'winning_cells': [],  # list of [row, col]
        'is_draw': False,
        'scores': {},  # {username: score}
        'last_move': None,  # {'player': str, 'color': str, 'row': int, 'col': int}
        'stats_recorded': False,
    }


def get_client_safe_state(state: Dict[str, Any], for_player: Optional[str] = None) -> Dict[str, Any]:
    """Returns the state dictionary safe for client broadcast."""
    return state


def start_game(state: Dict[str, Any], starting_player: Optional[str] = None) -> Tuple[bool, str]:
    """Transitions lobby into playing state with 2 players."""
    players = state.get('players', [])
    if len(players) < 2:
        return False, "Mindestens 2 Spieler erforderlich"

    p1, p2 = players[0], players[1]
    state['player_colors'] = {
        p1: 'red',
        p2: 'yellow',
    }
    state['board'] = [[None for _ in range(COLS)] for _ in range(ROWS)]
    state['winning_cells'] = []
    state['is_draw'] = False
    state['winner'] = None
    state['stats_recorded'] = False
    state['last_move'] = None

    if starting_player and starting_player in players:
        state['turn'] = starting_player
    else:
        state['turn'] = p1

    state['status'] = 'playing'
    return True, "Spiel gestartet"


def check_winner(board: List[List[Optional[str]]]) -> Optional[Tuple[str, List[List[int]]]]:
    """Checks if there is a 4-in-a-row winner.
    
    Returns:
        (color, [[r, c], [r, c], [r, c], [r, c]]) or None
    """
    # 1. Horizontal
    for r in range(ROWS):
        for c in range(COLS - 3):
            color = board[r][c]
            if color and board[r][c + 1] == color and board[r][c + 2] == color and board[r][c + 3] == color:
                return color, [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]

    # 2. Vertical
    for r in range(ROWS - 3):
        for c in range(COLS):
            color = board[r][c]
            if color and board[r + 1][c] == color and board[r + 2][c] == color and board[r + 3][c] == color:
                return color, [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]

    # 3. Diagonal down-right (\)
    for r in range(ROWS - 3):
        for c in range(COLS - 3):
            color = board[r][c]
            if color and board[r + 1][c + 1] == color and board[r + 2][c + 2] == color and board[r + 3][c + 3] == color:
                return color, [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]

    # 4. Diagonal up-right (/)
    for r in range(3, ROWS):
        for c in range(COLS - 3):
            color = board[r][c]
            if color and board[r - 1][c + 1] == color and board[r - 2][c + 2] == color and board[r - 3][c + 3] == color:
                return color, [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]

    return None


def is_board_full(board: List[List[Optional[str]]]) -> bool:
    """Checks whether all columns in the top row are filled."""
    return all(board[0][c] is not None for c in range(COLS))


def drop_disc(state: Dict[str, Any], username: str, col: int) -> Tuple[bool, str]:
    """Drops a disc into the chosen column for the active player."""
    if state.get('status') != 'playing':
        return False, "Das Spiel läuft derzeit nicht"

    if state.get('turn') != username:
        return False, "Du bist nicht am Zug"

    if not isinstance(col, int) or col < 0 or col >= COLS:
        return False, f"Ungültige Spalte: {col}"

    board = state['board']
    if board[0][col] is not None:
        return False, "Diese Spalte ist bereits voll"

    # Find the lowest unoccupied row in this column
    target_row = -1
    for r in range(ROWS - 1, -1, -1):
        if board[r][col] is None:
            target_row = r
            break

    if target_row == -1:
        return False, "Diese Spalte ist voll"

    color = state['player_colors'].get(username, 'red')
    board[target_row][col] = color
    state['last_move'] = {
        'player': username,
        'color': color,
        'row': target_row,
        'col': col
    }

    # Check winning condition
    win_result = check_winner(board)
    if win_result:
        win_color, win_cells = win_result
        state['status'] = 'finished'
        state['winner'] = username
        state['winning_cells'] = win_cells
        scores = state.setdefault('scores', {})
        scores[username] = scores.get(username, 0) + 1
        return True, "Gewonnen"

    # Check draw condition
    if is_board_full(board):
        state['status'] = 'finished'
        state['is_draw'] = True
        state['winner'] = None
        return True, "Unentschieden"

    # Switch turn to the other player
    players = state.get('players', [])
    if len(players) >= 2:
        other_player = players[1] if players[0] == username else players[0]
        state['turn'] = other_player

    return True, "Zug ausgeführt"


def restart_game(state: Dict[str, Any]) -> Tuple[bool, str]:
    """Restarts a finished game, swapping starting player."""
    players = state.get('players', [])
    if len(players) < 2:
        state['status'] = 'lobby'
        return True, "Zurück zur Lobby"

    last_winner = state.get('winner')
    current_starter = players[0]
    if last_winner and last_winner in players:
        # Loser starts next round for fair balance
        current_starter = players[1] if players[0] == last_winner else players[0]
    else:
        # Alternate turn
        prev_p1_turn = state.get('player_colors', {}).get(players[0]) == 'red'
        if prev_p1_turn:
            current_starter = players[1]

    return start_game(state, starting_player=current_starter)
