from flask import Blueprint, render_template
from apps.auth.decorators import login_required
from .manifest import MANIFEST

bp = Blueprint('pokemon_tower_bp', __name__)

@bp.route('/editor')
@login_required
def editor_view():
    return render_template('editor.html')

__all__ = ['MANIFEST', 'bp']
