# nodes — the GROUNDED front door + Node registry + deploy tooling

Served at **`grounded.developai.co.za/nodes/`** (static, from `/var/www/nodes` on the
box, via Caddy). This repo is how Nodes are listed and provisioned. Part of
**Grounded** (newsroom-owned AI by Develop AI).

## Files
- **`index.html`** — the front door. Auth-aware (calls `/api/auth/me` → shows "Hi <name>"+Sign out or Sign in) and **registry-driven**: it renders Node cards from `nodes.json` at runtime. Don't hand-code cards.
- **`nodes.json`** — THE registry. One entry per Node: `{slug, repo, name, status:"live"|"soon", hosted:true|false, desc}`. Adding or changing a Node here (then `sudo git -C /var/www/nodes pull` on the box) is all the front door needs.
- **`deploy-node.sh <slug> <port>`** — run on the box to host a Node: clones `node-<slug>`, writes its `.env` from the tracker's shared secrets, `npm install`, pm2 `<slug>-hosted`, and prints the Caddy blocks to paste.
- **`ADD_A_NODE.md`** — the full end-to-end checklist for a new Node (download + hosted). **Start here to add a Node.**
- `DEPLOY.md`, `HOSTED.md`, `NODE_PATTERN.md` — background design docs.

## How a Node plugs in (summary)
1. Build the repo from the `node-analytics` pattern (install.sh/ps1, `index.js` via `createServer`, `server-hosted.js` via `createHostedServer`, handlers against the host interface, relative `public/` paths).
2. Add it to `nodes.json` (+ box pull) → it's listed + downloadable. Generic Caddy rule maps `/nodes/<slug>/{mac,windows}` to `node-<slug>`'s raw install scripts (one rule, all Nodes).
3. To host it online: `bash deploy-node.sh <slug> <port>` on the box + paste the printed `handle_path /nodes/<slug>/app/*` Caddy block + `sudo systemctl restart caddy` (Caddy has `admin off` — restart, never reload).

## GOTCHAs
- Caddy `admin off` → `sudo systemctl restart caddy`, not reload.
- Audio/file Nodes (e.g. node-podcasting) can be DOWNLOADED today but not yet HOSTED — `createHostedServer` needs a custom-routes hook + blob storage first.

See the tracker repo's `CLAUDE.md` for the full system map; `grounded-node-runtime/CLAUDE.md` for the shared boot/host APIs.
