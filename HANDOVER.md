# GROUNDED — START HERE (handover)

> Open this first. It's the single map of the whole system: what the repos are,
> how the live box is wired, how to **add a new Node**, how to deploy, and the
> gotchas that will otherwise cost you an hour. Last reviewed 2026-05-27.

**Grounded** = newsroom-owned AI, by **Develop AI**. One domain,
`grounded.developai.co.za`, three things on it:

1. **AI Legal tracker** — the public site (lawsuits + regulations + use-cases) and
   the logged-in admin. Lives in the `tracker` repo.
2. **Nodes** — small AI tools a newsroom can **download and run locally** *and*
   **use online** (hosted on the box, behind the Grounded login). Each Node is its
   own `node-<slug>` repo, all built on one shared library.
3. **Tools** — AIKit, a FastAPI app proxied under `/tools`.

The whole point of a Node: **the same handler code runs two ways** — on a
journalist's laptop (data + AI key stay on their machine) and online
(multi-tenant, per-newsroom). You write the logic once against a *host interface*;
the runtime gives you both boots.

---

## The repos (and the VS Code workspace)

Open **`grounded.code-workspace`** — it loads all six active repos as one
multi-root workspace. They live in two parent folders on disk:

| # | Repo (GitHub `pauldevelopai/…`) | On disk | What it is |
|---|------|---------|------------|
| ① | `tracker` | `PYTHON 2026/tracker` | The main app: AI Legal site + the Grounded admin, feedback, beacon, auth, Postgres. |
| ② | `grounded-node-runtime` | `PYTHON 2026/grounded-node-runtime` | The shared library every Node builds on. `createServer` (local) / `createHostedServer` (online) / the host interface. **Versioned by git tag.** |
| ③ | `nodes` | `PYTHON 2026/Nodes/nodes` | The **front door** (`/nodes/`), the **registry** (`nodes.json`), deploy tooling, and these docs. **The hub.** |
| ④ | `node-analytics` | `PYTHON 2026/Nodes/node-analytics` | *Audience Signal*. Reference Node for the **Postgres-table** storage pattern. |
| ⑤ | `node-verifier` | `PYTHON 2026/Nodes/node-verifier` | *Election Watch*. Reference Node for the **host.store + custom-routes** pattern. |
| ⑥ | `node-podcasting` | `PYTHON 2026/Nodes/node-podcasting` | *Podcast Studio*. Downloads + runs locally; **not yet hosted** (no `server-hosted.js`; audio/blob storage still to wire). |

**Ignore / clean up these stale folders** (not in the workspace, safe to delete —
they're pre-rename leftovers, superseded by ④/⑤):
`Nodes/node-makanday-analytics`, `Nodes/node-capitalfm-verifier`, `Nodes/grounded-hub`.
The live, canonical repos are `node-analytics` and `node-verifier`.

---

## How a new Node plugs in — the 6-step TL;DR

Full detail and copy-paste commands are in **`ADD_A_NODE.md`** (same folder). The shape:

1. **Make the repo** from a template. Copy `node-analytics` (DB tables) or
   `node-verifier` (key/value store), rename slug + display name. A conforming
   Node has: `index.js` (local boot), `server-hosted.js` (online boot),
   `lib/handlers.js` (your logic against the host interface), `public/`
   (dashboard, **relative paths**), `install.sh` + `install.ps1`, `package.json`
   with `start` + `start:hosted` and the runtime pinned to the current tag.
2. **Write logic against the host interface only** — never touch the filesystem or
   a specific database directly. That's what makes one codebase run both ways.
3. **Register it**: add one entry to `nodes/nodes.json`, push, and on the box
   `sudo git -C /var/www/nodes pull`. The front door now lists it and the download
   commands work (a generic Caddy rule maps `/nodes/<slug>/{mac,windows}`).
4. **Host it online**: on the box run `bash deploy-node.sh <slug> <port>`, then paste
   the one Caddy block it prints and `sudo systemctl restart caddy`.
5. **Verify**: front door shows the card; `curl -I …/nodes/<slug>/mac` 302s to the
   installer; `…/nodes/<slug>/app/` 302s to login (gated). Sign in and use it.
6. **It's now in the Nodes admin** like the others (usage + per-newsroom feedback).

---

## The two storage patterns (pick one per Node)

Both use `createHostedServer` online and `createServer` locally. They differ only
in **where the Node's data lives**:

- **Postgres tables — `node-analytics`.** Pass `ensureSchema` to `createHostedServer`;
  it creates your `node_<slug>_*` tables. Use `host.db.query/tx` in handlers
  (auto-scoped to `$1 = newsroom_id`). Best when you have real relational data.
- **Key/value store — `node-verifier`.** Use `host.store.list/get/put/delete`
  (collections of JSON, per-newsroom). No schema to write — same API backs JSON
  files locally and a `node_<slug>_store` table online. Best for "I just need to
  save some records" Nodes, and the fastest way to make a file-based Node
  multi-tenant. Add any non-standard routes via the **`mountRoutes`** hook (verifier
  uses it for its `/api/listener/*` routes).

---

## Deploying — always via Lightsail **browser** SSH

> The old SSH key was pasted into a chat and is **compromised — rotate it** and do
> NOT SSH with a chat-pasted key. Until then, use the Lightsail console's in-browser
> SSH for all box work. (See "Outstanding" below.)

The box is a shared Lightsail Ubuntu host (`52.56.143.231`, eu-west-2). Per repo:

| Change you made | Command on the box |
|---|---|
| Tracker (server or React client) | `cd /home/ubuntu/tracker && bash deploy.sh` |
| Front door / registry (`nodes.json`, `index.html`) | `sudo git -C /var/www/nodes pull` |
| A hosted Node's code (e.g. verifier) | `cd /home/ubuntu/node-<slug> && git pull && rm -rf node_modules/@developai && npm install && pm2 restart <slug>-hosted` |
| First-time host a new Node | `cd /home/ubuntu/nodes && bash deploy-node.sh <slug> <port>` then paste Caddy block + `sudo systemctl restart caddy` |
| Runtime library (after moving its tag) | redeploy each Node that pins the new tag (the `rm -rf node_modules/@developai` line above) |

`tracker/deploy.sh` does: stash → pull → server `npm install` → **migrate** →
**client `npm run build`** → `pm2 restart tracker-server`. Migrations are tracked
in a `migrations` table, so re-running is safe — it only applies new ones. The
client build is the step people forget: editing React does nothing live until the
Vite bundle is rebuilt.

---

## Host interface cheat-sheet (what your handlers get)

A handler is `async (host, reqLike) => responseObject`. The runtime maps standard
names to routes automatically (`getSetupStatus`→`/api/setup`, `postBrief`→`/api/brief`,
`postIngest`→`/api/ingest`, `listSources`, `getReport`, `getQuality`, `getActivity`).

- `host.db.query(sql, params)` / `host.db.tx(fn)` — Postgres, auto-binds `$1 = newsroom_id` online.
- `host.store.list(coll)` / `.get(coll,key)` / `.put(coll,key,val)` / `.delete(coll,key)` — per-newsroom key/value JSON.
- `host.ai.chat(input, { system, maxTokens })` — Claude/OpenAI; key is the user's locally, server-managed online.
- `host.parse.docxToHtml(buffer)` — document parsing.
- `host.log.run/edit/error(...)` — activity log (powers the Nodes admin).
- `host.feedback.submit(...)` — local feedback file (online, the injected widget POSTs to the tracker instead).
- `host.meta`, `host.tablePrefix` — identity + `node_<slug>_` prefix.

---

## Gotchas (these will bite you)

- **Caddy has `admin off`** → `systemctl reload caddy` FAILS silently-ish. Always
  `sudo systemctl restart caddy`. Edit the file at
  `/etc/caddy/sites/ailegal.co.za.caddy` — do **not** paste Caddy directives into
  the shell (a past hour was lost to `handle_path: command not found`).
- **Hosted Nodes serve under `/nodes/<slug>/app/`** → the dashboard MUST use
  **relative** paths (`fetch("api/…")`, `<script src="app.js">`). Absolute `/api/…`
  hits the tracker and 404s. This is the #1 "hosted app shows only nav, no content" bug.
- **Runtime is consumed by git tag** (`github:…/grounded-node-runtime#vX.Y.Z`).
  To ship a runtime change: bump `package.json`, commit, **move the tag**
  (`git tag -f vX.Y.Z && git push -f origin vX.Y.Z`), bump the pin in each Node.
- **npm caches github deps** — after re-pointing a Node at a new tag, a plain
  `npm install` may serve the stale copy. Force it:
  `rm -rf node_modules/@developai && npm install`.
- **Auth cookie is `tracker_token`** (JWT, httpOnly). The hosted runtime reads it
  name-agnostically (any cookie that verifies with `JWT_SECRET`), but `tracker_token`
  is the default. `JWT_SECRET` in each Node's box `.env` must match the tracker's.
- **Internal identifiers are sticky.** The verifier's slug is `capitalfm-verifier`
  and its tables are `node_capitalfm_verifier_*` even though the product is now
  "Election Watch" — renaming them would orphan existing data. Display names are
  de-branded; identifiers are not. Same caution for any Node you rename.

---

## Outstanding / known follow-ups

- **Rotate the leaked SSH key.** Generate a fresh keypair, replace it on the
  Lightsail instance, and delete the old one. Until done, deploy via browser SSH only.
- **Delete the stale folders** listed above (`node-makanday-analytics`,
  `node-capitalfm-verifier`, `grounded-hub`) once you've confirmed nothing local
  references them.
- **node-analytics box runs runtime v0.8.0** (git now pins v0.9.0). Low priority —
  v0.8.0 works; it picks up v0.9.0 next time you deploy analytics.
- **Host node-podcasting** — needs a `server-hosted.js` plus blob storage for audio
  before it can go multi-tenant. Downloads/local already work.
- **End-to-end smoke test you should do logged in** (only you can — it needs a
  session): sign in, open `…/nodes/verifier/app/`, run a real claim verification,
  then click the **Feedback** button and confirm the item appears in
  `…/admin` (Recent feedback) and `…/feedback`.

---

## Where the detail lives

- **`ADD_A_NODE.md`** (this folder) — the full add-a-Node recipe.
- **`CLAUDE.md`** in each repo — auto-loaded by Claude Code; the per-repo map.
  Start with `tracker/CLAUDE.md` (full system + box topology) and
  `grounded-node-runtime/CLAUDE.md` (the host APIs + versioning).
- **`deploy-node.sh`** (this folder) — provisions a hosted Node on the box.
- `nodes/DEPLOY.md`, `HOSTED.md`, `NODE_PATTERN.md` — background design notes.
