"""UltraSong-Briefkasten: Bestellen, Abholen durch den PC, Hochladen, Herunterladen.

Laeuft gegen ein temporaeres DATA_DIR, die echte Datenbank bleibt unberuehrt:
    python -m unittest tests.test_ultrasong
"""
import io
import os
import sys
import tempfile
import unittest
import zipfile

_TMP = tempfile.mkdtemp(prefix='ultrasong-test-')
os.environ['DATA_DIR'] = _TMP
os.environ['ULTRASONG_PC_KEY'] = 'test-pc-key'
os.environ['ULTRASONG_CLIENT_KEY'] = 'test-client-key'
os.environ.pop('ULTRASONG_USERS', None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_app import app  # noqa: E402

PC = {'X-PC-Key': 'test-pc-key'}
CLIENT = {'X-Client-Key': 'test-client-key'}


def _song_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('A - B/A - B.txt', '#TITLE:B\n')
        z.writestr('A - B/A - B.mp3', os.urandom(300_000))
        z.writestr('A - B/A - B [CO].jpg', b'\xff\xd8jpeg')
    return buf.getvalue()


class UltraSongTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.user = app.test_client()
        self.user.post('/api/auth/register', json={'username': 'SingTester', 'password': 'Passwort123!', 'avatar': 'avatar_1'})
        r = self.user.post('/api/auth/login', json={'username': 'SingTester', 'password': 'Passwort123!'})
        self.assertEqual(r.status_code, 200)
        token = (r.get_json() or {}).get('token')
        self.auth = {'X-Auth-Token': token} if token else {}
        self.pc = app.test_client()

    def get(self, path):
        return self.user.get(path, headers=self.auth)

    def post(self, path, body):
        return self.user.post(path, json=body, headers=self.auth)

    def sync(self, **body):
        r = self.pc.post('/ultrasong/pc/sync', json={'since': 1.0, 'jobs': [], **body}, headers=PC)
        self.assertEqual(r.status_code, 200)
        return r.get_json()

    def test_page_needs_login(self):
        anon = app.test_client()
        self.assertEqual(anon.get('/ultrasong/api/state').status_code, 401)
        self.assertEqual(self.get('/ultrasong/').status_code, 200)

    def test_pc_key_required(self):
        self.assertEqual(self.pc.post('/ultrasong/pc/sync', json={}).status_code, 403)
        self.assertEqual(self.pc.post('/ultrasong/pc/sync', json={}, headers={'X-PC-Key': 'falsch'}).status_code, 403)
        self.assertEqual(self.pc.post('/ultrasong/pc/upload?name=x&offset=0&last=1', data=b'x').status_code, 403)

    def test_order_roundtrip(self):
        self.sync(bye=True)
        self.assertFalse(self.get('/ultrasong/api/state').get_json()['pc']['online'])
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'search', 'data': {'q': 'x'}}).status_code, 503)

        self.sync()
        self.assertTrue(self.get('/ultrasong/api/state').get_json()['pc']['online'])
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'delete', 'data': {}}).status_code, 400)
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'create', 'data': {'id': '../x', 'artist': 'A', 'title': 'B'}}).status_code, 400)
        oid = self.post('/ultrasong/api/order', {'kind': 'search', 'data': {'q': 'Tream München'}}).get_json()['id']
        self.assertFalse(self.get(f'/ultrasong/api/order/{oid}').get_json()['done'])

        cmds = self.sync()['commands']
        self.assertEqual([(c['id'], c['kind'], c['data']) for c in cmds], [(oid, 'search', {'q': 'Tream München'})])
        self.assertEqual(self.sync()['commands'], [])  # nur einmal ausgeliefert

        self.sync(results=[{'id': oid, 'ok': True, 'data': [{'id': 'abcdefghijk', 'title': 'T'}]}],
                  jobs=[{'key': 'k1', 'artist': 'A', 'title': 'B', 'status': 'laeuft', 'stage': 'noten'}])
        r = self.get(f'/ultrasong/api/order/{oid}').get_json()
        self.assertEqual(r, {'done': True, 'ok': True, 'data': [{'id': 'abcdefghijk', 'title': 'T'}], 'error': None})
        self.assertEqual(self.get('/ultrasong/api/state').get_json()['jobs'][0]['stage'], 'noten')

    def upload(self, name, data):
        url = '/ultrasong/pc/upload?name=' + name.replace(' ', '%20')
        half = len(data) // 2
        self.assertEqual(self.pc.post(f'{url}&offset=0&last=0', data=data[:half], headers=PC).status_code, 200)
        self.assertEqual(self.pc.post(f'{url}&offset=5&last=0', data=b'x', headers=PC).status_code, 409)
        self.assertEqual(self.pc.post(f'{url}&offset={half}&last=1', data=data[half:], headers=PC).status_code, 200)

    def test_fetch_download_then_gone(self):
        """Songliste vom PC, ZIP erst auf Bestellung, nach komplettem Download wieder weg."""
        from games.ultrasong.routes import FILES
        name, data = 'A - B', _song_zip()
        self.sync(songs=[{'name': name, 'created': 5.0, 'size': len(data)}])
        self.assertEqual(self.pc.post('/ultrasong/pc/cover?name=A%20-%20B', data=b'\xff\xd8jpeg', headers=PC).status_code, 200)
        self.assertEqual(self.sync(songs=[{'name': name, 'created': 5.0, 'size': len(data)}])['covers'], [name])
        song = self.get('/ultrasong/api/state').get_json()['songs'][0]
        self.assertEqual((song['name'], song['cover']), (name, 1))
        self.assertEqual(self.get(f"/ultrasong/cover/{song['key']}").data, b'\xff\xd8jpeg')

        self.assertEqual(self.get(f"/ultrasong/dl/{song['key']}").status_code, 404)   # noch nicht hochgeladen
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'fetch', 'data': {'names': ['X - Y']}}).status_code, 404)
        oid = self.post('/ultrasong/api/order', {'kind': 'fetch', 'data': {'names': [name]}}).get_json()['id']
        self.assertEqual(self.sync()['commands'][0]['data'], {'names': [name]})
        self.upload(name, data)
        self.sync(results=[{'id': oid, 'ok': True, 'data': {'ok': True}}])
        self.assertTrue(self.get(f'/ultrasong/api/order/{oid}').get_json()['ok'])

        r = self.get(f"/ultrasong/dl/{song['key']}")
        self.assertEqual(r.data, data)
        r.close()
        self.assertFalse((FILES / (song['key'] + '.zip')).exists())                   # nach dem Download geloescht
        self.assertEqual(self.get(f"/ultrasong/dl/{song['key']}").status_code, 404)

        self.upload(name, data)                                                         # mehrere auf einmal
        self.upload('C - D', data)
        from games.ultrasong.routes import _file_key
        keys = f"{song['key']},{_file_key('C - D')}"
        allz = zipfile.ZipFile(io.BytesIO(self.get(f'/ultrasong/dl-all?keys={keys}').data))
        self.assertIn('A - B/A - B.mp3', allz.namelist())
        self.assertIsNone(allz.testzip())
        self.assertEqual(self.get(f'/ultrasong/dl-all?keys={keys}').status_code, 404)  # auch weg
        self.assertEqual(self.pc.post('/ultrasong/pc/upload?name=..&offset=0&last=1', data=b'x', headers=PC).status_code, 400)

        self.sync(bye=True)                                                             # PC aus: nichts bleibt liegen
        self.assertFalse((FILES / (song['key'] + '.jpg')).exists())
        self.sync()
        self.assertEqual(self.get('/ultrasong/api/state').get_json()['songs'], [])

    def test_stop_only_admin(self):
        from storage import get_storage
        self.sync()
        self.assertFalse(self.get('/ultrasong/api/state').get_json()['admin'])
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'stop', 'data': {}}).status_code, 403)
        with get_storage()._get_conn() as conn:
            conn.execute("UPDATE users SET role='admin' WHERE username='SingTester'")
        from apps.auth.decorators import invalidate_auth_cache
        invalidate_auth_cache()
        self.assertTrue(self.get('/ultrasong/api/state').get_json()['admin'])
        self.assertEqual(self.post('/ultrasong/api/order', {'kind': 'stop', 'data': {}}).status_code, 200)
        with get_storage()._get_conn() as conn:
            conn.execute("UPDATE users SET role='user' WHERE username='SingTester'")
        invalidate_auth_cache()

    def test_user_allowlist(self):
        os.environ['ULTRASONG_USERS'] = 'jemand_anders'
        try:
            self.assertEqual(self.get('/ultrasong/api/state').status_code, 403)
        finally:
            os.environ.pop('ULTRASONG_USERS')

    def test_client_key(self):
        """UltraStar Deluxe bestellt mit X-Client-Key statt Login, mehrere Ergebnisse in einer Anfrage."""
        game = app.test_client()
        self.sync()
        self.assertEqual(game.get('/ultrasong/api/state', headers={'X-Client-Key': 'falsch'}).status_code, 401)
        st = game.get('/ultrasong/api/state', headers=CLIENT).get_json()
        self.assertTrue(st['pc']['online'])
        self.assertFalse(st['admin'])
        ids = [game.post('/ultrasong/api/order', headers=CLIENT, json={
            'kind': 'lyrics', 'data': {'artist': 'Tream', 'title': t}}).get_json()['id']
            for t in ('Drago Augustino', 'Drago Augustino (Acoustic)')]
        self.assertEqual(game.post('/ultrasong/api/order', headers=CLIENT, json={'kind': 'stop', 'data': {}}).status_code, 403)
        self.assertEqual(len(self.sync()['commands']), 2)
        self.sync(results=[{'id': ids[0], 'ok': True, 'data': {'found': True}}])
        r = game.get(f'/ultrasong/api/orders?ids={ids[0]},{ids[1]}', headers=CLIENT).get_json()
        self.assertEqual(r[str(ids[0])], {'done': True, 'ok': True, 'data': {'found': True}, 'error': None})
        self.assertEqual(r[str(ids[1])], {'done': False})
        self.assertEqual(game.get('/ultrasong/api/orders?ids=x', headers=CLIENT).status_code, 400)
        self.sync(results=[{'id': ids[1], 'ok': True, 'data': {'found': False}}])


if __name__ == '__main__':
    unittest.main()
