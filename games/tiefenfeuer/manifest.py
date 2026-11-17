from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='tiefenfeuer',
    title='Tiefenfeuer',
    subtitle='Grab dich in die Tiefe und bau eine Kolonie auf.',
    tag='Idle-Aufbau',
    game_type='singleplayer',
    route_prefix='/tiefenfeuer',
    template='tiefenfeuer.html',
    card_class='card-tiefenfeuer',
    color='#c86a1e',
    icon='⛏️',
    min_players=1,
    max_players=1,
)
