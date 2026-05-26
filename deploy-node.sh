#!/usr/bin/env bash
#
# deploy-node.sh — provision (or update) a HOSTED GROUNDED Node on the box.
#
#   bash deploy-node.sh <slug> <port>
#   e.g. bash deploy-node.sh podcasting 3003
#
# It does the repeatable, error-prone parts for you:
#   1. Clone or fast-forward github.com/pauldevelopai/node-<slug> into /home/ubuntu.
#   2. Write its .env from the tracker's shared secrets (JWT_SECRET, DATABASE_URL,
#      ANTHROPIC_API_KEY) + PORT. Secrets are copied file-to-file; nothing is printed.
#   3. npm install, then (re)start it under pm2 as "<slug>-hosted".
#   4. Print the one Caddy block to paste for /nodes/<slug>/app/ (a manual,
#      careful step — Caddy edits aren't auto-applied here on purpose).
#
# Prereq: the Node repo must follow the node-analytics pattern — i.e. have a
# "start:hosted" script (server-hosted.js) and the multi-tenant host. See
# ADD_A_NODE.md.
set -euo pipefail

SLUG="${1:?usage: deploy-node.sh <slug> <port>}"
PORT="${2:?usage: deploy-node.sh <slug> <port>}"
REPO="node-${SLUG}"
DIR="/home/ubuntu/${REPO}"
TRACKER_ENV="${TRACKER_ENV:-/home/ubuntu/tracker/.env}"

echo "==> Hosted Node '${SLUG}' (repo ${REPO}) → port ${PORT}"

# 1. Code
if [ -d "$DIR/.git" ]; then
  echo "    updating $DIR"
  git -C "$DIR" pull --ff-only
else
  echo "    cloning into $DIR"
  git clone "https://github.com/pauldevelopai/${REPO}.git" "$DIR"
fi
cd "$DIR"

# 2. Shared secrets → .env (never printed)
TRACKER_ENV="$TRACKER_ENV" NODE_PORT="$PORT" node -e '
const fs = require("fs");
const parse = (p) => { const o = {}; try {
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("\x27") && v.endsWith("\x27"))) v = v.slice(1, -1);
    o[m[1]] = v;
  }} catch (e) {} return o; };
const t = parse(process.env.TRACKER_ENV);
const need = ["JWT_SECRET", "DATABASE_URL", "ANTHROPIC_API_KEY"];
const miss = need.filter(k => !t[k]);
if (miss.length) { console.error("    ! tracker .env missing: " + miss.join(", ")); process.exit(1); }
let env = ""; try { env = fs.readFileSync(".env", "utf8"); } catch (e) {}
const set = (k, v) => { env = new RegExp("^" + k + "=", "m").test(env)
  ? env.replace(new RegExp("^" + k + "=.*$", "m"), k + "=" + v)
  : env.replace(/\n*$/, "\n") + k + "=" + v + "\n"; };
set("JWT_SECRET", t.JWT_SECRET);
set("DATABASE_URL", t.DATABASE_URL);
set("ANTHROPIC_API_KEY", t.ANTHROPIC_API_KEY);
set("PORT", process.env.NODE_PORT);
fs.writeFileSync(".env", env);
console.log("    .env written (JWT_SECRET, DATABASE_URL, ANTHROPIC_API_KEY, PORT=" + process.env.NODE_PORT + ")");
'

# 3. Install + run under pm2
echo "    npm install"
npm install --no-audit --no-fund --loglevel=error
if pm2 describe "${SLUG}-hosted" >/dev/null 2>&1; then
  pm2 restart "${SLUG}-hosted" --update-env
else
  pm2 start npm --name "${SLUG}-hosted" -- run start:hosted
fi
pm2 save >/dev/null 2>&1 || true
echo "    pm2 process '${SLUG}-hosted' is running on :${PORT}"

# 4. Caddy block to paste (manual)
cat <<CADDY

────────────────────────────────────────────────────────────────────────────
ONE-TIME (if not already present): generic install URLs for EVERY Node.
Add inside the grounded.developai.co.za host block in
/etc/caddy/sites/ailegal.co.za.caddy:

    @node_mac path_regexp nm ^/nodes/([a-z0-9-]+)/mac$
    redir @node_mac https://raw.githubusercontent.com/pauldevelopai/node-{re.nm.1}/main/install.sh 302
    @node_win path_regexp nw ^/nodes/([a-z0-9-]+)/windows$
    redir @node_win https://raw.githubusercontent.com/pauldevelopai/node-{re.nw.1}/main/install.ps1 302

PER-NODE: route the hosted app for '${SLUG}' to this process. Add inside the
same host block (more specific than /nodes/* so it wins):

    handle_path /nodes/${SLUG}/app/* {
        reverse_proxy 127.0.0.1:${PORT}
    }

Then apply (Caddy has admin off — restart, not reload):
    sudo systemctl restart caddy
────────────────────────────────────────────────────────────────────────────

Done. Add '${SLUG}' to nodes/nodes.json (status:"live", hosted:true) and
`sudo git -C /var/www/nodes pull` so it shows on the front door.
CADDY
