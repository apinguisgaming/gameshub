"""Comprehensive automated verification suite for GameHub platform."""
import json
import os
import sys
import unittest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask_app import app
from storage import get_storage
import config


class GameHubPlatformTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        """Clean up test lobbies and heartbeats so database remains pristine."""
        storage = get_storage()
        with storage._get_conn() as conn:
            conn.execute("DELETE FROM game_lobbies")
            conn.execute("DELETE FROM player_heartbeats")
            conn.execute("DELETE FROM maps_penalties")

    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.storage = get_storage()

    def test_01_database_tables_exist(self):
        """Verify that SQLite database is initialized with required tables."""
        with self.storage._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = {row['name'] for row in cur.fetchall()}
            expected = {'users', 'user_game_saves', 'game_lobbies', 'game_stats'}
            self.assertTrue(expected.issubset(tables), f"Missing tables: {expected - tables}")
        print("[OK] 01: Database tables verified")

    def test_02_auth_flow(self):
        """Verify user registration, login, session /me check, and logout."""
        username = "TestGamer_99"
        password = "SecurePassword123"

        # 1. Register
        res = self.client.post('/api/auth/register', json={
            'username': username,
            'password': password,
            'avatar': 'avatar_5'
        })
        self.assertIn(res.status_code, [201, 409]) # 201 created or 409 already registered

        # 2. Login
        res = self.client.post('/api/auth/login', json={
            'username': username,
            'password': password
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['user']['username'], username)

        # 3. Check /me with active session
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.status_code, 200)
        me_data = res.get_json()
        self.assertTrue(me_data['authenticated'])
        self.assertEqual(me_data['user']['username'], username)

        # 4. Logout
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 200)

        # 5. Check /me after logout
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.get_json()['authenticated'])
        print("[OK] 02: Auth flow verified")
    def test_03_auth_gate_redirects(self):
        """Verify unauthenticated users get redirected to portal with ?login=1."""
        protected_routes = [
            '/secret/',
            '/song/',
            '/imposter/',
            '/tower/',
            '/survivors/',
            '/nexusdex/',
            '/songseeker/'
        ]

        # Use clean client without session
        clean_client = self.app.test_client()
        for r in protected_routes:
            res = clean_client.get(r)
            self.assertEqual(res.status_code, 302, f"Route {r} did not redirect unauthenticated user")
            self.assertIn('login=1', res.headers['Location'])
            self.assertIn(f'next={r}', res.headers['Location'])

        print("[OK] 03: Auth gate redirection verified")

    def test_04_authenticated_game_access(self):
        """Verify authenticated user can load all game templates."""
        # Login first
        self.client.post('/api/auth/register', json={'username': 'Gamer1', 'password': 'pass'})
        self.client.post('/api/auth/login', json={'username': 'Gamer1', 'password': 'pass'})

        routes = [
            '/',
            '/secret/',
            '/song/',
            '/imposter/',
            '/tower/',
            '/survivors/',
            '/nexusdex/',
            '/songseeker/'
        ]

        for r in routes:
            res = self.client.get(r)
            self.assertEqual(res.status_code, 200, f"Route {r} returned {res.status_code}")

        print("[OK] 04: Authenticated game access verified")

    def test_05_cloud_save_api(self):
        """Verify cloud save and load endpoints."""
        self.client.post('/api/auth/register', json={'username': 'SaveTester', 'password': 'pass'})
        self.client.post('/api/auth/login', json={'username': 'SaveTester', 'password': 'pass'})

        # Save Tower Defense state
        test_state = {'wave': 12, 'money': 850, 'lives': 15}
        res = self.client.post('/api/save/tower', json={'state': test_state})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()['success'])

        # Load Tower Defense state
        res = self.client.get('/api/save/tower')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['state'], test_state)

        print("[OK] 05: Cloud save API verified")

    def test_06_secret_hitler_multiroom_lifecycle(self):
        """Verify creating, listing, joining, and leaving a Secret Hitler room."""
        # Host login
        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'SH_Host', 'password': 'pass'})
        host_client.post('/api/auth/login', json={'username': 'SH_Host', 'password': 'pass'})

        # 1. Create Room
        res = host_client.post('/secret/create_room')
        self.assertEqual(res.status_code, 200)
        code = res.get_json()['room_code']
        self.assertTrue(len(code) >= 3)

        # 2. List Rooms
        res = host_client.get('/secret/rooms')
        self.assertEqual(res.status_code, 200)
        rooms = res.get_json()['rooms']
        found = any(r['room_code'] == code for r in rooms)
        self.assertTrue(found, f"Room {code} not in list")

        # 3. Player 2 joins
        p2_client = self.app.test_client()
        p2_client.post('/api/auth/register', json={'username': 'SH_Player2', 'password': 'pass'})
        p2_client.post('/api/auth/login', json={'username': 'SH_Player2', 'password': 'pass'})

        res = p2_client.post(f'/secret/{code}/join')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('SH_Player2', data['players'])

        # 4. Host starts game
        res = host_client.post(f'/secret/{code}/start_game')
        self.assertEqual(res.status_code, 200)

        # 5. Leave room
        res = p2_client.post(f'/secret/{code}/leave_game')
        self.assertEqual(res.status_code, 200)

        print("[OK] 06: Secret Hitler multi-room lifecycle verified")

    def test_07_song_guesser_multiroom_lifecycle(self):
        """Verify creating, listing, joining, and leaving a Song Guesser room."""
        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'SG_Host', 'password': 'pass'})
        host_client.post('/api/auth/login', json={'username': 'SG_Host', 'password': 'pass'})

        # 1. Create Room
        res = host_client.post('/song/create_room')
        self.assertEqual(res.status_code, 200)
        code = res.get_json()['room_code']

        # 2. Player 2 joins
        p2_client = self.app.test_client()
        p2_client.post('/api/auth/register', json={'username': 'SG_Player2', 'password': 'pass'})
        p2_client.post('/api/auth/login', json={'username': 'SG_Player2', 'password': 'pass'})

        res = p2_client.post(f'/song/{code}/join')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('SG_Player2', data['players'])

        # 3. Host updates settings (including Plattenkiste accordion toggle)
        res = host_client.post(f'/song/{code}/update_settings', data={'key': 'time_per_song', 'value': '15'})
        self.assertEqual(res.status_code, 200)
        res_pl = host_client.post(f'/song/{code}/update_settings', data={'key': 'playlists_open', 'value': 'true'})
        self.assertEqual(res_pl.status_code, 200)
        self.assertTrue(res_pl.get_json()['settings']['playlists_open'])

        # 4. Leave
        res = p2_client.post(f'/song/{code}/leave_game')
        self.assertEqual(res.status_code, 200)

        print("[OK] 07: Song Guesser multi-room lifecycle verified")

    def test_08_imposter_static_words(self):
        """Verify imposter static words file exists and is valid JSON."""
        words_path = config.STATIC_DIR / 'imposter' / 'words.json'
        self.assertTrue(words_path.exists(), "static/imposter/words.json does not exist")
        with open(words_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.assertTrue(len(data) > 5, "Fewer than 5 word categories found")
        print("[OK] 08: Impostor static words verified")


    def test_09_token_authentication_and_multi_tab_isolation(self):
        """Verify token authentication and multi-tab isolation without cookie collision."""
        # Register two accounts
        self.client.post('/api/auth/register', json={'username': 'TabUserAlpha', 'password': 'Password123!'})
        self.client.post('/api/auth/register', json={'username': 'TabUserBeta', 'password': 'Password123!'})

        # Login TabUserAlpha -> get token Alpha
        res_a = self.client.post('/api/auth/login', json={'username': 'TabUserAlpha', 'password': 'Password123!'})
        self.assertEqual(res_a.status_code, 200)
        token_a = res_a.get_json()['token']
        self.assertTrue(bool(token_a))

        # Login TabUserBeta -> get token Beta
        res_b = self.client.post('/api/auth/login', json={'username': 'TabUserBeta', 'password': 'Password123!'})
        self.assertEqual(res_b.status_code, 200)
        token_b = res_b.get_json()['token']
        self.assertTrue(bool(token_b))
        self.assertNotEqual(token_a, token_b)

        # Tab A calls /api/auth/me using X-Auth-Token
        clean_tab_a = self.app.test_client()
        res_me_a = clean_tab_a.get('/api/auth/me', headers={'X-Auth-Token': token_a})
        self.assertEqual(res_me_a.status_code, 200)
        self.assertEqual(res_me_a.get_json()['user']['username'], 'TabUserAlpha')

        # Tab B calls /api/auth/me using X-Auth-Token
        clean_tab_b = self.app.test_client()
        res_me_b = clean_tab_b.get('/api/auth/me', headers={'X-Auth-Token': token_b})
        self.assertEqual(res_me_b.status_code, 200)
        self.assertEqual(res_me_b.get_json()['user']['username'], 'TabUserBeta')

        # Test query parameter token (?token=...)
        res_param = clean_tab_a.get(f'/tower/?token={token_a}')
        self.assertEqual(res_param.status_code, 200)
        self.assertIn(b'TabUserAlpha', res_param.data)

        res_param_b = clean_tab_b.get(f'/tower/?token={token_b}')
        self.assertEqual(res_param_b.status_code, 200)
        self.assertIn(b'TabUserBeta', res_param_b.data)

        print("[OK] 09: Token auth & multi-tab isolation verified")

    def test_10_user_scoped_cloud_save_isolation(self):
        """Verify user-scoped cloud saves remain completely isolated between users."""
        res_a = self.client.post('/api/auth/login', json={'username': 'TabUserAlpha', 'password': 'Password123!'})
        token_a = res_a.get_json()['token']
        res_b = self.client.post('/api/auth/login', json={'username': 'TabUserBeta', 'password': 'Password123!'})
        token_b = res_b.get_json()['token']

        # Ensure Beta starts with empty save
        beta_client = self.app.test_client()
        beta_client.post('/api/save/tower', headers={'X-Auth-Token': token_b}, json={'state': None})

        # Alpha saves Pokémon Tower progress (Wave 50)
        alpha_client = self.app.test_client()
        res = alpha_client.post('/api/save/tower',
            headers={'X-Auth-Token': token_a},
            json={'state': {'wave': 50, 'pokes': ['Pikachu', 'Charizard']}}
        )
        self.assertEqual(res.status_code, 200)

        # Beta has NOT saved yet -> check Beta's cloud save is empty
        res_beta_empty = beta_client.get('/api/save/tower', headers={'X-Auth-Token': token_b})
        self.assertEqual(res_beta_empty.status_code, 200)
        self.assertIsNone(res_beta_empty.get_json()['state'])

        # Beta saves Pokémon Tower progress (Wave 1)
        res = beta_client.post('/api/save/tower',
            headers={'X-Auth-Token': token_b},
            json={'state': {'wave': 1, 'pokes': ['Bulbasaur']}}
        )
        self.assertEqual(res.status_code, 200)

        # Alpha still has Wave 50
        res_alpha = alpha_client.get('/api/save/tower', headers={'X-Auth-Token': token_a})
        self.assertEqual(res_alpha.get_json()['state']['wave'], 50)

        # Beta still has Wave 1
        res_beta = beta_client.get('/api/save/tower', headers={'X-Auth-Token': token_b})
        self.assertEqual(res_beta.get_json()['state']['wave'], 1)

        print("[OK] 10: User-scoped cloud save isolation verified")

    def test_11_secret_hitler_role_endpoint(self):
        """Verify the get_my_role endpoint returns a valid secret role."""
        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'RoleHost', 'password': 'pass_role_host'})
        login_res = host_client.post('/api/auth/login', json={'username': 'RoleHost', 'password': 'pass_role_host'})
        host_token = login_res.get_json()['token']

        p2_client = self.app.test_client()
        p2_client.post('/api/auth/register', json={'username': 'RolePlayer2', 'password': 'pass_role_p2'})
        p2_login = p2_client.post('/api/auth/login', json={'username': 'RolePlayer2', 'password': 'pass_role_p2'})
        p2_token = p2_login.get_json()['token']

        # Create room
        res_create = host_client.post('/secret/create_room', headers={'X-Auth-Token': host_token})
        room_code = res_create.get_json()['room_code']

        # Join room
        p2_client.post(f'/secret/{room_code}/join', headers={'X-Auth-Token': p2_token})

        # Start game
        res_start = host_client.post(f'/secret/{room_code}/start_game', headers={'X-Auth-Token': host_token})
        self.assertEqual(res_start.status_code, 200)

        # Query my role for host
        res_role = host_client.get(f'/secret/{room_code}/get_my_role', headers={'X-Auth-Token': host_token})
        self.assertEqual(res_role.status_code, 200)
        data = res_role.get_json()
        self.assertIn(data['role'], ['Liberal', 'Fascist', 'Hitler'])
        self.assertTrue(len(data.get('info', '')) > 0)

        # Query my role for player 2
        res_role2 = p2_client.get(f'/secret/{room_code}/get_my_role', headers={'X-Auth-Token': p2_token})
        self.assertEqual(res_role2.status_code, 200)
        data2 = res_role2.get_json()
        self.assertIn(data2['role'], ['Liberal', 'Fascist', 'Hitler'])

        print("[OK] 11: Secret Hitler get_my_role endpoint verified")

    def test_12_secret_hitler_state_no_hand_leak(self):
        """Verify broadcast state does not leak policy hand or action payload."""
        from apps.secret import logic as secret_logic
        state = secret_logic.get_initial_state()
        state['players'] = ['A', 'B']
        state['hand'] = ['Liberal', 'Fascist', 'Fascist']
        state['action_payload'] = 'Fascist'
        state['status'] = 'playing'
        state['phase'] = 'legislative'
        state['host'] = 'A'

        safe = secret_logic.get_full_state(state)
        self.assertNotIn('hand', safe, "hand leaked in public broadcast state!")
        self.assertNotIn('action_payload', safe, "action_payload leaked in public broadcast state!")
        self.assertIn('hand_count', safe)
        self.assertEqual(safe['hand_count'], 3)
        self.assertTrue(safe.get('has_action_payload'))

        print("[OK] 12: Secret Hitler state sanitization (anti-cheat) verified")

    def test_13_secret_hitler_my_hand_authorization(self):
        """Verify my_hand endpoint only delivers cards to authorized legislator."""
        from storage import get_storage
        storage = get_storage()

        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'HandPres', 'password': 'pass_hand_pres'})
        login_res = host_client.post('/api/auth/login', json={'username': 'HandPres', 'password': 'pass_hand_pres'})
        pres_token = login_res.get_json()['token']

        other_client = self.app.test_client()
        other_client.post('/api/auth/register', json={'username': 'HandOther', 'password': 'pass_hand_other'})
        other_login = other_client.post('/api/auth/login', json={'username': 'HandOther', 'password': 'pass_hand_other'})
        other_token = other_login.get_json()['token']

        # Set up a room in legislative president_session
        state = {
            'room_code': 'HND1',
            'players': ['HandPres', 'HandOther'],
            'president_index': 0,
            'chancellor_nominee': 'HandOther',
            'status': 'playing',
            'phase': 'legislative',
            'legislative_step': 'president_session',
            'hand': ['Liberal', 'Fascist', 'Liberal']
        }
        storage.save_lobby('secret', 'HND1', state)

        # President should see hand
        res_pres = host_client.get('/secret/HND1/my_hand', headers={'X-Auth-Token': pres_token})
        self.assertEqual(res_pres.status_code, 200)
        self.assertEqual(res_pres.get_json()['hand'], ['Liberal', 'Fascist', 'Liberal'])

        # Other player should NOT see hand
        res_other = other_client.get('/secret/HND1/my_hand', headers={'X-Auth-Token': other_token})
        self.assertEqual(res_other.status_code, 200)
        self.assertEqual(res_other.get_json()['hand'], [])

        print("[OK] 13: Secret Hitler my_hand authorization verified")

    def test_14_song_guesser_end_round_authorization(self):
        """Verify non-host player cannot prematurely end a round in Song Guesser."""
        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'SongHostAuth', 'password': 'pass_song_host'})
        login_h = host_client.post('/api/auth/login', json={'username': 'SongHostAuth', 'password': 'pass_song_host'})
        host_token = login_h.get_json()['token']

        guest_client = self.app.test_client()
        guest_client.post('/api/auth/register', json={'username': 'SongGuestAuth', 'password': 'pass_song_guest'})
        login_g = guest_client.post('/api/auth/login', json={'username': 'SongGuestAuth', 'password': 'pass_song_guest'})
        guest_token = login_g.get_json()['token']

        # Create room
        res_c = host_client.post('/song/create_room', headers={'X-Auth-Token': host_token})
        code = res_c.get_json()['room_code']

        # Guest joins
        guest_client.post(f'/song/{code}/join', headers={'X-Auth-Token': guest_token})

        # Guest tries to end round -> 403 Forbidden
        res_fail = guest_client.post(f'/song/{code}/end_round', headers={'X-Auth-Token': guest_token})
        self.assertEqual(res_fail.status_code, 403)

        # Host tries to end round -> 200 OK
        res_ok = host_client.post(f'/song/{code}/end_round', headers={'X-Auth-Token': host_token})
        self.assertEqual(res_ok.status_code, 200)

        print("[OK] 14: Song Guesser host-only end_round authorization verified")

    def test_15_pusher_presence_auth_endpoint(self):
        """Verify /pusher/auth enforces authentication and handles channel authorization."""
        anon_client = self.app.test_client()
        res_anon = anon_client.post('/pusher/auth', data={'socket_id': '123.456', 'channel_name': 'presence-secret-TEST'})
        self.assertEqual(res_anon.status_code, 403)

        auth_client = self.app.test_client()
        auth_client.post('/api/auth/register', json={'username': 'PusherUser', 'password': 'pass_pusher_user'})
        login_res = auth_client.post('/api/auth/login', json={'username': 'PusherUser', 'password': 'pass_pusher_user'})
        token = login_res.get_json()['token']

        # Missing parameters -> 400
        res_missing = auth_client.post('/pusher/auth', headers={'X-Auth-Token': token}, data={})
        self.assertEqual(res_missing.status_code, 400)

        # Authenticated attempt -> successfully passed auth gate (returns auth response or 500 on dummy pusher, NOT 403)
        res_auth = auth_client.post('/pusher/auth', headers={'X-Auth-Token': token}, data={
            'socket_id': '1234.5678',
            'channel_name': 'presence-secret-ROOM'
        })
        self.assertIn(res_auth.status_code, (200, 500))

        print("[OK] 15: Pusher presence auth endpoint verified")

    def test_16_sqlite_heartbeat_multiworker_storage(self):
        """Verify SQLite-backed player heartbeat persistence for multi-worker safety."""
        import time
        from storage import get_storage
        storage = get_storage()

        # Upsert heartbeats
        now = time.time()
        storage.upsert_heartbeat('secret', 'HBTEST', 'Player1', now)
        storage.upsert_heartbeat('secret', 'HBTEST', 'Player2', now + 5.0)

        # Retrieve room heartbeats
        hb_map = storage.get_room_heartbeats('secret', 'HBTEST')
        self.assertIn('Player1', hb_map)
        self.assertIn('Player2', hb_map)
        self.assertEqual(hb_map['Player1'], now)
        self.assertEqual(hb_map['Player2'], now + 5.0)

        # Check active status
        self.assertTrue(storage.has_active_heartbeats('secret', 'HBTEST', max_age_seconds=60))
        self.assertFalse(storage.has_active_heartbeats('secret', 'HBTEST_UNKNOWN', max_age_seconds=60))

        # Delete single player
        storage.delete_heartbeat('secret', 'HBTEST', 'Player1')
        hb_map_after = storage.get_room_heartbeats('secret', 'HBTEST')
        self.assertNotIn('Player1', hb_map_after)
        self.assertIn('Player2', hb_map_after)

        # Delete entire room
        storage.delete_room_heartbeats('secret', 'HBTEST')
        hb_empty = storage.get_room_heartbeats('secret', 'HBTEST')
        self.assertEqual(len(hb_empty), 0)

        print("[OK] 16: SQLite player heartbeat multi-worker storage verified")

    def test_17_sqlite_rate_limiting(self):
        """Verify SQLite-backed rate limiting protects against brute force."""
        from storage import get_storage
        storage = get_storage()
        test_ip = '198.51.100.77'
        storage.clear_failed_logins(test_ip)

        client = self.app.test_client()

        # 5 failed attempts
        for i in range(5):
            res = client.post('/api/auth/login',
                environ_base={'REMOTE_ADDR': test_ip},
                json={'username': 'NonExistentUser', 'password': 'wrongpassword'}
            )
            self.assertEqual(res.status_code, 401)

        # 6th attempt is blocked by rate limiter
        res_blocked = client.post('/api/auth/login',
            environ_base={'REMOTE_ADDR': test_ip},
            json={'username': 'NonExistentUser', 'password': 'wrongpassword'}
        )
        self.assertEqual(res_blocked.status_code, 429)

        # Clear failed logins -> access unblocked
        storage.clear_failed_logins(test_ip)
        res_unblocked = client.post('/api/auth/login',
            environ_base={'REMOTE_ADDR': test_ip},
            json={'username': 'NonExistentUser', 'password': 'wrongpassword'}
        )
        self.assertEqual(res_unblocked.status_code, 401)

        print("[OK] 17: SQLite login rate limiting verified")

    def test_18_optimistic_concurrency_control(self):
        """Verify optimistic concurrency control detects write collisions via version column."""
        from storage import get_storage
        from storage.base import OptimisticLockError
        storage = get_storage()

        room_code = 'LOCK1'
        storage.delete_lobby('secret', room_code)
        state = {'room_code': room_code, 'round': 1}

        # Initial save (version = 1)
        storage.save_lobby('secret', room_code, state)

        # First concurrent writer expects version 1 -> succeeds, bumps to 2
        state['round'] = 2
        storage.save_lobby('secret', room_code, state, expected_version=1)

        # Second concurrent writer also thought it was version 1 -> collision!
        with self.assertRaises(OptimisticLockError):
            storage.save_lobby('secret', room_code, state, expected_version=1)

        print("[OK] 18: Optimistic concurrency control (version locking) verified")

    def test_19_presence_aware_room_survival(self):
        """Verify room with active player heartbeat is NOT deleted even if idle for 10 minutes."""
        import time
        from storage import get_storage
        storage = get_storage()

        # 1. Old room with NO active heartbeats -> gets pruned
        room_dead = 'DEADRM'
        storage.save_lobby('secret', room_dead, {'status': 'lobby'})
        # Force updated_at to 10 minutes ago
        with storage._get_conn() as conn:
            conn.execute("UPDATE game_lobbies SET updated_at = datetime('now', '-600 seconds') WHERE room_code = ?", (room_dead,))

        loaded_dead = storage.load_lobby('secret', room_dead)
        self.assertIsNone(loaded_dead, "Empty idle room was not pruned!")

        # 2. Old room WITH active player heartbeat -> SURVIVES!
        room_live = 'LIVERM'
        storage.save_lobby('secret', room_live, {'status': 'playing', 'note': 'active players present'})
        with storage._get_conn() as conn:
            conn.execute("UPDATE game_lobbies SET updated_at = datetime('now', '-600 seconds') WHERE room_code = ?", (room_live,))

        # Player is active right now
        storage.upsert_heartbeat('secret', room_live, 'ActiveAlice', time.time())

        loaded_live = storage.load_lobby('secret', room_live)
        self.assertIsNotNone(loaded_live, "Room with active heartbeats was wrongly deleted!")
        self.assertEqual(loaded_live['note'], 'active players present')

        print("[OK] 19: Presence-aware room survival verified")

    def test_20_song_library_memory_cache(self):
        """Verify song data library is cached in memory across calls."""
        from apps.song.logic import load_songs_library
        lib1 = load_songs_library()
        lib2 = load_songs_library()
        self.assertIs(lib1, lib2, "Song library is being re-parsed from disk instead of cached!")

        print("[OK] 20: Song library in-memory caching verified")

    def test_21_game_registry_manifests(self):
        """Verify centralized game registry and manifest management."""
        from apps.common.registry import get_all_games, get_game, register_game, GameManifest
        from apps.games import init_games_registry

        games = init_games_registry()
        game_ids = [g.id for g in games]
        for required_id in ['secret', 'song', 'imposter', 'tower', 'survivors', 'nexusdex', 'songseeker']:
            self.assertIn(required_id, game_ids, f"Required game '{required_id}' not found in registry")

        secret_manifest = get_game('secret')
        self.assertEqual(secret_manifest.game_type, 'multiplayer')
        self.assertEqual(secret_manifest.route_prefix, '/secret')

        # Test dynamic game registration
        test_game = GameManifest(
            id='sample_game',
            title='Sample Game',
            subtitle='Testing dynamic registration',
            route_prefix='/sample'
        )
        register_game(test_game)
        self.assertEqual(get_game('sample_game').title, 'Sample Game')

        # Restore canonical platform games
        init_games_registry()
        print("[OK] 21: Game registry & manifest system verified")

    def test_22_hybrid_card_rendering(self):
        """Verify hybrid portal card rendering: auto-generated cards and custom card overrides."""
        import os
        from apps.games import init_games_registry
        init_games_registry()

        # 1. Fallback auto-generated cards render on landing portal
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        html = res.get_data(as_text=True)
        self.assertIn('Impostor', html)
        self.assertIn('Secret<br>Hitler', html)
        self.assertIn('card card-imposter', html)

        # 2. Handcrafted custom card override taking precedence
        cards_dir = os.path.join(self.app.template_folder, 'cards')
        os.makedirs(cards_dir, exist_ok=True)
        test_card_path = os.path.join(cards_dir, 'imposter.html')
        custom_snippet = '<div class="custom-handcrafted-card">HANDCRAFTED IMPOSTOR CARD</div>'
        try:
            with open(test_card_path, 'w', encoding='utf-8') as f:
                f.write(custom_snippet)

            res_custom = self.client.get('/')
            self.assertEqual(res_custom.status_code, 200)
            custom_body = res_custom.get_data(as_text=True)
            self.assertIn('custom-handcrafted-card', custom_body)
            self.assertIn('HANDCRAFTED IMPOSTOR CARD', custom_body)
        finally:
            if os.path.exists(test_card_path):
                os.remove(test_card_path)

        # 3. When custom card is removed, fallback card is immediately restored
        res_restored = self.client.get('/')
        restored_body = res_restored.get_data(as_text=True)
        self.assertNotIn('custom-handcrafted-card', restored_body)
        self.assertIn('card card-imposter', restored_body)

        print("[OK] 22: Hybrid portal card rendering (handcrafted + fallback) verified")

    def test_23_singleplayer_auto_route_and_shell_fallback(self):
        """Verify dynamic singleplayer route registration, alias routing, and fallback game shell."""
        from flask import Flask
        from apps.common.registry import GameManifest, register_game
        from apps.common.singleplayer import register_singleplayer_routes

        # Verify backwards-compatibility aliases on main application
        self.client.post('/api/auth/register', json={'username': 'ShellTester', 'password': 'pass'})
        self.client.post('/api/auth/login', json={'username': 'ShellTester', 'password': 'pass'})
        res_s3 = self.client.get('/site3/')
        self.assertEqual(res_s3.status_code, 200)
        res_s4 = self.client.get('/site4/')
        self.assertEqual(res_s4.status_code, 200)

        # Create fresh test app to verify runtime registration of a new singleplayer game without a template
        test_app = Flask('test_singleplayer', template_folder=self.app.template_folder)
        test_app.secret_key = 'test_secret'

        @test_app.before_request
        def auth_hook():
            from apps.auth.decorators import resolve_user_for_request
            resolve_user_for_request()

        auto_game = GameManifest(
            id='minigame',
            title='Auto Mini Game',
            subtitle='Generated with dynamic shell',
            route_prefix='/minigame',
            icon='🕹️'
        )
        register_game(auto_game)
        register_singleplayer_routes(test_app, [auto_game])

        client = test_app.test_client()
        with client.session_transaction() as sess:
            sess['user_id'] = 1
            sess['username'] = 'ShellTester'
            sess['auth_token'] = 'test_token'

        # Request route -> automatically renders game_shell.html
        res = client.get('/minigame/')
        self.assertEqual(res.status_code, 200)
        body = res.get_data(as_text=True)
        self.assertIn('Auto Mini Game', body)
        self.assertIn('🕹️', body)
        self.assertIn('Dies ist die automatische Shell-Ansicht', body)

        print("[OK] 23: Singleplayer auto-routes, aliases, and shell fallback verified")

    def test_24_multiplayer_blueprint_factory(self):
        """Verify reusable multiplayer Blueprint factory provides room lifecycle endpoints."""
        from flask import Flask
        from apps.common.multiplayer_bp import create_multiplayer_blueprint

        test_app = Flask('test_mp', template_folder=self.app.template_folder)
        test_app.secret_key = 'test_secret'

        @test_app.before_request
        def auth_hook():
            from apps.auth.decorators import resolve_user_for_request
            resolve_user_for_request()

        mp_bp = create_multiplayer_blueprint(
            'tictactoe',
            initial_state_factory=lambda: {'board': [0] * 9, 'status': 'lobby'}
        )
        test_app.register_blueprint(mp_bp)

        client = test_app.test_client()
        with client.session_transaction() as sess:
            sess['user_id'] = 1
            sess['username'] = 'TTT_Player'
            sess['auth_token'] = 'test_token'

        # Create room
        res_create = client.post('/tictactoe/create')
        self.assertEqual(res_create.status_code, 200)
        create_data = res_create.get_json()
        self.assertTrue(create_data['success'])
        room_code = create_data['room_code']
        self.assertEqual(len(room_code), 4)

        # Get room state
        res_state = client.get(f'/tictactoe/{room_code}/state')
        self.assertEqual(res_state.status_code, 200)
        self.assertEqual(res_state.get_json()['status'], 'lobby')

        # Send heartbeat
        res_hb = client.post(f'/tictactoe/{room_code}/heartbeat')
        self.assertEqual(res_hb.status_code, 200)
        self.assertTrue(res_hb.get_json()['success'])

        # List lobbies
        res_list = client.get('/tictactoe/list_lobbies')
        self.assertEqual(res_list.status_code, 200)
        lobbies = res_list.get_json()['lobbies']
        self.assertTrue(any(l['room_code'] == room_code for l in lobbies))

        # Leave room
        res_leave = client.post(f'/tictactoe/{room_code}/leave')
        self.assertEqual(res_leave.status_code, 200)
        self.assertTrue(res_leave.get_json()['success'])

        print("[OK] 24: Reusable multiplayer Blueprint factory verified")

    def test_25_delta_broadcasting_optimization(self):
        """Verify differential state broadcasting, compact payload diffing, and append-only log optimization."""
        from apps.common.delta import compute_state_delta, apply_state_delta, BroadcastTracker
        import copy

        prev_state = {
            'players': ['Alice', 'Bob'],
            'host': 'Alice',
            'phase': 'nominating',
            'president': 'Alice',
            'chancellor': None,
            'votes': {},
            'settings': {'log_book': True, 'reveal_on_death': False},
            'logs': ['Spiel initialisiert.', 'Alice hat den Raum betreten.']
        }

        # 1. No changes -> compute_state_delta should return None
        self.assertIsNone(compute_state_delta(prev_state, copy.deepcopy(prev_state)))

        # 2. Modify field (e.g. setting toggled) + append log
        curr_state = copy.deepcopy(prev_state)
        curr_state['settings']['log_book'] = False
        curr_state['chancellor'] = 'Bob'
        curr_state['logs'].append('Alice hat Bob nominiert.')

        delta = compute_state_delta(prev_state, curr_state)
        self.assertIsNotNone(delta)
        self.assertTrue(delta['_delta'])
        self.assertIn('changes', delta)
        self.assertEqual(delta['changes']['chancellor'], 'Bob')
        self.assertEqual(delta['changes']['settings']['log_book'], False)
        # Players, host, president were untouched and should NOT be in changes!
        self.assertNotIn('players', delta['changes'])
        self.assertNotIn('host', delta['changes'])
        self.assertNotIn('president', delta['changes'])

        # Logs optimization: should NOT resend full list, only new entries!
        self.assertNotIn('logs', delta.get('changes', {}))
        self.assertIn('new_logs', delta)
        self.assertEqual(delta['new_logs'], ['Alice hat Bob nominiert.'])

        # 3. Client-side reconstruction via apply_state_delta
        reconstructed = apply_state_delta(copy.deepcopy(prev_state), delta)
        self.assertEqual(reconstructed['chancellor'], 'Bob')
        self.assertEqual(reconstructed['settings']['log_book'], False)
        self.assertEqual(reconstructed['logs'], curr_state['logs'])

        # 4. Multi-game BroadcastTracker lifecycle
        tracker = BroadcastTracker()
        payload1, is_delta1 = tracker.get_broadcast_payload('secret', 'TEST', prev_state)
        self.assertFalse(is_delta1, "First broadcast should be full state snapshot")
        self.assertEqual(payload1, prev_state)

        payload2, is_delta2 = tracker.get_broadcast_payload('secret', 'TEST', curr_state)
        self.assertTrue(is_delta2, "Second broadcast should be compact delta")
        self.assertIn('_delta', payload2)
        self.assertIn('new_logs', payload2)

        # 5. Broadcast identical state again -> returns None (skipped trigger)
        payload3, is_delta3 = tracker.get_broadcast_payload('secret', 'TEST', curr_state)
        self.assertIsNone(payload3, "Unchanged state should be skipped to conserve Pusher quota")

        print("[OK] 25: Delta broadcasting optimization and state patcher verified")

    def test_26_geobingo_multiplayer_lifecycle(self):
        """Verify Geo Bingo room creation, joining, proof capture with Pano-ID, and judgement lifecycle."""
        # 1. Host registers, logs in, creates room
        host_client = self.app.test_client()
        host_client.post('/api/auth/register', json={'username': 'GB_Host', 'password': 'pass'})
        host_client.post('/api/auth/login', json={'username': 'GB_Host', 'password': 'pass'})

        res = host_client.post('/geobingo/create_room')
        self.assertEqual(res.status_code, 200)
        code = res.get_json()['room_code']
        self.assertTrue(bool(code))

        # 2. Player 2 joins
        p2_client = self.app.test_client()
        p2_client.post('/api/auth/register', json={'username': 'GB_Player2', 'password': 'pass'})
        p2_client.post('/api/auth/login', json={'username': 'GB_Player2', 'password': 'pass'})

        res = p2_client.post(f'/geobingo/{code}/join')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('GB_Player2', data['players'])

        # 3. Host updates settings
        res = host_client.post(f'/geobingo/{code}/update_settings', json={'item_count': 5, 'item_preset': 'easy'})
        self.assertEqual(res.status_code, 200)

        # 4. Host starts game
        res = host_client.post(f'/geobingo/{code}/start_game')
        self.assertEqual(res.status_code, 200)

        # 5. Player captures proof with pano_id
        proof_payload = {
            'item_idx': 0,
            'pano_id': 'pano_test_monaco_123',
            'lat': 43.7384,
            'lng': 7.4246,
            'heading': 180.0,
            'pitch': 5.0,
            'fov': 90.0
        }
        res_proof = host_client.post(f'/geobingo/{code}/save_proof', json=proof_payload)
        self.assertEqual(res_proof.status_code, 200)
        self.assertEqual(res_proof.get_json()['completed_count'], 1)

        # 6. Test heartbeat
        res_hb = host_client.post(f'/geobingo/{code}/heartbeat', json={'room_code': code})
        self.assertEqual(res_hb.status_code, 200)

        # 7. Leave game
        res_leave = p2_client.post(f'/geobingo/{code}/leave_game')
        self.assertEqual(res_leave.status_code, 200)

        print("[OK] 26: Geo Bingo 1v1 multi-room lifecycle verified")

    def test_27_google_maps_request_logging(self):
        """Verify Google Maps request logging, user identity linking, X-Forwarded-For handling, and logfile creation."""
        from apps.common.maps_logger import MAPS_LOG_FILE

        with self.storage._get_conn() as conn:
            conn.execute("DELETE FROM maps_penalties")
            conn.execute("DELETE FROM maps_api_logs WHERE username = 'MapsUser_77'")

        # 1. Unauthenticated request without username/token must be rejected
        unauth_client = self.app.test_client()
        res_unauth = unauth_client.post('/api/logs/maps', json={
            'action': 'sdk_init',
            'page': '/geobingo/'
        })
        self.assertEqual(res_unauth.status_code, 401)
        self.assertFalse(res_unauth.get_json().get('success', True))

        # 2. Register and login test user
        username = "MapsUser_77"
        password = "SecurePassword123"
        res_reg = self.client.post('/api/auth/register', json={'username': username, 'password': password})
        self.assertIn(res_reg.status_code, [201, 200, 409])
        res_login = self.client.post('/api/auth/login', json={'username': username, 'password': password})
        self.assertEqual(res_login.status_code, 200)
        token = res_login.get_json()['token']

        # 3. Log Google Maps request with multi-IP X-Forwarded-For header
        multi_ip_header = "198.51.100.42, 10.0.0.1, 172.16.0.5"
        res_log = self.client.post(
            '/api/logs/maps',
            headers={
                'X-Auth-Token': token,
                'X-Forwarded-For': multi_ip_header,
                'User-Agent': 'TestBrowser/1.0 (Windows NT 10.0)'
            },
            json={
                'action': 'maps_sdk_init',
                'page': '/geobingo/',
                'details': {'room_code': 'TEST99'}
            }
        )
        self.assertEqual(res_log.status_code, 200)
        data = res_log.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['username'], username)
        self.assertEqual(data['ip_address'], '198.51.100.42') # First IP extracted
        self.assertEqual(data['page'], '/geobingo/')
        self.assertEqual(data['action'], 'maps_sdk_init')

        # 4. Verify record in SQLite database
        logs = self.storage.get_maps_logs(limit=5, username=username)
        self.assertTrue(len(logs) >= 1)
        latest = logs[0]
        self.assertEqual(latest['username'], username)
        self.assertEqual(latest['ip_address'], '198.51.100.42')
        self.assertEqual(latest['page'], '/geobingo/')
        self.assertEqual(latest['action'], 'maps_sdk_init')
        self.assertIn('details', latest)
        self.assertEqual(latest['details'].get('room_code'), 'TEST99')

        # 5. Verify record in structured logfile
        self.assertTrue(MAPS_LOG_FILE.exists(), f"Log file does not exist: {MAPS_LOG_FILE}")
        with open(MAPS_LOG_FILE, 'r', encoding='utf-8') as f:
            log_contents = f.read()

        expected_pattern = f'USER="{username}" IP="198.51.100.42" PAGE="/geobingo/" ACTION="maps_sdk_init"'
        self.assertIn(expected_pattern, log_contents)

        # 6. Verify GET /api/logs/maps retrieval
        res_get = self.client.post(
            '/api/logs/maps',
            headers={'X-Auth-Token': token},
            json={'action': 'picker_map_init', 'page': '/geobingo/'}
        )
        self.assertEqual(res_get.status_code, 200)

        res_logs_query = self.client.get(f'/api/logs/maps?username={username}', headers={'X-Auth-Token': token})
        self.assertEqual(res_logs_query.status_code, 200)
        query_data = res_logs_query.get_json()
        self.assertTrue(query_data['success'])
        self.assertGreaterEqual(query_data['count'], 2)

        print("[OK] 27: Google Maps request logging, IP extraction & logfile verified")

    def test_28_maps_rate_limiting_and_cascade_protection(self):
        """Verify progressive rate-limiting, cascade protection, strike escalation, and manual DB admin reset."""
        from apps.common.maps_logger import MAPS_LOG_FILE
        import time

        username = "RateLimitUser"
        password = "SecurePassword123"
        self.client.post('/api/auth/register', json={'username': username, 'password': password})
        res_login = self.client.post('/api/auth/login', json={'username': username, 'password': password})
        token = res_login.get_json()['token']
        headers = {'X-Auth-Token': token}

        # Clear any preexisting penalties for clean test
        with self.storage._get_conn() as conn:
            conn.execute("DELETE FROM maps_penalties WHERE identifier LIKE '%ratelimituser%' OR identifier LIKE 'ip:%'")
            conn.execute("DELETE FROM maps_api_logs WHERE username = ?", (username,))

        # 1. Test Smart Gaming: Fast in-game actions in 2 rooms (4 requests: 1 SDK + 3 in-game)
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/', 'details': {'room': 'R1'}})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'picker_map_init', 'page': '/geobingo/', 'details': {'room': 'R1'}})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'picker_map_init', 'page': '/geobingo/', 'details': {'room': 'R2'}})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'streetview_init', 'page': '/geobingo/', 'details': {'room': 'R2'}})

        # Pre-check must ALLOW (200 OK) because user is simply playing games (only 1 SDK init, 4 total < 8)
        res_check = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_check.status_code, 200)
        self.assertTrue(res_check.get_json()['allowed'])

        # 2. Test F5-Reload Spam: Trigger 2 more SDK inits (total 3 sdk_inits in 5 min)
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})

        # Pre-check must trigger STRIKE 1 (60s cooldown, 429)
        res_check_strike1 = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_check_strike1.status_code, 429)
        data_s1 = res_check_strike1.get_json()
        self.assertFalse(data_s1['allowed'])
        self.assertEqual(data_s1['strike_count'], 1)
        self.assertGreaterEqual(data_s1['cooldown_seconds'], 55)

        # Verify Strike 1 is logged to structured logfile
        with open(MAPS_LOG_FILE, 'r', encoding='utf-8') as f:
            log_content = f.read()
        self.assertIn(f'PENALTY USER="{username}"', log_content)
        self.assertIn('STRIKE=1 DURATION="60s"', log_content)

        # 3. Test Cascade Protection:
        # Advance time by manually expiring the 60s cooldown in the database
        with self.storage._get_conn() as conn:
            conn.execute(
                "UPDATE maps_penalties SET blocked_until = ? WHERE identifier LIKE '%ratelimituser%' OR identifier LIKE 'ip:%'",
                (time.time() - 5.0,)
            )

        # Without new requests, pre-check must be ALLOWED! Old 3 requests must NOT trigger Strike 2!
        res_check_cascade = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_check_cascade.status_code, 200)
        self.assertTrue(res_check_cascade.get_json()['allowed'])

        # 4. Trigger Strike 2: 3 NEW SDK reloads after the first strike
        # Note: we temporarily artificially set timestamp on logs or send 3 new ones
        time.sleep(1.05) # ensure SQLite timestamp > last_strike_at
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})
        self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})

        res_check_strike2 = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_check_strike2.status_code, 429)
        data_s2 = res_check_strike2.get_json()
        self.assertEqual(data_s2['strike_count'], 2)
        self.assertGreaterEqual(data_s2['cooldown_seconds'], 290) # 5 min (300s)

        # 5. Escalate to Strike 3 (3600s = 1 hour)
        with self.storage._get_conn() as conn:
            conn.execute("UPDATE maps_penalties SET blocked_until = ? WHERE identifier LIKE '%ratelimituser%' OR identifier LIKE 'ip:%'", (time.time() - 5.0,))
        time.sleep(1.05)
        for _ in range(3):
            self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})
        res_s3 = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_s3.status_code, 429)
        self.assertEqual(res_s3.get_json()['strike_count'], 3)
        self.assertGreaterEqual(res_s3.get_json()['cooldown_seconds'], 3500)

        # 6. Escalate to Strike 4 (PERMANENT BAN)
        with self.storage._get_conn() as conn:
            conn.execute("UPDATE maps_penalties SET blocked_until = ? WHERE identifier LIKE '%ratelimituser%' OR identifier LIKE 'ip:%'", (time.time() - 5.0,))
        time.sleep(1.05)
        for _ in range(3):
            self.client.post('/api/logs/maps', headers=headers, json={'action': 'maps_sdk_init', 'page': '/geobingo/'})
        res_s4 = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_s4.status_code, 429)
        data_s4 = res_s4.get_json()
        self.assertEqual(data_s4['strike_count'], 4)
        self.assertTrue(data_s4['is_permanent'])
        self.assertEqual(data_s4['error'], 'permanently_blocked')

        # 7. Test Admin Manual Reset in DB:
        with self.storage._get_conn() as conn:
            conn.execute("DELETE FROM maps_penalties WHERE identifier LIKE '%ratelimituser%' OR identifier LIKE 'ip:%'")
            conn.execute("DELETE FROM maps_api_logs WHERE username = ?", (username,))

        res_after_admin_reset = self.client.post('/api/logs/maps/check', headers=headers)
        self.assertEqual(res_after_admin_reset.status_code, 200)
        self.assertTrue(res_after_admin_reset.get_json()['allowed'])

        print("[OK] 28: Maps progressive rate-limiting, cascade protection & admin reset verified")


if __name__ == '__main__':
    unittest.main(verbosity=2)





