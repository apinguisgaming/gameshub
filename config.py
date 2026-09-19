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
    Path('/home/gameshub').exists() or
    (Path('/home').exists() and Path('/var/www').exists())
)

def _apply_proxy():
    if IS_PYTHONANYWHERE:
        proxy_url = 'http://proxy.server:3128'
        os.environ['http_proxy'] = proxy_url
        os.environ['https_proxy'] = proxy_url
        os.environ['HTTP_PROXY'] = proxy_url
        os.environ['HTTPS_PROXY'] = proxy_url

_apply_proxy()

import sys
import glob

# Ensure user-level site-packages are loaded in WSGI environments
home_local_site = Path.home() / '.local' / 'lib'
if home_local_site.exists():
    for p in glob.glob(str(home_local_site / 'python*' / 'site-packages')):
        if p not in sys.path:
            sys.path.insert(0, p)

_cached_pusher = None

class DummyPusher:
    def __init__(self, error=None):
        self.error = error

    def trigger(self, channel, event, data):
        return None

def get_pusher_client():
    """Initializes and returns a Pusher client or a safe fallback if unavailable."""
    global _cached_pusher
    if _cached_pusher is not None and not isinstance(_cached_pusher, DummyPusher):
        return _cached_pusher

    _apply_proxy()
    try:
        import pusher
        kwargs = {
            'app_id': PUSHER_APP_ID,
            'key': PUSHER_KEY,
            'secret': PUSHER_SECRET,
            'cluster': PUSHER_CLUSTER,
            'ssl': True
        }
        if IS_PYTHONANYWHERE:
            kwargs['proxies'] = {
                'http': 'http://proxy.server:3128',
                'https': 'http://proxy.server:3128'
            }
        client = pusher.Pusher(**kwargs)
        _cached_pusher = client
        return _cached_pusher
    except Exception as e:
        import logging
        err_msg = f"{type(e).__name__}: {e}"
        logging.warning(f"[config] Could not initialize Pusher client: {err_msg}")
        return DummyPusher(error=err_msg)
