# GameHub Modular Architecture

A unified, modular Flask gaming platform with single sign-on, multi-room multiplayer, real-time WebSocket state synchronization, and zero-boilerplate colocated game modules.

---

## Key Architectural Principles

1. **Colocated Game Modules (`games/<game_id>/`)**:
   Every game is a self-contained package owning its own:
   - `manifest.py`: Self-describing game metadata (title, route prefix, player count, icon, settings).
   - `templates/`: Game HTML templates.
   - `static/`: Game stylesheets, scripts, audio, and asset files.
   - `routes.py`: Game HTTP endpoints and action handlers (multiplayer).
   - `logic.py`: Game rules and state transitions.

2. **Zero-Boilerplate Auto-Discovery**:
   The engine automatically discovers all game packages in `games/`, loads their manifests, wires their templates, and registers their routes without modifying `flask_app.py`.

3. **Universal Multiplayer Engine (`engine/multiplayer.py`)**:
   - Out-of-the-box room lifecycle (`create`, `join`, `leave`, `heartbeat`, `state`, `rooms`).
   - Action Dispatch Engine (`POST /<room_code>/action` and `@bp.action('...')`).
   - Non-blocking Pusher WebSocket broadcasting with differential delta state patching (`_delta`).

4. **High-Performance Backend Core**:
   - Request-scoped SQLite connection pooling.
   - In-memory TTL authentication cache (drops token validation latency from 20ms to 0.1ms).
   - Non-blocking background Pusher dispatch via thread pool.
   - Batched stats transactions (`record_match_outcome`).

5. **Unified Frontend Client SDK (`static/common/sdk.js`)**:
   - `GameHub.auth`: Authenticated fetch with automatic token resolution (`X-Auth-Token`).
   - `GameHub.storage`: User-scoped cloud saves for singleplayer games.
   - `GameHub.multiplayer`: Room joining, leaving, action dispatch, heartbeat timer, and automatic WebSocket delta patching.

---

## Directory Structure

```text
├── flask_app.py             # Main entrypoint; auto-discovers games and registers platform services
├── config.py                # Centralized configuration (Pusher, DB, proxy, secrets)
├── test_platform.py         # Automated test suite (29/29 tests passing)
│
├── engine/                  # Core Engine Infrastructure
│   ├── registry.py          # Central game registry & GameManifest dataclass
│   ├── rooms.py             # Room lifecycle, code generation, capacity validation
│   ├── multiplayer.py       # Reusable MultiplayerBlueprint factory & action dispatcher
│   ├── delta.py             # Differential state diffing & client reconstruction
│   ├── broadcasting.py      # Non-blocking Pusher dispatch with thread pool
│   ├── heartbeat.py         # Player heartbeat and presence tracking
│   ├── stats.py             # Batch match outcomes & high-score recording
│   ├── singleplayer.py      # Dynamic singleplayer auto-router & fallback shell
│   └── cli.py               # Developer CLI for zero-boilerplate game scaffolding
│
├── games/                   # Colocated Game Packages
│   ├── secret_hitler/       # Secret Hitler (Multiplayer, 5-10 players)
│   ├── song_guesser/        # Song Guesser (Multiplayer, 2-4 players)
│   ├── geo_bingo/           # Geo Bingo (Multiplayer Street View, 2-4 players)
│   ├── impostor/            # Impostor (Pass & Play, 3-12 players)
│   ├── pokemon_tower/       # Pokémon Tower Defense (Singleplayer Canvas)
│   ├── gothic_survivors/    # Gothic Survivors (Singleplayer Rogue-lite)
│   ├── song_seeker/         # SongSeeker (Singleplayer Music Game)
│   └── nexus_dex/           # NexusDex (Singleplayer Pokédex Reference)
│
├── storage/                 # Storage Adapter Layer
│   ├── base.py              # BaseStorage interface & OptimisticLockError
│   └── sqlite_adapter.py    # Request-scoped pooled SQLite connection adapter
│
├── apps/                    # Core Platform Applications
│   ├── auth/                # SSO authentication, token caching, decorators
│   └── api/                 # Cloud Save & Google Maps request logging
│
├── templates/               # Shared Platform Templates
│   ├── base.html            # Universal HTML base shell & script loader
│   ├── landing.html         # Landing portal & login modal
│   ├── game_shell.html      # Dynamic fallback shell for new games
│   └── cards/               # Handcrafted landing portal game card overrides
│
└── static/                  # Shared Static Assets
    ├── common/              # Universal client SDK, delta patcher, lobby controller
    ├── img/                 # Avatars & platform brand assets
    ├── landing/             # Landing portal styles & scripts
    └── sprites/             # Shared sprite sheets
```

---

## Developer CLI: Scaffolding New Games

Generate a complete, working game module with a single command:

```bash
# Create a multiplayer game scaffold:
python -m engine.cli create my_game --title "My New Game" --type multiplayer

# Create a singleplayer game scaffold:
python -m engine.cli create mini_quest --title "Mini Quest" --type singleplayer
```

The game is immediately discovered by the platform and available at `/<game-id>/` upon application reload.

---

## Running the Automated Test Suite

Run all platform and game regression tests:

```bash
python test_platform.py
```

All 29 tests verify:
- Database schema & connection pooling
- Multi-tab token isolation & session security
- Cloud save user isolation
- Multiplayer room lifecycles & authorization
- Differential Pusher state broadcasts
- Progressive Google Maps API rate limiting & strike escalation
- Game scaffolding CLI & dynamic auto-discovery

---

## Running Locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the application:
   ```bash
   python flask_app.py
   ```

3. Open `http://localhost:5000` in your browser.
