import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('DATA_DIR', BASE_DIR / 'data'))
STATIC_DIR = BASE_DIR / 'static'
TEMPLATES_DIR = BASE_DIR / 'templates'

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Application Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'super_secret_key_change_this_later')

# Storage Configuration
STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'sqlite')
MONGODB_URI = os.environ.get('MONGODB_URI', '')

# Pusher Configuration
PUSHER_APP_ID = os.environ.get('PUSHER_APP_ID', '2087525')
PUSHER_KEY = os.environ.get('PUSHER_KEY', 'c70b0b1879d5918e3996')
PUSHER_SECRET = os.environ.get('PUSHER_SECRET', 'f5251bcb6332cef94ddb')
PUSHER_CLUSTER = os.environ.get('PUSHER_CLUSTER', 'eu')

# Detect PythonAnywhere environment and configure outbound proxy
IS_PYTHONANYWHERE = bool(
    os.environ.get('PYTHONANYWHERE_DOMAIN') or 
    os.environ.get('PYTHONANYWHERE_SITE') or 
    Path('/etc/pythonanywhere').exists() or
    (Path('/home').exists() and Path('/var/www').exists())
)

if IS_PYTHONANYWHERE:
    proxy_url = 'http://proxy.server:3128'
    os.environ.setdefault('http_proxy', proxy_url)
    os.environ.setdefault('https_proxy', proxy_url)
    os.environ.setdefault('HTTP_PROXY', proxy_url)
    os.environ.setdefault('HTTPS_PROXY', proxy_url)

def get_pusher_client():
    """Initializes and returns a Pusher client or a safe fallback if unavailable."""
    try:
        import pusher
        return pusher.Pusher(
            app_id=PUSHER_APP_ID,
            key=PUSHER_KEY,
            secret=PUSHER_SECRET,
            cluster=PUSHER_CLUSTER,
            ssl=True
        )
    except Exception as e:
        class DummyPusher:
            def trigger(self, channel, event, data):
                pass
        return DummyPusher()
