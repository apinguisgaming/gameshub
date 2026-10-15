"""Set a user's role (user | admin). Run on the server, e.g. in a PythonAnywhere Bash console:

    python set_role.py Nico admin
    python set_role.py          # list all admins
"""
import sys

from storage import get_storage

ROLES = ('user', 'admin')


def main(argv):
    storage = get_storage()
    with storage._get_conn() as conn:
        if not argv:
            admins = [r['username'] for r in conn.execute("SELECT username FROM users WHERE role = 'admin'")]
            print('Admins:', ', '.join(admins) or '(none)')
            return 0
        if len(argv) != 2 or argv[1] not in ROLES:
            print(__doc__)
            return 2
        username, role = argv
        cur = conn.execute('UPDATE users SET role = ? WHERE username = ? COLLATE NOCASE', (role, username))
        if not cur.rowcount:
            print(f'User "{username}" not found')
            return 1
    print(f'{username} is now {role} (takes effect within a minute)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
