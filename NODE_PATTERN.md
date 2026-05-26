# GROUNDED Node pattern — conversion handover

This is the spec for what a GROUNDED **Node** must look like, and the checklist
for bringing an existing or new Node in line with it. The reference
implementation is **[`pauldevelopai/node-analytics`](https://github.com/pauldevelopai/node-analytics)** —
when in doubt, copy how it does a thing.

Anyone converting a Node should be able to work straight down this document.

---

## Why the pattern exists

A Node is a small, single-purpose AI tool a newsroom **runs on its own machine,
owns, and can adapt.** Five properties make that real, and every Node must have
all five:

1. **Trivial to install** — one terminal command, nothing installed by hand.
2. **Generic, not branded to one newsroom** — the same code serves anyone.
3. **No one's data travels with the code** — data is local to each install.
4. **The newsroom owns it** — their GitHub fork is their copy and identity.
5. **Discoverable** — it's listed on the front door at `grounded.developai.co.za/nodes`.

---

## The seven pillars (what every Node must have)

### 1. One-command install
Two scripts in the repo root, mirrored logic:

- `install.sh` (macOS/Linux) — run via `curl -fsSL …/<slug>/mac | bash`
- `install.ps1` (Windows) — run via `irm …/<slug>/windows | iex`

Each script:
- uses an existing Node ≥20 if present, else downloads a **private portable
  Node** into the install folder (no system install, no admin, no Homebrew);
- downloads the app over **plain HTTPS** from `github.com/pauldevelopai/node-<slug>`
  (codeload tarball — **no git required**);
- runs `npm install`, starts the server, opens the browser;
- is **idempotent**: re-running just relaunches on the latest version and
  **preserves `.env` and `data/`**.

Copy `node-analytics/install.sh` and `install.ps1` and change only the
`GROUNDED_REPO` / `$Repo` default and the install-folder name.

### 2. Uniform naming
For a Node whose slug is `<slug>`:

| Thing | Value |
|---|---|
| GitHub repo | `pauldevelopai/node-<slug>` |
| Local folder | `node-<slug>` |
| `package.json` name | `node-<slug>` |
| Internal `SLUG` (in `index.js`) | `<slug>` (no newsroom name) |
| Install folder | `~/GROUNDED/node-<slug>` (`%USERPROFILE%\GROUNDED\node-<slug>` on Windows) |
| Data-file prefix | `node_<slug>_*` (the runtime derives this from `SLUG`) |

No newsroom name appears in any identifier.

### 3. Env-driven branding (no hardcoded newsroom)
The product name is fixed (e.g. "Audience Signal"); the **newsroom** name is
dynamic. Wire it exactly like `node-analytics`:

- **`index.js`** — `const SLUG = "<slug>"; const PRODUCT = "…";` Build the host
  with `newsroom: process.env.NEWSROOM` (no `|| "SomeNewsroom"` default), read
  the resolved name back from `host.meta?.newsroom`, and pass
  `displayName: newsroom ? \`${newsroom} ${PRODUCT}\` : PRODUCT`.
- **`lib/handlers.js`** — `getSetupStatus` returns `{ …, newsroom: host.meta?.newsroom || null, productName: "…", activityFile: \`data/processed/${host.tablePrefix}activity.json\` }`.
- **`public/index.html`** — neutral defaults (no newsroom), with IDs the JS
  fills: `#brand-kicker`, `#brand-h1`, `#brand-foot`, `#activity-file`.
- **`public/app.js`** — an `applyBrand(setup)` called at the top of `boot()`
  (before the configured/early-return check) that sets the title, masthead and
  footer from `setup.newsroom` + `setup.productName`.

Result: `NEWSROOM=Foo` (env) → "Foo <Product>"; unset on a fresh install →
plain "<Product>". The name is **sticky** in the install's saved meta once set.

### 4. Data never travels with the code
`.gitignore` must contain:
```
data/raw/*
data/processed/*
!data/raw/.gitkeep
!data/processed/.gitkeep
```
Commit empty `.gitkeep` files in both folders; commit **no** data. If a Node
currently has committed data, untrack it without deleting local copies:
`git rm --cached <files>` then commit. A fresh clone / fork / Download-ZIP /
install must start **empty**.

### 5. README + ownership docs
- `README.md` leads with the **one command** (Mac + Windows), then first-run,
  then "re-run the same command to update," then troubleshooting. The fork path
  lives in an **"Advanced"** section, not the main flow.
- `docs/MAKE_IT_YOUR_OWN.md` — the fork-as-identity + adapt + contribute-back
  walkthrough (copy from `node-analytics`, change the slug).
- `docs/FOR_PAUL.md` — the admin playbook (operating modes, the data/privacy
  rules). Copy and adjust.

### 6. Register on the front door (this repo)
In `pauldevelopai/nodes`:
- add a card to `index.html` (copy the Audience Signal block; change name,
  description, and the two install commands);
- add two lines to `_redirects` mapping `/<slug>/mac` and `/<slug>/windows` to
  that Node's raw `install.sh` / `install.ps1`.

### 7. Deliberately NOT in a Node (yet)
- **No outbound telemetry / phone-home.** The runtime sends nothing. Cohort
  visibility would need a future *opt-in* beacon (minimal consented events,
  never story content).
- **No in-app login/accounts.** Identity = the GitHub fork. Real multi-tenant
  logins are a later hosted-GROUNDED concern.

---

## Conversion checklist (work top to bottom)

- [ ] Rename repo → `node-<slug>`; rename local folder; set `package.json`
      `name` to `node-<slug>`.
- [ ] Set `SLUG` in `index.js` to `<slug>` (no newsroom name).
- [ ] If the slug changed, rename data files `node_<oldslug>_*` →
      `node_<slug>_*` and update any test (`tablePrefix`) + in-app references.
- [ ] Make branding env-driven (pillar 3) — all four files.
- [ ] Drop `install.sh` + `install.ps1` in the root; set their repo/folder
      defaults to this Node.
- [ ] gitignore `data/`, add `.gitkeep`s, untrack any committed data.
- [ ] Rewrite `README.md` around the one command; add `docs/MAKE_IT_YOUR_OWN.md`
      and `docs/FOR_PAUL.md`.
- [ ] Add the Node to the `nodes` front door (card + redirects).
- [ ] Run the verification recipe below.
- [ ] Push to `main`.

---

## Gotchas (learned converting node-analytics)

- **`npm install` works without git** even though `package-lock.json` may pin
  the runtime as `git+ssh://…`. For a *public* repo, npm/pacote fetches the
  dependency as an HTTPS codeload tarball. **Verify it** by installing with git
  removed from `PATH` — don't assume.
- **Reinstall-skip fingerprint = hash of `package.json` only.** `npm install`
  rewrites `package-lock.json`, so hashing the lock makes every re-run look
  "changed" and reinstall needlessly.
- **`SLUG` is load-bearing for data.** The runtime builds the data-file prefix
  as `node_${SLUG.replace(/-/g,"_")}_`. Changing the slug changes the filenames;
  rename the committed/local data files and update tests + the in-app reference.
- **Branding is sticky.** The runtime resolves newsroom as
  `NEWSROOM env → saved meta → null`. Don't bake a default newsroom into code;
  let a fresh install show the plain product name.
- **Front-door redirects are 302.** `curl -fsSL` and PowerShell `irm` both
  follow redirects, so a 302 to the raw script is enough.
- **macOS Gatekeeper** doesn't block `curl|bash` (no quarantine on piped input),
  so the one-command path avoids the "unverified developer" prompt that a
  double-clicked `.command` hits.
- **Windows is the weak spot.** `install.ps1` mirrors the Mac logic but the
  PowerShell specifics (Expand-Archive, robocopy exit codes, Start-Job) need a
  test on a real Windows machine before you hand the command to a newsroom.

---

## Verification recipe (run before shipping any Node)

On a Mac, with git made unavailable, install into a throwaway home on a spare
port and confirm a clean, generic, empty boot:

```bash
T="$(mktemp -d)"; mkdir -p "$T/shims"
printf '#!/bin/sh\nexit 127\n' > "$T/shims/git"      # pretend git is absent
printf '#!/bin/sh\nexit 0\n'   > "$T/shims/open"     # don't spawn a browser
chmod +x "$T/shims/git" "$T/shims/open"
PATH="$T/shims:$(dirname "$(which node)"):/usr/bin:/bin" \
  GROUNDED_HOME="$T/G" PORT=3990 \
  bash -c 'curl -fsSL https://raw.githubusercontent.com/pauldevelopai/node-<slug>/main/install.sh | bash' &
curl -s --retry 60 --retry-delay 1 --retry-connrefused http://localhost:3990/api/setup   # newsroom:null, productName set
curl -s http://localhost:3990/api/sources                                                # [] — empty, no data
lsof -ti tcp:3990 | xargs kill; rm -rf "$T"
```

Pass criteria: installs with **no git**, boots, `/api/setup` shows
`newsroom: null` (generic branding), `/api/sources` is `[]` (no inherited data).
