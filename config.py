import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent

# Auto-load .env file if present
_env_file = BASE_DIR / '.env'
if _env_file.exists():
    try:
        with open(_env_file, 'r', encoding='utf-8') as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    _k = _k.strip()
                    _v = _v.strip().strip('"').strip("'")
                    if _k and _k not in os.environ:
                        os.environ[_k] = _v
    except Exception:
        pass

DATA_DIR = Path(os.environ.get('DATA_DIR', BASE_DIR / 'data'))
STATIC_DIR = BASE_DIR / 'static'
TEMPLATES_DIR = BASE_DIR / 'templates'

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Application Security
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    import warnings
    warnings.warn("SECRET_KEY not set! Using dev fallback key.", stacklevel=2)
    SECRET_KEY = 'dev-secret-key-change-in-production'

# Storage Configuration
STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'sqlite')

# Pusher Configuration — load from environment variables
PUSHER_APP_ID = os.environ.get('PUSHER_APP_ID', '')
PUSHER_KEY = os.environ.get('PUSHER_KEY', '')
PUSHER_SECRET = os.environ.get('PUSHER_SECRET', '')
PUSHER_CLUSTER = os.environ.get('PUSHER_CLUSTER', 'eu')

# Google Maps Platform Configuration
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')


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

    def authenticate(self, channel, socket_id, custom_data=None):
        import json
        return {
            'auth': f'dummy_key:dummy_signature_{socket_id}',
            'channel_data': json.dumps(custom_data) if custom_data else None
        }

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
