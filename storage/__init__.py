"""Storage package for GameHub."""
from typing import Optional
from config import STORAGE_BACKEND, MONGODB_URI
from .base import BaseStorage
from .sqlite_adapter import SQLiteStorage

_storage_instance: Optional[BaseStorage] = None


def get_storage() -> BaseStorage:
    """Returns the configured storage singleton instance."""
    global _storage_instance
    if _storage_instance is None:
        backend = (STORAGE_BACKEND or 'sqlite').lower()
        if backend == 'sqlite':
            _storage_instance = SQLiteStorage()
        elif backend == 'mongodb':
            from .mongo_adapter import MongoStorage
            _storage_instance = MongoStorage(uri=MONGODB_URI)
        else:
            raise ValueError(f"Unsupported STORAGE_BACKEND: {STORAGE_BACKEND}")
    return _storage_instance
