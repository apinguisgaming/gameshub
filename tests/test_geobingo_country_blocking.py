from apps.geobingo import logic as geobingo_logic
from apps.geobingo import geo_countries as geobingo_geo
from flask_app import app

def test_logic_record_proof_blocked():
    state = geobingo_logic.get_initial_state()
    state['players'] = ['Player1', 'Player2']
    state['status'] = 'playing'
    state['phase'] = 'exploration'
    state['items'] = ['Auto', 'Baum', 'Bank']
    state['settings']['blocked_countries'] = ['DE']

    # Attempt to save a proof in Berlin (Germany)
    berlin_proof = {
        'pano_id': 'pano_berlin_123',
        'lat': 52.5200,
        'lng': 13.4050,
        'heading': 90,
        'pitch': 0,
        'zoom': 1,
        'fov': 90
    }
    success, err = geobingo_logic.record_proof(state, 'Player1', 0, berlin_proof)
    assert success is False
    assert "Deutschland" in err
    assert "gesperrt" in err
    assert '0' not in state['proofs'].get('Player1', {})

    # Attempt to save a proof in Vienna (Austria) -> should succeed
    vienna_proof = {
        'pano_id': 'pano_vienna_123',
        'lat': 48.2082,
        'lng': 16.3738,
        'heading': 45,
        'pitch': 0,
        'zoom': 1,
        'fov': 90
    }
    success, err = geobingo_logic.record_proof(state, 'Player1', 0, vienna_proof)
    assert success is True
    assert err is None
    assert '0' in state['proofs']['Player1']
    assert state['proofs']['Player1']['0']['pano_id'] == 'pano_vienna_123'

from storage import get_storage

def test_flask_check_location_route():
    storage = get_storage()
    user = storage.get_user_by_username('test_geo_user')
    if not user:
        user_id = storage.create_user('test_geo_user', 'password123')
    else:
        user_id = user['id']

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user_id'] = user_id

    # Test direct check without room
    res = client.post('/geobingo/check_location', json={
        'lat': 52.5200,
        'lng': 13.4050
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['country'] is not None
    assert data['country']['code'] == 'DE'
    # Test country polygons endpoint
    poly_res = client.get('/geobingo/country_polygons?codes=DE,FR')
    assert poly_res.status_code == 200
    poly_data = poly_res.get_json()
    assert poly_data['success'] is True
    assert 'DE' in poly_data['countries']
    assert 'FR' in poly_data['countries']
    assert len(poly_data['countries']['DE']['polygons']) > 0
    assert poly_data['countries']['DE']['name_de'] == 'Deutschland'

if __name__ == '__main__':
    test_logic_record_proof_blocked()
    test_flask_check_location_route()
    print("ALL LOGIC & INTEGRATION TESTS PASSED!")
