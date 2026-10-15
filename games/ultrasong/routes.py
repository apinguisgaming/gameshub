"""UltraSong: Songwuensche von unterwegs an den PC zu Hause.

Die Seite ist ein Briefkasten. Browser legen Bestellungen ab (Suche, Songtext-Check, Erstellen, Abbrechen).
Der UltraSong-Hub auf dem PC holt sie im Spielabend-Modus im Sekundentakt ab (/ultrasong/pc/sync, mit
PC-Schluessel), liefert die Antworten beim naechsten Abholen zurueck und laedt fertige Songs als ZIP hoch.
Der PC ist von aussen nie erreichbar; ohne laufenden Spielabend zeigt die Seite "PC ist aus".

.env: ULTRASONG_PC_KEY (Pflicht, derselbe Schluessel wie in den Hub-Einstellungen),
      ULTRASONG_USERS (optional, kommagetrennte Benutzernamen; leer = alle eingeloggten).
"""
import hashlib
import hmac
import json
import os
import re
import sqlite3
import threading
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path

from flask import Blueprint, Response, abort, jsonify, redirect, request, send_file, stream_with_context

from apps.auth.decorators import get_current_user
from config import DATA_DIR

ultrasong_bp = Blueprint('ultrasong_bp', __name__)

FILES = Path(DATA_DIR) / 'ultrasong'
DB = Path(DATA_DIR) / 'ultrasong.db'
ONLINE_S = 10            # so lange nach dem letzten Abholen gilt der PC als online
ORDER_TTL = 60           # nicht abgeholte Bestellungen verfallen danach
KEEP_S = 48 * 3600       # Songs bleiben so lange zum Herunterladen liegen
MAX_BYTES = 300 << 20    # hoechstens so viel Platz fuer Songs (aelteste fliegen zuerst)
MAX_CHUNK = 8 << 20
YT_ID = re.compile(r'[\w-]{6,20}')
_lock = threading.Lock()


# --- Speicher (eigene kleine SQLite-Datei) -----------------------------------------------------------

@contextmanager
def _db():
    """Verbindung mit Commit am Ende (bei Fehler Rollback), danach geschlossen."""
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    con.executescript('''
        CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, kind TEXT, data TEXT,
            created REAL, taken REAL, done REAL, ok INTEGER, result TEXT);
        CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS songs (name TEXT PRIMARY KEY, file TEXT, size INTEGER, created REAL, cover INTEGER);
    ''')
    try:
        with con:
            yield con
    finally:
        con.close()


def _get(con, k, default=None):
    row = con.execute('SELECT v FROM kv WHERE k=?', (k,)).fetchone()
    return json.loads(row['v']) if row else default


def _put(con, k, v):
    con.execute('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', (k, json.dumps(v)))


def _pc_state(con) -> dict:
    pc = _get(con, 'pc', {})
    online = bool(pc) and not pc.get('bye') and time.time() - pc.get('seen', 0) < ONLINE_S
    return {'online': online, 'since': pc.get('since') if online else None, 'jobs': pc.get('jobs', [])}


def _file_key(name: str) -> str:
    return hashlib.sha1(name.encode('utf-8')).hexdigest()[:20]


def _cleanup(con):
    now = time.time()
    con.execute('UPDATE orders SET done=?, ok=0, result=? WHERE done IS NULL AND taken IS NULL AND created<?',
                (now, json.dumps('Der PC zu Hause hat nicht reagiert.'), now - ORDER_TTL))
    con.execute('DELETE FROM orders WHERE created<?', (now - 3600,))
    rows = con.execute('SELECT name, file, size, created FROM songs ORDER BY created DESC').fetchall()
    total = 0
    for r in rows:
        total += r['size'] or 0
        if r['created'] < now - KEEP_S or total > MAX_BYTES:
            for suffix in ('.zip', '.jpg'):
                (FILES / (r['file'] + suffix)).unlink(missing_ok=True)
            con.execute('DELETE FROM songs WHERE name=?', (r['name'],))


# --- Zugriff -------------------------------------------------------------------------------------------

def _allowed_user() -> bool:
    users = [u.strip().lower() for u in os.environ.get('ULTRASONG_USERS', '').split(',') if u.strip()]
    user = get_current_user()
    return bool(user) and (not users or str(user.get('username', '')).lower() in users)


def _member(f):
    def wrapped(*a, **kw):
        if not get_current_user():
            if '/api/' in request.path:  # fetch() soll 401 sehen, keine Umleitung auf die Startseite
                return jsonify({'error': 'unauthorized', 'message': 'Bitte einloggen'}), 401
            return redirect(f'/?next={request.path}&login=1')
        if not _allowed_user():
            return jsonify({'error': 'forbidden', 'message': 'Kein Zugriff auf UltraSong'}), 403
        return f(*a, **kw)
    wrapped.__name__ = f.__name__
    return wrapped


def _pc(f):
    def wrapped(*a, **kw):
        key = os.environ.get('ULTRASONG_PC_KEY', '')
        given = request.headers.get('X-PC-Key', '')
        if not key or not hmac.compare_digest(given.encode(), key.encode()):
            abort(403)
        return f(*a, **kw)
    wrapped.__name__ = f.__name__
    return wrapped


# --- Browser -------------------------------------------------------------------------------------------

def _text(d, k, n=200):
    v = d.get(k)
    if not isinstance(v, str) or not v.strip() or len(v) > n:
        raise ValueError(k)
    return v.strip()


def _validate(kind: str, d: dict) -> dict:
    dur = d.get('duration') or 0
    dur = float(dur) if isinstance(dur, (int, float)) and 0 <= dur < 7200 else 0
    if kind == 'search':
        return {'q': _text(d, 'q')}
    if kind == 'lyrics':
        return {'artist': _text(d, 'artist'), 'title': _text(d, 'title'), 'duration': dur}
    if kind == 'create':
        vid = _text(d, 'id', 40)
        if not YT_ID.fullmatch(vid):
            raise ValueError('id')
        lyr = d.get('lyrics')
        if lyr is not None and (not isinstance(lyr, str) or len(lyr) > 20000):
            raise ValueError('lyrics')
        return {'id': vid, 'artist': _text(d, 'artist'), 'title': _text(d, 'title'), 'duration': dur,
                'lyrics': (lyr or '').strip() or None, 'replace': bool(d.get('replace'))}
    if kind == 'cancel':
        key = _text(d, 'key', 40)
        if not re.fullmatch(r'\w+', key):
            raise ValueError('key')
        return {'key': key}
    if kind == 'stop':
        return {}
    raise ValueError('kind')


@ultrasong_bp.route('/api/state')
@_member
def state():
    with _lock, _db() as con:
        _cleanup(con)
        pc = _pc_state(con)
        songs = [dict(r) for r in con.execute('SELECT name, size, created, cover FROM songs ORDER BY created DESC')]
    for s in songs:
        s['key'] = _file_key(s['name'])
    return jsonify({'pc': {'online': pc['online'], 'since': pc['since']}, 'jobs': pc['jobs'], 'songs': songs})


@ultrasong_bp.route('/api/order', methods=['POST'])
@_member
def order():
    body = request.get_json(silent=True) or {}
    kind = body.get('kind')
    try:
        data = _validate(kind, body.get('data') or {})
    except (ValueError, TypeError):
        return jsonify({'message': 'Ungültige Bestellung'}), 400
    user = str((get_current_user() or {}).get('username', '?'))
    now = time.time()
    with _lock, _db() as con:
        if not _pc_state(con)['online']:
            return jsonify({'message': 'Der PC zu Hause ist gerade aus.'}), 503
        recent = con.execute('SELECT COUNT(*) FROM orders WHERE user=? AND created>?', (user, now - 300)).fetchone()[0]
        if recent > 150:
            return jsonify({'message': 'Zu viele Bestellungen – kurz durchatmen.'}), 429
        cur = con.execute('INSERT INTO orders (user, kind, data, created) VALUES (?, ?, ?, ?)',
                          (user, kind, json.dumps(data), now))
    return jsonify({'id': cur.lastrowid})


@ultrasong_bp.route('/api/order/<int:oid>')
@_member
def order_result(oid: int):
    with _lock, _db() as con:
        _cleanup(con)
        r = con.execute('SELECT done, ok, result FROM orders WHERE id=?', (oid,)).fetchone()
    if r is None:
        return jsonify({'message': 'Unbekannte Bestellung'}), 404
    if r['done'] is None:
        return jsonify({'done': False})
    res = json.loads(r['result']) if r['result'] else None
    return jsonify({'done': True, 'ok': bool(r['ok']), 'data': res if r['ok'] else None,
                    'error': None if r['ok'] else res})


def _song(key: str):
    with _lock, _db() as con:
        for r in con.execute('SELECT name, file FROM songs'):
            if _file_key(r['name']) == key:
                return r['name'], FILES / (r['file'] + '.zip'), FILES / (r['file'] + '.jpg')
    abort(404)


@ultrasong_bp.route('/dl/<key>')
@_member
def download(key: str):
    name, z, _ = _song(key)
    if not z.is_file():
        abort(404)
    return send_file(z, mimetype='application/zip', as_attachment=True, download_name=f'{name}.zip')


@ultrasong_bp.route('/cover/<key>')
@_member
def cover(key: str):
    _, _, jpg = _song(key)
    if not jpg.is_file():
        abort(404)
    return send_file(jpg, mimetype='image/jpeg', max_age=3600)


class _Pipe:
    def __init__(self):
        self.buf = bytearray()

    def write(self, b):
        self.buf += b
        return len(b)

    def flush(self):
        pass

    def take(self) -> bytes:
        out, self.buf = bytes(self.buf), bytearray()
        return out


@ultrasong_bp.route('/dl-all')
@_member
def download_all():
    """Alle Songs seit ?seit=<unix-zeit> in einer ZIP (Song-Ordner nebeneinander), beim Senden erzeugt."""
    seit = request.args.get('seit', type=float) or 0
    with _lock, _db() as con:
        files = [FILES / (r['file'] + '.zip') for r in
                 con.execute('SELECT file FROM songs WHERE created>=? ORDER BY created', (seit,))]
    files = [f for f in files if f.is_file()]
    if not files:
        abort(404)

    def gen():
        pipe = _Pipe()
        with zipfile.ZipFile(pipe, 'w', zipfile.ZIP_STORED) as out:
            for f in files:
                with zipfile.ZipFile(f) as src:
                    for info in src.infolist():
                        with src.open(info) as a, out.open(info.filename, 'w', force_zip64=True) as b:
                            while chunk := a.read(256 * 1024):
                                b.write(chunk)
                                yield pipe.take()
        yield pipe.take()

    stamp = time.strftime('%d.%m.%Y')
    return Response(stream_with_context(gen()), mimetype='application/zip', headers={
        'Content-Disposition': f'attachment; filename="UltraSong {stamp} ({len(files)} Songs).zip"'})


# --- PC (UltraSong-Hub im Spielabend-Modus) -------------------------------------------------------------

@ultrasong_bp.route('/pc/sync', methods=['POST'])
@_pc
def pc_sync():
    body = request.get_json(silent=True) or {}
    now = time.time()
    with _lock, _db() as con:
        for res in body.get('results') or []:
            con.execute('UPDATE orders SET done=?, ok=?, result=? WHERE id=? AND done IS NULL',
                        (now, 1 if res.get('ok') else 0,
                         json.dumps(res.get('data') if res.get('ok') else res.get('error')), res.get('id')))
        jobs = body.get('jobs') if isinstance(body.get('jobs'), list) else []
        _put(con, 'pc', {'seen': now, 'since': body.get('since'), 'bye': bool(body.get('bye')), 'jobs': jobs[-20:]})
        if body.get('bye'):
            return jsonify({'ok': True})
        _cleanup(con)
        rows = con.execute('SELECT id, kind, data FROM orders WHERE taken IS NULL AND done IS NULL ORDER BY id').fetchall()
        con.executemany('UPDATE orders SET taken=? WHERE id=?', [(now, r['id']) for r in rows])
        have = [r['name'] for r in con.execute('SELECT name FROM songs')]
    return jsonify({'commands': [{'id': r['id'], 'kind': r['kind'], 'data': json.loads(r['data'])} for r in rows],
                    'have': have})


@ultrasong_bp.route('/pc/upload', methods=['POST'])
@_pc
def pc_upload():
    name = request.args.get('name', '')
    offset = request.args.get('offset', type=int)
    last = request.args.get('last') == '1'
    if not name or len(name) > 200 or any(c in name for c in '/\\\0') or name.strip('.') == '' or offset is None:
        abort(400)
    data = request.get_data(cache=False)
    if len(data) > MAX_CHUNK:
        abort(413)
    FILES.mkdir(parents=True, exist_ok=True)
    key = _file_key(name)
    part = FILES / (key + '.part')
    with _lock:
        size = part.stat().st_size if part.exists() else 0
        if offset == 0:
            size = 0
            part.write_bytes(b'')
        if offset != size:
            return jsonify({'message': f'Erwartet Offset {size}'}), 409
        with open(part, 'ab') as f:
            f.write(data)
        if not last:
            return jsonify({'ok': True})
        z = FILES / (key + '.zip')
        os.replace(part, z)
        has_cover = False
        try:
            with zipfile.ZipFile(z) as zf:
                imgs = [i for i in zf.namelist() if i.lower().endswith(('.jpg', '.jpeg'))]
                imgs.sort(key=lambda i: '[co]' not in i.lower())
                if imgs:
                    (FILES / (key + '.jpg')).write_bytes(zf.read(imgs[0]))
                    has_cover = True
        except zipfile.BadZipFile:
            z.unlink(missing_ok=True)
            return jsonify({'message': 'ZIP kaputt'}), 400
        with _db() as con:
            con.execute('INSERT OR REPLACE INTO songs (name, file, size, created, cover) VALUES (?, ?, ?, ?, ?)',
                        (name, key, z.stat().st_size, time.time(), int(has_cover)))
            _cleanup(con)
    return jsonify({'ok': True})
