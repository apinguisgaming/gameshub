from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='battleship',
    title='Schiffe<br>Versenken',
    subtitle='Taktische Seeschlacht. Finde und versenke die Flotte deines Gegners!',
    tag='Multiplayer (2)',
    game_type='multiplayer',
    route_prefix='/battleship',
    template='battleship.html',
    card_class='card-battleship',
    color='#1d3557',
    icon='🚢',
    min_players=2,
    max_players=2,
    default_settings={'extra_turn_on_hit': True}
)
