"""Game definitions and registry initialization for GameHub platform."""
from apps.common.registry import GameManifest, register_game, get_all_games, clear_registry


def init_games_registry():
    """Initializes the registry with all platform games."""
    clear_registry()

    # 1. Impostor (Pass & Play)
    register_game(GameManifest(
        id='imposter',
        title='Impostor',
        subtitle='Finde den Verräter unter euch (Pass & Play).',
        tag='Game (3-12)',
        game_type='singleplayer',
        route_prefix='/imposter',
        template='imposter.html',
        card_class='card-imposter',
        color='#b91c1c',
        icon='🤫',
        min_players=3,
        max_players=12
    ))

    # 2. Song Guesser (Multiplayer)
    register_game(GameManifest(
        id='song',
        title='Song<br>Guesser',
        subtitle='Errate den Song anhand eines kurzen Ausschnitts.',
        tag='Multiplayer (2-4)',
        game_type='multiplayer',
        route_prefix='/song',
        template='song.html',
        card_class='card-song',
        color='#2563eb',
        icon='🎵',
        min_players=2,
        max_players=4,
        default_settings={'time_per_song': 20, 'total_songs': 10}
    ))

    # 3. Secret Hitler (Multiplayer)
    register_game(GameManifest(
        id='secret',
        title='Secret<br>Hitler',
        subtitle='Social Deduction Spiel für 5 bis 10 Personen.',
        tag='Multiplayer (5-10)',
        game_type='multiplayer',
        route_prefix='/secret',
        template='secret.html',
        card_class='card-secret',
        color='#800f2f',
        icon='🕵️',
        min_players=5,
        max_players=10
    ))

    # 4. Pokémon Tower Defense (Canvas Singleplayer)
    register_game(GameManifest(
        id='tower',
        title='Pokémon<br>Tower Defense',
        subtitle='Verteidige das Spielfeld mit deinen Pokémon.',
        tag='Canvas Game',
        game_type='singleplayer',
        route_prefix='/tower',
        template='tower.html',
        card_class='card-tower',
        color='#d97706',
        aliases=['/site4/'],
        icon='🛡️',
        has_cloud_save=True,
        min_players=1,
        max_players=1
    ))

    # 5. Gothic Survivors (Rogue-lite Singleplayer)
    register_game(GameManifest(
        id='survivors',
        title='Gothic<br>Survivors',
        subtitle='Pixel-Art Rogue-lite & Character Creator.',
        tag='Action RPG',
        game_type='singleplayer',
        route_prefix='/survivors',
        template='survivors.html',
        card_class='card-survivors',
        color='#4b5563',
        icon='⚔️',
        has_cloud_save=True,
        min_players=1,
        max_players=1
    ))

    # 6. Gothic Survivors Character Creator (Sub-tool)
    register_game(GameManifest(
        id='survivors_creator',
        title='Survivors<br>Creator',
        subtitle='Erstelle und passe deine Gothic Survivors Charaktere an.',
        tag='Editor',
        game_type='singleplayer',
        route_prefix='/survivors/creator',
        template='survivors_creator.html',
        card_class='card-survivors',
        color='#6b7280',
        show_on_portal=False,
        icon='🎨',
        min_players=1,
        max_players=1
    ))

    # 7. SongSeeker (Music Tool)
    register_game(GameManifest(
        id='songseeker',
        title='Song<br>Seeker',
        subtitle='Interaktives Musik-Ratespiel im Hitster-Stil.',
        tag='Music Tool',
        game_type='singleplayer',
        route_prefix='/songseeker',
        template='songseeker.html',
        card_class='card-songseeker',
        color='#059669',
        icon='📻',
        min_players=1,
        max_players=1
    ))

    # 8. NexusDex (Pokedex Reference Tool)
    register_game(GameManifest(
        id='nexusdex',
        title='Nexus<br>Dex',
        subtitle='Der interaktive Pokédex & Typen-Guide.',
        tag='Pokedex',
        game_type='singleplayer',
        route_prefix='/nexusdex',
        template='nexusdex.html',
        card_class='card-nexusdex',
        color='#dc2626',
        aliases=['/site3/'],
        icon='📖',
        min_players=1,
        max_players=1
    ))

    # 9. Geo Bingo (Multiplayer Street View Game)
    register_game(GameManifest(
        id='geobingo',
        title='Geo<br>Bingo',
        subtitle='Finde Objekte in Google Street View.',
        tag='Multiplayer (2-4)',
        game_type='multiplayer',
        route_prefix='/geobingo',
        template='geobingo.html',
        card_class='card-geobingo',
        color='#2d6a4f',
        icon='🗺️',
        min_players=2,
        max_players=4,
        default_settings={'item_count': 7, 'time_limit': 600, 'item_preset': 'standard'}
    ))

    return get_all_games()

