#!/usr/bin/env python3
"""Narrow, backed-up Caddy integration and atomic static releases.

Executed on the server via explicitly authorized passwordless sudo. Never alters
the existing MakoLrcStudio files or any other site's configuration. Keep this
script and menu.caddyfile together. Supports `activate.py rollback`.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path('/var/www/tool.talium.site/menu')
CONFIG = Path('/etc/caddy/Caddyfile')
BACKUPS = Path('/var/backups/talium-menu')
STATE = ROOT / 'last-deployment.json'
BEGIN = '# >>> OnlineToolsMenu routes'
END = '# <<< OnlineToolsMenu routes'
MAKO_BEGIN = '# >>> MakoLrcStudio deploy block'
MAKO_END = '# <<< MakoLrcStudio deploy block <<<'


def merge_config(original, snippet):
    if original.count(MAKO_BEGIN) != 1 or original.count(MAKO_END) != 1:
        raise ValueError('Expected exactly one existing MakoLrcStudio site block')
    head, rest = original.split(MAKO_BEGIN, 1)
    block, tail = rest.split(MAKO_END, 1)
    if not re.search(r'^tool\.talium\.site\s*\{', block, re.M):
        raise ValueError('The managed site is not tool.talium.site')
    if 'handle /MakoLrcStudio/* {' not in block:
        raise ValueError('Existing tool route missing; refusing an unsafe merge')
    if block.count(BEGIN) != block.count(END) or block.count(BEGIN) > 1:
        raise ValueError('Ambiguous existing menu markers')
    if BEGIN in block:
        block = re.sub(r'\t?' + re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', snippet.rstrip() + '\n', block, count=1, flags=re.S)
    else:
        fallback = '\thandle {\n\t\trespond 404\n\t}'
        if block.count(fallback) != 1:
            raise ValueError('Unknown fallback handler; refusing to guess')
        block = block.replace(fallback, snippet.rstrip() + '\n\n' + fallback, 1)
        block = block.replace('# 只暴露应用子路径，站点根、旧项目名路径与其他路径都不提供服务。', '# 首页由 OnlineToolsMenu 提供；应用与未知路径规则保持独立。')
    return head + MAKO_BEGIN + block + MAKO_END + tail


def run(*args, capture=False):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE if capture else None).stdout


def atomic_write(path, content):
    fd, name = tempfile.mkstemp(prefix='.talium-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(content)
        os.chmod(name, 0o644)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def point_to(target):
    current = ROOT / 'current'
    if target is None:
        current.unlink(missing_ok=True)
        return
    temporary = ROOT / '.next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    temporary.replace(current)


def request(path, status_only=False):
    args = ['curl', '-sS', '--max-time', '20', '--resolve', 'tool.talium.site:443:127.0.0.1']
    if status_only:
        args += ['-o', '/dev/null', '-w', '%{http_code}']
    else:
        args += ['-f']
    return run(*args, 'https://tool.talium.site' + path, capture=True)


def rollback():
    state = json.loads(STATE.read_text())
    if state.get('rolled_back'):
        raise ValueError('This deployment has already been rolled back')
    if str((ROOT / 'current').resolve()) != state['release']:
        raise ValueError('The current release changed; refusing to roll back unrelated work')
    backup = Path(state['backup'])
    # Validate before touching active state.
    run('caddy', 'validate', '--config', str(backup), '--adapter', 'caddyfile')
    active_config = CONFIG.read_text()
    active_release = str((ROOT / 'current').resolve())
    try:
        point_to(state['previous'])
        atomic_write(CONFIG, backup.read_text())
        run('systemctl', 'reload', 'caddy')
    except Exception:
        point_to(active_release)
        atomic_write(CONFIG, active_config)
        run('systemctl', 'reload', 'caddy')
        raise
    state['rolled_back'] = True
    atomic_write(STATE, json.dumps(state, indent=2) + '\n')
    print('Rollback complete; existing application is available:', request('/MakoLrcStudio/', True).decode())


def activate(archive_path, commit, expected_hash):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Expected a full Git commit SHA')
    archive_path = Path(archive_path)
    if hashlib.sha256(archive_path.read_bytes()).hexdigest() != expected_hash:
        raise ValueError('Upload checksum mismatch')
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'releases').mkdir(exist_ok=True)
    BACKUPS.mkdir(parents=True, exist_ok=True, mode=0o700)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    release = ROOT / 'releases' / (timestamp + '-' + commit[:12])
    release.mkdir(mode=0o755)
    with tarfile.open(archive_path, 'r:gz') as archive:
        for item in archive.getmembers():
            if item.name.startswith('/') or '..' in Path(item.name).parts or not (item.isfile() or item.isdir()):
                raise ValueError('Unsafe archive entry: ' + item.name)
        archive.extractall(release)
    for item in release.rglob('*'):
        item.chmod(0o755 if item.is_dir() else 0o644)
    if not (release / 'index.html').is_file() or not (release / 'assets').is_dir():
        raise ValueError('Incomplete production archive')
    atomic_write(release / 'release.json', json.dumps({'commit': commit, 'deployedAt': timestamp}) + '\n')
    original = CONFIG.read_text()
    snippet = Path(__file__).with_name('menu.caddyfile').read_text()
    updated = merge_config(original, snippet)
    candidate = BACKUPS / (timestamp + '.candidate')
    candidate.write_text(updated)
    run('caddy', 'fmt', '--overwrite', str(candidate))
    run('caddy', 'validate', '--config', str(candidate), '--adapter', 'caddyfile')
    backup = BACKUPS / (timestamp + '.Caddyfile')
    shutil.copy2(CONFIG, backup)
    previous = str((ROOT / 'current').resolve()) if (ROOT / 'current').is_symlink() else None
    if (ROOT / 'current').exists() and previous is None:
        raise ValueError('Current is not a symlink; refusing to replace it')
    # An HTML response obtained just before the switch may still request its old
    # hashed assets afterwards. Retain those immutable URLs in the new release.
    if previous:
        prior_assets = Path(previous) / 'assets'
        if prior_assets.is_dir():
            for asset in prior_assets.rglob('*'):
                destination = release / 'assets' / asset.relative_to(prior_assets)
                if asset.is_file() and not destination.exists():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(asset, destination)
    original_app = request('/MakoLrcStudio/')
    switched = False
    try:
        point_to(str(release))
        switched = True
        atomic_write(CONFIG, candidate.read_text())
        run('systemctl', 'reload', 'caddy')
        if b'Talium' not in request('/'):
            raise ValueError('The new homepage was not served')
        if json.loads(request('/release.json'))['commit'] != commit:
            raise ValueError('Wrong release is active')
        if request('/MakoLrcStudio/') != original_app:
            raise ValueError('Existing application response changed')
        for path, expected in [('/MakoLrcStudio', b'308'), ('/unknown-talium-path', b'404')]:
            if request(path, True) != expected:
                raise ValueError('Unexpected response status for ' + path)
        state = {'commit': commit, 'release': str(release), 'previous': previous, 'backup': str(backup), 'rolled_back': False}
        atomic_write(STATE, json.dumps(state, indent=2) + '\n')
    except Exception:
        if switched:
            point_to(previous)
            atomic_write(CONFIG, original)
            run('systemctl', 'reload', 'caddy')
        raise
    print(json.dumps({'url': 'https://tool.talium.site/', 'commit': commit, 'release': str(release), 'backup': str(backup)}))


if __name__ == '__main__':
    if os.geteuid() != 0:
        sys.exit('Run server activation with authorized sudo.')
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if sys.argv[1:] == ['rollback']:
            rollback()
        elif len(sys.argv) == 4:
            activate(*sys.argv[1:])
        else:
            sys.exit('Usage: activate.py <archive> <commit> <sha256> | rollback')
