# Self-hosting the website on the VPS

Why this exists: on 24 Nov 2026 Vercel paused the Hobby team ("Fast Data Transfer" over the fair-use
limit) until 24 Dec 2026, which took the site down (`402 DEPLOYMENT_DISABLED`). This runs the same Next.js
app as a container on the Hostinger VPS (`srv1565944`, `187.127.148.38`). Vercel keeps working as
before: the standalone output is only switched on by the Docker build (`BUILD_STANDALONE=1`).

## How it fits together

```
GitHub push to main ──> Action "Docker image" ──> ghcr.io/restocare/frontend:latest
                                                          │  (Watchtower polls)
browser ──> host nginx :443 ──> 127.0.0.1:3000 ──> container `frontend` (project `frontend`)
```

- `Dockerfile` builds the app (Node 24, Next standalone). NEXT_PUBLIC_* values come from the committed
  `.env.production`.
- `app/.well-known/assetlinks.json` is force-static, so `ANDROID_PACKAGE_NAME` / `ANDROID_CERT_SHA256` are
  **build-time**. Set them as GitHub repository variables (Settings > Secrets and variables > Actions >
  Variables) copying the values from the Vercel project's environment. They are public fingerprints.
  Without `ANDROID_CERT_SHA256` the Play Store signing certificate is missing and Android app links fall back
  to opening the website.
- `META_CAPI_ACCESS_TOKEN` and `META_TEST_EVENT_CODE` are **runtime** secrets for `app/api/meta/capi`. Copy
  them from Vercel into the `frontend` project's environment on the VPS. Never commit them.
- `deploy/vps/docker-compose.yml` is the compose project; `deploy/vps/nginx-www.restocare.in.conf` is the host
  nginx site.

## Go-live order

1. **Merge this PR.** The `Docker image` workflow pushes `ghcr.io/restocare/frontend:latest`. Set the two
   Android variables first (above) or re-run the workflow afterwards.
2. **Registry access.** GHCR packages from a private repo are private. The VPS already pulls
   `ghcr.io/restocare/backend-staging`, so a login may exist; confirm `docker pull ghcr.io/restocare/frontend:latest`
   works on the server.
3. **Create the compose project** `frontend` from `deploy/vps/docker-compose.yml` (Hostinger `vps_docker_create`,
   project name `frontend`), with the two Meta variables. Check `curl -sI http://127.0.0.1:3000/` on the server.
4. **Auto-update.** Watchtower runs as `/watchtower backend`. Add `frontend` to its command (it is its own
   project, `/docker/watchtower/docker-compose.yml`) and make sure it can read GHCR credentials.
5. **nginx + TLS** (needs a shell on the VPS):
   1. Point DNS first (below); the site is down anyway, so there is nothing to protect.
   2. Enable only the port-80 block, then `certbot certonly --webroot -w /var/www/html -d restocare.in -d www.restocare.in`.
   3. Enable the full file, `nginx -t && systemctl reload nginx`.
6. **DNS (GoDaddy).** Set the A records for `@` and `www` to `187.127.148.38`. Leave MX/TXT/other records alone.
   Lower the TTL before the change if you want a fast rollback.
7. **Check**: `curl -sI https://www.restocare.in/` is 200, apex returns a 301 to www, `/sitemap.xml` and
   `/.well-known/assetlinks.json` load, and a retired URL from `lib/redirects.ts` returns 410.

## Rollback

Point the A records back at Vercel (`216.198.79.1`) once the Vercel pause ends on 24 Dec 2026.

## Still open: the bandwidth that caused the pause

`public/videos` is about 90 MB across 8 mp4 files (one is 26 MB) and the landing page references all of them.
Moving hosts does not remove that traffic. Compress them, or host them on a CDN (Cloudinary is already an allowed
image host) and reference them by URL.
