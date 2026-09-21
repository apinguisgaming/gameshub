from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='song_guesser',
    title='Song<br>Guesser',
    subtitle='Errate den Song anhand eines kurzen Ausschnitts.',
    tag='Multiplayer (2-4)',
    game_type='multiplayer',
    route_prefix='/song-guesser',
    template='song_guesser.html',
    card_class='card-song-guesser',
    color='#2563eb',
    icon='🎵',
    min_players=2,
    max_players=4,
    default_settings={'time_per_song': 20, 'total_songs': 10}
)
