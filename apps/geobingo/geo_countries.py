"""Offline Reverse Geocoding & Country Boundary Engine for GeoBingo.
Zero external API calls, pure Python ray-casting on simplified Natural Earth boundaries.
"""
import json
import os
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_COUNTRIES_DATA: Optional[List[Dict[str, Any]]] = None
_COUNTRIES_BY_CODE: Optional[Dict[str, Dict[str, Any]]] = None
_UI_COUNTRY_LIST: Optional[List[Dict[str, str]]] = None


def _load_data_if_needed():
    """Loads and caches the countries dataset in memory."""
    global _COUNTRIES_DATA, _COUNTRIES_BY_CODE, _UI_COUNTRY_LIST
    if _COUNTRIES_DATA is not None:
        return

    data_path = os.path.join(os.path.dirname(__file__), "data", "countries.json")
    if not os.path.exists(data_path):
        logger.error(f"[GeoBingo Geo] countries.json not found at {data_path}")
        _COUNTRIES_DATA = []
        _COUNTRIES_BY_CODE = {}
        _UI_COUNTRY_LIST = []
        return

    try:
        with open(data_path, "r", encoding="utf-8") as f:
            _COUNTRIES_DATA = json.load(f)

        _COUNTRIES_BY_CODE = {c["code"].upper(): c for c in _COUNTRIES_DATA}
        _UI_COUNTRY_LIST = [
            {
                "code": c["code"],
                "name_de": c["name_de"],
                "name_en": c["name_en"],
                "flag": c["flag"],
            }
            for c in _COUNTRIES_DATA
        ]
        logger.info(f"[GeoBingo Geo] Loaded {len(_COUNTRIES_DATA)} countries for offline reverse geocoding.")
    except Exception as e:
        logger.error(f"[GeoBingo Geo] Failed to load countries.json: {e}", exc_info=True)
        _COUNTRIES_DATA = []
        _COUNTRIES_BY_CODE = {}
        _UI_COUNTRY_LIST = []


def _point_in_polygon(lng: float, lat: float, ring: List[List[float]]) -> bool:
    """Ray-casting point-in-polygon algorithm."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    p1x, p1y = ring[0]
    for i in range(1, n + 1):
        p2x, p2y = ring[i % n]
        if min(p1y, p2y) < lat <= max(p1y, p2y):
            if lng <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lng <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def get_country_at(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Determines which country a lat/lng coordinate falls into.
    
    Returns a dict with 'code', 'name_de', 'name_en', 'flag' or None if ocean/unmatched.
    """
    _load_data_if_needed()
    if not _COUNTRIES_DATA:
        return None

    # Standardize longitude between -180 and 180
    while lng > 180:
        lng -= 360
    while lng < -180:
        lng += 360

    for country in _COUNTRIES_DATA:
        bbox = country["bbox"]
        # bbox is [min_lng, min_lat, max_lng, max_lat]
        if not (bbox[0] <= lng <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue

        for poly in country.get("polygons", []):
            if _point_in_polygon(lng, lat, poly):
                return {
                    "code": country["code"],
                    "name_de": country["name_de"],
                    "name_en": country["name_en"],
                    "flag": country["flag"]
                }

    return None


def get_country_by_code(code: str) -> Optional[Dict[str, Any]]:
    """Retrieves country metadata by 2-letter ISO code."""
    _load_data_if_needed()
    if not _COUNTRIES_BY_CODE or not code:
        return None
    c = _COUNTRIES_BY_CODE.get(code.upper().strip())
    if not c:
        return None
    return {
        "code": c["code"],
        "name_de": c["name_de"],
        "name_en": c["name_en"],
        "flag": c["flag"]
    }


def is_location_blocked(
    lat: float,
    lng: float,
    blocked_codes: List[str]
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Checks if a coordinate is in one of the blocked countries.
    
    Returns (is_blocked: bool, country_info: Optional[dict]).
    """
    detected = get_country_at(lat, lng)
    if not detected:
        return False, None

    if not blocked_codes:
        return False, detected

    normalized_blocked = {str(c).upper().strip() for c in blocked_codes if c}
    if not normalized_blocked:
        return False, detected

    if detected["code"].upper() in normalized_blocked:
        return True, detected

    return False, detected


def get_all_countries_for_ui() -> List[Dict[str, str]]:
    """Returns the list of all countries for the Lobby UI selector."""
    _load_data_if_needed()
    return _UI_COUNTRY_LIST or []


def get_polygons_for_countries(country_codes: List[str]) -> Dict[str, Any]:
    """Returns polygons and metadata for the specified country codes."""
    _load_data_if_needed()
    if not _COUNTRIES_BY_CODE or not country_codes:
        return {}
    res = {}
    for code in country_codes:
        code_u = str(code).upper().strip()
        c = _COUNTRIES_BY_CODE.get(code_u)
        if c:
            res[code_u] = {
                "code": c["code"],
                "name_de": c["name_de"],
                "polygons": c.get("polygons", [])
            }
    return res
