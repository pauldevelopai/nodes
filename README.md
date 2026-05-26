# nodes — the GROUNDED front door

The landing page for **GROUNDED Nodes**, served at
**`https://grounded.developai.co.za/nodes/`** by Caddy on the GROUNDED box
(alongside the AI Legal tracker, which stays at the domain root).

It lists the Nodes with their one-command installers, and the same Caddy block
serves the install-command URLs (`/nodes/<slug>/{mac,windows}` → each Node's raw
`install.sh` / `install.ps1`).

Each Node lives in its **own** repo (e.g.
[`node-analytics`](https://github.com/pauldevelopai/node-analytics)). This repo
is only the front door — no Node code here.

## Files

| File | Purpose |
|------|---------|
| `index.html` | the landing page (self-contained — inline CSS + a tiny copy-button script) |
| `_redirects` | install-URL redirects for an **optional** standalone Netlify/Cloudflare deploy. The live deploy uses Caddy instead — see `DEPLOY.md`. |
| `DEPLOY.md` | how it's hosted (the Caddy block + apply/update steps) |
| `NODE_PATTERN.md` | the spec + checklist for bringing other Nodes in line with `node-analytics` |

## Deploy / update

See `DEPLOY.md`. In short: the files live at `/var/www/nodes` on the box; to ship
a change, push here and run `sudo git -C /var/www/nodes pull` on the box.

## Adding a new Node

1. Add a card to `index.html` (copy the Audience Signal block; change the name,
   description, and the two install commands).
2. Add the redirect handles for `/nodes/<slug>/{mac,windows}` to the Caddy block
   (`DEPLOY.md` shows the shape) — and to `_redirects` too if you also keep the
   standalone Netlify option.
