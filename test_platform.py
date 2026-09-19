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

        # 3. Host updates settings
        res = host_client.post(f'/song/{code}/update_settings', data={'key': 'time_per_song', 'value': '15'})
        self.assertEqual(res.status_code, 200)

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


if __name__ == '__main__':
    unittest.main(verbosity=2)
