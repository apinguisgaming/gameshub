"""Flask application entry point for GameHub platform."""
import logging
import os
from flask import Flask, render_template, session, request, jsonify, send_from_directory
from jinja2 import ChoiceLoader, FileSystemLoader
from config import SECRET_KEY, PUSHER_KEY, PUSHER_CLUSTER, GOOGLE_MAPS_API_KEY, get_pusher_client
from storage import get_storage
from apps.auth.routes import auth_bp
from apps.auth.decorators import login_required
from apps.api.routes import api_bp
from games import init_games_registry

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder=None)
app.secret_key = SECRET_KEY
app.json.sort_keys = False

# Configure unified Jinja template search across root templates/ and all games/*/templates/
games_dir = os.path.join(app.root_path, 'games')
game_template_dirs = [
    os.path.join(games_dir, g, 'templates')
    for g in os.listdir(games_dir)
    if os.path.isdir(os.path.join(games_dir, g, 'templates'))
] if os.path.isdir(games_dir) else []

app.jinja_loader = ChoiceLoader([
    FileSystemLoader(os.path.join(app.root_path, 'templates')),
    FileSystemLoader(game_template_dirs),
])

# Run session cleanup on startup
with app.app_context():
    try:
        storage = get_storage()
        cleaned = storage.cleanup_expired_sessions(30)
        if cleaned:
            logger.info(f"Cleaned {cleaned} expired session tokens on startup")
    except Exception as e:
        logger.warning(f"Session cleanup skipped: {e}")

# ==========================================
#         STATIC FILE SERVING
# ==========================================
@app.route('/static/<path:filename>', endpoint='static')
def serve_static(filename: str):
    """Serves static files from root static/ or colocated games/<id>/static/ packages."""
    static_root = os.path.join(app.root_path, 'static')
    root_file = os.path.join(static_root, filename)
    if os.path.isfile(root_file):
        return send_from_directory(static_root, filename)

    parts = filename.split('/', 1)
    if len(parts) == 2:
        game_id, rel_path = parts
        game_static = os.path.join(app.root_path, 'games', game_id, 'static')
        game_file = os.path.join(game_static, rel_path)
        if os.path.isfile(game_file):
            return send_from_directory(game_static, rel_path)

    return send_from_directory(static_root, filename)

# ==========================================
#         CORE BLUEPRINT REGISTRATION
# ==========================================
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')

# ==========================================
#       PUSHER CHANNEL AUTHENTICATION
# ==========================================
@app.route('/pusher/auth', methods=['POST'])
def pusher_auth():
    """Authenticates clients for Pusher Presence and Private channels."""
    from apps.auth.decorators import get_current_user
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 403

    socket_id = request.form.get('socket_id')
    channel_name = request.form.get('channel_name')

    if not socket_id or not channel_name:
        return jsonify({'error': 'Missing socket_id or channel_name'}), 400

    client = get_pusher_client()
    try:
        custom_data = {
            'user_id': str(user['id']),
            'user_info': {
                'username': user['username'],
                'avatar': user.get('avatar', 'default')
            }
        }
        auth = client.authenticate(
            channel=channel_name,
            socket_id=socket_id,
            custom_data=custom_data
        )
        return jsonify(auth)
    except Exception as e:
        logger.error(f"[Pusher Auth Error] channel={channel_name}: {e}")
        return jsonify({'error': 'Authentication failed'}), 500

# ==========================================
#       REQUEST AUTHENTICATION HOOK
# ==========================================
@app.before_request
def authenticate_request():
    """Resolves user for the current request (session token or cookie)."""
    from apps.auth.decorators import resolve_user_for_request
    resolve_user_for_request()

# ==========================================
#       GLOBAL TEMPLATE CONTEXT
# ==========================================
def card_template_exists(game_id: str) -> bool:
    """Checks if a handcrafted card template exists for the game."""
    cards_dir = os.path.join(app.root_path, 'templates', 'cards')
    if os.path.isfile(os.path.join(cards_dir, f"{game_id}.html")):
        return True
    game_card = os.path.join(app.root_path, 'games', game_id, 'templates', 'card.html')
    return os.path.isfile(game_card)

@app.context_processor
def inject_global_context():
    """Injects user authentication profile, active token, Pusher settings, active game manifest, and games registry into all templates."""
    from apps.auth.decorators import get_current_user, get_current_token
    from engine.registry import get_all_games, get_game_by_path
    active_manifest = get_game_by_path(request.path)
    return {
        'current_user': get_current_user(),
        'auth_token': get_current_token(),
        'pusher_key': PUSHER_KEY,
        'pusher_cluster': PUSHER_CLUSTER,
        'google_maps_key': GOOGLE_MAPS_API_KEY,
        'registered_games': [g for g in get_all_games() if g.show_on_portal],
        'card_template_exists': card_template_exists,
        'active_game_manifest': active_manifest,
    }


# ==========================================
#       PORTAL & GAME INITIALIZATION
# ==========================================

@app.route('/')
def portal():
    """Central GameHub landing portal (public, displays login modal if unauthenticated)."""
    return render_template('landing.html')


# Auto-discover colocated games, register manifests and blueprints
init_games_registry(app)


@app.teardown_appcontext
def close_db_connection(exception=None):
    """Closes request-scoped pooled SQLite connection."""
    from flask import g
    conn = getattr(g, '_db_conn', None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)