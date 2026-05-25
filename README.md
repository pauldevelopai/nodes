# nodes — the GROUNDED front door

The public landing page for **GROUNDED Nodes**, served at
**https://nodes.developai.co.za**. It does two jobs:

1. **Lists the Nodes** with a one-line description and the one-command installer
   for each (`index.html`).
2. **Serves the install command URLs** — the clean `nodes.developai.co.za/<node>/{mac,windows}`
   links that each Node's README tells newsrooms to paste (`_redirects`).

Each Node itself lives in its **own** repo (e.g.
[`node-analytics`](https://github.com/pauldevelopai/node-analytics)). This repo
is only the front door — no Node code here.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The landing page (self-contained — inline CSS + a tiny copy-button script). |
| `_redirects` | Maps the clean install URLs to each Node's raw install script. |

## The install redirects

```
/analytics/mac      → raw …/node-analytics/main/install.sh    (302)
/analytics/windows  → raw …/node-analytics/main/install.ps1   (302)
```

`curl -fsSL` and PowerShell's `irm` both follow redirects, so a 302 to the raw
GitHub script is all that's needed — the script then downloads the app itself.

## Deploy

Point `nodes.developai.co.za` at this repo with any static host that reads a
`_redirects` file — **Netlify** or **Cloudflare Pages** work with zero config
(connect the repo, set the custom domain, done). The landing page and the
install redirects both come from this one deploy.

On a host without `_redirects` support (nginx, Apache, GitHub Pages, etc.),
recreate the two redirects from the table above in that host's config instead.

## Adding a new Node

1. Add a card to `index.html` (copy the Audience Signal block; change the name,
   description, and the two install commands).
2. Add two lines to `_redirects` pointing `/<node>/mac` and `/<node>/windows`
   at that Node's `install.sh` / `install.ps1`.

That's it — the new Node shows up on the front door and its install command goes
live.
