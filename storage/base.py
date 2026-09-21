"""Abstract base class for storage adapters in GameHub."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseStorage(ABC):
    """Interface defining all persistence operations for GameHub."""

    # --- Users ---
    @abstractmethod
    def create_user(self, username: str, password_hash: str, avatar: str = 'default') -> int:
        """Create a new user and return user_id."""
        pass

    @abstractmethod
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Find a user by username (case-insensitive)."""
        pass

    @abstractmethod
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Find a user by user_id."""
        pass

    @abstractmethod
    def update_user(self, user_id: int, **fields: Any) -> None:
        """Update fields for a user."""
        pass

    # --- Session Tokens (Tab Isolation) ---
    @abstractmethod
    def create_session_token(self, user_id: int) -> str:
        """Generate and save a session token for tab-isolated authentication."""
        pass

    @abstractmethod
    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Look up authenticated user by session token."""
        pass

    @abstractmethod
    def delete_session_token(self, token: str) -> None:
        """Invalidate a session token upon logout."""
        pass

    # --- Personal Game Saves (Single-Player Cloud Sync) ---
    @abstractmethod
    def save_game_state(self, user_id: int, game_id: str, state_data: Dict[str, Any]) -> None:
        """Save or overwrite a user's single-player state for a game."""
        pass

    @abstractmethod
    def load_game_state(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        """Load a user's single-player state for a game."""
        pass

    # --- Multiplayer Lobbies (Shared Room State) ---
    @abstractmethod
    def save_lobby(
        self,
        game_id: str,
        room_code: str,
        state: Dict[str, Any],
        host_user_id: Optional[int] = None,
        player_count: int = 0,
        status: str = 'lobby'
    ) -> None:
        """Save or update a multiplayer lobby."""
        pass

    @abstractmethod
    def load_lobby(self, game_id: str, room_code: str) -> Optional[Dict[str, Any]]:
        """Load full lobby state dictionary."""
        pass

    @abstractmethod
    def delete_lobby(self, game_id: str, room_code: str) -> None:
        """Delete a multiplayer lobby."""
        pass

    @abstractmethod
    def list_lobbies(self, game_id: str) -> List[Dict[str, Any]]:
        """List active lobbies for a game."""
        pass

    def find_player_room(self, game_id: str, username: str) -> Optional[str]:
        """Find the active room code for a given player in a game."""
        return None

    def touch_lobby(self, game_id: str, room_code: str) -> None:
        """Updates last-active timestamp of a lobby."""
        pass

    def cleanup_inactive_lobbies(self, max_idle_seconds: int = 300) -> int:
        """Deletes lobbies inactive for more than max_idle_seconds."""
        return 0

    # --- Leaderboards & Stats ---
    @abstractmethod
    def update_stats(self, user_id: int, game_id: str, **stat_deltas: Any) -> None:
        """Increment or update game statistics for a user."""
        pass

    @abstractmethod
    def get_stats(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        """Get stats for a user on a specific game."""
        pass

    @abstractmethod
    def get_leaderboard(self, game_id: str, metric: str = 'wins', limit: int = 10) -> List[Dict[str, Any]]:
        """Get top players for a specific game metric."""
        pass

    # --- Heartbeat Tracking ---
    def upsert_heartbeat(self, game_id: str, room_code: str, username: str, timestamp: float) -> None:
        """Updates or inserts a player's heartbeat timestamp."""
        pass

    def get_room_heartbeats(self, game_id: str, room_code: str) -> Dict[str, float]:
        """Returns {username: last_seen} for all tracked players in a room."""
        return {}

    def delete_heartbeat(self, game_id: str, room_code: str, username: str) -> None:
        """Deletes a player's heartbeat record."""
        pass

    def delete_room_heartbeats(self, game_id: str, room_code: str) -> None:
        """Deletes all heartbeat records for a room."""
        pass

    def has_active_heartbeats(self, game_id: str, room_code: str, max_age_seconds: int = 300) -> bool:
        """Checks if any player in the room has reported a heartbeat within max_age_seconds."""
        return False

    # --- Rate Limiting ---
    def record_failed_login(self, ip: str) -> None:
        """Records a failed login attempt for an IP address."""
        pass

    def count_recent_failures(self, ip: str, window_seconds: float = 60.0) -> int:
        """Counts failed login attempts from an IP within window_seconds."""
        return 0

    def clear_failed_logins(self, ip: str) -> None:
        """Clears failed login attempts for an IP upon successful login."""
        pass

    # --- Session Token Maintenance ---
    def cleanup_expired_sessions(self, max_age_days: int = 30) -> int:
        """Purges session tokens older than max_age_days."""
        return 0

    # --- Google Maps API Request Logging ---
    def log_maps_request(
        self,
        username: str,
        ip_address: str,
        page: str,
        user_id: Optional[int] = None,
        action: str = 'map_load',
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> int:
        """Logs a Google Maps client-side request and returns record id."""
        return 0

    def get_maps_logs(self, limit: int = 100, username: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves recent Google Maps API request logs."""
        return []

    # --- Google Maps Rate Limiting & Penalties ---
    def check_maps_penalty(self, username: str, ip_address: str) -> Dict[str, Any]:
        """Checks if a user or IP is currently subject to a Maps rate limit penalty."""
        return {'blocked': False, 'is_permanent': False, 'strike_count': 0, 'remaining_seconds': 0, 'last_strike_at': None}

    def count_recent_maps_activity(
        self,
        username: str,
        ip_address: str,
        after_timestamp: Optional[str] = None,
        window_seconds: int = 300
    ) -> Dict[str, int]:
        """Counts maps activity within window_seconds, optionally restricted to after_timestamp for cascade protection."""
        return {'sdk_inits': 0, 'total_requests': 0}

    def record_maps_penalty_strike(
        self,
        username: str,
        ip_address: str,
        reason: str = 'excessive_reloads'
    ) -> Dict[str, Any]:
        """Escalates penalty strike count and computes cooldown duration or permanent ban."""
        return {'strike_count': 1, 'blocked_until': 0, 'is_permanent': False, 'duration_seconds': 60}


class OptimisticLockError(Exception):
    """Raised when a concurrent write collision is detected during optimistic locking."""
    pass

