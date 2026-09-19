"""API routes for GameHub cloud saves and leaderboards."""
from flask import Blueprint, jsonify, request, session
from storage import get_storage
from apps.auth.decorators import login_required

api_bp = Blueprint('api_bp', __name__)


@api_bp.route('/save/<game_id>', methods=['GET'])
@login_required
def get_save(game_id: str):
    user_id = session['user_id']
    storage = get_storage()
    state = storage.load_game_state(user_id=user_id, game_id=game_id)
    return jsonify({'success': True, 'game_id': game_id, 'state': state})


@api_bp.route('/save/<game_id>', methods=['POST'])
@login_required
def post_save(game_id: str):
    user_id = session['user_id']
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'success': False, 'error': 'Invalid JSON body'}), 400

    # Accept either {"state": {...}} or direct state dict
    state_data = data.get('state', data) if isinstance(data, dict) else {}

    storage = get_storage()
    storage.save_game_state(user_id=user_id, game_id=game_id, state_data=state_data)
    return jsonify({'success': True, 'game_id': game_id})


@api_bp.route('/stats/<game_id>', methods=['GET'])
@login_required
def get_user_stats(game_id: str):
    user_id = session['user_id']
    storage = get_storage()
    stats = storage.get_stats(user_id=user_id, game_id=game_id)
    return jsonify({'success': True, 'game_id': game_id, 'stats': stats})


@api_bp.route('/leaderboard/<game_id>', methods=['GET'])
def get_leaderboard(game_id: str):
    metric = request.args.get('metric', 'wins')
    try:
        limit = int(request.args.get('limit', 10))
    except ValueError:
        limit = 10

    storage = get_storage()
    leaderboard = storage.get_leaderboard(game_id=game_id, metric=metric, limit=limit)
    return jsonify({'success': True, 'game_id': game_id, 'metric': metric, 'leaderboard': leaderboard})
