"""Serves the built game files (JS, CSS, manifest, service worker) under
/tiefenfeuer/<file>, so the whole game lives in this one folder.
The page itself (/tiefenfeuer/) is rendered by the singleplayer auto-route."""
import os
from flask import Blueprint, abort, send_from_directory

STATIC_DIR = os.path.join(os.path.dirname(__file__), 'static')

tiefenfeuer_bp = Blueprint('tiefenfeuer_bp', __name__, url_prefix='/tiefenfeuer')


@tiefenfeuer_bp.route('/<path:filename>')
def game_file(filename: str):
    if not os.path.isfile(os.path.join(STATIC_DIR, filename)):
        abort(404)
    response = send_from_directory(STATIC_DIR, filename)
    if filename == 'sw.js':
        response.headers['Cache-Control'] = 'no-cache'
    return response
