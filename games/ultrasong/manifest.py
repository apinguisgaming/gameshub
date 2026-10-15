from engine.registry import GameManifest

MANIFEST = GameManifest(
    id='ultrasong',
    title='UltraSong',
    subtitle='Wunschsong bestellen – der PC zu Hause macht daraus einen UltraStar-Song.',
    tag='Karaoke',
    game_type='singleplayer',
    route_prefix='/ultrasong',
    template='ultrasong.html',
    card_class='card-ultrasong',
    color='#5b4cf0',
    icon='🎤',
)
