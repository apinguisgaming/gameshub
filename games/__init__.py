"""GameHub Games Package.

Provides centralized discovery, manifest registration, and automatic route wiring
for all colocated games in the games/ directory.
"""
import importlib
import logging
import os
import pkgutil
from typing import List, Optional
from flask import Flask
from engine.registry import GameManifest, register_game, get_all_games, clear_registry
from engine.singleplayer import register_singleplayer_routes

logger = logging.getLogger(__name__)

CANONICAL_GAME_ORDER = [
    'impostor',
    'song_guesser',
    'secret_hitler',
    'pokemon_tower',
    'gothic_survivors',
    'song_seeker',
    'nexus_dex',
    'geo_bingo',
]


def discover_games() -> List[GameManifest]:
    """Dynamically discovers all game packages in the games/ directory and loads their manifests."""
    manifests: List[GameManifest] = []
    current_dir = os.path.dirname(__file__)

    # 1. Load canonical games in preferred display order
    loaded_ids = set()
    for game_id in CANONICAL_GAME_ORDER:
        pkg_dir = os.path.join(current_dir, game_id)
        if os.path.isdir(pkg_dir):
            try:
                mod = importlib.import_module(f".{game_id}", package=__name__)
                manifest = getattr(mod, 'MANIFEST', None)
                if manifest and isinstance(manifest, GameManifest):
                    manifests.append(manifest)
                    loaded_ids.add(game_id)
            except Exception as e:
                logger.error(f"Failed to load game '{game_id}': {e}")

    # 2. Discover any additional custom game packages added by developers
    for _, name, is_pkg in pkgutil.iter_modules([current_dir]):
        if is_pkg and name not in loaded_ids and not name.startswith('_'):
            try:
                mod = importlib.import_module(f".{name}", package=__name__)
                manifest = getattr(mod, 'MANIFEST', None)
                if manifest and isinstance(manifest, GameManifest):
                    manifests.append(manifest)
                    loaded_ids.add(name)
            except Exception as e:
                logger.warning(f"Failed to auto-discover game '{name}': {e}")

    return manifests


def init_games_registry(app: Optional[Flask] = None) -> List[GameManifest]:
    """Initializes the central GameHub registry and optionally wires Flask blueprints."""
    clear_registry()
    manifests = discover_games()

    for manifest in manifests:
        register_game(manifest)

    if app is not None:
        registered_bp_names = {bp.name for bp in app.blueprints.values()}

        # 1. Register colocated game blueprints
        for manifest in manifests:
            try:
                mod = importlib.import_module(f".{manifest.id}", package=__name__)
                bp = getattr(mod, 'bp', None)
                if bp is not None and bp.name not in registered_bp_names:
                    app.register_blueprint(bp, url_prefix=manifest.route_prefix)
                    registered_bp_names.add(bp.name)
            except Exception as e:
                logger.error(f"Failed to register blueprint for '{manifest.id}': {e}")

        # 2. Auto-wire singleplayer routes
        register_singleplayer_routes(app, manifests)

    return get_all_games()


__all__ = [
    'discover_games',
    'init_games_registry',
    'CANONICAL_GAME_ORDER',
]
