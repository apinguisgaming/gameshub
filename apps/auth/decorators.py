"""Authentication decorators for GameHub."""
from functools import wraps
from flask import session, redirect, request


def login_required(f):
    """Ensures user has an active session before accessing a route.
    
    If unauthenticated, redirects to the portal with `?login=1&next=<path>`
    so the login modal automatically opens on the landing page.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # If requesting via AJAX/JSON API, return 401 instead of redirect
            if request.path.startswith('/api/') or request.is_json:
                from flask import jsonify
                return jsonify({'error': 'unauthorized', 'message': 'Bitte einloggen'}), 401
            return redirect(f'/?next={request.path}&login=1')
        return f(*args, **kwargs)
    return decorated_function
