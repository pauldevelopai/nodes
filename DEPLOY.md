# Deploying the GROUNDED front door

This repo is `nodes.developai.co.za`: the landing page (`index.html`) plus the
install-command redirects. Two ways to host it.

---

## Option A — Netlify or Cloudflare Pages (easiest, zero server)

Connect this repo, set the custom domain to `nodes.developai.co.za`, deploy.
The `_redirects` file makes `/analytics/mac` and `/analytics/windows` work with
no extra config. Done. (Recommended unless you specifically want a server.)

---

## Option B — Self-host on the Lightsail Ubuntu box

Use this if you want everything on your own VM (`Ubuntu-1`, static IP
`52.56.143.231`). nginx serves the page and does the redirects via
`deploy/nginx-nodes.conf` (nginx ignores `_redirects`, hence the explicit config).

**You run these steps — over Lightsail's browser SSH so no key is involved.**
Open the instance → **Connect using SSH** (browser), then paste:

```bash
# 1. Install nginx, certbot, git
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git

# 2. Put the site on the box
sudo git clone https://github.com/pauldevelopai/nodes.git /var/www/nodes

# 3. Wire up the nginx config (shipped in this repo)
sudo cp /var/www/nodes/deploy/nginx-nodes.conf /etc/nginx/sites-available/nodes
sudo ln -sf /etc/nginx/sites-available/nodes /etc/nginx/sites-enabled/nodes
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

At this point `http://52.56.143.231` shows the front door.

**4. Point the domain.** At your DNS provider, add records for
`nodes.developai.co.za`:
- `A` → `52.56.143.231`
- `AAAA` → `2a05:d01c:39:4900:e647:daf9:26ef:412b` (optional, IPv6)

**5. Open the firewall.** In Lightsail → the instance → **Networking**, make
sure both **HTTP (80)** and **HTTPS (443)** are allowed (80 is open by default;
add 443).

**6. Get HTTPS** (after DNS has propagated to the IP):

```bash
sudo certbot --nginx -d nodes.developai.co.za
```

Certbot edits the nginx config to add TLS and an HTTP→HTTPS redirect, and
auto-renews. Now `https://nodes.developai.co.za/analytics/mac` serves the Mac
installer, `/windows` the Windows one, and `/` shows the landing page.

### Updating later
```bash
sudo git -C /var/www/nodes pull && sudo systemctl reload nginx
```

### Security note
The default SSH key for this instance was pasted into a chat during setup and
should be considered **compromised** — rotate it (new key pair in Lightsail,
retire the old one). Day-to-day deploys above use browser SSH and need no key.
