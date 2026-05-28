# Adding a new Node

A Node is a small app written against the GROUNDED **host interface** so the
*same code* runs two ways:

- **Local** — a newsroom installs it with one command; data + AI key stay on their machine.
- **Hosted** — it runs online on the box, multi-tenant, behind the Grounded login.

You write handlers once; the shared runtime (`@developai/grounded-node-runtime`)
gives you both boots. This is the end-to-end checklist. New here? Read
`HANDOVER.md` first for the big picture.

---

## 0. Pick a template by how your Node stores data

| Your Node mostly… | Copy | Storage in handlers |
|---|---|---|
| has relational data, reports, queries | **`node-analytics`** | `host.db.query/tx` + an `ensureSchema` that creates `node_<slug>_*` tables |
| just needs to save/list records (the simplest path) | **`node-verifier`** | `host.store.list/get/put/delete` (per-newsroom JSON collections) — no schema to write |

Either way the boot files below are identical; only the handlers + (for analytics)
the schema differ.

## 1. The Node repo must follow the pattern

A conforming `node-<slug>` repo has:

| File | Purpose |
|------|---------|
| `index.js` | **Local** entry. `createServer({ slug, host: createLiteHost({...}), handlers, displayName, nodeVersion })`. Add custom routes after if needed: `mountMyRoutes(app, () => host)`. |
| `server-hosted.js` | **Hosted** entry. `await createHostedServer({ slug, productName, handlers, staticDir, nodeVersion, ...})`. Sets `process.env.GROUNDED_HOSTED="1"`. Exposes `npm run start:hosted`. |
| `lib/handlers.js` | Your work, written against the host interface only (`host.db` / `host.store` / `host.ai` / `host.parse` / `host.log` / `host.feedback`). The same module is imported by both entries. |
| `public/` | The dashboard. **Relative** asset + API paths (`<script src="app.js">`, `fetch("api/…")`) so it works at `/` locally and under `/nodes/<slug>/app/` hosted. |
| `install.sh`, `install.ps1` | One-command installers. Copy from the template; change only `REPO=pauldevelopai/node-<slug>` and `DISPLAY_NAME`. |
| `.env.example`, `package.json` | Config + `"start"` and `"start:hosted"` scripts; pin the runtime to the **current tag** (today `#v0.10.0`). |
| `NODE.md`, `README.md`, `CLAUDE.md` | Identity card, the newsroom setup guide, and the Claude-Code map. |

**Hosted boot — the two shapes:**

```js
// node-analytics/server-hosted.js — Postgres-table Node
await createHostedServer({
  slug: "analytics", productName: "Audience Signal",
  handlers, ensureSchema,            // ← creates node_analytics_* tables
  nodeVersion: pkg.version, staticDir: join(__dirname, "public"),
});

// node-verifier/server-hosted.js — host.store Node with custom routes
await createHostedServer({
  slug: "verifier", productName: "Election Watch",
  handlers,
  mountRoutes: (app, { hostFor }) => mountListenerRoutes(app, hostFor), // ← per-request host
  nodeVersion: pkg.version, staticDir: join(__dirname, "public"),
});
```

`createHostedServer` provides everything else for free: tracker-cookie auth, a
per-request newsroom-scoped host, the standard `/api/*` route map, an empty
`node_<slug>_store` table, the "run it locally" footer, and — via runtime
v0.10.0 — the shared **`/nodes/chrome.js`** chrome (Builder/Tracker/Monetisation
nav + the feedback & AI-chat bubbles). You never hand-write nav in a Node; it's
injected and stays consistent with every other surface.

## 2. List it on the front door (always)

Add an entry to **`nodes.json`**, push, and on the box `sudo git -C /var/www/nodes pull`:

```json
{ "slug": "myslug", "repo": "node-myslug", "name": "My Node",
  "status": "live", "hosted": true,
  "desc": "One sentence the newsroom reads on the card. <em>HTML ok.</em>" }
```

`status:"soon"` = placeholder card; `"live"` = shows the install commands (and the
"Use it online" button when `hosted:true`). The front door renders from this file —
never hand-code cards.

## 3. Downloads work automatically

A one-time **generic Caddy rule** maps `/nodes/<slug>/{mac,windows}` to
`node-<slug>`'s raw `install.sh` / `install.ps1` on GitHub — so a new slug's
download URLs work with no Caddy change. Confirm:

```bash
curl -sI https://grounded.developai.co.za/nodes/myslug/mac    # → 302 to raw install.sh
```

## 4. Host it online (one command + one paste)

On the box:

```bash
cd /home/ubuntu/nodes && bash deploy-node.sh myslug 3005   # next free port
```

That clones `node-myslug`, writes its `.env` from the tracker's shared secrets
(`JWT_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL`), installs, and starts it under
pm2 as `myslug-hosted`. It prints the **one Caddy block** for `/nodes/myslug/app/` —
paste it into `/etc/caddy/sites/ailegal.co.za.caddy` and
`sudo systemctl restart caddy` (Caddy has `admin off` — restart, never reload).

## 5. Verify

```bash
curl -sI https://grounded.developai.co.za/nodes/myslug/app/   # → 302 to /login (gated, good)
```

Sign in → the dashboard loads under `/nodes/myslug/app/` with the Grounded nav,
feedback widget, and "run it locally" footer. It now shows in the **Nodes admin**
(`/node-admin`) with usage + per-newsroom feedback, like every other Node.

---

### If the hosted app shows only the nav/footer and no content
Your `public/` is using absolute paths. Change `<script src="/app.js">` →
`src="app.js"` and every `fetch("/api/…")` → `fetch("api/…")`. Absolute paths
resolve to the tracker, not your Node, under the `/nodes/<slug>/app/` subpath.

### If the Node runs old runtime code after a tag bump
npm served a cached github dep. On the box:
`rm -rf node_modules/@developai && npm install && pm2 restart <slug>-hosted`.
