#!/bin/bash
# Deploy NEIMAN to Kubernetes using Kustomize
# Usage: ./deploy.sh [dev|staging|prod] [version]

set -euo pipefail

ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
KUSTOMIZE_DIR="infrastructure/kubernetes/overlays/${ENVIRONMENT}"

echo "🚀 Deploying NEIMAN to ${ENVIRONMENT} (version: ${VERSION})"

# Validate environment
if [[ ! -d "${KUSTOMIZE_DIR}" ]]; then
    echo "❌ Environment '${ENVIRONMENT}' not found. Available: dev, staging, prod"
    exit 1
fi

# Update image tags
cd "${KUSTOMIZE_DIR}"
kustomize edit set image ghcr.io/ORG/NEIMAN-api="${VERSION}"
kustomize edit set image ghcr.io/ORG/NEIMAN-web="${VERSION}"

# Build and apply
echo "📦 Building manifests..."
kustomize build . > /tmp/NEIMAN-${ENVIRONMENT}.yaml

echo "🔍 Validating..."
kubectl apply --dry-run=client -f /tmp/NEIMAN-${ENVIRONMENT}.yaml

echo "✅ Applying..."
kubectl apply -f /tmp/NEIMAN-${ENVIRONMENT}.yaml

echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/NEIMAN-api -n NEIMAN --timeout=300s
kubectl rollout status deployment/NEIMAN-web -n NEIMAN --timeout=300s

echo "✅ Deployment complete!"
kubectl get pods -n NEIMAN -l 'app in (NEIMAN-api,NEIMAN-web)'