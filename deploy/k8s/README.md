# Deploying on k3s

The same app as the Docker Compose deployment (`deploy/README.md`), on a one-node [k3s](https://k3s.io) cluster.
Steps 1 to 3 of that guide (create the server, open ports 80 and 443, choose the address) apply here unchanged.
On Civo's managed k3s, see [Civo](#civo) instead of steps 1 and 2.

```
internet ──▶ Traefik (k3s, HTTPS) ──▶ web: Caddy + web app ──▶ api ──▶ postgres
                 ▲ cert-manager: Let's Encrypt certificate
```

| File                           | What it is                                                                     |
|--------------------------------|--------------------------------------------------------------------------------|
| `kustomization.yaml`           | Ties it together: `kubectl apply -k deploy/k8s`                                |
| `postgres.yaml`                | PostgreSQL 17, data on the node's disk (10 GB volume)                          |
| `api.yaml`                     | The API; migrations run in an init container before it starts                  |
| `web.yaml`                     | Caddy with the built web app, plain HTTP behind Traefik                        |
| `ingress.yaml`                 | The public address, the certificate and the http → https redirect             |
| `config.env.example`           | Settings that aren't secret, copied to `config.env`                            |
| `secrets.env.example`          | Passwords and keys, copied to `secrets.env`                                    |
| `cluster/traefik-config.yaml`  | Once per cluster: keeps visitors' IP addresses (rate limits, logs)             |
| `cluster/cluster-issuer.yaml`  | Once per cluster: Let's Encrypt for cert-manager                               |

## 1. Install k3s and cert-manager

On the server:

```bash
curl -sfL https://get.k3s.io | sh -
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $USER ~/.kube/config
kubectl get nodes    # Ready after a minute

# Keep visitors' IP addresses (Traefik restarts with it)
sudo cp deploy/k8s/cluster/traefik-config.yaml /var/lib/rancher/k3s/server/manifests/

# cert-manager (pick the current release from https://cert-manager.io/docs/releases/)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml
kubectl -n cert-manager rollout status deployment cert-manager-webhook

nano deploy/k8s/cluster/cluster-issuer.yaml    # set your email
kubectl apply -f deploy/k8s/cluster/cluster-issuer.yaml
```

(The repository has to be cloned first for the two `deploy/k8s/cluster` files; see step 2.)

## 2. Build the images

k3s doesn't build images, so they're built with Docker on the server and imported into k3s (the manifests use
`imagePullPolicy: Never`, so k3s never tries to download them). Install Docker and get the code as in step 4 of
`deploy/README.md`, then:

```bash
cd ~/studylog
DOMAIN=studylog.example.com    # the same address as in config.env
docker build --target api --build-arg VITE_API_URL=https://$DOMAIN -t studylog-api:latest .
docker build --target web --build-arg VITE_API_URL=https://$DOMAIN -t studylog-web:latest .
docker save studylog-api:latest studylog-web:latest | sudo k3s ctr images import -
```

`VITE_API_URL` is baked into the web app, so changing the address means building again. Building needs more memory
than a 2 GB server has: on one that small, build on your machine and copy them over
(`docker save studylog-api:latest studylog-web:latest | ssh <server> sudo k3s ctr images import -`), or use the
registry images as on Civo.

## 3. Configure and start

```bash
cp deploy/k8s/config.env.example deploy/k8s/config.env
cp deploy/k8s/secrets.env.example deploy/k8s/secrets.env
chmod 600 deploy/k8s/secrets.env
nano deploy/k8s/config.env     # DOMAIN, APP_URL, MAIL_FROM
nano deploy/k8s/secrets.env    # POSTGRES_PASSWORD, JWT_SECRET, SMTP login

kubectl apply -k deploy/k8s
```

Both files are git-ignored. Check on it with:

```bash
kubectl -n studylog get pods                   # all Running and 1/1 Ready
kubectl -n studylog get certificate            # READY True once Let's Encrypt answered (a minute or two)
kubectl -n studylog logs deploy/api -c migrate
kubectl -n studylog logs -f deploy/api
```

If the certificate stays not ready, `kubectl -n studylog describe challenge` says why: nearly always the ports
(step 2 of `deploy/README.md`) or the address not pointing to the server yet.

## Updating

```bash
cd ~/studylog
git pull
# build and import the images (step 2), then:
kubectl -n studylog rollout restart deployment api web
```

The new API pod runs the migrations first; the old one keeps serving until the new one is ready. A changed
`config.env` or `secrets.env` only needs `kubectl apply -k deploy/k8s`: the pods restart with the new values.
Old images pile up in both Docker and k3s; clear them now and then with `docker image prune -f` and
`sudo k3s crictl rmi --prune`.

## Backups

The database is the only thing to back up. Every night at 02:00 (India time) the `db-backup` CronJob dumps it,
encrypts the dump and uploads it to OneDrive (`gradiaqo-backups/`), then deletes backups older than 30 days
(`backup/backup.yaml`). The files in OneDrive are unreadable without the backup password, names included.

**Setting it up** (once, on your machine):

1. Install [rclone](https://rclone.org/install/) and run `rclone config`: **n** (new remote), name it `onedrive`,
   type `onedrive`, keep the defaults, and log in to Microsoft in the browser when asked. Choose your personal
   OneDrive (`drive_type = personal`).
2. Copy the `[onedrive]` section of your rclone config (`rclone config file` shows where it is) to
   `deploy/k8s/backup/rclone.conf`.
3. `cp deploy/k8s/backup/backup.env.example deploy/k8s/backup/backup.env` and fill it in. **Keep a copy of
   `BACKUP_PASSWORD` and `BACKUP_SALT` outside the server**: without them the backups can't be restored.
4. `kubectl apply -k deploy/civo` (or `deploy/k8s`), then take the first backup now and watch it:

   ```bash
   kubectl -n studylog create job --from=cronjob/db-backup db-backup-now
   kubectl -n studylog logs -f job/db-backup-now -c dump
   kubectl -n studylog logs -f job/db-backup-now -c upload
   ```

Both files are git-ignored. `kubectl apply -k` needs them from now on, also when nothing about backups changes.

**Is it working?** `kubectl -n studylog get jobs` lists the last runs (`db-backup-<time>`, Complete or Failed). For
an email when a night's backup doesn't arrive, create a free check on [healthchecks.io](https://healthchecks.io)
(period 1 day, grace 2 hours) and put its URL in `BACKUP_PING_URL`. The OneDrive login is renewed on every run and
kept on the `backup-rclone` volume; if it ever stops working, run `rclone config reconnect onedrive:` on your
machine, copy the section into `rclone.conf` again and apply.

**Restoring** (from your machine, with the same two passwords):

```bash
export RCLONE_CONFIG_BACKUP_TYPE=crypt RCLONE_CONFIG_BACKUP_REMOTE=onedrive:gradiaqo-backups
export RCLONE_CONFIG_BACKUP_PASSWORD="$( rclone obscure 'the BACKUP_PASSWORD' )"
export RCLONE_CONFIG_BACKUP_PASSWORD2="$( rclone obscure 'the BACKUP_SALT' )"
rclone lsl backup:                                   # the backups, newest at the bottom
rclone copy backup:studylog-2026-10-27-2030.dump .   # decrypted on the way down
kubectl -n studylog exec -i postgres-0 -- \
  pg_restore -U studylog -d studylog --clean --if-exists < studylog-2026-10-27-2030.dump
```

`--clean` replaces what's in the database with the backup. To look at a backup without touching production,
restore it into a local database instead (`yarn db:up`, then `pg_restore` with the `.env` connection).

## Civo

Civo's Kubernetes is managed k3s: there's no server to log in to, so the images come from GitHub's registry
(`.github/workflows/images.yml`) and `deploy/civo` points the manifests at them. A 1 CPU / 2 GB node is enough for
everything here.

1. **Images**: on GitHub, add the repository variable `DOMAIN` (Settings → Secrets and variables → Actions →
   Variables), then run the **Images** workflow from the Actions tab. It pushes `ghcr.io/coolsamk7/studylog-api` and
   `studylog-web`, tagged `latest` and `sha-<commit>`.
2. **Cluster**: create it with one node (K3s, Flannel) and keep the default Traefik (it takes ports 80 and 443 on the
   node; the *LoadBalancer* variant adds a paid Civo load balancer). Firewall: ports 80 and 443, and 6443 from your
   IP only. Download the kubeconfig, then install Traefik's resource types, which Civo leaves out (needed for the
   http → https redirect). Civo's Traefik is 2.9 (check with the first command); use the file for that version:

   ```bash
   kubectl -n kube-system get ds traefik -o jsonpath='{.spec.template.spec.containers[0].image}'   # …traefik:2.9.4
   kubectl apply -f https://raw.githubusercontent.com/traefik/traefik/v2.9.4/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml
   ```

   `deploy/civo` adds the `traefik` IngressClass (Civo has none) and uses Traefik 2.9's API group for the redirect;
   with Traefik 2.10 or newer, drop that patch there. `cluster/traefik-config.yaml` doesn't apply (Civo's Traefik is
   bound to the node's ports, so it already sees visitors' IPs).
3. **Address**: point your domain's `A` record at the node's public IP (`kubectl get nodes -o wide`), or use
   `<ip-with-dashes>.sslip.io`. It must be the same as `DOMAIN` from step 1.
4. **cert-manager and the issuer**: as in step 1 above (the `kubectl apply` lines).
5. **Registry login** (private images; a read-only token: GitHub → Settings → Developer settings → Personal access
   tokens → classic, scope `read:packages`):

   ```bash
   kubectl create namespace studylog
   kubectl -n studylog create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=coolsamk7 --docker-password=<token>
   ```

6. **Configure and start**: fill in `config.env` and `secrets.env` as in step 3, then
   `kubectl apply -k deploy/civo`.
7. **Email**: Civo blocks the mail ports 25, 465 and 587 going out, so `SMTP_PORT` is 2525 (Brevo's alternative).
   Brevo also refuses SMTP logins from IP addresses it doesn't know: add the node's public IP under Brevo → Security
   → Authorized IPs. To check, from the API pod:

   ```bash
   kubectl -n studylog exec deploy/api -c api -- node -e 'require("/app/node_modules/nodemailer").createTransport({
     host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
   }).verify().then(() => console.log("SMTP OK"), (e) => console.log(e.message))'
   ```

   `Connection timeout` means the port is blocked; `Unauthorized IP address` means the IP isn't authorized yet.

The data volume is a Civo volume (`civo-volume`), billed separately from the node. To update: run the Images
workflow, then `kubectl -n studylog rollout restart deployment api web`. To roll back, set `newTag` in
`deploy/civo/kustomization.yaml` to an earlier `sha-<commit>` and apply again. Backups run in the cluster (see
above).

## Superadmins

Superadmins see the Admin pages (catalog, reports, users). Make the first one with the CLI in the API pod, then
promote or demote others from Admin › Users:

```bash
kubectl -n studylog exec deploy/api -c api -- node apps/cli/dist/main.js user:promote you@example.com
kubectl -n studylog exec deploy/api -c api -- node apps/cli/dist/main.js user:promote you@example.com --demote
```

The role is in the access token, so it applies within 15 minutes (`JWT_EXPIRES_IN_SECONDS`) or at the next login.

## Official learning paths

The official paths are YAML files (format: `content/paths/README.md`) kept in OneDrive under
`gradiaqo-paths/official/`, not in this repository. Import one with **Import file** in Admin › Catalog, which shows
what would change before importing, then publish the path there. Or from your machine (the file goes in through stdin):

```bash
kubectl -n studylog exec -i deploy/api -c api -- node apps/cli/dist/main.js catalog:import - --dry-run < dsa.yaml
kubectl -n studylog exec -i deploy/api -c api -- node apps/cli/dist/main.js catalog:import - < dsa.yaml
```

## Good to know

- **One API pod**: rate limit counters are kept in memory, so more than one would each count separately.
- **Visitors' IPs**: Traefik and Caddy are two proxies in front of the API, hence `TRUST_PROXY=2` in `config.env`.
- **The database volume** lives under `/var/lib/rancher/k3s/storage` on the node. `kubectl delete -k deploy/k8s`
  deletes the `studylog` namespace and with it the data; take a backup first.
