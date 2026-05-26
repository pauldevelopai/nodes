# Deploying the GROUNDED front door

The front door is served by **Caddy** on the GROUNDED box — the same box that
runs the AI Legal tracker — at **`https://grounded.developai.co.za/nodes/`**.

The tracker stays at the domain root, untouched. The Nodes page is a set of
**grounded-only, path-scoped** handles added to the existing Caddy site block, so
it can't affect the tracker or `ailegal.co.za`.

## How it's wired

- The site files live at **`/var/www/nodes`** (a clone of this repo).
- Caddy already serves a shared block for
  `ailegal.co.za, www.ailegal.co.za, grounded.developai.co.za` (SPA at the root,
  `/api/*` → `:3001`, `/tools/*` → `:3001`, etc.). We add these handles **inside**
  that block — the existing handles are not touched:

```caddy
    # ── GROUNDED Nodes front door — grounded.developai.co.za only ──────────
    @nodes_mac {
        host grounded.developai.co.za
        path /nodes/analytics/mac
    }
    handle @nodes_mac {
        redir https://raw.githubusercontent.com/pauldevelopai/node-analytics/main/install.sh 302
    }

    @nodes_win {
        host grounded.developai.co.za
        path /nodes/analytics/windows
    }
    handle @nodes_win {
        redir https://raw.githubusercontent.com/pauldevelopai/node-analytics/main/install.ps1 302
    }

    @nodes_bare {
        host grounded.developai.co.za
        path /nodes
    }
    handle @nodes_bare {
        redir /nodes/ 301
    }

    @nodes_site {
        host grounded.developai.co.za
        path /nodes/*
    }
    handle @nodes_site {
        uri strip_prefix /nodes
        root * /var/www/nodes
        file_server
    }
```

These are path-scoped, so Caddy evaluates them before the catch-all SPA `handle`,
and host-scoped, so `ailegal.co.za/nodes/*` falls through to the SPA as before.

## Apply / update (run on the box, e.g. Lightsail browser SSH)

```bash
# 1. Put / refresh the front-door files
sudo git -C /var/www/nodes pull 2>/dev/null || sudo git clone https://github.com/pauldevelopai/nodes.git /var/www/nodes
sudo chmod -R a+rX /var/www/nodes        # Caddy must be able to read them

# 2. Add the snippet above into the existing site block
ls /etc/caddy/sites/                      # find the file that holds the block
sudo nano /etc/caddy/sites/<that-file>    # paste the snippet before the final `handle { ... }`

# 3. Validate, then reload (validate gates the reload)
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy

# 4. Verify
curl -sI https://grounded.developai.co.za/nodes/analytics/mac   # → 302 to raw install.sh
#   open https://grounded.developai.co.za/nodes/   → the front door
#   open https://grounded.developai.co.za/         → the tracker, unchanged
```

To ship a Nodes-page change later: edit this repo, push, then just
`sudo git -C /var/www/nodes pull` on the box (no Caddy change needed).

## Optional: standalone hosting

If you ever want the front door on its own (not behind the tracker's box), the
`_redirects` file lets you drop this repo on **Netlify** or **Cloudflare Pages**
as a root site — point a domain at it and the install redirects work with no
config. Not used by the live `grounded.developai.co.za/nodes/` deploy.
