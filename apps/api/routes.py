"""API routes for GameHub cloud saves and leaderboards."""
from flask import Blueprint, jsonify, request, session
from storage import get_storage
from apps.auth.decorators import login_required, get_current_user

api_bp = Blueprint('api_bp', __name__)


@api_bp.route('/save/<game_id>', methods=['GET'])
@login_required
def get_save(game_id: str):
    user = get_current_user()
    user_id = user['id']
    storage = get_storage()
    state = storage.load_game_state(user_id=user_id, game_id=game_id)
    return jsonify({'success': True, 'game_id': game_id, 'state': state})


@api_bp.route('/save/<game_id>', methods=['POST'])
@login_required
def post_save(game_id: str):
    user = get_current_user()
    user_id = user['id']
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
    user = get_current_user()
    user_id = user['id']
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


@api_bp.route('/logs/maps', methods=['POST'])
def log_maps():
    """Logs a Google Maps API request with mandatory user attribution."""
    from apps.common.maps_logger import record_maps_request

    data = request.get_json(silent=True) or {}
    storage = get_storage()

    # 1. Resolve authenticated user
    user = get_current_user()
    if not user:
        token = data.get('token') or request.headers.get('X-Auth-Token')
        if token:
            user = storage.get_user_by_token(str(token).strip())

    if user:
        username = user['username']
        user_id = user['id']
    else:
        # Fallback: check if valid username is explicitly passed
        candidate = data.get('username')
        if candidate and isinstance(candidate, str) and candidate.strip():
            username = candidate.strip()
            db_user = storage.get_user_by_username(username)
            user_id = db_user['id'] if db_user else None
        else:
            return jsonify({'success': False, 'error': 'Unauthorized: UserName is required'}), 401

    # 2. Check if user or IP is actively blocked
    from apps.common.maps_logger import extract_client_ip, log_maps_penalty
    ip_address = extract_client_ip(request)
    penalty = storage.check_maps_penalty(username=username, ip_address=ip_address)
    if penalty['blocked']:
        return jsonify({
            'success': False,
            'error': 'rate_limited',
            'is_permanent': penalty['is_permanent'],
            'strike_count': penalty['strike_count'],
            'cooldown_seconds': penalty['remaining_seconds'],
            'message': 'Kartenaufrufe temporär oder dauerhaft gesperrt.'
        }), 429

    page = data.get('page') or request.referrer or '/geobingo/'
    action = data.get('action') or 'map_load'
    details = data.get('details') if isinstance(data.get('details'), dict) else {}

    result = record_maps_request(
        req=request,
        username=username,
        page=page,
        user_id=user_id,
        action=action,
        details=details
    )
    return jsonify(result), 200


@api_bp.route('/logs/maps/check', methods=['GET', 'POST'])
def check_maps_access():
    """Pre-check endpoint for Google Maps access with smart rate-limiting and cascade protection."""
    from apps.common.maps_logger import extract_client_ip, log_maps_penalty
    storage = get_storage()
    ip_address = extract_client_ip(request)

    data = (request.get_json(silent=True) or {}) if request.is_json else (request.args.to_dict() or {})

    # Resolve user
    user = get_current_user()
    if not user:
        token = data.get('token') or request.headers.get('X-Auth-Token') or request.args.get('token')
        if token:
            user = storage.get_user_by_token(str(token).strip())

    if user:
        username = user['username']
    else:
        candidate = data.get('username') or request.args.get('username')
        if candidate and isinstance(candidate, str) and candidate.strip():
            username = candidate.strip()
        else:
            username = 'guest_' + ip_address.replace('.', '_').replace(':', '_')

    # 1. Check existing active penalty
    penalty = storage.check_maps_penalty(username=username, ip_address=ip_address)
    if penalty['blocked']:
        if penalty['is_permanent']:
            return jsonify({
                'allowed': False,
                'error': 'permanently_blocked',
                'is_permanent': True,
                'strike_count': penalty['strike_count'],
                'message': 'Dein Zugang zu Google Maps wurde aufgrund wiederholten Spams dauerhaft gesperrt. Bitte kontaktiere einen Administrator.'
            }), 429
        else:
            return jsonify({
                'allowed': False,
                'error': 'rate_limited',
                'is_permanent': False,
                'strike_count': penalty['strike_count'],
                'cooldown_seconds': penalty['remaining_seconds'],
                'message': f"Zu viele Kartenaufrufe (Stufe {penalty['strike_count']}/4). Bitte warte {penalty['remaining_seconds']} Sekunden."
            }), 429

    # 2. Cascade protection: only count requests occurring AFTER the last strike
    last_strike_at = penalty.get('last_strike_at')
    activity = storage.count_recent_maps_activity(
        username=username,
        ip_address=ip_address,
        after_timestamp=last_strike_at,
        window_seconds=300
    )

    # 3. Smart Trigger:
    # >= 3 full SDK reloads in 5 min (F5 spam), OR > 8 total actions in 5 min
    sdk_inits = activity['sdk_inits']
    total = activity['total_requests']

    if sdk_inits >= 3 or total > 8:
        reason = f"F5-Reload-Spam ({sdk_inits} SDK-Inits in 5m)" if sdk_inits >= 3 else f"Exzessive Aktionen ({total} Aufrufe in 5m)"
        strike_result = storage.record_maps_penalty_strike(username=username, ip_address=ip_address, reason=reason)
        strike_num = strike_result['strike_count']
        duration = strike_result['duration_seconds']
        dur_str = f"{duration}s" if duration > 0 else "permanent"

        log_maps_penalty(
            username=username,
            ip_address=ip_address,
            strike=strike_num,
            duration_str=dur_str,
            reason=reason
        )

        if strike_result['is_permanent']:
            return jsonify({
                'allowed': False,
                'error': 'permanently_blocked',
                'is_permanent': True,
                'strike_count': strike_num,
                'message': 'Dein Zugang zu Google Maps wurde aufgrund wiederholten Spams dauerhaft gesperrt. Bitte kontaktiere einen Administrator.'
            }), 429
        else:
            return jsonify({
                'allowed': False,
                'error': 'rate_limited',
                'is_permanent': False,
                'strike_count': strike_num,
                'cooldown_seconds': duration,
                'message': f"Zu viele Kartenaufrufe (Stufe {strike_num}/4). Bitte warte {duration} Sekunden."
            }), 429

    return jsonify({'allowed': True, 'strike_count': penalty.get('strike_count', 0)}), 200


@api_bp.route('/logs/maps', methods=['GET'])
@login_required
def get_maps_api_logs():
    """Retrieves recent Google Maps API request logs (authenticated users/admins)."""
    storage = get_storage()
    username = request.args.get('username')
    try:
        limit = int(request.args.get('limit', 100))
    except (ValueError, TypeError):
        limit = 100

    logs = storage.get_maps_logs(limit=limit, username=username)
    return jsonify({'success': True, 'logs': logs, 'count': len(logs)})


