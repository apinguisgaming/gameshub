"""Google Maps request tracking and structured logging service."""
import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from flask import Request

from config import DATA_DIR
from storage import get_storage

logger = logging.getLogger(__name__)

MAPS_LOG_DIR = Path(DATA_DIR) / 'logs'
MAPS_LOG_FILE = MAPS_LOG_DIR / 'maps_requests.log'


def extract_client_ip(req: Request) -> str:
    """Extracts client IP address, handling proxy headers (PythonAnywhere, Nginx, CDNs).
    
    If X-Forwarded-For is present with multiple IPs, the first IP is taken.
    """
    forwarded = req.headers.get('X-Forwarded-For', '')
    if forwarded:
        parts = [p.strip() for p in forwarded.split(',') if p.strip()]
        if parts:
            return parts[0]

    real_ip = req.headers.get('X-Real-IP')
    if real_ip and real_ip.strip():
        return real_ip.strip()

    return req.remote_addr or 'unknown'


def record_maps_request(
    req: Request,
    username: str,
    page: str,
    user_id: Optional[int] = None,
    action: str = 'map_load',
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Records a Google Maps API request to both a structured logfile and SQLite database.
    
    Args:
        req: Flask Request object
        username: Mandatory username associated with the request
        page: The subpage or URL where the map was triggered
        user_id: Optional user ID if authenticated in database
        action: Specific map action (e.g. 'sdk_init', 'picker_map_init', 'streetview_init')
        details: Optional dictionary of additional context data
        
    Returns:
        Dict with status, row ID, and recorded metadata
    """
    now_utc = datetime.now(timezone.utc)
    ts_formatted = now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')
    ip_address = extract_client_ip(req)
    user_agent = req.headers.get('User-Agent', 'unknown')
    clean_page = (page or req.path or '/geobingo/').strip()
    clean_action = (action or 'map_load').strip()

    # 1. Structured File Logging
    try:
        os.makedirs(MAPS_LOG_DIR, exist_ok=True)
        # Escape quotes in user agent and username for safe line parsing
        safe_ua = user_agent.replace('"', '\\"')
        safe_user = username.replace('"', '\\"')
        safe_page = clean_page.replace('"', '\\"')
        safe_action = clean_action.replace('"', '\\"')

        log_line = (
            f"[{ts_formatted}] USER=\"{safe_user}\" "
            f"IP=\"{ip_address}\" "
            f"PAGE=\"{safe_page}\" "
            f"ACTION=\"{safe_action}\" "
            f"UA=\"{safe_ua}\"\n"
        )

        with open(MAPS_LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_line)
    except Exception as e:
        logger.error(f"[MapsLogger] Failed writing to {MAPS_LOG_FILE}: {e}", exc_info=True)

    # 2. SQLite Database Persistence
    log_id = None
    try:
        storage = get_storage()
        log_id = storage.log_maps_request(
            username=username,
            ip_address=ip_address,
            page=clean_page,
            user_id=user_id,
            action=clean_action,
            user_agent=user_agent,
            details=details
        )
    except Exception as e:
        logger.error(f"[MapsLogger] Failed inserting into database: {e}", exc_info=True)

    return {
        'success': True,
        'log_id': log_id,
        'timestamp': ts_formatted,
        'username': username,
        'ip_address': ip_address,
        'page': clean_page,
        'action': clean_action
    }


def log_maps_penalty(
    username: str,
    ip_address: str,
    strike: int,
    duration_str: str,
    reason: str
) -> None:
    """Writes a formatted penalty event to maps_requests.log."""
    now_utc = datetime.now(timezone.utc)
    ts_formatted = now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')
    try:
        os.makedirs(MAPS_LOG_DIR, exist_ok=True)
        safe_user = username.replace('"', '\\"')
        safe_reason = reason.replace('"', '\\"')
        line = (
            f"[{ts_formatted}] PENALTY USER=\"{safe_user}\" "
            f"IP=\"{ip_address}\" "
            f"STRIKE={strike} "
            f"DURATION=\"{duration_str}\" "
            f"REASON=\"{safe_reason}\"\n"
        )
        with open(MAPS_LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line)
    except Exception as e:
        logger.error(f"[MapsLogger] Failed writing penalty log: {e}", exc_info=True)

