"""Flask application entry point for GameHub platform."""
import logging
from flask import Flask, render_template, session
from config import SECRET_KEY, PUSHER_KEY, PUSHER_CLUSTER
from storage import get_storage
from apps.auth.routes import auth_bp
from apps.auth.decorators import login_required
from apps.api.routes import api_bp
from apps.secret.routes import secret_bp
from apps.song.routes import song_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.json.sort_keys = False

# ==========================================
#         BLUEPRINT REGISTRATION
# ==========================================
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(secret_bp, url_prefix='/secret')
app.register_blueprint(song_bp, url_prefix='/song')

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
@app.context_processor
def inject_global_context():
    """Injects user authentication profile, active token, and Pusher settings into all templates."""
    from apps.auth.decorators import get_current_user, get_current_token
    return {
        'current_user': get_current_user(),
        'auth_token': get_current_token(),
        'pusher_key': PUSHER_KEY,
        'pusher_cluster': PUSHER_CLUSTER,
    }

# ==========================================
#       PORTAL & CLIENT-SIDE GAMES
# ==========================================

@app.route('/')
def portal():
    """Central GameHub landing portal (public, displays login modal if unauthenticated)."""
    return render_template('landing.html')

@app.route('/imposter/')
@login_required
def imposter():
    return render_template('imposter.html')

@app.route('/songseeker/')
@login_required
def songseeker():
    return render_template('songseeker.html')

@app.route('/survivors/')
@login_required
def survivors():
    return render_template('survivors.html')

@app.route('/survivors/creator/')
@login_required
def survivors_creator():
    return render_template('survivors_creator.html')

@app.route('/nexusdex/')
@app.route('/site3/')  # Backwards compatibility
@login_required
def nexusdex():
    return render_template('nexusdex.html')

@app.route('/tower/')
@app.route('/site4/')  # Backwards compatibility
@login_required
def tower():
    return render_template('tower.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)