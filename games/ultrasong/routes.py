"""UltraSong: Songwuensche von unterwegs an den PC zu Hause.

Die Seite ist ein Briefkasten. Browser legen Bestellungen ab (Suche, Songtext-Check, Erstellen, Abbrechen).
Der UltraSong-Hub auf dem PC holt sie im Spielabend-Modus im Sekundentakt ab (/ultrasong/pc/sync, mit
PC-Schluessel), liefert die Antworten beim naechsten Abholen zurueck und meldet seine fertigen Songs (nur
Name, Groesse, kleines Cover). Die ZIP laedt er erst hoch, wenn jemand "Herunterladen" drueckt ("fetch");
nach dem vollstaendigen Download wird sie hier sofort geloescht. Platz belegen also nur Songs, die gerade
unterwegs sind. "Spielabend beenden" duerfen nur Admins (users.role, siehe set_role.py).
Der PC ist von aussen nie erreichbar; ohne laufenden Spielabend zeigt die Seite "PC ist aus".

.env: ULTRASONG_PC_KEY (Pflicht, derselbe Schluessel wie in den Hub-Einstellungen),
      ULTRASONG_USERS (optional, kommagetrennte Benutzernamen; leer = alle eingeloggten),
      ULTRASONG_CLIENT_KEY (optional, Schluessel fuer UltraStar Deluxe: Header X-Client-Key statt Login;
      darf suchen, Songtexte pruefen, erstellen, abbrechen und herunterladen - aber nicht beenden),
      ULTRASONG_B2_BUCKET, _ENDPOINT, _KEY_ID, _KEY (optional, Backblaze B2): dann laedt der PC die ZIPs
      direkt dorthin hoch und Browser/Spiel laden sie von dort - die Seite stellt nur kurz gueltige Links
      aus (hier signiert, ohne Verbindung zu B2). Aufraeumen per Lifecycle-Regel im Bucket (Praefix songs/).
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
from urllib.parse import quote

from flask import Blueprint, Response, abort, jsonify, redirect, request, send_file, stream_with_context

from apps.auth.decorators import get_current_user, is_admin
from config import DATA_DIR

ultrasong_bp = Blueprint('ultrasong_bp', __name__)

FILES = Path(DATA_DIR) / 'ultrasong'
DB = Path(DATA_DIR) / 'ultrasong.db'
ONLINE_S = 10            # so lange nach dem letzten Abholen gilt der PC als online
ORDER_TTL = 60           # nicht abgeholte Bestellungen verfallen danach
UPLOAD_KEEP_S = 3600     # abgebrochene Downloads: hochgeladene ZIP spaetestens dann weg
MAX_CHUNK = 8 << 20
MAX_COVER = 2 << 20
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
        CREATE TABLE IF NOT EXISTS pc_songs (name TEXT PRIMARY KEY, size INTEGER, created REAL);
        CREATE TABLE IF NOT EXISTS uploads (name TEXT PRIMARY KEY, size INTEGER, at REAL);
        DROP TABLE IF EXISTS songs;
    ''')
    if 'obj' not in [c[1] for c in con.execute('PRAGMA table_info(uploads)')]:
        con.execute('ALTER TABLE uploads ADD COLUMN obj TEXT')   # Objekt in B2, sonst liegt die ZIP hier
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
    for r in con.execute('SELECT name FROM uploads WHERE at<?', (now - UPLOAD_KEEP_S,)).fetchall():
        _drop_upload(con, r['name'])
    if FILES.is_dir():   # Reste (Covers geloeschter Songs, abgebrochene Uploads) nach einer Stunde weg
        keep = {_file_key(r['name']) + '.zip' for r in con.execute('SELECT name FROM uploads')}
        keep |= {_file_key(r['name']) + '.jpg' for r in con.execute('SELECT name FROM pc_songs')}
        for f in FILES.iterdir():
            if f.name not in keep and f.stat().st_mtime < now - 3600:
                f.unlink(missing_ok=True)


def _drop_upload(con, name: str):
    (FILES / (_file_key(name) + '.zip')).unlink(missing_ok=True)
    con.execute('DELETE FROM uploads WHERE name=?', (name,))


# --- Backblaze B2 (S3-Schnittstelle, vorsignierte Links) -----------------------------------------------

LINK_S = 3600            # so lange gelten Upload- und Download-Links


def _b2():
    cfg = {k: os.environ.get('ULTRASONG_B2_' + k.upper(), '').strip() for k in ('bucket', 'endpoint', 'key_id', 'key')}
    cfg['endpoint'] = re.sub(r'^https?://', '', cfg['endpoint']).rstrip('/')
    return cfg if all(cfg.values()) else None


def _sign_url(method: str, host: str, path: str, region: str, key_id: str, secret: str, expires: int,
              extra: dict = None, now: float = None) -> str:
    """AWS-Signatur V4 als Query-Parameter (UNSIGNED-PAYLOAD), wie sie S3 und B2 verstehen."""
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime(time.time() if now is None else now))
    scope = f'{stamp[:8]}/{region}/s3/aws4_request'
    q = {'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': f'{key_id}/{scope}', 'X-Amz-Date': stamp,
         'X-Amz-Expires': str(expires), 'X-Amz-SignedHeaders': 'host', **(extra or {})}
    qs = '&'.join(f"{quote(k, safe='-_.~')}={quote(v, safe='-_.~')}" for k, v in sorted(q.items()))
    uri = quote(path, safe='/-_.~')
    canon = '\n'.join([method, uri, qs, f'host:{host}\n', 'host', 'UNSIGNED-PAYLOAD'])
    to_sign = '\n'.join(['AWS4-HMAC-SHA256', stamp, scope, hashlib.sha256(canon.encode()).hexdigest()])
    k = ('AWS4' + secret).encode()
    for part in (stamp[:8], region, 's3', 'aws4_request'):
        k = hmac.new(k, part.encode(), hashlib.sha256).digest()
    sig = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    return f'https://{host}{uri}?{qs}&X-Amz-Signature={sig}'


def _b2_url(method: str, obj: str, filename: str = None) -> str:
    b = _b2()
    region = b['endpoint'].split('.')[1] if b['endpoint'].count('.') >= 2 else 'us-east-1'
    extra = {'response-content-disposition': "attachment; filename*=UTF-8''" + quote(filename)} if filename else None
    return _sign_url(method, b['endpoint'], f"/{b['bucket']}/{obj}", region, b['key_id'], b['key'], LINK_S, extra)


# --- Zugriff -------------------------------------------------------------------------------------------

def _allowed_user() -> bool:
    users = [u.strip().lower() for u in os.environ.get('ULTRASONG_USERS', '').split(',') if u.strip()]
    user = get_current_user()
    return bool(user) and (not users or str(user.get('username', '')).lower() in users)


CLIENT_USER = 'ultrastar'


def _client() -> bool:
    """Anfrage von UltraStar Deluxe (X-Client-Key) statt aus dem Browser."""
    key = os.environ.get('ULTRASONG_CLIENT_KEY', '')
    given = request.headers.get('X-Client-Key', '')
    return bool(key and given) and hmac.compare_digest(given.encode(), key.encode())


def _member(f):
    def wrapped(*a, **kw):
        if _client():
            return f(*a, **kw)
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
    if kind == 'fetch':
        names = d.get('names')
        if not isinstance(names, list) or not 1 <= len(names) <= 30 or not all(isinstance(n, str) and n for n in names):
            raise ValueError('names')
        # compat: Originale (MP3/H.264) statt der kleinen Fassung (Opus/AV1) fuer aeltere UltraStar-Versionen
        return {'names': names, 'compat': bool(d.get('compat'))}
    if kind == 'stop':
        return {}
    raise ValueError('kind')


@ultrasong_bp.route('/api/state')
@_member
def state():
    with _lock, _db() as con:
        _cleanup(con)
        pc = _pc_state(con)
        songs = [dict(r) for r in con.execute('SELECT name, size, created FROM pc_songs ORDER BY created DESC')]
    for s in songs:
        s['key'] = _file_key(s['name'])
        s['cover'] = int((FILES / (s['key'] + '.jpg')).is_file())
    return jsonify({'pc': {'online': pc['online'], 'since': pc['since']}, 'jobs': pc['jobs'], 'songs': songs,
                    'admin': not _client() and is_admin()})


@ultrasong_bp.route('/api/order', methods=['POST'])
@_member
def order():
    body = request.get_json(silent=True) or {}
    kind = body.get('kind')
    try:
        data = _validate(kind, body.get('data') or {})
    except (ValueError, TypeError):
        return jsonify({'message': 'Ungültige Bestellung'}), 400
    if kind == 'stop' and (_client() or not is_admin()):
        return jsonify({'message': 'Nur Admins können den Spielabend beenden.'}), 403
    user = CLIENT_USER if _client() else str((get_current_user() or {}).get('username', '?'))
    now = time.time()
    with _lock, _db() as con:
        if not _pc_state(con)['online']:
            return jsonify({'message': 'Der PC zu Hause ist gerade aus.'}), 503
        if kind == 'fetch' and _client():
            # das Spiel darf jeden Song der Bibliothek holen (auch aeltere, die die Suche als vorhanden meldet)
            if not all(_valid_name(n) for n in data['names']):
                return jsonify({'message': 'Ungültige Bestellung'}), 400
            data['any'] = True
        elif kind == 'fetch':
            known = {r['name'] for r in con.execute('SELECT name FROM pc_songs')}
            if not set(data['names']) <= known:
                return jsonify({'message': 'Diesen Song gibt es am PC nicht (mehr).'}), 404
        recent = con.execute('SELECT COUNT(*) FROM orders WHERE user=? AND created>?', (user, now - 300)).fetchone()[0]
        if recent > (600 if _client() else 150):   # das Spiel prueft pro Suche ~20 Songtexte
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
    return jsonify(_result(r))


@ultrasong_bp.route('/api/orders')
@_member
def order_results():
    """Mehrere Bestellungen auf einmal (?ids=1,2,3): eine Anfrage statt einer pro Songtext-Check."""
    try:
        ids = [int(i) for i in request.args.get('ids', '').split(',') if i.strip()][:50]
    except ValueError:
        return jsonify({'message': 'Ungültige ids'}), 400
    if not ids:
        return jsonify({})
    with _lock, _db() as con:
        _cleanup(con)
        rows = con.execute(f"SELECT id, done, ok, result FROM orders WHERE id IN ({','.join('?' * len(ids))})",
                           ids).fetchall()
    return jsonify({str(r['id']): _result(r) for r in rows})


def _result(r) -> dict:
    if r['done'] is None:
        return {'done': False}
    res = json.loads(r['result']) if r['result'] else None
    return {'done': True, 'ok': bool(r['ok']), 'data': res if r['ok'] else None, 'error': None if r['ok'] else res}


@ultrasong_bp.route('/links')
@_member
def links():
    """Download-Links direkt zu B2 (?keys=a,b); {'files': null}, wenn die ZIPs hier liegen (dann /dl, /dl-all)."""
    keys = [k for k in request.args.get('keys', '').split(',') if k][:50]
    with _lock, _db() as con:
        by_key = {_file_key(r['name']): dict(r) for r in con.execute('SELECT name, size, obj FROM uploads')}
    if not keys or not all(k in by_key for k in keys):
        abort(404)
    if not _b2() or not all(by_key[k]['obj'] for k in keys):
        return jsonify({'files': None})
    return jsonify({'files': [{'name': by_key[k]['name'], 'size': by_key[k]['size'],
                               'url': _b2_url('GET', by_key[k]['obj'], by_key[k]['name'] + '.zip')} for k in keys]})


def _uploaded(keys: list) -> list:
    """(Name, ZIP-Pfad) der hier hochgeladenen Songs zu den Schluesseln, in dieser Reihenfolge."""
    with _lock, _db() as con:
        by_key = {_file_key(r['name']): r['name'] for r in con.execute('SELECT name FROM uploads WHERE obj IS NULL')}
    out = [(by_key[k], FILES / (k + '.zip')) for k in keys if k in by_key]
    if len(out) != len(keys) or not all(z.is_file() for _, z in out):
        abort(404)
    return out


def _then_delete(chunks, names: list):
    """Reicht die Daten durch und loescht die ZIPs, sobald alles beim Browser angekommen ist."""
    complete = False
    try:
        yield from chunks
        complete = True
    finally:
        if complete:   # abgebrochen: liegen lassen fuer einen neuen Versuch (_cleanup raeumt nach 1 h)
            with _lock, _db() as con:
                for n in names:
                    _drop_upload(con, n)


def _read(path: Path):
    with open(path, 'rb') as f:
        while chunk := f.read(256 * 1024):
            yield chunk


@ultrasong_bp.route('/dl/<key>')
@_member
def download(key: str):
    [(name, z)] = _uploaded([key])
    return Response(_then_delete(_read(z), [name]), mimetype='application/zip', headers={
        'Content-Length': str(z.stat().st_size),
        'Content-Disposition': f"attachment; filename*=UTF-8''{quote(name)}.zip"})


@ultrasong_bp.route('/cover/<key>')
@_member
def cover(key: str):
    jpg = FILES / (key + '.jpg')
    if not re.fullmatch(r'[0-9a-f]{20}', key) or not jpg.is_file():
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
    """Mehrere hochgeladene Songs (?keys=a,b,...) in einer ZIP (Song-Ordner nebeneinander), beim Senden erzeugt."""
    keys = [k for k in request.args.get('keys', '').split(',') if k]
    if not keys:
        abort(404)
    songs = _uploaded(keys)
    files = [z for _, z in songs]

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
    return Response(stream_with_context(_then_delete(gen(), [n for n, _ in songs])), mimetype='application/zip', headers={
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
        if body.get('bye'):   # PC aus: Songliste und Covers weg, hier bleibt nichts liegen
            for r in con.execute('SELECT name FROM pc_songs').fetchall():
                (FILES / (_file_key(r['name']) + '.jpg')).unlink(missing_ok=True)
            con.execute('DELETE FROM pc_songs')
            return jsonify({'ok': True})
        if isinstance(body.get('songs'), list):
            con.execute('DELETE FROM pc_songs')
            con.executemany('INSERT OR REPLACE INTO pc_songs (name, size, created) VALUES (?, ?, ?)',
                            [(s['name'], int(s.get('size') or 0), float(s.get('created') or 0))
                             for s in body['songs'][:200] if isinstance(s, dict) and _valid_name(s.get('name'))])
        _cleanup(con)
        rows = con.execute('SELECT id, kind, data FROM orders WHERE taken IS NULL AND done IS NULL ORDER BY id').fetchall()
        con.executemany('UPDATE orders SET taken=? WHERE id=?', [(now, r['id']) for r in rows])
        covers = [r['name'] for r in con.execute('SELECT name FROM pc_songs')
                  if (FILES / (_file_key(r['name']) + '.jpg')).is_file()]
    return jsonify({'commands': [{'id': r['id'], 'kind': r['kind'], 'data': json.loads(r['data'])} for r in rows],
                    'covers': covers})


def _valid_name(name) -> bool:
    return isinstance(name, str) and 0 < len(name) <= 200 and not any(c in name for c in '/\\\0') and name.strip('.') != ''


@ultrasong_bp.route('/pc/cover', methods=['POST'])
@_pc
def pc_cover():
    name = request.args.get('name', '')
    data = request.get_data(cache=False)
    if not _valid_name(name) or not data or len(data) > MAX_COVER:
        abort(400)
    FILES.mkdir(parents=True, exist_ok=True)
    (FILES / (_file_key(name) + '.jpg')).write_bytes(data)
    return jsonify({'ok': True})


@ultrasong_bp.route('/pc/upload', methods=['POST'])
@_pc
def pc_upload():
    name = request.args.get('name', '')
    offset = request.args.get('offset', type=int)
    last = request.args.get('last') == '1'
    if not _valid_name(name) or offset is None:
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
        if not zipfile.is_zipfile(part):
            part.unlink(missing_ok=True)
            return jsonify({'message': 'ZIP kaputt'}), 400
        os.replace(part, z)
        with _db() as con:
            con.execute('INSERT OR REPLACE INTO uploads (name, size, at, obj) VALUES (?, ?, ?, NULL)',
                        (name, z.stat().st_size, time.time()))
            _cleanup(con)
    return jsonify({'ok': True})


@ultrasong_bp.route('/pc/b2', methods=['POST'])
@_pc
def pc_b2():
    """Upload-Link fuer eine ZIP (?name=), 404 ohne B2 - dann laedt der PC wie bisher stueckweise hierher."""
    name = request.args.get('name', '')
    if not _valid_name(name):
        abort(400)
    if not _b2():
        abort(404)
    obj = f'songs/{_file_key(name)}-{int(time.time() * 1000)}.zip'
    return jsonify({'obj': obj, 'url': _b2_url('PUT', obj)})


@ultrasong_bp.route('/pc/b2-done', methods=['POST'])
@_pc
def pc_b2_done():
    """Der PC hat die ZIP nach B2 hochgeladen (?name=&obj=&size=)."""
    name, obj = request.args.get('name', ''), request.args.get('obj', '')
    size = request.args.get('size', type=int)
    if not _valid_name(name) or not re.fullmatch(r'songs/[0-9a-f]{20}-\d+\.zip', obj) or not size:
        abort(400)
    with _lock, _db() as con:
        _drop_upload(con, name)   # aeltere Fassung hier, falls vorhanden
        con.execute('INSERT INTO uploads (name, size, at, obj) VALUES (?, ?, ?, ?)', (name, size, time.time(), obj))
    return jsonify({'ok': True})
