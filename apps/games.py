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
        tag='Game',
        game_type='singleplayer',
        route_prefix='/imposter',
        template='imposter.html',
        card_class='card-imposter',
        icon='🤫'
    ))

    # 2. Song Guesser (Multiplayer)
    register_game(GameManifest(
        id='song',
        title='Song<br>Guesser',
        subtitle='Errate den Song anhand eines kurzen Ausschnitts.',
        tag='Multiplayer',
        game_type='multiplayer',
        route_prefix='/song',
        template='song.html',
        card_class='card-song',
        icon='🎵'
    ))

    # 3. Secret Hitler (Multiplayer)
    register_game(GameManifest(
        id='secret',
        title='Secret<br>Hitler',
        subtitle='Social Deduction Spiel für 5 bis 10 Personen.',
        tag='Multiplayer',
        game_type='multiplayer',
        route_prefix='/secret',
        template='secret.html',
        card_class='card-secret',
        icon='🕵️'
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
        aliases=['/site4/'],
        icon='🛡️',
        has_cloud_save=True
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
        icon='⚔️',
        has_cloud_save=True
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
        show_on_portal=False,
        icon='🎨'
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
        icon='📻'
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
        aliases=['/site3/'],
        icon='📖'
    ))

    # 9. Geo Bingo (Multiplayer 1v1 Street View Game)
    register_game(GameManifest(
        id='geobingo',
        title='Geo<br>Bingo',
        subtitle='Finde Objekte in Google Street View (1 vs 1).',
        tag='Multiplayer',
        game_type='multiplayer',
        route_prefix='/geobingo',
        template='geobingo.html',
        card_class='card-geobingo',
        icon='🗺️'
    ))

    return get_all_games()

