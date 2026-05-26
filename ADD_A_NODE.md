# Adding a new Node

A Node is a small app that targets the GROUNDED **host interface** so the *same
code* runs two ways:

- **Local** — a newsroom installs it with one command; data + keys stay on their machine.
- **Hosted** — it runs online on the box, multi-tenant, behind the tracker login.

This is the checklist to plug a new one in (example: `node-podcasting`, slug `podcasting`).

---

## 1. The Node repo must follow the pattern

Use **`node-analytics`** as the reference. A conforming repo has:

| File | Purpose |
|------|---------|
| `index.js` | Local entry — `createServer({ slug, host: createLiteHost(...), handlers })` from `@developai/grounded-node-runtime`. |
| `server-hosted.js` | Hosted entry — verifies the tracker cookie, builds a per-request Postgres host, mounts the **same** handlers. Exposes `npm run start:hosted`. |
| `lib/handlers.js` (+ app logic) | The Node's actual work, written against the host interface (`host.db`, `host.ai`, `host.parse`, `host.log`, `host.feedback`). |
| `public/` | The dashboard (relative asset/API paths so it works at `/` locally and under `/nodes/<slug>/app/` hosted). |
| `install.sh`, `install.ps1` | One-command installers. Copy from `node-analytics` and change only `DISPLAY_NAME` + the repo slug. |
| `.env.example`, `package.json` (with `"start"` and `"start:hosted"`) | Config + scripts. |

> `node-podcasting` currently uses the **old** `Start.command`/`Update.bat` style and has no `server-hosted.js`/`install.sh`. It needs bringing onto this pattern before it can plug in. (Ask Claude to do the conversion — it's mechanical.)

## 2. List it on the front door (always)

Add an entry to **`nodes/nodes.json`**, push, and on the box `sudo git -C /var/www/nodes pull`:

```json
{ "slug": "podcasting", "repo": "node-podcasting", "name": "Explain Podcast Studio",
  "status": "live", "hosted": true,
  "desc": "Train a newsroom voice and turn transcripts into MP3 podcasts." }
```

`status:"soon"` shows a placeholder card; `"live"` shows install commands (and the
"Use it online" button if `hosted:true`). The front door renders from this file —
no HTML editing.

## 3. Downloads work automatically

The one-time **generic install rule** in Caddy maps `/nodes/<slug>/{mac,windows}`
to `node-<slug>`'s raw install scripts — so a new slug's download URLs work with
no Caddy change. (The rule is printed by `deploy-node.sh`; add it once.)

## 4. Host it online (one command + one paste)

On the box:

```bash
bash deploy-node.sh podcasting 3003     # next free port
```

That clones the repo, writes its `.env` from the tracker's shared secrets, installs,
and starts it under pm2 as `podcasting-hosted`. It then prints the **one Caddy block**
to paste for `/nodes/podcasting/app/` — add it and `sudo systemctl restart caddy`.

## 5. Done

The Node now appears on the front door, downloads with one command, and runs online
at `grounded.developai.co.za/nodes/podcasting/app/` behind the Grounded login —
showing up in the **Nodes admin** like every other.

---

### Make it even easier (recommended next step)

Today each Node repo carries its own copy of `server-hosted.js` + the multi-tenant
Postgres host. Moving those into `@developai/grounded-node-runtime` as a generic
`createHostedServer({ slug, handlers, productName })` would shrink a Node's hosted
entry to ~10 lines (like `index.js` already is for local) — so a new Node is just
*handlers + public/ + a tiny entry file*. Worth doing once a second Node lands.
