from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='song_seeker',
    title='Song<br>Seeker',
    subtitle='Interaktives Musik-Ratespiel im Hitster-Stil.',
    tag='Music Tool',
    game_type='singleplayer',
    route_prefix='/song-seeker',
    template='song_seeker.html',
    card_class='card-song-seeker',
    color='#059669',
    icon='📻',
    min_players=1,
    max_players=1
)
