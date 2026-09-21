from engine.registry import GameManifest

MANIFEST = GameManifest(
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
)
