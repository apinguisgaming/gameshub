"""Automated tests for 4-Gewinnt (Connect Four) and Schiffe Versenken (Battleship)."""
import unittest
from flask_app import app
from games.connect_four import logic as c4_logic
from games.battleship import logic as bs_logic


class NewGamesTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def test_connect_four_logic(self):
        """Test Connect Four logic: disc drops, gravity, turn alternation, win conditions."""
        state = c4_logic.get_initial_state()
        state['players'] = ['Alice', 'Bob']
        state['host'] = 'Alice'

        # Start game
        success, msg = c4_logic.start_game(state)
        self.assertTrue(success)
        self.assertEqual(state['status'], 'playing')
        self.assertEqual(state['turn'], 'Alice')

        # Alice drops in column 3 (lands on row 5)
        success, msg = c4_logic.drop_disc(state, 'Alice', 3)
        self.assertTrue(success)
        self.assertEqual(state['board'][5][3], 'red')
        self.assertEqual(state['turn'], 'Bob')

        # Bob drops in column 3 (lands on row 4)
        success, msg = c4_logic.drop_disc(state, 'Bob', 3)
        self.assertTrue(success)
        self.assertEqual(state['board'][4][3], 'yellow')
        self.assertEqual(state['turn'], 'Alice')

        # Connect 4 horizontal win simulation
        # Board reset
        state['board'] = [[None for _ in range(7)] for _ in range(6)]
        state['turn'] = 'Alice'
        for col in range(3):
            c4_logic.drop_disc(state, 'Alice', col) # Row 5, cols 0, 1, 2
            c4_logic.drop_disc(state, 'Bob', col)   # Row 4, cols 0, 1, 2
        
        # Winning drop by Alice at col 3 (Row 5)
        self.assertEqual(state['turn'], 'Alice')
        success, msg = c4_logic.drop_disc(state, 'Alice', 3)
        self.assertTrue(success)
        self.assertEqual(state['status'], 'finished')
        self.assertEqual(state['winner'], 'Alice')
        self.assertEqual(len(state['winning_cells']), 4)
        self.assertEqual(state['scores']['Alice'], 1)

    def test_battleship_logic(self):
        """Test Battleship logic: fleet generation, validation, firing, damage, sinking, victory."""
        # 1. Random fleet generation
        fleet = bs_logic.generate_random_fleet()
        self.assertEqual(len(fleet), len(bs_logic.FLEET_SPEC))
        valid, msg = bs_logic.validate_fleet(fleet)
        self.assertTrue(valid, msg)

        # 2. Game setup
        state = bs_logic.get_initial_state()
        state['players'] = ['Admiral_A', 'Admiral_B']
        state['host'] = 'Admiral_A'

        success, _ = bs_logic.start_placement(state)
        self.assertTrue(success)
        self.assertEqual(state['status'], 'placement')

        # Confirm fleets
        fleet_b = bs_logic.generate_random_fleet()
        bs_logic.confirm_placement(state, 'Admiral_A', fleet)
        success, msg = bs_logic.confirm_placement(state, 'Admiral_B', fleet_b)
        self.assertTrue(success)
        self.assertEqual(state['status'], 'battle')
        self.assertEqual(state['turn'], 'Admiral_A')

        # 3. Fire shot: targeting first coordinate of Admiral_B's first ship
        target_ship = fleet_b[0]
        hit_row, hit_col = target_ship['coords'][0]

        success, msg, shot_record = bs_logic.fire_shot(state, 'Admiral_A', hit_row, hit_col)
        self.assertTrue(success)
        self.assertIn(shot_record['result'], ('hit', 'sunk'))
        # On hit, Admiral_A should keep the turn!
        self.assertEqual(state['turn'], 'Admiral_A')

        # 4. Anti-Cheat Check: opponent should not see un-sunk ships in sanitized state
        safe_for_a = bs_logic.get_client_safe_state(state, for_player='Admiral_A')
        # Admiral_A can see their own fleet
        self.assertEqual(len(safe_for_a['fleets']['Admiral_A']), len(bs_logic.FLEET_SPEC))
        # But Admiral_A can only see sunk ships of Admiral_B (or empty if none sunk yet)
        sunk_b_ships = [s for s in fleet_b if s.get('sunk')]
        self.assertEqual(len(safe_for_a['fleets']['Admiral_B']), len(sunk_b_ships))

    def test_commanders_mode_abilities_and_fog_of_war(self):
        """Test Commanders mode: energy economy, abilities execution, and strict anti-cheat fog of war."""
        state = bs_logic.get_initial_state()
        state['players'] = ['Player1', 'Player2']
        state['host'] = 'Player1'
        state['game_mode'] = 'commanders'

        bs_logic.start_placement(state)
        # Select commanders
        state['commanders']['Player1'] = 'karslake'  # Airstrike, cost 5
        state['commanders']['Player2'] = 'kelly'     # Sonar, cost 3

        fleet_1 = bs_logic.generate_random_fleet()
        fleet_2 = bs_logic.generate_random_fleet()
        bs_logic.confirm_placement(state, 'Player1', fleet_1)
        bs_logic.confirm_placement(state, 'Player2', fleet_2)

        self.assertEqual(state['status'], 'battle')
        self.assertEqual(state['turn'], 'Player1')
        self.assertEqual(state['energy']['Player1'], 4)  # 2 starting + 2 turn

        # Give Player1 enough energy for airstrike
        state['energy']['Player1'] = 7
        target_cell = fleet_2[0]['coords'][0]
        success, msg, res = bs_logic.execute_ability(state, 'Player1', target_cell[0], target_cell[1], direction='H')
        hit_count = sum(1 for s in res['shots'] if s['result'] in ('hit', 'sunk'))
        self.assertEqual(state['energy']['Player1'], 7 - 5 + hit_count)

        # Check Fog of War: last_shot should never reveal ship_name if not sunk
        safe_for_p1 = bs_logic.get_client_safe_state(state, for_player='Player1')
        last_shot = safe_for_p1.get('last_shot')
        if last_shot and last_shot.get('result') == 'hit':
            self.assertIsNone(last_shot.get('ship_name'))

        # Switch to Player2 and test Sonar
        state['turn'] = 'Player2'
        state['energy']['Player2'] = 5
        success, msg, res = bs_logic.execute_ability(state, 'Player2', 3, 3)
        self.assertTrue(success)
        self.assertEqual(state['energy']['Player2'], 2)  # 5 - 3 cost
        self.assertIn('count', res['sonar'])
        # Sonar result should only be in safe state for Player2
        safe_p1 = bs_logic.get_client_safe_state(state, for_player='Player1')
        safe_p2 = bs_logic.get_client_safe_state(state, for_player='Player2')
        self.assertNotIn('Player2', safe_p1.get('sonar_result', {}))
        self.assertIn('Player2', safe_p2.get('sonar_result', {}))

    def test_http_routes_and_portal_cards(self):
        """Verify that Connect Four and Battleship are visible on the landing portal and have functional routes."""
        # 1. Landing portal contains cards for both new games
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        html = res.get_data(as_text=True)
        self.assertIn('4-Gewinnt', html)
        self.assertIn('Schiffe<br>Versenken', html)
        self.assertIn('card-connect-four', html)
        self.assertIn('card-battleship', html)

        # 2. Endpoints render properly
        res_c4 = self.client.get('/connect-four/', follow_redirects=True)
        self.assertIn(res_c4.status_code, (200, 302))

        res_bs = self.client.get('/battleship/', follow_redirects=True)
        self.assertIn(res_bs.status_code, (200, 302))


if __name__ == '__main__':
    unittest.main()

