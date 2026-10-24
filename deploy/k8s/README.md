# Deploying on k3s

The same app as the Docker Compose deployment (`deploy/README.md`), on a one-node [k3s](https://k3s.io) cluster.
Steps 1 to 3 of that guide (create the server, open ports 80 and 443, choose the address) apply here unchanged.

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

`VITE_API_URL` is baked into the web app, so changing the address means building again.

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

The database is the only thing to back up. A nightly dump, keeping the last 14 (`crontab -e`):

```cron
0 3 * * * kubectl -n studylog exec postgres-0 -- pg_dump -U studylog -Fc studylog > ~/backups/studylog-$(date +\%F).dump && ls -1t ~/backups/*.dump | tail -n +15 | xargs -r rm
```

Copy them off the server too (see `deploy/README.md`). To restore one:

```bash
kubectl -n studylog exec -i postgres-0 -- \
  pg_restore -U studylog -d studylog --clean --if-exists < ~/backups/studylog-2026-10-19.dump
```

## Good to know

- **One API pod**: rate limit counters are kept in memory, so more than one would each count separately.
- **Visitors' IPs**: Traefik and Caddy are two proxies in front of the API, hence `TRUST_PROXY=2` in `config.env`.
- **The database volume** lives under `/var/lib/rancher/k3s/storage` on the node. `kubectl delete -k deploy/k8s`
  deletes the `studylog` namespace and with it the data; take a backup first.
