from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='secret_hitler',
    title='Secret<br>Hitler',
    subtitle='Social Deduction Spiel für 5 bis 10 Personen.',
    tag='Multiplayer (5-10)',
    game_type='multiplayer',
    route_prefix='/secret-hitler',
    template='secret_hitler.html',
    card_class='card-secret-hitler',
    color='#800f2f',
    icon='🕵️',
    min_players=5,
    max_players=10
)
