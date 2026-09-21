"""Game definitions and registry initialization for GameHub platform."""
from apps.common.registry import GameManifest, register_game, get_all_games, clear_registry


def init_games_registry():
    """Initializes the registry with all platform games."""
    clear_registry()

    # 1. Impostor (Pass & Play)
    register_game(GameManifest(
        id='impostor',
        title='Impostor',
        subtitle='Finde den Verräter unter euch (Pass & Play).',
        tag='Game (3-12)',
        game_type='singleplayer',
        route_prefix='/impostor',
        template='impostor.html',
        card_class='card-impostor',
        color='#b91c1c',
        icon='🤫',
        min_players=3,
        max_players=12
    ))

    # 2. Song Guesser (Multiplayer)
    register_game(GameManifest(
        id='song_guesser',
        title='Song<br>Guesser',
        subtitle='Errate den Song anhand eines kurzen Ausschnitts.',
        tag='Multiplayer (2-4)',
        game_type='multiplayer',
        route_prefix='/song-guesser',
        template='song_guesser.html',
        card_class='card-song-guesser',
        color='#2563eb',
        icon='🎵',
        min_players=2,
        max_players=4,
        default_settings={'time_per_song': 20, 'total_songs': 10}
    ))

    # 3. Secret Hitler (Multiplayer)
    register_game(GameManifest(
        id='secret_hitler',
        title='Secret<br>Hitler',
        subtitle='Social Deduction Spiel für 5 bis 10 Personen.',
        tag='Multiplayer (5-10)',
        game_type='multiplayer',
        route_prefix='/secret-hitler',
        template='secret_hitler.html',
        card_class='card-secret-hitler',
        color='#800f2f',
        icon='🕵️',
        min_players=5,
        max_players=10
    ))

    # 4. Pokémon Tower Defense (Canvas Singleplayer)
    register_game(GameManifest(
        id='pokemon_tower',
        title='Pokémon<br>Tower Defense',
        subtitle='Verteidige das Spielfeld mit deinen Pokémon.',
        tag='Canvas Game',
        game_type='singleplayer',
        route_prefix='/pokemon-tower',
        template='pokemon_tower.html',
        card_class='card-pokemon-tower',
        color='#d97706',
        icon='🛡️',
        has_cloud_save=True,
        min_players=1,
        max_players=1
    ))

    # 5. Gothic Survivors (Rogue-lite Singleplayer)
    register_game(GameManifest(
        id='gothic_survivors',
        title='Gothic<br>Survivors',
        subtitle='Pixel-Art Rogue-lite & Character Creator.',
        tag='Action RPG',
        game_type='singleplayer',
        route_prefix='/gothic-survivors',
        template='gothic_survivors.html',
        card_class='card-gothic-survivors',
        color='#4b5563',
        icon='⚔️',
        has_cloud_save=True,
        min_players=1,
        max_players=1
    ))

    # 6. SongSeeker (Music Tool)
    register_game(GameManifest(
        id='song_seeker',
        title='Song<br>Seeker',
        subtitle='Interaktives Musik-Ratespiel im Hitster-Stil.',
        tag='Music Tool',
        game_type='singleplayer',
        route_prefix='/song-seeker',
        template='song_seeker.html',
        card_class='card-song-seeker',
        color='#059669',
        icon='📻',
        min_players=1,
        max_players=1
    ))

    # 7. NexusDex (Pokedex Reference Tool)
    register_game(GameManifest(
        id='nexus_dex',
        title='Nexus<br>Dex',
        subtitle='Der interaktive Pokédex & Typen-Guide.',
        tag='Pokedex',
        game_type='singleplayer',
        route_prefix='/nexus-dex',
        template='nexus_dex.html',
        card_class='card-nexus-dex',
        color='#dc2626',
        icon='📖',
        min_players=1,
        max_players=1
    ))

    # 8. Geo Bingo (Multiplayer Street View Game)
    register_game(GameManifest(
        id='geo_bingo',
        title='Geo<br>Bingo',
        subtitle='Finde Objekte in Google Street View.',
        tag='Multiplayer (2-4)',
        game_type='multiplayer',
        route_prefix='/geo-bingo',
        template='geo_bingo.html',
        card_class='card-geo-bingo',
        color='#2d6a4f',
        icon='🗺️',
        min_players=2,
        max_players=4,
        default_settings={'item_count': 7, 'time_limit': 600, 'item_preset': 'standard'}
    ))

    return get_all_games()
