"""SQLite implementation of the BaseStorage interface."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import DATA_DIR
from .base import BaseStorage


class SQLiteStorage(BaseStorage):
    """Thread-safe SQLite storage adapter for GameHub."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or (DATA_DIR / 'gamehub.db')
        self._init_db()

    @contextmanager
    def _get_conn(self):
        """Context manager for SQLite connections with WAL mode and row factory."""
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA journal_mode = WAL;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initializes database schema if tables do not exist."""
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    avatar TEXT DEFAULT 'default',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS user_game_saves (
                    user_id INTEGER NOT NULL,
                    game_id TEXT NOT NULL,
                    state_data TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, game_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS game_lobbies (
                    game_id TEXT NOT NULL,
                    room_code TEXT NOT NULL,
                    state_data TEXT NOT NULL,
                    host_user_id INTEGER,
                    player_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'lobby',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (game_id, room_code),
                    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS game_stats (
                    user_id INTEGER NOT NULL,
                    game_id TEXT NOT NULL,
                    games_played INTEGER DEFAULT 0,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    high_score INTEGER DEFAULT 0,
                    stats_meta TEXT,
                    PRIMARY KEY (user_id, game_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS user_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS player_heartbeats (
                    game_id TEXT NOT NULL,
                    room_code TEXT NOT NULL,
                    username TEXT NOT NULL,
                    last_seen REAL NOT NULL,
                    PRIMARY KEY (game_id, room_code, username)
                );

                CREATE TABLE IF NOT EXISTS login_attempts (
                    ip_address TEXT NOT NULL,
                    attempted_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
            """)

            # Schema migration: add version column to game_lobbies if not present
            try:
                conn.execute("ALTER TABLE game_lobbies ADD COLUMN version INTEGER DEFAULT 1")
            except Exception:
                pass

            # Schema migration: add losses and stats_meta columns to game_stats if not present
            try:
                conn.execute("ALTER TABLE game_stats ADD COLUMN losses INTEGER DEFAULT 0")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE game_stats ADD COLUMN stats_meta TEXT")
            except Exception:
                pass

    # --- Session Tokens ---
    def create_session_token(self, user_id: int) -> str:
        import secrets
        token = secrets.token_hex(24)
        with self._get_conn() as conn:
            conn.execute("INSERT INTO user_sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        return token

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT u.* FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.token = ?
            """, (token.strip(),))
            row = cur.fetchone()
            return dict(row) if row else None

    def delete_session_token(self, token: str) -> None:
        if not token:
            return
        with self._get_conn() as conn:
            conn.execute("DELETE FROM user_sessions WHERE token = ?", (token.strip(),))

    # --- Users ---
    def create_user(self, username: str, password_hash: str, avatar: str = 'default') -> int:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)",
                (username.strip(), password_hash, avatar)
            )
            return cur.lastrowid

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username.strip(),))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def update_user(self, user_id: int, **fields: Any) -> None:
        if not fields:
            return
        allowed = {'username', 'password_hash', 'avatar', 'last_login'}
        update_fields = {k: v for k, v in fields.items() if k in allowed}
        if not update_fields:
            return
        set_clause = ", ".join(f"{k} = ?" for k in update_fields.keys())
        values = list(update_fields.values()) + [user_id]
        with self._get_conn() as conn:
            conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)

    # --- Personal Game Saves ---
    def save_game_state(self, user_id: int, game_id: str, state_data: Dict[str, Any]) -> None:
        serialized = json.dumps(state_data)
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO user_game_saves (user_id, game_id, state_data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, game_id) DO UPDATE SET
                    state_data = excluded.state_data,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, game_id, serialized))

    def load_game_state(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT state_data FROM user_game_saves WHERE user_id = ? AND game_id = ?",
                (user_id, game_id)
            )
            row = cur.fetchone()
            if row and row['state_data']:
                return json.loads(row['state_data'])
            return None

    # --- Multiplayer Lobbies ---
    def save_lobby(
        self,
        game_id: str,
        room_code: str,
        state: Dict[str, Any],
        host_user_id: Optional[int] = None,
        player_count: int = 0,
        status: str = 'lobby',
        expected_version: Optional[int] = None
    ) -> None:
        serialized = json.dumps(state)
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            if expected_version is not None:
                cur = conn.cursor()
                cur.execute("""
                    UPDATE game_lobbies SET
                        state_data = ?,
                        host_user_id = COALESCE(?, host_user_id),
                        player_count = ?,
                        status = ?,
                        updated_at = CURRENT_TIMESTAMP,
                        version = COALESCE(version, 1) + 1
                    WHERE game_id = ? AND room_code = ? AND version = ?
                """, (serialized, host_user_id, player_count, status, game_id, code, expected_version))
                if cur.rowcount == 0:
                    from .base import OptimisticLockError
                    raise OptimisticLockError(f"Concurrent write collision detected for {game_id}/{code}")
            else:
                conn.execute("""
                    INSERT INTO game_lobbies (game_id, room_code, state_data, host_user_id, player_count, status, updated_at, version)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
                    ON CONFLICT(game_id, room_code) DO UPDATE SET
                        state_data = excluded.state_data,
                        host_user_id = COALESCE(excluded.host_user_id, game_lobbies.host_user_id),
                        player_count = excluded.player_count,
                        status = excluded.status,
                        updated_at = CURRENT_TIMESTAMP,
                        version = COALESCE(game_lobbies.version, 1) + 1
                """, (game_id, code, serialized, host_user_id, player_count, status))

    def load_lobby(self, game_id: str, room_code: str) -> Optional[Dict[str, Any]]:
        import time
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            cur = conn.cursor()
            # Presence-aware prune: Only delete if BOTH no state update in 300s AND no active player heartbeats in 300s
            cur.execute("""
                DELETE FROM game_lobbies
                WHERE game_id = ? AND room_code = ?
                  AND updated_at < datetime('now', '-300 seconds')
                  AND NOT EXISTS (
                      SELECT 1 FROM player_heartbeats ph
                      WHERE ph.game_id = game_lobbies.game_id
                        AND ph.room_code = game_lobbies.room_code
                        AND ph.last_seen > ?
                  )
            """, (game_id, code, time.time() - 300.0))
            if cur.rowcount > 0:
                conn.execute(
                    "DELETE FROM player_heartbeats WHERE game_id = ? AND room_code = ?",
                    (game_id, code)
                )
                return None

            cur.execute(
                "SELECT state_data FROM game_lobbies WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )
            row = cur.fetchone()
            if row and row['state_data']:
                return json.loads(row['state_data'])
            return None

    def delete_lobby(self, game_id: str, room_code: str) -> None:
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            conn.execute(
                "DELETE FROM game_lobbies WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )
            conn.execute(
                "DELETE FROM player_heartbeats WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )

    def touch_lobby(self, game_id: str, room_code: str) -> None:
        """Refreshes updated_at timestamp so an active room is not cleaned up."""
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE game_lobbies SET updated_at = CURRENT_TIMESTAMP WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )

    def cleanup_inactive_lobbies(self, max_idle_seconds: int = 300) -> int:
        """Deletes all lobbies with no state updates AND no active player heartbeats."""
        import time
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                DELETE FROM game_lobbies
                WHERE updated_at < datetime('now', ?)
                  AND NOT EXISTS (
                      SELECT 1 FROM player_heartbeats ph
                      WHERE ph.game_id = game_lobbies.game_id
                        AND ph.room_code = game_lobbies.room_code
                        AND ph.last_seen > ?
                  )
            """, (f"-{max_idle_seconds} seconds", time.time() - max_idle_seconds))
            deleted = cur.rowcount
            if deleted > 0:
                conn.execute("""
                    DELETE FROM player_heartbeats
                    WHERE NOT EXISTS (
                        SELECT 1 FROM game_lobbies gl
                        WHERE gl.game_id = player_heartbeats.game_id
                          AND gl.room_code = player_heartbeats.room_code
                    )
                """)
            return deleted

    def list_lobbies(self, game_id: str) -> List[Dict[str, Any]]:
        # Auto-prune lobbies inactive for 300 seconds
        self.cleanup_inactive_lobbies(300)
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT 
                    l.room_code,
                    l.game_id,
                    l.player_count,
                    l.status,
                    l.created_at,
                    l.updated_at,
                    u.username AS host_username,
                    u.avatar AS host_avatar
                FROM game_lobbies l
                LEFT JOIN users u ON l.host_user_id = u.id
                WHERE l.game_id = ?
                ORDER BY l.updated_at DESC
            """, (game_id,))
            return [dict(r) for r in cur.fetchall()]

    # --- Leaderboards & Stats ---
    def update_stats(self, user_id: int, game_id: str, **stat_deltas: Any) -> None:
        games_played_delta = stat_deltas.get('games_played', 0)
        wins_delta = stat_deltas.get('wins', 0)
        losses_delta = stat_deltas.get('losses', 0)
        new_score = stat_deltas.get('high_score', None)

        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM game_stats WHERE user_id = ? AND game_id = ?",
                (user_id, game_id)
            )
            row = cur.fetchone()
            if row:
                current_high = row['high_score']
                updated_high = max(current_high, new_score) if new_score is not None else current_high
                cur.execute("""
                    UPDATE game_stats SET
                        games_played = games_played + ?,
                        wins = wins + ?,
                        losses = losses + ?,
                        high_score = ?
                    WHERE user_id = ? AND game_id = ?
                """, (games_played_delta, wins_delta, losses_delta, updated_high, user_id, game_id))
            else:
                initial_high = new_score if new_score is not None else 0
                cur.execute("""
                    INSERT INTO game_stats (user_id, game_id, games_played, wins, losses, high_score)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, game_id, games_played_delta, wins_delta, losses_delta, initial_high))

    def get_stats(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM game_stats WHERE user_id = ? AND game_id = ?",
                (user_id, game_id)
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_leaderboard(self, game_id: str, metric: str = 'wins', limit: int = 10) -> List[Dict[str, Any]]:
        valid_metrics = {'wins', 'games_played', 'high_score'}
        sort_metric = metric if metric in valid_metrics else 'wins'
        limit = max(1, min(limit, 50))

        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT 
                    s.user_id,
                    u.username,
                    u.avatar,
                    s.games_played,
                    s.wins,
                    s.losses,
                    s.high_score
                FROM game_stats s
                JOIN users u ON s.user_id = u.id
                WHERE s.game_id = ?
                ORDER BY s.{sort_metric} DESC
                LIMIT ?
            """, (game_id, limit))
            return [dict(r) for r in cur.fetchall()]

    # --- Heartbeat Tracking ---
    def upsert_heartbeat(self, game_id: str, room_code: str, username: str, timestamp: float) -> None:
        """Inserts or updates a player's last-seen heartbeat timestamp in SQLite."""
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO player_heartbeats (game_id, room_code, username, last_seen)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(game_id, room_code, username) DO UPDATE SET last_seen = excluded.last_seen
            """, (game_id, code, username, timestamp))

    def get_room_heartbeats(self, game_id: str, room_code: str) -> Dict[str, float]:
        """Returns {username: last_seen} dictionary for all tracked players in a room."""
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT username, last_seen FROM player_heartbeats WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )
            return {row['username']: row['last_seen'] for row in cur.fetchall()}

    def delete_heartbeat(self, game_id: str, room_code: str, username: str) -> None:
        """Removes a player from heartbeat tracking."""
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            conn.execute(
                "DELETE FROM player_heartbeats WHERE game_id = ? AND room_code = ? AND username = ?",
                (game_id, code, username)
            )

    def delete_room_heartbeats(self, game_id: str, room_code: str) -> None:
        """Removes all heartbeats for a room."""
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            conn.execute(
                "DELETE FROM player_heartbeats WHERE game_id = ? AND room_code = ?",
                (game_id, code)
            )

    def has_active_heartbeats(self, game_id: str, room_code: str, max_age_seconds: int = 300) -> bool:
        """Returns True if any player in the room has reported a heartbeat within max_age_seconds."""
        import time
        code = room_code.upper().strip()
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT 1 FROM player_heartbeats WHERE game_id = ? AND room_code = ? AND last_seen > ? LIMIT 1",
                (game_id, code, time.time() - max_age_seconds)
            )
            return cur.fetchone() is not None

    # --- Rate Limiting ---
    def record_failed_login(self, ip: str) -> None:
        """Records a failed login attempt and prunes attempts older than 5 minutes."""
        import time
        now = time.time()
        with self._get_conn() as conn:
            conn.execute("INSERT INTO login_attempts (ip_address, attempted_at) VALUES (?, ?)", (ip, now))
            conn.execute("DELETE FROM login_attempts WHERE attempted_at < ?", (now - 300.0,))

    def count_recent_failures(self, ip: str, window_seconds: float = 60.0) -> int:
        """Returns the number of failed login attempts from an IP within window_seconds."""
        import time
        threshold = time.time() - window_seconds
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip_address = ? AND attempted_at > ?",
                (ip, threshold)
            )
            row = cur.fetchone()
            return row['cnt'] if row else 0

    def clear_failed_logins(self, ip: str) -> None:
        """Clears all failed login attempts for an IP address."""
        with self._get_conn() as conn:
            conn.execute("DELETE FROM login_attempts WHERE ip_address = ?", (ip,))

    # --- Session Maintenance ---
    def cleanup_expired_sessions(self, max_age_days: int = 30) -> int:
        """Deletes session tokens older than max_age_days."""
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM user_sessions WHERE created_at < datetime('now', ?)",
                (f"-{max_age_days} days",)
            )
            return cur.rowcount
