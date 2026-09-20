import time
from apps.geobingo.geo_countries import get_country_at, is_location_blocked, get_all_countries_for_ui

def test_all():
    cities = [
        ('Berlin', 52.52, 13.405, 'DE'),
        ('Munich', 48.1351, 11.582, 'DE'),
        ('Vienna', 48.2082, 16.3738, 'AT'),
        ('Zurich', 47.3769, 8.5417, 'CH'),
        ('Paris', 48.8566, 2.3522, 'FR'),
        ('London', 51.5074, -0.1278, 'GB'),
        ('Rome', 41.9028, 12.4964, 'IT'),
        ('Madrid', 40.4168, -3.7038, 'ES'),
        ('New York', 40.7128, -74.006, 'US'),
        ('Tokyo', 35.6762, 139.6503, 'JP'),
        ('Sydney', -33.8688, 151.2093, 'AU'),
        ('Rio de Janeiro', -22.9068, -43.1729, 'BR'),
    ]

    t0 = time.time()
    for city, lat, lng, expected in cities:
        res = get_country_at(lat, lng)
        print(f"{city} -> {res['code']} {res['name_de']} {res['flag']}")
        assert res is not None, f"Could not find country for {city}"
        assert res['code'] == expected, f"Expected {expected} for {city}, got {res['code']}"
    t1 = time.time()
    print(f"Lookup time for {len(cities)} cities: {(t1 - t0) * 1000:.3f} ms")

    # Test blocking
    blocked, country = is_location_blocked(52.52, 13.405, ['DE', 'FR'])
    print(f"Berlin blocked with [DE, FR]: {blocked} ({country['name_de']})")
    assert blocked is True

    blocked, country = is_location_blocked(48.2082, 16.3738, ['DE', 'FR'])
    print(f"Vienna blocked with [DE, FR]: {blocked} ({country['name_de']})")
    assert blocked is False

    # Ocean test
    ocean_res = get_country_at(0.0, 0.0)
    print(f"Atlantic Ocean (0, 0): {ocean_res}")
    assert ocean_res is None

    ui_list = get_all_countries_for_ui()
    print(f"Total countries for UI: {len(ui_list)}")
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_all()
