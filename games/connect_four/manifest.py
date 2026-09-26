from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='connect_four',
    title='4-Gewinnt',
    subtitle='Klassisches 2-Spieler Duell. Wer schafft zuerst 4 in einer Reihe?',
    tag='Multiplayer (2)',
    game_type='multiplayer',
    route_prefix='/connect-four',
    template='connect_four.html',
    card_class='card-connect-four',
    color='#e63946',
    icon='🔴',
    min_players=2,
    max_players=2,
    default_settings={}
)
