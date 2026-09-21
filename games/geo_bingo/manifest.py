from engine.registry import GameManifest

MANIFEST = GameManifest(
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
)
