"""Flask application entry point for GameHub platform."""
import logging
import os
from flask import Flask, render_template, session, request, jsonify
from config import SECRET_KEY, PUSHER_KEY, PUSHER_CLUSTER, GOOGLE_MAPS_API_KEY, get_pusher_client
from storage import get_storage
from apps.auth.routes import auth_bp
from apps.auth.decorators import login_required
from apps.api.routes import api_bp
from apps.secret.routes import secret_bp
from apps.song.routes import song_bp
from apps.geobingo.routes import geobingo_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.json.sort_keys = False

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
#         BLUEPRINT REGISTRATION
# ==========================================
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(secret_bp, url_prefix='/secret')
app.register_blueprint(song_bp, url_prefix='/song')
app.register_blueprint(geobingo_bp, url_prefix='/geobingo')

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
    cards_dir = os.path.join(app.template_folder, 'cards')
    return os.path.isfile(os.path.join(cards_dir, f"{game_id}.html"))

@app.context_processor
def inject_global_context():
    """Injects user authentication profile, active token, Pusher settings, and games registry into all templates."""
    from apps.auth.decorators import get_current_user, get_current_token
    from apps.common.registry import get_all_games
    return {
        'current_user': get_current_user(),
        'auth_token': get_current_token(),
        'pusher_key': PUSHER_KEY,
        'pusher_cluster': PUSHER_CLUSTER,
        'google_maps_key': GOOGLE_MAPS_API_KEY,
        'registered_games': [g for g in get_all_games() if g.show_on_portal],
        'card_template_exists': card_template_exists,
    }


# ==========================================
#       PORTAL & DYNAMIC GAME ROUTES
# ==========================================

@app.route('/')
def portal():
    """Central GameHub landing portal (public, displays login modal if unauthenticated)."""
    return render_template('landing.html')

# Initialize game registry and auto-register singleplayer routes
from apps.games import init_games_registry
from apps.common.singleplayer import register_singleplayer_routes

init_games_registry()
register_singleplayer_routes(app)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)