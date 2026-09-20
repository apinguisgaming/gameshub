"""Authentication routes for GameHub."""
import re
import time
from typing import Dict, Tuple
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash
from storage import get_storage

auth_bp = Blueprint('auth_bp', __name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 60.0
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_-]{2,16}$')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or request.form
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    avatar = (data.get('avatar') or 'avatar_1').strip()

    if not USERNAME_REGEX.match(username):
        return jsonify({
            'success': False,
            'error': 'Benutzername muss 2-16 Zeichen lang sein (Buchstaben, Zahlen, _, -).'
        }), 400

    if len(password) < 4:
        return jsonify({
            'success': False,
            'error': 'Passwort muss mindestens 4 Zeichen lang sein.'
        }), 400

    storage = get_storage()
    existing = storage.get_user_by_username(username)
    if existing:
        return jsonify({
            'success': False,
            'error': 'Dieser Benutzername ist bereits vergeben.'
        }), 409

    pw_hash = generate_password_hash(password)
    try:
        user_id = storage.create_user(username=username, password_hash=pw_hash, avatar=avatar)
    except Exception as e:
        return jsonify({'success': False, 'error': 'Registrierung fehlgeschlagen.'}), 500

    token = storage.create_session_token(user_id)
    session['user_id'] = user_id
    session.permanent = True

    return jsonify({
        'success': True,
        'token': token,
        'user': {
            'id': user_id,
            'username': username,
            'avatar': avatar
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    ip = request.remote_addr or 'unknown'
    storage = get_storage()

    if storage.count_recent_failures(ip, LOCKOUT_WINDOW_SECONDS) >= MAX_FAILED_ATTEMPTS:
        return jsonify({
            'success': False,
            'error': 'Zu viele Fehlversuche. Bitte versuche es in einer Minute erneut.'
        }), 429

    data = request.get_json(silent=True) or request.form
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'success': False, 'error': 'Benutzername und Passwort angeben.'}), 400

    user = storage.get_user_by_username(username)

    if not user or not check_password_hash(user['password_hash'], password):
        storage.record_failed_login(ip)
        return jsonify({'success': False, 'error': 'Ungültiger Benutzername oder falsches Passwort.'}), 401

    storage.clear_failed_logins(ip)
    storage.update_user(user['id'], last_login=time.strftime('%Y-%m-%d %H:%M:%S'))

    token = storage.create_session_token(user['id'])
    session['user_id'] = user['id']
    session.permanent = True

    return jsonify({
        'success': True,
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'avatar': user.get('avatar', 'default')
        }
    })


@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    from apps.auth.decorators import get_current_token
    token = get_current_token() or request.headers.get('X-Auth-Token') or request.args.get('token')
    if token:
        try:
            token_user = get_storage().get_user_by_token(token)
            get_storage().delete_session_token(token)
            # Only clear the shared cookie if it actually belongs to this user
            if token_user and session.get('user_id') == token_user['id']:
                session.clear()
        except Exception:
            pass
    else:
        session.clear()
    return jsonify({'success': True})


@auth_bp.route('/me', methods=['GET'])
def me():
    from apps.auth.decorators import get_current_user
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False, 'user': None})

    return jsonify({
        'authenticated': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'avatar': user.get('avatar', 'default'),
            'created_at': user.get('created_at')
        }
    })
