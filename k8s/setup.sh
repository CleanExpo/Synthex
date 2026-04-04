#!/usr/bin/env bash
# =============================================================================
# Synthex Kubernetes Local Test Environment — Setup Script
# Requires: Docker, kind, kubectl, helm
# =============================================================================
set -euo pipefail

CLUSTER_NAME="synthex-local"
IMAGE_NAME="synthex-app:local"
NAMESPACE="synthex"

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────
check_prerequisites() {
  info "Checking prerequisites..."
  command -v docker  >/dev/null 2>&1 || error "Docker not found. Install Docker Desktop."
  command -v kind    >/dev/null 2>&1 || error "kind not found. Run: scoop install kind"
  command -v kubectl >/dev/null 2>&1 || error "kubectl not found. Run: scoop install kubectl"
  command -v helm    >/dev/null 2>&1 || error "helm not found. Run: scoop install helm"
  docker info >/dev/null 2>&1       || error "Docker daemon not running. Start Docker Desktop."
  info "All prerequisites satisfied."
}

# ── Secrets check ─────────────────────────────────────────────────────────────
check_secrets() {
  if [ ! -f "k8s/manifests/secrets.yaml" ]; then
    warn "k8s/manifests/secrets.yaml not found."
    warn "Creating from example template — update with real values before deployment."
    cp k8s/manifests/secrets.yaml.example k8s/manifests/secrets.yaml
    echo ""
    echo "  Edit k8s/manifests/secrets.yaml and replace placeholder base64 values."
    echo "  Encode a value: echo -n 'your-value' | base64"
    echo ""
  fi
}

# ── kind cluster ─────────────────────────────────────────────────────────────
create_cluster() {
  if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    warn "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
  else
    info "Creating kind cluster '${CLUSTER_NAME}'..."
    kind create cluster --config k8s/kind-config.yaml
    info "Cluster created."
  fi

  # Set kubectl context
  kubectl cluster-info --context "kind-${CLUSTER_NAME}" >/dev/null 2>&1 || \
    error "Could not connect to cluster. Check Docker and kind status."
  kubectl config use-context "kind-${CLUSTER_NAME}"
  info "kubectl context set to kind-${CLUSTER_NAME}."
}

# ── NGINX ingress controller ──────────────────────────────────────────────────
install_ingress() {
  if kubectl get namespace ingress-nginx >/dev/null 2>&1; then
    warn "ingress-nginx already installed. Skipping."
    return
  fi
  info "Installing NGINX ingress controller..."
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
  info "Waiting for ingress controller to be ready (up to 90s)..."
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=90s
  info "NGINX ingress controller ready."
}

# ── Build Docker image ────────────────────────────────────────────────────────
build_image() {
  info "Building Docker image '${IMAGE_NAME}'..."
  docker build \
    -f k8s/Dockerfile \
    -t "${IMAGE_NAME}" \
    --build-arg DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/synthex" \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key" \
    .
  info "Docker image built."
}

# ── Load image into kind cluster ──────────────────────────────────────────────
load_image() {
  info "Loading image into kind cluster (avoids registry push for local dev)..."
  kind load docker-image "${IMAGE_NAME}" --name "${CLUSTER_NAME}"
  info "Image loaded into cluster."
}

# ── Apply Kubernetes manifests ────────────────────────────────────────────────
apply_manifests() {
  info "Applying Kubernetes manifests..."
  kubectl apply -f k8s/manifests/namespace.yaml
  kubectl apply -f k8s/manifests/configmap.yaml
  kubectl apply -f k8s/manifests/secrets.yaml
  kubectl apply -f k8s/manifests/deployment.yaml
  kubectl apply -f k8s/manifests/service.yaml
  kubectl apply -f k8s/manifests/ingress.yaml
  kubectl apply -f k8s/manifests/hpa.yaml
  info "Manifests applied."
}

# ── Wait for deployment ───────────────────────────────────────────────────────
wait_for_deployment() {
  info "Waiting for Synthex pods to be ready (up to 3 minutes)..."
  kubectl rollout status deployment/synthex-app -n "${NAMESPACE}" --timeout=180s
  info "Deployment ready."
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Synthex Local Kubernetes — READY  ${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo ""
  echo "  App URL:    http://localhost:9080"
  echo "  Cluster:    kind-${CLUSTER_NAME}"
  echo "  Namespace:  ${NAMESPACE}"
  echo ""
  echo "  Useful commands:"
  echo "    kubectl get pods -n ${NAMESPACE}"
  echo "    kubectl logs -f deployment/synthex-app -n ${NAMESPACE}"
  echo "    kubectl describe pod -n ${NAMESPACE}"
  echo "    kind delete cluster --name ${CLUSTER_NAME}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  local skip_build="${1:-}"

  check_prerequisites
  check_secrets
  create_cluster
  install_ingress

  if [ "${skip_build}" != "--skip-build" ]; then
    build_image
    load_image
  fi

  apply_manifests
  wait_for_deployment
  print_summary
}

main "$@"
