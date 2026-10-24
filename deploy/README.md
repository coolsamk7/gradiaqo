# Deploying StudyLog (Oracle Cloud Always Free)

Everything runs on one server with Docker Compose (`docker-compose.prod.yml`):

| Service | What it does |
| --- | --- |
| `web` | Caddy: serves the web app, sends API requests to `api`, gets and renews HTTPS certificates. The only service open to the internet (ports 80 and 443) |
| `api` | The NestJS API |
| `migrate` | Applies pending database migrations, then exits. The API starts only after it succeeded |
| `db` | PostgreSQL 17, data in the `db-data` volume |

The web app and the API share one address. The web app answers `/`, `/login`, `/signup`, `/app/*` and its files;
everything else goes to the API. So the refresh cookie works as in development, and new API routes need no change
in `deploy/Caddyfile`.

## 1. Create the server

In the Oracle Cloud console (choose your home region carefully at signup: Always Free servers can only be created
there):

1. **Compute → Instances → Create instance**.
2. **Image**: Canonical Ubuntu 24.04. **Shape**: Ampere `VM.Standard.A1.Flex`, 2 OCPUs and 12 GB memory (Always
   Free allows up to 4 OCPUs and 24 GB in total). The small AMD shape (1 GB) is too small to build the app.
3. **Networking**: create a new VCN with a public subnet and **assign a public IPv4 address**.
4. **SSH keys**: upload your public key (`~/.ssh/id_ed25519.pub`), or download the generated one.
5. Create. If it says *Out of capacity*, try another availability domain or try again later; A1 servers are popular.

Note the **public IP address**.

## 2. Open ports 80 and 443

Two firewalls, both need it:

1. **Oracle**: Networking → Virtual cloud networks → your VCN → Security → the default security list → **Add
   ingress rules**: source `0.0.0.0/0`, TCP, destination ports `80,443`. (Optional: also UDP 443 for HTTP/3.)
2. **The server itself**: Oracle's Ubuntu images block everything but SSH with iptables. On the server:

   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Choose the address

- **Your own domain**: add an `A` record (e.g. `studylog.example.com`) pointing to the public IP.
- **No domain yet**: use sslip.io, which needs no setup. For IP `140.238.1.2` the address is
  `140-238-1-2.sslip.io`. Caddy gets a real certificate for it too. You can switch to a domain later (change
  `DOMAIN` and run step 5 again).

## 4. Install Docker and get the code

```bash
ssh ubuntu@<public-ip>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # log in again so the docker group applies
ssh ubuntu@<public-ip>

git clone https://github.com/coolsamk7/gradiaqo.git studylog
cd studylog
```

(For a private repository, create a read-only deploy key or a fine-grained token on GitHub first.)

## 5. Configure and start

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env    # set DOMAIN, POSTGRES_PASSWORD (openssl rand -hex 32) and JWT_SECRET (openssl rand -base64 48)
chmod 600 deploy/.env

docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d --build
```

The first build takes a few minutes. Then open `https://<DOMAIN>`. Check on it with:

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env ps        # all running, migrate exited (0)
docker compose -f docker-compose.prod.yml --env-file deploy/.env logs -f api web
```

If the site doesn't load, it's nearly always step 2 (ports) or 3 (the address doesn't point to the server yet):
Caddy's log (`logs web`) says why it couldn't get a certificate.

## Updating

```bash
cd ~/studylog
git pull
docker compose -f docker-compose.prod.yml --env-file deploy/.env up -d --build
```

Migrations run automatically before the new API starts. Unused old images pile up; clear them now and then with
`docker image prune -f`.

## Backups

The database is the only thing to back up. A nightly dump, keeping the last 14:

```bash
mkdir -p ~/backups
crontab -e
```

```cron
0 3 * * * cd ~/studylog && docker compose -f docker-compose.prod.yml --env-file deploy/.env exec -T db pg_dump -U studylog -Fc studylog > ~/backups/studylog-$(date +\%F).dump && ls -1t ~/backups/*.dump | tail -n +15 | xargs -r rm
```

Copy them off the server too (e.g. Oracle Object Storage, 20 GB free, with `oci os object put`), since a backup on
the same disk doesn't survive losing the server. To restore a dump:

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env exec -T db \
  pg_restore -U studylog -d studylog --clean --if-exists < ~/backups/studylog-2026-10-19.dump
```

## Good to know

- **Idle servers**: Oracle may reclaim Always Free servers that stay almost idle for a week. Upgrading the account to
  Pay As You Go prevents that; Always Free resources stay free.
- **Settings** the API gets in production are in `docker-compose.prod.yml` (`NODE_ENV=production`, secure cookies,
  rate limits on, Swagger off, `TRUST_PROXY=1` for Caddy). Only the values in `deploy/.env` are secret.
- **Try it locally** before deploying: `DOMAIN=localhost` works (Caddy uses its own certificate; the browser warns
  once).
