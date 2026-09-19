"""MongoDB stub adapter for GameHub (future migration target)."""
from typing import Any, Dict, List, Optional
from .base import BaseStorage


class MongoStorage(BaseStorage):
    """MongoDB storage adapter implementation for GameHub.
    
    Activates when STORAGE_BACKEND = 'mongodb' and MONGODB_URI is provided.
    """

    def __init__(self, uri: Optional[str] = None):
        self.uri = uri
        raise NotImplementedError(
            "MongoDB adapter is not yet fully configured. "
            "Please use STORAGE_BACKEND='sqlite' or complete the MongoStorage implementation."
        )

    def create_user(self, username: str, password_hash: str, avatar: str = 'default') -> int:
        raise NotImplementedError

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def update_user(self, user_id: int, **fields: Any) -> None:
        raise NotImplementedError

    def save_game_state(self, user_id: int, game_id: str, state_data: Dict[str, Any]) -> None:
        raise NotImplementedError

    def load_game_state(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def save_lobby(
        self,
        game_id: str,
        room_code: str,
        state: Dict[str, Any],
        host_user_id: Optional[int] = None,
        player_count: int = 0,
        status: str = 'lobby'
    ) -> None:
        raise NotImplementedError

    def load_lobby(self, game_id: str, room_code: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def delete_lobby(self, game_id: str, room_code: str) -> None:
        raise NotImplementedError

    def list_lobbies(self, game_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def update_stats(self, user_id: int, game_id: str, **stat_deltas: Any) -> None:
        raise NotImplementedError

    def get_stats(self, user_id: int, game_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def get_leaderboard(self, game_id: str, metric: str = 'wins', limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError
