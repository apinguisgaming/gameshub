"""Authentication decorators and request identity resolvers for GameHub."""
from functools import wraps
from flask import session, redirect, request, jsonify
from storage import get_storage


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

    # 1. Validate Session Token (Multi-Tab Isolation)
    if token:
        token_str = str(token).strip()
        user = storage.get_user_by_token(token_str)
        if user:
            request.current_user = user
            request.auth_token = token_str
            return user

    # 2. Fallback to Flask Session Cookie
    user_id = session.get('user_id')
    if user_id:
        user = storage.get_user_by_id(user_id)
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
