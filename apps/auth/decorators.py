"""Authentication decorators and request identity resolvers for GameHub."""
from functools import wraps
import threading
import time
from flask import session, redirect, request, jsonify
from storage import get_storage

_CACHE_LOCK = threading.Lock()
_TOKEN_CACHE = {}  # token_str -> (user_dict, expires_at)
_USER_CACHE = {}   # user_id -> (user_dict, expires_at)
TOKEN_CACHE_TTL = 60.0


def invalidate_auth_cache(user_id=None, token=None):
    """Invalidates cached authentication identities."""
    with _CACHE_LOCK:
        if token and token in _TOKEN_CACHE:
            _TOKEN_CACHE.pop(token, None)
        if user_id and user_id in _USER_CACHE:
            _USER_CACHE.pop(user_id, None)
        if not user_id and not token:
            _TOKEN_CACHE.clear()
            _USER_CACHE.clear()


def resolve_user_for_request():
    """Resolves authenticated user from session token or session cookie.
    
    Checks in order:
    1. HTTP header 'X-Auth-Token'
    2. Query param '?token='
    3. Form or JSON body 'token'
    4. Session cookie 'user_id'
    
    Attaches `request.current_user` and `request.auth_token`.
    """
    token = request.headers.get('X-Auth-Token')
    if not token:
        token = request.args.get('token')
    if not token and request.form:
        token = request.form.get('token')
    if not token and request.is_json:
        try:
            data = request.get_json(silent=True)
            if isinstance(data, dict):
                token = data.get('token')
        except Exception:
            token = None

    storage = get_storage()
    now = time.time()

    # 1. Validate Session Token (Multi-Tab Isolation)
    if token:
        token_str = str(token).strip()
        user = None
        with _CACHE_LOCK:
            cached = _TOKEN_CACHE.get(token_str)
            if cached and cached[1] > now:
                user = cached[0]

        if not user:
            user = storage.get_user_by_token(token_str)
            if user:
                with _CACHE_LOCK:
                    _TOKEN_CACHE[token_str] = (user, now + TOKEN_CACHE_TTL)

        if user:
            request.current_user = user
            request.auth_token = token_str
            return user

    # 2. Fallback to Flask Session Cookie
    user_id = session.get('user_id')
    if user_id:
        user = None
        with _CACHE_LOCK:
            cached = _USER_CACHE.get(user_id)
            if cached and cached[1] > now:
                user = cached[0]

        if not user:
            user = storage.get_user_by_id(user_id)
            if user:
                with _CACHE_LOCK:
                    _USER_CACHE[user_id] = (user, now + TOKEN_CACHE_TTL)

        if user:
            request.current_user = user
            request.auth_token = None
            return user

    request.current_user = None
    request.auth_token = None
    return None


def get_current_user():
    """Returns the authenticated user for the current request context."""
    if not hasattr(request, 'current_user'):
        return resolve_user_for_request()
    return request.current_user


def get_current_token():
    """Returns the active session token if any."""
    if not hasattr(request, 'auth_token'):
        resolve_user_for_request()
    return getattr(request, 'auth_token', None)


def login_required(f):
    """Ensures user is authenticated before accessing a route.
    
    Supports both token-based and cookie-based authentication.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            if request.path.startswith('/api/') or request.is_json:
                return jsonify({'error': 'unauthorized', 'message': 'Bitte einloggen'}), 401
            return redirect(f'/?next={request.path}&login=1')
        return f(*args, **kwargs)
    return decorated_function
