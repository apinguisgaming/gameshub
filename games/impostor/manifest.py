from engine.registry import GameManifest

MANIFEST = GameManifest(
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
)
