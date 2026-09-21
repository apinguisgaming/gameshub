from flask import Blueprint, render_template
from apps.auth.decorators import login_required
from engine.registry import get_game

gothic_bp = Blueprint('gothic_bp', __name__, url_prefix='/gothic-survivors')

@gothic_bp.route('/creator')
@login_required
def creator():
    manifest = get_game('gothic_survivors')
    return render_template('gothic_survivors_creator.html', game=manifest)
