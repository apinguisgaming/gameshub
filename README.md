# GameHub Platform

A unified, modular Flask gaming platform with single sign-on, multi-room multiplayer, and cloud saves.

## Architecture & Features

- **Single Sign-On (SSO)**: Users register/login once at the main portal (`/`). Individual game pages show zero login inputs.
- **Authentication Gateway**: All game pages are protected with `@login_required` and automatically redirect unauthenticated users to the homepage login modal (`/?next=...&login=1`).
- **Multi-Room Engine**: Secret Hitler and Song Guesser feature interactive Room Browsers allowing users to create 4-character room sessions or join friends via room codes.
- **Dynamic Pusher Channels**: Websocket events are room-scoped (`secret-<ROOM>` and `song-<ROOM>`), allowing unlimited concurrent matches.
- **Storage Adapter Pattern**: Data access runs through `BaseStorage`. SQLite is active by default with thread safety, WAL mode, and automatic schema management (`data/gamehub.db`). A MongoDB adapter stub is ready for future migration (`STORAGE_BACKEND=mongodb`).
- **Cloud Saves & Leaderboards**: Single-player games (Pokémon Tower, Gothic Survivors, SongSeeker, NexusDex, Impostor) automatically sync saves and high scores to `/api/save/<game>`.

## Directory Structure

```text
├── flask_app.py             # Main entrypoint, portal & protected game routes
├── config.py                # Centralized configuration (Pusher, DB, secrets)
├── requirements.txt         # Dependencies (Flask, pusher)
├── test_platform.py         # Automated verification suite (8/8 tests passing)
│
├── storage/                 # Storage Adapter Layer
│   ├── base.py              # Abstract BaseStorage interface
│   ├── sqlite_adapter.py    # SQLite implementation with WAL mode & transactions
│   └── mongo_adapter.py     # MongoDB future-migration target
│
├── apps/                    # Backend application modules
│   ├── auth/                # SSO authentication & decorators (@login_required)
│   ├── api/                 # Cloud Save & Leaderboards API
│   ├── common/              # Shared multi-room lifecycle & heartbeat manager
│   ├── secret/              # Secret Hitler game engine & Pusher rooms
│   └── song/                # Song Guesser game engine & Pusher rooms
│
├── data/                    # Private runtime data
│   ├── gamehub.db           # SQLite database (auto-initialized)
│   └── song_data.json       # Read-only static song database
│
├── templates/               # HTML templates
│   ├── landing.html         # Portal with Neo-Brutalist Login/Register modal
│   ├── secret.html          # Secret Hitler (Room Browser + Lobby + Game)
│   ├── song.html            # Song Guesser (Room Browser + Lobby + Game)
│   ├── imposter.html        # Impostor (localStorage + cloud sync)
│   ├── songseeker.html      # SongSeeker with cloud sync
│   ├── survivors.html       # Gothic Survivors with score sync
│   ├── nexusdex.html        # NexusDex with box/party cloud sync
│   └── tower.html           # Pokémon Tower Defense with wave sync
│
└── static/                  # Static assets served via Nginx on PythonAnywhere
    ├── imposter/            # Impostor words JSON
    ├── img/                 # Secret Hitler card assets & themes
    ├── nexusdex/            # NexusDex scripts, CSS & walkthroughs
    ├── songseeker/          # SongSeeker scripts & playlists
    ├── survivors/           # Gothic Survivors procedural engine & audio
    ├── tower/               # Tower Defense maps, engine & sprites
    └── sprites/             # Shared Pokémon sprites
```

## Running Tests

Run the full platform verification test suite:

```bash
python test_platform.py
```

## Running Locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python flask_app.py
   ```

3. Open `http://localhost:5000` in your browser.

## Deployment on PythonAnywhere

1. **WSGI Configuration** (`/var/www/<username>_pythonanywhere_com_wsgi.py`):
   ```python
   import sys
   path = '/home/<username>/mysite'
   if path not in sys.path:
       sys.path.append(path)

   from flask_app import app as application
   ```

2. **Static Files** (PythonAnywhere Web tab):
   - **URL**: `/static/`
   - **Directory**: `/home/<username>/mysite/static`
