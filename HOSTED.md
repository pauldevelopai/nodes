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
