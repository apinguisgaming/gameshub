"""GameHub Game Registry & Manifest System.

Provides centralized registration and discovery for singleplayer and multiplayer games.
Allows new games to register manifests, auto-generate portal cards, and wire routes
without modifying global layout templates or core dispatchers.
"""
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class GameManifest:
    id: str                                # Unique slug (e.g. 'secret', 'song', 'imposter')
    title: str                             # Display title (can include HTML e.g. 'Secret<br>Hitler')
    subtitle: str                          # Tagline / description
    tag: str = 'Game'                      # Badge tag on card (e.g. 'Multiplayer', 'Action RPG')
    game_type: str = 'singleplayer'        # 'singleplayer' or 'multiplayer'
    route_prefix: str = ''                 # Primary URL prefix (e.g. '/secret')
    template: str = ''                     # Template file (e.g. 'secret.html')
    card_class: str = ''                   # Custom CSS class for card (e.g. 'card-secret')
    color: str = '#111111'                 # Accent color for auto-generated cards
    icon: str = '🎮'                        # Emoji or icon symbol
    aliases: List[str] = field(default_factory=list)  # Legacy or alternate URL routes
    show_on_portal: bool = True            # Whether to display as a card on the landing portal
    has_cloud_save: bool = False
    has_leaderboard: bool = False
    card_template: Optional[str] = None    # Path to custom card partial (e.g. 'cards/secret.html')
    min_players: int = 1                   # Minimum required players to start
    max_players: int = 10                  # Maximum room capacity
    default_settings: Dict[str, Any] = field(default_factory=dict)  # Standard game options

    def to_dict(self) -> Dict[str, Any]:
        """Serializes manifest to dictionary for JSON/template consumption."""
        return asdict(self)


_REGISTRY: Dict[str, GameManifest] = {}


def register_game(manifest: GameManifest) -> None:
    """Registers a game manifest into the central registry."""
    _REGISTRY[manifest.id] = manifest


def get_game(game_id: str) -> Optional[GameManifest]:
    """Retrieves a game manifest by ID."""
    return _REGISTRY.get(game_id)


def get_game_by_path(path: str) -> Optional[GameManifest]:
    """Resolves active GameManifest from current request URL path."""
    if not path:
        return None
    clean = path.strip()
    for g in _REGISTRY.values():
        if g.route_prefix and (clean == g.route_prefix or clean.startswith(f"{g.route_prefix.rstrip('/')}/")):
            return g
        for alias in g.aliases:
            if clean == alias or clean.startswith(f"{alias.rstrip('/')}/"):
                return g
    return None


def get_all_games() -> List[GameManifest]:
    """Returns all registered game manifests in registration order."""
    return list(_REGISTRY.values())


def clear_registry() -> None:
    """Clears the registry (mainly for testing)."""
    _REGISTRY.clear()
