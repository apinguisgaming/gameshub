"""Item catalog and generator for Geo Bingo."""
import random
from typing import List, Optional

GLOBAL_ITEMS = [
    "🚗 Rotes Auto",
    "🏪 Laden / Supermarkt",
    "🌳 Großer Laubbaum",
    "🚦 Ampelanlage",
    "⛪ Kirche oder Kapelle",
    "🚲 Fahrrad",
    "🗑️ Öffentlicher Mülleimer",
    "🚌 Linienbus",
    "🌺 Bunte Blumen / Pflanzkübel",
    "🏗️ Baustelle oder Baukran",
    "⛽ Tankstelle",
    "🐕 Hund",
    "🎯 Auffälliges Straßenschild",
    "🚶 Fußgänger mit Tasche",
    "🏢 Hochhaus / Bürogebäude",
    "🚙 Weißer Lieferwagen",
    "🏫 Schule oder Kindergarten",
    "🔔 Kirchturm oder Turmuhr",
    "🚕 Taxi",
    "🌉 Brücke oder Überführung",
    "🏍️ Motorrad oder Roller",
    "📪 Briefkasten",
    "🪧 Werbetafel / Plakat",
    "🛑 Stoppschild",
    "🏠 Einfamilienhaus",
    "🛣️ Zebrastreifen",
    "🅿️ Parkplatz",
    "🌿 Hecke oder Busch",
    "💡 Straßenlaterne",
    "🏎️ Sportwagen",
    "⛲ Brunnen mit Wasser",
    "🎨 Wandgraffiti / Street Art",
    "🐈 Katze",
    "🏛️ Denkmal oder Statue",
    "🎪 Café mit Markise",
    "🚢 Schiff oder Boot",
    "🎡 Spielplatz",
    "🏖️ Strand oder Wasserblick",
    "🚂 Eisenbahn oder Schienen",
    "🌈 Auffällig bunte Hausfassade",
    "🪑 Parkbank",
    "🎭 Theater oder Kino",
    "🏥 Krankenhaus oder Apotheke",
    "🦅 Vogel auf Dach oder Mast",
    "🚜 Traktor oder Baumaschine"
]

ITEM_PRESETS = {
    "standard": GLOBAL_ITEMS[:24],
    "easy": GLOBAL_ITEMS[24:38],
    "hard": GLOBAL_ITEMS[38:]
}


def get_global_items() -> List[str]:
    """Returns the full list of available global items."""
    return list(GLOBAL_ITEMS)


def generate_items(
    count: int = 7,
    selected_items: Optional[List[str]] = None,
    preset: str = "standard",
    custom_items: Optional[List[str]] = None
) -> List[str]:
    """Generates a list of items for the match based on user selection or pool."""
    count = max(3, min(count, 20))

    # Priority 1: User explicitly picked items from the word pool
    if selected_items:
        clean_selected = [str(c).strip() for c in selected_items if str(c).strip()]
        if len(clean_selected) >= count:
            shuffled = list(clean_selected)
            random.shuffle(shuffled)
            return shuffled[:count]
        elif clean_selected:
            # Pad with items from global pool not already in selection
            available_pool = [i for i in GLOBAL_ITEMS if i not in clean_selected]
            random.shuffle(available_pool)
            return clean_selected + available_pool[:max(0, count - len(clean_selected))]

    # Priority 2: Custom items preset
    if preset == "custom" and custom_items:
        clean_custom = [str(c).strip() for c in custom_items if str(c).strip()]
        if len(clean_custom) >= count:
            random.shuffle(clean_custom)
            return clean_custom[:count]
        elif clean_custom:
            standard_pool = [i for i in GLOBAL_ITEMS if i not in clean_custom]
            random.shuffle(standard_pool)
            return clean_custom + standard_pool[:max(0, count - len(clean_custom))]

    # Priority 3: Fallback pool selection
    pool = list(GLOBAL_ITEMS)
    random.shuffle(pool)
    return pool[:count]
