from engine.registry import GameManifest

MANIFEST = GameManifest(
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
)
