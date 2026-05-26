# Hosting Nodes online — design

**Status: design / not yet built.** Today every Node runs **locally** (one-command
install, data on the newsroom's own machine). This describes what it takes to also
let a newsroom **use a Node in the browser** — sign in, upload their matrix, use the
dashboard online — as a second door to the same Node. Hosted and local coexist:
hosted is the convenient option; local stays for newsrooms that need their data on
their own machine.

---

## The one piece of leverage

A Node's app code (`lib/handlers.js`, `analytics.js`, `ingest.js`, `beats.js`, and
the dashboard) talks to a **host interface** — `host.db.query()`, `host.ai.chat()`,
`host.log`, `host.tablePrefix` — never directly to storage or the AI. Today the only
implementation is the **lite host**: single-user, file-based, `newsroom_id="local"`,
no auth.

The same handlers can run unchanged on a **hosted host**: multi-tenant, Postgres,
every read/write scoped to the logged-in newsroom. (The interface already auto-binds
`$1 = newsroom_id` on every query — see the runtime's host-lite.) So hosting is
**build the platform around the Node, not rewrite the Node.**

---

## What has to be built

1. **Auth / accounts** — newsrooms sign in. *(Decision A.)*
2. **Multi-tenant host** — the runtime's host interface implemented against Postgres,
   scoping every row to the session's `newsroom_id`. This is the core new code, and
   it's reused by *every* future Node.
3. **Hosted entrypoint** — a server that wires the Node's handlers to the multi-tenant
   host + auth middleware (session → `newsroom_id`), instead of `index.js`'s lite host.
4. **Server-side AI** — online, the server makes the AI calls, so a key pays.
   *(Decision B.)*
5. **Deploy on Lightsail** — run the hosted Node as a service on a local port (e.g.
   `:3002`); Caddy reverse-proxies `grounded.developai.co.za/nodes/analytics/app` → it.
   The box already runs the tracker (Node `:3001` + FastAPI `:8000`); one more Node
   process is fine for the pilot.
6. **Front door** — each Node card gains **"Use it online"** (sign in → hosted app)
   *above* the local install commands.

---

## Decisions needed before building

### A. Authentication — reuse the tracker, or a separate GROUNDED login?
- **Reuse `holly` / AI-Legal accounts** — fastest; one login; the hosted Node trusts
  the session holly already issues. But it ties Audience-Signal users into the
  AI-Legal user system (a different product and audience).
- **Separate GROUNDED accounts** — cleaner long-term (GROUNDED is the parent brand for
  newsroom Nodes); more to build (signup, sessions, password reset).

### B. Who pays for AI online?
- **Shared GROUNDED key** — you hold one key server-side; cheap Haiku model + a
  per-newsroom usage cap. Simplest for newsrooms. *(Recommended for the pilot.)*
- **Each newsroom's own key** — entered once, stored **encrypted** server-side; shifts
  cost to them but adds a real security burden (storing third-party secrets).

### C. Data posture (confirm, don't decide)
Hosted means each newsroom's uploads + results live in the **server's** database
(isolated per account) — the opposite of the local "data never leaves your machine"
guarantee. So hosted is offered *alongside* local, and the front door says which is
which. Sensitive-source work → recommend local.

---

## To confirm on the box (read-only, 2 facts)

- Is **Postgres** already running (does `holly` use it)? If yes, reuse it; if not, add it.
- How does `holly` issue/verify logins (session cookie? JWT?) — only needed if we reuse
  its auth (Decision A).

---

## Effort & phasing

This is the platform build, not a tweak — **days of focused work**, phased:

1. **Decide A + B**, confirm the box's DB/auth.
2. **Multi-tenant host + Postgres schema** for the analytics tables (scoped by
   `newsroom_id`). A draft schema (`node_analytics_*`) already exists from the
   graduation notes in `node-analytics/docs/FOR_PAUL.md`.
3. **Auth + hosted entrypoint + Caddy route + service** on the box.
4. **Front-door "Use it online" + the login screen.**

Build it for **one** Node (Audience Signal) first; once it works, the same hosted host
serves every future Node with no extra platform work.

---

## Locked decisions + confirmed stack (2026-05-26)

- **Auth: reuse holly's accounts.** holly issues a **JWT in a cookie `tracker_token`**,
  verified with `config.jwtSecret` (`tracker/server/middleware/auth.js`). The hosted
  Node runs on the same domain, so the browser already sends that cookie to it — the
  Node verifies it with the same secret, reads the user, and scopes their data. No new
  login UI; unauthenticated visitors are redirected to holly's existing `/login`.
- **AI: one shared GROUNDED key** server-side (cheap Haiku) + a per-newsroom usage cap.
- **Storage: the box's existing Postgres** (`127.0.0.1:5432`). Tables `node_analytics_*`
  with a `newsroom_id` column; every query scoped to the signed-in newsroom.
- Box libs available: `pg`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`.

## Concrete build plan

**Phase 1 — Multi-tenant host (in `grounded-node-runtime`).** A Postgres-backed
implementation of the host interface (`db`/`ai`/`log`/`tablePrefix`) that resolves the
`newsroom_id` **per request** (today's lite host bakes one tenant at startup — adding
per-request tenant context is the one real architectural change). Reused by every Node.

**Phase 2 — Auth + hosted entrypoint.** Express middleware verifies the `tracker_token`
JWT → `newsroom_id` (else redirect to `/login`); mounts the *existing* `lib/handlers.js`
on the multi-tenant host. AI uses the shared key.

**Phase 3 — Deploy.** Run the hosted Node as a service on `:3002`; Caddy
reverse-proxies `grounded.developai.co.za/nodes/analytics/app/*` → it (grounded-only,
tracker untouched). Secrets (JWT secret, DB creds, shared AI key) from an env file on
the box, never committed.

**Phase 4 — Front door.** Add **"Use it online"** to each Node card, above the local
install commands.

**To resolve at build time:** what in holly's JWT identifies a *newsroom* (a user id?
an organisation id? — holly has an Organisations model) — that becomes the tenant
scoping key. Confirm from the users/orgs schema in Phase 1.
