"""Tiefenfeuer – idle mining/colony prototype (built from the separate Vite project)."""
from .manifest import MANIFEST
from .routes import tiefenfeuer_bp, tiefenfeuer_bp as bp

__all__ = ['MANIFEST', 'tiefenfeuer_bp', 'bp']
