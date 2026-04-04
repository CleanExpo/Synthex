#!/usr/bin/env bash
# =============================================================================
# Synthex Kubernetes Local Test Environment — Teardown Script
# =============================================================================
set -euo pipefail

CLUSTER_NAME="synthex-local"

echo "Deleting kind cluster '${CLUSTER_NAME}'..."
kind delete cluster --name "${CLUSTER_NAME}"
echo "Cluster deleted. Docker images remain — run 'docker rmi synthex-app:local' to remove."
