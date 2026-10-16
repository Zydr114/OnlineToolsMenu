#!/usr/bin/env bash
# Build locally, upload via SSH, then activate only under explicit sudo authorization.
set -euo pipefail
cd "$(dirname "$0")/.."
host="${DEPLOY_HOST:-tencent}"
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit all source changes before deployment.' >&2; exit 1; }
commit="$(git rev-parse HEAD)"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || exit 1
npm run build
mkdir -p artifacts/deploy
archive="artifacts/deploy/${commit}.tar.gz"
tar -czf "$archive" -C dist .
checksum="$(sha256sum "$archive" | cut -d' ' -f1)"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" 'sudo -n true && mkdir -p /home/ubuntu/.local/share/talium-menu'
scp "$archive" scripts/activate.py scripts/menu.caddyfile "$host:/home/ubuntu/.local/share/talium-menu/"
ssh -o BatchMode=yes "$host" "sudo -n python3 /home/ubuntu/.local/share/talium-menu/activate.py /home/ubuntu/.local/share/talium-menu/${commit}.tar.gz ${commit} ${checksum}"
curl --fail --silent --show-error --max-time 20 https://tool.talium.site/release.json
echo
echo 'Deployed: https://tool.talium.site/'
