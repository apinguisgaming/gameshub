"""GameHub Developer CLI.

Provides scaffolding commands for zero-boilerplate game generation:
Usage:
    python -m engine.cli create <game_id> [--title TITLE] [--type singleplayer|multiplayer]
"""
import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT_DIR / 'games'


def create_game_scaffold(
    game_id: str,
    title: str = None,
    game_type: str = 'singleplayer',
    icon: str = '🎮',
    color: str = '#6366f1',
    min_players: int = 1,
    max_players: int = 1,
) -> None:
    """Generates a complete, colocated game package inside games/<game_id>/."""
    game_id = game_id.lower().replace('-', '_').strip()
    if not game_id.isidentifier():
        print(f"Error: '{game_id}' is not a valid Python identifier.")
        sys.exit(1)

    target_dir = GAMES_DIR / game_id
    if target_dir.exists():
        print(f"Error: Game directory '{target_dir}' already exists.")
        sys.exit(1)

    display_title = title or game_id.replace('_', ' ').title()
    route_prefix = f"/{game_id.replace('_', '-')}"

    # Create directory structure
    templates_dir = target_dir / 'templates'
    static_dir = target_dir / 'static'
    templates_dir.mkdir(parents=True, exist_ok=True)
    static_dir.mkdir(parents=True, exist_ok=True)

    # 1. manifest.py
    if game_type == 'multiplayer':
        min_players = max(2, min_players)
        max_players = max(min_players, max_players if max_players > 1 else 4)
        manifest_content = f'''from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='{game_id}',
    title='{display_title}',
    subtitle='Multiplayer game generated with GameHub CLI.',
    tag='Multiplayer ({min_players}-{max_players})',
    game_type='multiplayer',
    route_prefix='{route_prefix}',
    template='{game_id}.html',
    card_class='card-{game_id.replace("_", "-")}',
    color='{color}',
    icon='{icon}',
    min_players={min_players},
    max_players={max_players},
    default_settings={{'round_time': 30}}
)
'''
    else:
        manifest_content = f'''from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='{game_id}',
    title='{display_title}',
    subtitle='Singleplayer game generated with GameHub CLI.',
    tag='Singleplayer',
    game_type='singleplayer',
    route_prefix='{route_prefix}',
    template='{game_id}.html',
    card_class='card-{game_id.replace("_", "-")}',
    color='{color}',
    icon='{icon}',
    has_cloud_save=True,
    min_players=1,
    max_players=1
)
'''
    with open(target_dir / 'manifest.py', 'w', encoding='utf-8') as f:
        f.write(manifest_content)

    # 2. CSS stylesheet
    style_content = f'''/* Style for {display_title} */
.{game_id}-container {{
    max-width: 900px;
    margin: 40px auto;
    padding: 24px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #f8fafc;
    text-align: center;
}}

.{game_id}-title {{
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 12px;
    color: {color};
}}
'''
    with open(static_dir / 'style.css', 'w', encoding='utf-8') as f:
        f.write(style_content)

    # 3. HTML template
    if game_type == 'multiplayer':
        template_content = f'''{{% extends "base.html" %}}
{{% block title %}}{display_title} - GameHub{{% endblock %}}

{{% block styles %}}
<link rel="stylesheet" href="{{{{ url_for('static', filename='{game_id}/style.css') }}}}">
{{% endblock %}}

{{% block content %}}
<div class="{game_id}-container">
    <div class="{game_id}-title">{icon} {display_title}</div>
    <p>Willkommen in {display_title}! Raumcode: <strong id="room-code-display">{{{{ room_code or 'Lobby' }}}}</strong></p>

    <div id="game-lobby-area" style="margin-top: 24px;">
        <button id="btn-create-room" class="btn btn-primary">Raum erstellen</button>
        <div id="active-rooms-list" style="margin-top: 16px;"></div>
    </div>
</div>

<script src="{{{{ url_for('static', filename='{game_id}/game.js') }}}}"></script>
{{% endblock %}}
'''
    else:
        template_content = f'''{{% extends "base.html" %}}
{{% block title %}}{display_title} - GameHub{{% endblock %}}

{{% block styles %}}
<link rel="stylesheet" href="{{{{ url_for('static', filename='{game_id}/style.css') }}}}">
{{% endblock %}}

{{% block content %}}
<div class="{game_id}-container">
    <div class="{game_id}-title">{icon} {display_title}</div>
    <p>Willkommen in {display_title}! Viel Spaß beim Spielen.</p>
    <div id="game-canvas-area" style="margin-top: 24px;">
        <p>Score: <span id="game-score">0</span></p>
        <button id="btn-add-score" class="btn btn-primary">+1 Punkt</button>
        <button id="btn-save-game" class="btn btn-secondary">Speichern</button>
    </div>
</div>

<script src="{{{{ url_for('static', filename='{game_id}/game.js') }}}}"></script>
{{% endblock %}}
'''
    with open(templates_dir / f'{game_id}.html', 'w', encoding='utf-8') as f:
        f.write(template_content)

    # 4. JavaScript client logic
    if game_type == 'multiplayer':
        js_content = f'''/**
 * Client-side game controller for {display_title}
 */
document.addEventListener('DOMContentLoaded', () => {{
    const mp = GameHub.multiplayer('{game_id}');
    const roomCode = document.getElementById('room-code-display')?.textContent?.trim();

    const btnCreate = document.getElementById('btn-create-room');
    if (btnCreate) {{
        btnCreate.addEventListener('click', async () => {{
            const res = await mp.createRoom();
            if (res.success && res.room_code) {{
                window.location.href = `{route_prefix}/${{res.room_code}}`;
            }}
        }});
    }}

    if (roomCode && roomCode !== 'Lobby') {{
        mp.subscribe(roomCode, (state) => {{
            console.log('[{display_title}] State update:', state);
        }});
        mp.startHeartbeat(roomCode);
    }} else {{
        GameHub.lobby.loadRooms('{game_id}', '#active-rooms-list', {{
            onJoin: (code) => {{ window.location.href = `{route_prefix}/${{code}}`; }}
        }});
    }}
}});
'''
    else:
        js_content = f'''/**
 * Client-side game controller for {display_title}
 */
document.addEventListener('DOMContentLoaded', async () => {{
    let score = 0;
    const scoreEl = document.getElementById('game-score');
    const btnAdd = document.getElementById('btn-add-score');
    const btnSave = document.getElementById('btn-save-game');

    // Load cloud save
    try {{
        const saveRes = await GameHub.storage.load('{game_id}');
        if (saveRes.success && saveRes.state) {{
            score = saveRes.state.score || 0;
            if (scoreEl) scoreEl.textContent = score;
        }}
    }} catch (e) {{ }}

    if (btnAdd) {{
        btnAdd.addEventListener('click', () => {{
            score++;
            if (scoreEl) scoreEl.textContent = score;
        }});
    }}

    if (btnSave) {{
        btnSave.addEventListener('click', async () => {{
            await GameHub.storage.save('{game_id}', {{ score: score }});
            alert('Spielstand gespeichert!');
        }});
    }}
}});
'''
    with open(static_dir / 'game.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    # 5. Routes and Logic for multiplayer games
    if game_type == 'multiplayer':
        routes_content = f'''"""Multiplayer routes for {display_title}."""
from flask import jsonify
from engine.multiplayer import create_multiplayer_blueprint
from . import logic

GAME_ID = '{game_id}'

bp = create_multiplayer_blueprint(
    game_id=GAME_ID,
    url_prefix='{route_prefix}',
    template='{game_id}.html',
    initial_state_factory=logic.get_initial_state,
    sanitize_state_func=logic.get_client_safe_state,
    max_players={max_players},
    min_players={min_players},
)


@bp.action('make_move')
def make_move(room_code, user, state, data):
    """Example action handler."""
    move = data.get('move')
    state['moves'] = state.get('moves', []) + [{{'player': user['username'], 'move': move}}]
    bp.trigger_update(room_code, state)
    return {{'success': True, 'state': logic.get_client_safe_state(state)}}
'''
        with open(target_dir / 'routes.py', 'w', encoding='utf-8') as f:
            f.write(routes_content)

        logic_content = f'''"""Game logic for {display_title}."""

def get_initial_state():
    return {{
        'status': 'lobby',
        'players': [],
        'moves': [],
        'scores': {{}}
    }}

def get_client_safe_state(state):
    return dict(state)
'''
        with open(target_dir / 'logic.py', 'w', encoding='utf-8') as f:
            f.write(logic_content)

        init_content = '''from .manifest import MANIFEST
from .routes import bp

__all__ = ['MANIFEST', 'bp']
'''
    else:
        init_content = '''from .manifest import MANIFEST

__all__ = ['MANIFEST']
'''

    with open(target_dir / '__init__.py', 'w', encoding='utf-8') as f:
        f.write(init_content)

    print(f"[OK] Successfully scaffolded '{display_title}' in games/{game_id}/ ({game_type})")
    print(f"     Route: {route_prefix}")


def main():
    parser = argparse.ArgumentParser(description="GameHub CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Create a new game module")
    create_parser.add_argument("game_id", help="Canonical game ID (e.g. space_invaders)")
    create_parser.add_argument("--title", help="Display title")
    create_parser.add_argument("--type", choices=["singleplayer", "multiplayer"], default="singleplayer", help="Game type")
    create_parser.add_argument("--icon", default="🎮", help="Emoji icon")
    create_parser.add_argument("--color", default="#6366f1", help="Theme color")
    create_parser.add_argument("--min-players", type=int, default=1, help="Min players")
    create_parser.add_argument("--max-players", type=int, default=4, help="Max players")

    args = parser.parse_args()
    if args.command == "create":
        create_game_scaffold(
            game_id=args.game_id,
            title=args.title,
            game_type=args.type,
            icon=args.icon,
            color=args.color,
            min_players=args.min_players,
            max_players=args.max_players,
        )


if __name__ == '__main__':
    main()
