"""Singleplayer game route auto-registrator for GameHub.

Registers standard game routes, aliases, and templates dynamically, eliminating
repetitive boilerplate functions in flask_app.py.
"""
import os
from typing import List, Optional, Union
from flask import Flask, render_template
from apps.auth.decorators import login_required
from apps.common.registry import GameManifest, get_all_games


def register_singleplayer_routes(app: Flask, manifests: Optional[List[GameManifest]] = None) -> None:
    """Registers routes for singleplayer games based on their manifests.
    
    If manifests is None, it scans all registered games from the registry
    where game_type == 'singleplayer'.
    """
    if manifests is None:
        manifests = [g for g in get_all_games() if g.game_type == 'singleplayer']

    for manifest in manifests:
        if not manifest.route_prefix:
            continue

        _register_single_game(app, manifest)


def _register_single_game(app: Flask, manifest: GameManifest) -> None:
    endpoint_name = f"game_{manifest.id}"
    
    route = manifest.route_prefix
    if not route.endswith('/'):
        route = route + '/'

    def view_func(target_manifest=manifest):
        tpl = target_manifest.template
        if tpl:
            folder = app.template_folder
            if not os.path.isabs(folder):
                folder = os.path.join(app.root_path, folder)
            tpl_path = os.path.join(folder, tpl)
            if os.path.isfile(tpl_path):
                return render_template(tpl, game=target_manifest)
        return render_template('game_shell.html', game=target_manifest)

    # Apply login_required decorator
    protected_view = login_required(view_func)
    protected_view.__name__ = endpoint_name

    # Register primary route
    app.add_url_rule(route, endpoint=endpoint_name, view_func=protected_view, strict_slashes=False)

    # Register all aliases
    for idx, alias in enumerate(manifest.aliases):
        alias_endpoint = f"{endpoint_name}_alias_{idx}"
        app.add_url_rule(alias, endpoint=alias_endpoint, view_func=protected_view, strict_slashes=False)
