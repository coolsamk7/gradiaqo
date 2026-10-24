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

The database is the only thing to back up. A nightly dump, keeping the last 14 (`crontab -e`):

```cron
0 3 * * * kubectl -n studylog exec postgres-0 -- pg_dump -U studylog -Fc studylog > ~/backups/studylog-$(date +\%F).dump && ls -1t ~/backups/*.dump | tail -n +15 | xargs -r rm
```

Copy them off the server too (see `deploy/README.md`). To restore one:

```bash
kubectl -n studylog exec -i postgres-0 -- \
  pg_restore -U studylog -d studylog --clean --if-exists < ~/backups/studylog-2026-10-19.dump
```

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
`deploy/civo/kustomization.yaml` to an earlier `sha-<commit>` and apply again. Backups work as below, run from your
machine with the Civo kubeconfig.

## Good to know

- **One API pod**: rate limit counters are kept in memory, so more than one would each count separately.
- **Visitors' IPs**: Traefik and Caddy are two proxies in front of the API, hence `TRUST_PROXY=2` in `config.env`.
- **The database volume** lives under `/var/lib/rancher/k3s/storage` on the node. `kubectl delete -k deploy/k8s`
  deletes the `studylog` namespace and with it the data; take a backup first.
