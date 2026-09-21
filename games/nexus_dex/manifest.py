from engine.registry import GameManifest

MANIFEST = GameManifest(
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
)
