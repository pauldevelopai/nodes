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

## Running a Node with an AI coding agent (`/grounded`)

Every Node repo ships an agent setup playbook — `.claude/commands/grounded.md`
(the `/grounded` command in Claude Code) plus an `AGENTS.md` pointer for Codex
and other agents. It clones (if needed), installs, launches, verifies the app
answers, and hands the user plain run instructions. The AI key is entered in
the app's own browser screen — never in the chat.

**Zero setup** — the instructions ship inside every repo, so cloning IS the install:

```bash
git clone https://github.com/pauldevelopai/node-<slug> && cd node-<slug> && claude
```

then type `/grounded`. (Codex: run `codex` instead of `claude`, then say
"set up and run this Node" — it follows `AGENTS.md` to the same playbook.)

**Power users** — install the command globally once:

```bash
curl -fsSL https://raw.githubusercontent.com/pauldevelopai/node-template/main/.claude/commands/grounded.md --create-dirs -o ~/.claude/commands/grounded.md
```

then `/grounded https://github.com/pauldevelopai/node-<slug>` works from any
folder, no clone first (a bare `node-<slug>` works too). Codex CLI users can
install the same file to `~/.codex/prompts/grounded.md` for a `/grounded`
prompt there.

The playbook is generic; the canonical copy lives in `node-template`, so every
Node scaffolded from it (see `ADD_A_NODE.md`) inherits it. Newsrooms without an
agent use the one-command installers above instead — same result.

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
