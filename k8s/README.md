# Synthex — Kubernetes Local Test Environment

Runs the Synthex Next.js app in a local [kind](https://kind.sigs.k8s.io/) cluster using Docker.

## Prerequisites

| Tool | Install (Windows) |
|------|-------------------|
| Docker Desktop | https://www.docker.com/products/docker-desktop |
| kind | `scoop install kind` |
| kubectl | `scoop install kubectl` |
| helm | `scoop install helm` |

## Quick Start

```bash
# 1. Set up secrets (one-time)
cp k8s/manifests/secrets.yaml.example k8s/manifests/secrets.yaml
# Edit secrets.yaml — encode values: echo -n "value" | base64

# 2. Create cluster, build image, deploy
bash k8s/setup.sh

# 3. Open app
open http://localhost:8080
```

## What setup.sh Does

1. Validates prerequisites (Docker, kind, kubectl, helm)
2. Creates `synthex-local` kind cluster (1 control-plane + 2 workers)
3. Installs NGINX ingress controller
4. Builds the Next.js Docker image using `k8s/Dockerfile`
5. Loads the image into the kind cluster (no registry required)
6. Applies all Kubernetes manifests
7. Waits for pods to be healthy

## Directory Structure

```
k8s/
├── Dockerfile              # Multi-stage Next.js build (standalone output)
├── kind-config.yaml        # kind cluster: 1 control-plane + 2 workers
├── setup.sh                # One-shot setup script
├── teardown.sh             # Delete cluster
├── README.md               # This file
└── manifests/
    ├── namespace.yaml      # synthex namespace
    ├── configmap.yaml      # Non-sensitive env vars
    ├── secrets.yaml.example # Secret template (never commit secrets.yaml)
    ├── deployment.yaml     # Synthex app — 2 replicas, rolling update
    ├── service.yaml        # ClusterIP service
    ├── ingress.yaml        # NGINX ingress → http://localhost:8080
    └── hpa.yaml            # Autoscale 2-6 pods on CPU/memory
```

## Access

| URL | Purpose |
|-----|---------|
| http://localhost:9080 | Synthex app |
| http://localhost:9080/api/health | Health check |

## Common Commands

```bash
# Pod status
kubectl get pods -n synthex

# Pod logs (live)
kubectl logs -f deployment/synthex-app -n synthex

# Describe a pod (events, resource usage)
kubectl describe pods -n synthex

# Exec into a pod
kubectl exec -it deployment/synthex-app -n synthex -- sh

# Rebuild image and redeploy (after code changes)
docker build -f k8s/Dockerfile -t synthex-app:local .
kind load docker-image synthex-app:local --name synthex-local
kubectl rollout restart deployment/synthex-app -n synthex

# Scale pods
kubectl scale deployment synthex-app -n synthex --replicas=3

# View HPA status
kubectl get hpa -n synthex

# Delete everything (keep cluster)
kubectl delete namespace synthex

# Delete cluster entirely
bash k8s/teardown.sh
```

## Secrets

`k8s/manifests/secrets.yaml` is **gitignored** — never commit it.

To encode a secret value:
```bash
echo -n "your-actual-value" | base64
```

Paste the result into `secrets.yaml` under the relevant key.

## How the Dockerfile Works

Uses Next.js [standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output) (`DOCKER_BUILD=true`):

1. **`deps` stage** — installs all npm dependencies
2. **`builder` stage** — runs `prisma generate` + `npm run build` with `DOCKER_BUILD=true`
3. **`runner` stage** — minimal Alpine image with only `.next/standalone` (no node_modules, no source)

The final image is ~300-400MB vs ~1.5GB without standalone output.

## Ports

| Port | Purpose |
|------|---------|
| 8080 (host) → 80 (cluster) | HTTP ingress |
| 8443 (host) → 443 (cluster) | HTTPS ingress (future) |
| 3000 (container) | Next.js app |

## Troubleshooting

**Pods stuck in `Pending`**
```bash
kubectl describe pods -n synthex
# Usually: resource limits too high for local machine
# Fix: reduce CPU/memory in manifests/deployment.yaml
```

**`ImagePullBackOff` or `ErrImageNeverPull`**
```bash
# Image not loaded into kind cluster
kind load docker-image synthex-app:local --name synthex-local
kubectl rollout restart deployment/synthex-app -n synthex
```

**`CrashLoopBackOff`**
```bash
# Usually: bad secrets or missing env vars
kubectl logs deployment/synthex-app -n synthex --previous
# Fix: check secrets.yaml has correct base64-encoded values
```

**Cannot reach http://localhost:8080**
```bash
# Ingress controller may still be starting
kubectl get pods -n ingress-nginx
# Wait for controller pod to be Running
```
