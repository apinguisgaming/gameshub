"""Battleship (Schiffe Versenken) game rules and fleet simulation."""
import random
from typing import Any, Dict, List, Optional, Tuple

GRID_SIZE = 10

# Standard 1xN fleet for classic mode
FLEET_SPEC = [
    {'id': 'battleship_1', 'name': 'Schlachtschiff', 'size': 4, 'shape': [[0, 0], [1, 0], [2, 0], [3, 0]]},
    {'id': 'cruiser_1', 'name': 'Kreuzer Alpha', 'size': 3, 'shape': [[0, 0], [1, 0], [2, 0]]},
    {'id': 'cruiser_2', 'name': 'Kreuzer Beta', 'size': 3, 'shape': [[0, 0], [1, 0], [2, 0]]},
    {'id': 'destroyer_1', 'name': 'Zerstörer 1', 'size': 2, 'shape': [[0, 0], [1, 0]]},
    {'id': 'destroyer_2', 'name': 'Zerstörer 2', 'size': 2, 'shape': [[0, 0], [1, 0]]},
    {'id': 'submarine_1', 'name': 'U-Boot 1', 'size': 1, 'shape': [[0, 0]]},
    {'id': 'submarine_2', 'name': 'U-Boot 2', 'size': 1, 'shape': [[0, 0]]},
]

# Unique custom-shaped polyomino fleets for each naval commander
COMMANDER_FLEETS: Dict[str, List[Dict[str, Any]]] = {
    'classic': FLEET_SPEC,
    'schmidt': [
        # Johannes Schmidt (Kriegsmarine) - Exact match to Steam Battleship screenshot!
        {'id': 'schnellboot', 'name': 'Schnellboot S-38', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'sub', 'name': 'U-Boot U-96', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'destroyer', 'name': 'Zerstörer Z-23 (L-Form)', 'size': 3, 'shape': [[0, 0], [1, 0], [1, 1]]},
        {'id': 'cruiser', 'name': 'Kreuzer Prinz Eugen (L-Form)', 'size': 4, 'shape': [[0, 0], [1, 0], [2, 0], [2, 1]]},
        {'id': 'battleship', 'name': 'Schlachtschiff Bismarck (Eck-Form)', 'size': 5, 'shape': [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]},
    ],
    'karslake': [
        # Sir William Karslake (Royal Navy)
        {'id': 'patrol', 'name': 'Patrouillenboot', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'frigate', 'name': 'Fregatte HMS Blackwood', 'size': 3, 'shape': [[0, 0], [1, 0], [2, 0]]},
        {'id': 'destroyer', 'name': 'Zerstörer HMS Kelly (L-Form)', 'size': 3, 'shape': [[0, 0], [1, 0], [1, 1]]},
        {'id': 'cruiser', 'name': 'Kreuzer HMS Belfast (T-Form)', 'size': 4, 'shape': [[0, 1], [1, 0], [1, 1], [1, 2]]},
        {'id': 'carrier', 'name': 'Träger HMS Ark Royal (L-Form)', 'size': 5, 'shape': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]]},
    ],
    'ferrara': [
        # Giuseppe Ferrara (Regia Marina)
        {'id': 'torpedoboot', 'name': 'MAS Torpedoboot', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'destroyer', 'name': 'Zerstörer Leone', 'size': 3, 'shape': [[0, 0], [1, 0], [2, 0]]},
        {'id': 'corvette', 'name': 'Korvette Gabbiano (Winkel)', 'size': 3, 'shape': [[0, 0], [1, 0], [0, 1]]},
        {'id': 'heavy_cruiser', 'name': 'Panzerkreuzer Zara (2x2 Block)', 'size': 4, 'shape': [[0, 0], [0, 1], [1, 0], [1, 1]]},
        {'id': 'battleship', 'name': 'Schlachtschiff Roma (Eck-Form)', 'size': 5, 'shape': [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]},
    ],
    'kelly': [
        # Astrid Kelly (Nordic Fleet)
        {'id': 'patrol', 'name': 'Spähboot Valkyrie', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'sub', 'name': 'U-Jagdboot Archer', 'size': 2, 'shape': [[0, 0], [1, 0]]},
        {'id': 'frigate', 'name': 'Fregatte Odin (L-Form)', 'size': 3, 'shape': [[0, 0], [1, 0], [1, 1]]},
        {'id': 'stealth_cruiser', 'name': 'Tarnkreuzer Shadow (Z-Form)', 'size': 4, 'shape': [[0, 0], [1, 0], [1, 1], [2, 1]]},
        {'id': 'flagship', 'name': 'Flaggschiff Fenrir (Winkel)', 'size': 4, 'shape': [[0, 0], [1, 0], [2, 0], [2, 1]]},
    ],
}

# 4 Tactical Abilities per Commander arranged in Diamond Cluster (Top, Left, Right, Bottom)
COMMANDER_ABILITIES: Dict[str, List[Dict[str, Any]]] = {
    'schmidt': [
        {
            'id': 'sonar',
            'pos': 'top',
            'name': 'U-Boot-Sonar',
            'icon': '📡',
            'cost': 3,
            'desc': 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
            'type': 'sonar'
        },
        {
            'id': 'mine',
            'pos': 'left',
            'name': 'Schnell-Torpedo',
            'icon': '⚙️',
            'cost': 2,
            'desc': 'Präzisions-Schuss auf 1 Zielfeld mit +2 Energie bei Treffer.',
            'type': 'precision'
        },
        {
            'id': 'torpedo',
            'pos': 'right',
            'name': 'Torpedo',
            'icon': '🚀',
            'cost': 4,
            'desc': 'Feuere ihn durch eine Zeile oder Spalte. Hält an, wenn er ein Schiff trifft.',
            'type': 'torpedo'
        },
        {
            'id': 'wolfpack',
            'pos': 'bottom',
            'name': 'Rudeltaktik (Ultimate)',
            'icon': '💥',
            'cost': 10,
            'desc': 'Massives Torpedobombardement auf ein 3x3 Zielgebiet.',
            'type': 'bombardment_3x3'
        }
    ],
    'karslake': [
        {
            'id': 'radar',
            'pos': 'top',
            'name': 'Radar-Scan',
            'icon': '📡',
            'cost': 3,
            'desc': 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
            'type': 'sonar'
        },
        {
            'id': 'recon',
            'pos': 'left',
            'name': 'Spähflug',
            'icon': '🛩️',
            'cost': 2,
            'desc': 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.',
            'type': 'recon_2'
        },
        {
            'id': 'airstrike',
            'pos': 'right',
            'name': 'Luftschlag',
            'icon': '⚡',
            'cost': 5,
            'desc': 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.',
            'type': 'airstrike_3'
        },
        {
            'id': 'carpet_bomb',
            'pos': 'bottom',
            'name': 'Teppichbombardement (Ultimate)',
            'icon': '💥',
            'cost': 10,
            'desc': 'Vernichtendes 3x3 Bombardement auf das Zielareal.',
            'type': 'bombardment_3x3'
        }
    ],
    'ferrara': [
        {
            'id': 'sonar',
            'pos': 'top',
            'name': 'Horchposten',
            'icon': '📡',
            'cost': 3,
            'desc': 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
            'type': 'sonar'
        },
        {
            'id': 'flare',
            'pos': 'left',
            'name': 'Leuchtgranate',
            'icon': '✨',
            'cost': 2,
            'desc': 'Prüft 2 aufeinanderfolgende Felder auf feindliche Einheiten.',
            'type': 'recon_2'
        },
        {
            'id': 'crossfire',
            'pos': 'right',
            'name': 'Kreuzfeuer',
            'icon': '⚔️',
            'cost': 5,
            'desc': 'Artilleriefeuer im Kreuzmuster (5 Felder: Zentrum + 4 Nachbarn).',
            'type': 'crossfire_5'
        },
        {
            'id': 'bombardment',
            'pos': 'bottom',
            'name': 'Schweres Bombardement (Ultimate)',
            'icon': '💥',
            'cost': 10,
            'desc': 'Feuert eine verheerende 3x3 Salve auf den gewählten Bereich.',
            'type': 'bombardment_3x3'
        }
    ],
    'kelly': [
        {
            'id': 'sonar',
            'pos': 'top',
            'name': 'Aufklärungs-Sonar',
            'icon': '📡',
            'cost': 3,
            'desc': 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
            'type': 'sonar'
        },
        {
            'id': 'ping',
            'pos': 'left',
            'name': 'Peilungs-Ping',
            'icon': '🎯',
            'cost': 2,
            'desc': 'Prüft 2 aufeinanderfolgende Felder in einer Reihe.',
            'type': 'recon_2'
        },
        {
            'id': 'depth_charge',
            'pos': 'right',
            'name': 'Wasserbomben',
            'icon': '💣',
            'cost': 5,
            'desc': 'Schachbrett-Salve (4 Felder im 2x2 Sektor).',
            'type': 'bombardment_2x2'
        },
        {
            'id': 'orbital_strike',
            'pos': 'bottom',
            'name': 'Präzisions-Bombardement (Ultimate)',
            'icon': '💥',
            'cost': 10,
            'desc': 'Volle 3x3 Salve auf den gewählten Zielbereich.',
            'type': 'bombardment_3x3'
        }
    ]
}

COMMANDERS = {
    'schmidt': {
        'id': 'schmidt',
        'name': 'Johannes Schmidt',
        'nation': 'Kriegsmarine',
        'icon': '⚓',
        'title': 'U-Boot-Ass',
        'ability': 'torpedo',
        'ability_name': 'Torpedo-Salve',
        'ability_desc': 'Feuert einen Torpedo durch eine Reihe bis zum ersten Treffer.',
        'cost': 4,
        'abilities': COMMANDER_ABILITIES['schmidt'],
        'fleet': COMMANDER_FLEETS['schmidt']
    },
    'karslake': {
        'id': 'karslake',
        'name': 'Sir William Karslake',
        'nation': 'Royal Navy',
        'icon': '🎖️',
        'title': 'Luftüberlegenheit',
        'ability': 'airstrike',
        'ability_name': 'Luftschlag',
        'ability_desc': 'Bombardiert 3 aufeinanderfolgende Felder in einer Reihe.',
        'cost': 5,
        'abilities': COMMANDER_ABILITIES['karslake'],
        'fleet': COMMANDER_FLEETS['karslake']
    },
    'ferrara': {
        'id': 'ferrara',
        'name': 'Giuseppe Ferrara',
        'nation': 'Regia Marina',
        'icon': '💥',
        'title': 'Artillerie-General',
        'ability': 'bombardment',
        'ability_name': 'Schweres Bombardement',
        'ability_desc': 'Feuert eine 2x2 Salve auf den gewählten Bereich.',
        'cost': 6,
        'abilities': COMMANDER_ABILITIES['ferrara'],
        'fleet': COMMANDER_FLEETS['ferrara']
    },
    'kelly': {
        'id': 'kelly',
        'name': 'Astrid Kelly',
        'nation': 'Marine-Aufklärung',
        'icon': '📡',
        'title': 'Sonar-Kommandeurin',
        'ability': 'sonar',
        'ability_name': 'Aufklärungs-Sonar',
        'ability_desc': 'Scannt 3x3 Felder und zählt verborgene Schiffssegmente.',
        'cost': 3,
        'abilities': COMMANDER_ABILITIES['kelly'],
        'fleet': COMMANDER_FLEETS['kelly']
    },
}


def rotate_shape(shape: List[List[int]], rotation: int) -> List[List[int]]:
    """Rotates a polyomino relative coordinate list by 0, 90, 180, or 270 degrees and normalizes."""
    rot = rotation % 4
    if rot == 0:
        res = [[r, c] for r, c in shape]
    elif rot == 1:
        res = [[c, -r] for r, c in shape]
    elif rot == 2:
        res = [[-r, -c] for r, c in shape]
    else:
        res = [[-c, r] for r, c in shape]
    min_r = min(r for r, c in res)
    min_c = min(c for r, c in res)
    return sorted([[r - min_r, c - min_c] for r, c in res])


def get_fleet_spec(commander_id: Optional[str] = None, game_mode: str = 'commanders') -> List[Dict[str, Any]]:
    """Returns the fleet specification for the chosen commander and game mode."""
    if game_mode == 'classic' or not commander_id:
        return COMMANDER_FLEETS['classic']
    return COMMANDER_FLEETS.get(commander_id, COMMANDER_FLEETS['classic'])


def get_initial_state() -> Dict[str, Any]:
    """Generates initial state for a Battleship room."""
    return {
        'status': 'lobby',  # 'lobby', 'placement', 'battle', 'finished'
        'game_mode': 'commanders',  # 'commanders' or 'classic'
        'players': [],
        'spectators': [],
        'host': None,
        'ready': {},  # {username: bool}
        'commanders': {},  # {username: 'karslake'|'schmidt'|'ferrara'|'kelly'}
        'energy': {},  # {username: int (0..10)}
        'fleets': {},  # {username: list of ships} (Server private during battle)
        'shots': {},  # {target_username: [{'row': r, 'col': c, 'result': 'hit'|'miss'|'sunk'}]}
        'turn': None,
        'winner': None,
        'scores': {},
        'last_shot': None,
        'sonar_result': {},  # {username: {'row': r, 'col': c, 'count': n}}
        'stats_recorded': False,
    }


def generate_random_fleet(commander_id: Optional[str] = None, game_mode: Optional[str] = None) -> List[Dict[str, Any]]:
    """Generates a valid, non-overlapping random placement for any commander's fleet."""
    mode = game_mode if game_mode is not None else ('commanders' if commander_id else 'classic')
    spec_list = get_fleet_spec(commander_id, mode)
    grid = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    placed_fleet = []

    for spec in spec_list:
        base_shape = spec.get('shape', [[i, 0] for i in range(spec['size'])])
        placed = False
        attempts = 0

        while not placed and attempts < 600:
            attempts += 1
            rot = random.randint(0, 3)
            shape = rotate_shape(base_shape, rot)
            max_r = max(r for r, c in shape)
            max_c = max(c for r, c in shape)
            if max_r >= GRID_SIZE or max_c >= GRID_SIZE:
                continue

            r0 = random.randint(0, GRID_SIZE - 1 - max_r)
            c0 = random.randint(0, GRID_SIZE - 1 - max_c)
            coords = [[r0 + r, c0 + c] for r, c in shape]

            # Check overlap
            if not any(grid[cr][cc] for cr, cc in coords):
                for cr, cc in coords:
                    grid[cr][cc] = True
                placed_fleet.append({
                    'id': spec['id'],
                    'name': spec['name'],
                    'size': spec['size'],
                    'shape': base_shape,
                    'rotation': rot,
                    'coords': coords,
                    'hits': 0,
                    'sunk': False,
                })
                placed = True

    return placed_fleet


def validate_fleet(fleet: List[Dict[str, Any]], commander_id: Optional[str] = None, game_mode: str = 'commanders') -> Tuple[bool, str]:
    """Validates that a submitted fleet conforms to the commander specification without overlapping."""
    if not isinstance(fleet, list) or len(fleet) == 0:
        return False, "Flotte muss eine nicht-leere Liste sein"

    spec_list = get_fleet_spec(commander_id, game_mode)
    expected_sizes = sorted([s['size'] for s in spec_list])
    classic_sizes = sorted([s['size'] for s in FLEET_SPEC])
    actual_sizes = sorted([s.get('size', 0) for s in fleet])

    if actual_sizes != expected_sizes and actual_sizes != classic_sizes:
        return False, "Schiffsgrößen stimmen nicht mit den Flottenvorgaben überein"

    occupied = set()
    for ship in fleet:
        coords = ship.get('coords', [])
        size = ship.get('size', 0)
        if len(coords) != size:
            return False, f"Ungültige Koordinatenlänge für Schiff {ship.get('name')}"

        # Check bounds and uniqueness
        for r, c in coords:
            if not (0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE):
                return False, f"Koordinate ({r},{c}) außerhalb des Spielfelds"
            coord_tuple = (r, c)
            if coord_tuple in occupied:
                return False, f"Schiffe überlappen sich bei ({r},{c})"
            occupied.add(coord_tuple)

    return True, "Flotte gültig"


def get_client_safe_state(state: Dict[str, Any], for_player: Optional[str] = None) -> Dict[str, Any]:
    """Returns a client-safe state dictionary, stripping hidden opponent ships and unrevealed hit details."""
    safe = dict(state)
    fleets = state.get('fleets', {})

    # If game finished, reveal everything!
    if state.get('status') == 'finished':
        safe['fleets'] = fleets
        return safe

    # Otherwise, reveal only sunk ships to the public / opponent
    sanitized_fleets = {}
    for username, fleet in fleets.items():
        if for_player and username == for_player:
            sanitized_fleets[username] = fleet
        else:
            sanitized_fleets[username] = [
                ship for ship in fleet if ship.get('sunk')
            ]

    safe['fleets'] = sanitized_fleets

    # Anti-Cheat: Ensure last_shot never leaks the ship name unless it is actually sunk!
    last_shot = state.get('last_shot')
    if last_shot:
        safe_last = dict(last_shot)
        if safe_last.get('result') != 'sunk':
            safe_last['ship_name'] = None
        safe['last_shot'] = safe_last

    # Sonar results are private to the scanning player
    sonar_res = state.get('sonar_result', {})
    if for_player and for_player in sonar_res:
        safe['sonar_result'] = {for_player: sonar_res[for_player]}
    else:
        safe['sonar_result'] = {}

    return safe


def start_placement(state: Dict[str, Any]) -> Tuple[bool, str]:
    """Transitions from lobby to ship placement phase."""
    players = state.get('players', [])
    if len(players) < 2:
        return False, "Mindestens 2 Spieler erforderlich"

    state['status'] = 'placement'
    state['ready'] = {p: False for p in players}
    state['fleets'] = {}
    state['shots'] = {p: [] for p in players}
    state['winner'] = None
    state['last_shot'] = None
    state['stats_recorded'] = False

    # Initialize commanders and energy
    state.setdefault('commanders', {})
    state.setdefault('energy', {})
    for p in players:
        if p not in state['commanders']:
            state['commanders'][p] = 'schmidt'
        state['energy'][p] = 2
    state['sonar_result'] = {}

    return True, "Platzierungsphase gestartet"


def confirm_placement(state: Dict[str, Any], username: str, fleet: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """Confirms player fleet placement and transitions to battle when both are ready."""
    if state.get('status') != 'placement':
        return False, "Nicht in der Platzierungsphase"

    cid = state.get('commanders', {}).get(username, 'schmidt')
    mode = state.get('game_mode', 'commanders')
    valid, err = validate_fleet(fleet, commander_id=cid, game_mode=mode)
    if not valid:
        return False, err

    state.setdefault('fleets', {})[username] = [
        {
            'id': s['id'],
            'name': s['name'],
            'size': s['size'],
            'coords': s['coords'],
            'shape': s.get('shape'),
            'rotation': s.get('rotation', 0),
            'hits': 0,
            'sunk': False
        }
        for s in fleet
    ]
    state.setdefault('ready', {})[username] = True

    players = state.get('players', [])
    if len(players) >= 2 and all(state['ready'].get(p) for p in players):
        state['status'] = 'battle'
        state['turn'] = players[0]
        # First player gets +2 turn energy
        state['energy'] = {p: 2 for p in players}
        state['energy'][players[0]] = 4
        return True, "Beide Spieler bereit! Gefecht beginnt!"

    return True, "Flotte bestätigt. Warte auf Gegner..."


def _resolve_single_shot(
    state: Dict[str, Any],
    shooter: str,
    target: str,
    row: int,
    col: int,
    target_shots: List[Dict[str, Any]],
    target_fleet: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Resolves a single cell attack against a target without revealing unsunk ship parts."""
    for s in target_shots:
        if s['row'] == row and s['col'] == col:
            return None  # already targeted

    hit_ship = None
    for ship in target_fleet:
        for cr, cc in ship['coords']:
            if cr == row and cc == col:
                hit_ship = ship
                break
        if hit_ship:
            break

    shot_record = {'row': row, 'col': col}
    if hit_ship:
        hit_ship['hits'] = hit_ship.get('hits', 0) + 1
        if hit_ship['hits'] >= hit_ship['size']:
            hit_ship['sunk'] = True
            shot_record['result'] = 'sunk'
            shot_record['ship_name'] = hit_ship['name']
            shot_record['sunk_coords'] = hit_ship['coords']
        else:
            shot_record['result'] = 'hit'
    else:
        shot_record['result'] = 'miss'

    target_shots.append(shot_record)
    state['last_shot'] = {
        'by': shooter,
        'target': target,
        'row': row,
        'col': col,
        'result': shot_record['result'],
        'ship_name': hit_ship.get('name') if shot_record.get('result') == 'sunk' else None
    }
    return shot_record


def fire_shot(state: Dict[str, Any], shooter: str, row: int, col: int) -> Tuple[bool, str, Dict[str, Any]]:
    """Handles standard single-cell artillery shot against opponent."""
    if state.get('status') != 'battle':
        return False, "Kein aktives Gefecht", {}

    if state.get('turn') != shooter:
        return False, "Du bist nicht am Zug", {}

    if not (0 <= row < GRID_SIZE and 0 <= col < GRID_SIZE):
        return False, f"Ungültige Koordinate ({row},{col})", {}

    players = state.get('players', [])
    if len(players) < 2:
        return False, "Nicht genügend Spieler", {}

    target = players[1] if players[0] == shooter else players[0]
    target_shots = state.setdefault('shots', {}).setdefault(target, [])
    target_fleet = state.setdefault('fleets', {}).get(target, [])

    for shot in target_shots:
        if shot['row'] == row and shot['col'] == col:
            return False, "Auf diese Koordinate wurde bereits geschossen", {}

    shot_res = _resolve_single_shot(state, shooter, target, row, col, target_shots, target_fleet)
    if not shot_res:
        return False, "Koordinate konnte nicht anvisiert werden", {}

    energy = state.setdefault('energy', {})

    if shot_res['result'] in ('hit', 'sunk'):
        energy[shooter] = min(10, energy.get(shooter, 0) + 1)
        if all(s.get('sunk') for s in target_fleet):
            state['status'] = 'finished'
            state['winner'] = shooter
            scores = state.setdefault('scores', {})
            scores[shooter] = scores.get(shooter, 0) + 1
            return True, f"{shooter} HAT DIE GEGNERISCHE FLOTTE VERNICHTET!", shot_res

        msg = f"TREFFER! {shot_res['ship_name']} VERSENKT!" if shot_res['result'] == 'sunk' else "TREFFER!"
        return True, msg, shot_res
    else:
        state['turn'] = target
        energy[target] = min(10, energy.get(target, 0) + 2)
        return True, "WASSER! Keine Wirkung.", shot_res


def execute_ability(
    state: Dict[str, Any],
    player: str,
    row: int,
    col: int,
    direction: str = 'H',
    ability_id: Optional[str] = None
) -> Tuple[bool, str, Dict[str, Any]]:
    """Executes a special Commander ability from the commander's diamond tactical suite."""
    if state.get('status') != 'battle':
        return False, "Kein aktives Gefecht", {}

    if state.get('turn') != player:
        return False, "Du bist nicht am Zug", {}

    if state.get('game_mode') == 'classic':
        return False, "Fähigkeiten sind im klassischen Modus deaktiviert", {}

    commander_id = state.get('commanders', {}).get(player, 'schmidt')
    abilities = COMMANDER_ABILITIES.get(commander_id, COMMANDER_ABILITIES['schmidt'])

    ability = None
    if ability_id:
        for ab in abilities:
            if ab['id'] == ability_id:
                ability = ab
                break
    if not ability:
        # Fallback to commander primary ability or first ability
        comm_meta = COMMANDERS.get(commander_id, COMMANDERS['schmidt'])
        primary_id = comm_meta.get('ability', abilities[0]['id'])
        for ab in abilities:
            if ab['id'] == primary_id:
                ability = ab
                break
        if not ability:
            ability = abilities[0]

    cost = ability['cost']
    energy = state.setdefault('energy', {})
    current_energy = energy.get(player, 0)

    if current_energy < cost:
        return False, f"Nicht genügend Energie ({current_energy}/{cost} benötigt)", {}

    players = state.get('players', [])
    if len(players) < 2:
        return False, "Nicht genügend Spieler", {}

    target = players[1] if players[0] == player else players[0]
    target_shots = state.setdefault('shots', {}).setdefault(target, [])
    target_fleet = state.setdefault('fleets', {}).get(target, [])

    # Deduct ability cost
    energy[player] -= cost
    result_data = {'ability': ability['id'], 'shots': []}
    ability_type = ability.get('type')

    # 1. SONAR / RADAR (3x3 Sensor Sweep - count unsunk segments)
    if ability_type == 'sonar':
        r_min, r_max = max(0, row - 1), min(GRID_SIZE - 1, row + 1)
        c_min, c_max = max(0, col - 1), min(GRID_SIZE - 1, col + 1)
        sonar_cells = []
        count = 0
        occupied_target = set()
        for ship in target_fleet:
            if not ship.get('sunk'):
                for sr, sc in ship['coords']:
                    occupied_target.add((sr, sc))

        for r in range(r_min, r_max + 1):
            for c in range(c_min, c_max + 1):
                sonar_cells.append([r, c])
                if (r, c) in occupied_target:
                    count += 1

        state.setdefault('sonar_result', {})[player] = {
            'row': row,
            'col': col,
            'cells': sonar_cells,
            'count': count
        }
        result_data['sonar'] = {'count': count, 'cells': sonar_cells}
        msg = f"SONAR-SCAN: {count} Schiffs-Segmente in Sektor geortet!"
        # Sonar is pure intel, shooter keeps turn!

    # 2. TORPEDO (Line search until first hit)
    elif ability_type == 'torpedo':
        cells = [[row, c] for c in range(GRID_SIZE)] if direction == 'H' else [[r, col] for r in range(GRID_SIZE)]
        hit_found = False
        for cr, cc in cells:
            shot_res = _resolve_single_shot(state, player, target, cr, cc, target_shots, target_fleet)
            if shot_res:
                result_data['shots'].append(shot_res)
                if shot_res['result'] in ('hit', 'sunk'):
                    hit_found = True
                    energy[player] = min(10, energy.get(player, 0) + 1)
                    break

        msg = "TORPEDO-TREFFER EINGESCHLAGEN!" if hit_found else "TORPEDO DURCHGELAUFEN (Wasser)!"
        if not hit_found:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    # 3. PRECISION / QUICK SHOT (1 cell with +2 energy bonus on hit)
    elif ability_type == 'precision':
        shot_res = _resolve_single_shot(state, player, target, row, col, target_shots, target_fleet)
        if shot_res:
            result_data['shots'].append(shot_res)
            if shot_res['result'] in ('hit', 'sunk'):
                energy[player] = min(10, energy.get(player, 0) + 2)
                msg = f"PRÄZISIONSTREFFER! +2 Bonus-Energie erhalten!"
            else:
                state['turn'] = target
                energy[target] = min(10, energy.get(target, 0) + 2)
                msg = "PRÄZISIONSSCHUSS INS WASSER!"
        else:
            msg = "Bereits anvisiert."

    # 4. RECON_2 (2 consecutive cells)
    elif ability_type == 'recon_2':
        cells = [[row, min(col, GRID_SIZE - 2)], [row, min(col, GRID_SIZE - 2) + 1]] if direction == 'H' else \
                [[min(row, GRID_SIZE - 2), col], [min(row, GRID_SIZE - 2) + 1, col]]
        hit_count = 0
        for cr, cc in cells:
            shot_res = _resolve_single_shot(state, player, target, cr, cc, target_shots, target_fleet)
            if shot_res:
                result_data['shots'].append(shot_res)
                if shot_res['result'] in ('hit', 'sunk'):
                    hit_count += 1
                    energy[player] = min(10, energy.get(player, 0) + 1)
        msg = f"AUFKLÄRUNGSSCHLAG! ({hit_count} Treffer)" if hit_count > 0 else "AUFKLÄRUNG ERFOLGLOS (Wasser)!"
        if hit_count == 0:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    # 5. AIRSTRIKE_3 (3 consecutive cells)
    elif ability_type == 'airstrike_3':
        if direction == 'H':
            c_start = min(max(0, col - 1), GRID_SIZE - 3)
            cells = [[row, c_start + i] for i in range(3)]
        else:
            r_start = min(max(0, row - 1), GRID_SIZE - 3)
            cells = [[r_start + i, col] for i in range(3)]

        hit_count = 0
        for cr, cc in cells:
            shot_res = _resolve_single_shot(state, player, target, cr, cc, target_shots, target_fleet)
            if shot_res:
                result_data['shots'].append(shot_res)
                if shot_res['result'] in ('hit', 'sunk'):
                    hit_count += 1
                    energy[player] = min(10, energy.get(player, 0) + 1)

        msg = f"LUFTSCHLAG EINGESCHLAGEN! ({hit_count} Treffer)" if hit_count > 0 else "LUFTSCHLAG FEHLGESCHLAGEN (Wasser)!"
        if hit_count == 0:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    # 6. CROSSFIRE_5 (5 cells: Center + 4 adjacent)
    elif ability_type == 'crossfire_5':
        candidate_cells = [
            [row, col],
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
        ]
        cells = [[r, c] for r, c in candidate_cells if 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE]
        hit_count = 0
        for cr, cc in cells:
            shot_res = _resolve_single_shot(state, player, target, cr, cc, target_shots, target_fleet)
            if shot_res:
                result_data['shots'].append(shot_res)
                if shot_res['result'] in ('hit', 'sunk'):
                    hit_count += 1
                    energy[player] = min(10, energy.get(player, 0) + 1)

        msg = f"KREUZFEUER! ({hit_count} Treffer)" if hit_count > 0 else "KREUZFEUER INS WASSER!"
        if hit_count == 0:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    # 7. BOMBARDMENT_2x2 (2x2 area)
    elif ability_type == 'bombardment_2x2':
        r_start = min(max(0, row), GRID_SIZE - 2)
        c_start = min(max(0, col), GRID_SIZE - 2)
        cells = [
            [r_start, c_start], [r_start, c_start + 1],
            [r_start + 1, c_start], [r_start + 1, c_start + 1]
        ]
        hit_count = 0
        for cr, cc in cells:
            shot_res = _resolve_single_shot(state, player, target, cr, cc, target_shots, target_fleet)
            if shot_res:
                result_data['shots'].append(shot_res)
                if shot_res['result'] in ('hit', 'sunk'):
                    hit_count += 1
                    energy[player] = min(10, energy.get(player, 0) + 1)

        msg = f"WASSERBOMBEN-SALVE! ({hit_count} Treffer)" if hit_count > 0 else "SALVE IN LEERES GEWÄSSER!"
        if hit_count == 0:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    # 8. BOMBARDMENT_3x3 / ULTIMATE (Full 3x3 destruction)
    elif ability_type == 'bombardment_3x3':
        r_min, r_max = max(0, row - 1), min(GRID_SIZE - 1, row + 1)
        c_min, c_max = max(0, col - 1), min(GRID_SIZE - 1, col + 1)
        hit_count = 0
        for r in range(r_min, r_max + 1):
            for c in range(c_min, c_max + 1):
                shot_res = _resolve_single_shot(state, player, target, r, c, target_shots, target_fleet)
                if shot_res:
                    result_data['shots'].append(shot_res)
                    if shot_res['result'] in ('hit', 'sunk'):
                        hit_count += 1
                        energy[player] = min(10, energy.get(player, 0) + 1)

        msg = f"MASSIVES BOMBARDEMENT EINGESCHLAGEN! ({hit_count} Treffer)" if hit_count > 0 else "BOMBARDEMENT IN WASSER EXPLODIERT!"
        if hit_count == 0:
            state['turn'] = target
            energy[target] = min(10, energy.get(target, 0) + 2)

    else:
        # Default single shot fallback
        shot_res = _resolve_single_shot(state, player, target, row, col, target_shots, target_fleet)
        if shot_res:
            result_data['shots'].append(shot_res)
            msg = "Spezialschlag abgefeuert."

    # Check win condition
    if all(s.get('sunk') for s in target_fleet):
        state['status'] = 'finished'
        state['winner'] = player
        scores = state.setdefault('scores', {})
        scores[player] = scores.get(player, 0) + 1

    return True, msg, result_data
