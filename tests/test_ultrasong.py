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
os.environ.pop('ULTRASONG_USERS', None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_app import app  # noqa: E402

PC = {'X-PC-Key': 'test-pc-key'}


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

    def test_upload_and_download(self):
        data = _song_zip()
        name = 'A - B'
        url = '/ultrasong/pc/upload?name=' + name.replace(' ', '%20')
        half = len(data) // 2
        self.assertEqual(self.pc.post(f'{url}&offset=0&last=0', data=data[:half], headers=PC).status_code, 200)
        self.assertEqual(self.pc.post(f'{url}&offset=5&last=0', data=b'x', headers=PC).status_code, 409)
        self.assertEqual(self.pc.post(f'{url}&offset={half}&last=1', data=data[half:], headers=PC).status_code, 200)
        self.assertIn(name, self.sync()['have'])

        songs = self.get('/ultrasong/api/state').get_json()['songs']
        song = next(s for s in songs if s['name'] == name)
        self.assertEqual(song['cover'], 1)
        self.assertEqual(self.get(f"/ultrasong/dl/{song['key']}").data, data)
        self.assertEqual(self.get(f"/ultrasong/cover/{song['key']}").data, b'\xff\xd8jpeg')
        allz = zipfile.ZipFile(io.BytesIO(self.get('/ultrasong/dl-all?seit=0').data))
        self.assertIn('A - B/A - B.mp3', allz.namelist())
        self.assertIsNone(allz.testzip())
        self.assertEqual(self.pc.post('/ultrasong/pc/upload?name=..&offset=0&last=1', data=b'x', headers=PC).status_code, 400)

    def test_user_allowlist(self):
        os.environ['ULTRASONG_USERS'] = 'jemand_anders'
        try:
            self.assertEqual(self.get('/ultrasong/api/state').status_code, 403)
        finally:
            os.environ.pop('ULTRASONG_USERS')


if __name__ == '__main__':
    unittest.main()
