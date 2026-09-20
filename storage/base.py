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


class OptimisticLockError(Exception):
    """Raised when a concurrent write collision is detected during optimistic locking."""
    pass

