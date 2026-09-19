"""Authentication module for GameHub."""
from .routes import auth_bp
from .decorators import login_required

__all__ = ['auth_bp', 'login_required']
