#!/bin/bash
# NEIMAN Health Check Script
# Usage: ./health-check.sh [namespace]

set -euo pipefail

NAMESPACE="${1:-NEIMAN}"

echo "🔍 NEIMAN Health Check - Namespace: ${NAMESPACE}"
echo "================================================="

# Check API
echo ""
echo "📡 API Health:"
API_PODS=$(kubectl get pods -n "${NAMESPACE}" -l app=NEIMAN-api -o jsonpath='{.items[*].metadata.name}')
for pod in ${API_PODS}; do
    STATUS=$(kubectl get pod -n "${NAMESPACE}" "${pod}" -o jsonpath='{.status.phase}')
    READY=$(kubectl get pod -n "${NAMESPACE}" "${pod}" -o jsonpath='{.status.containerStatuses[0].ready}')
    echo "  Pod: ${pod} | Status: ${STATUS} | Ready: ${READY}"
    
    # Health endpoint
    HEALTH=$(kubectl exec -n "${NAMESPACE}" "${pod}" -- curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "FAIL")
    echo "    Health endpoint: ${HEALTH}"
done

# Check Web
echo ""
echo "🌐 Web Health:"
WEB_PODS=$(kubectl get pods -n "${NAMESPACE}" -l app=NEIMAN-web -o jsonpath='{.items[*].metadata.name}')
for pod in ${WEB_PODS}; do
    STATUS=$(kubectl get pod -n "${NAMESPACE}" "${pod}" -o jsonpath='{.status.phase}')
    READY=$(kubectl get pod -n "${NAMESPACE}" "${pod}" -o jsonpath='{.status.containerStatuses[0].ready}')
    echo "  Pod: ${pod} | Status: ${STATUS} | Ready: ${READY}"
    
    # Health endpoint
    HEALTH=$(kubectl exec -n "${NAMESPACE}" "${pod}" -- curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "FAIL")
    echo "    Health endpoint: ${HEALTH}"
done

# Check HPA
echo ""
echo "📈 HPA Status:"
kubectl get hpa -n "${NAMESPACE}" -o wide

# Check Ingress
echo ""
echo "🌍 Ingress Status:"
kubectl get ingress -n "${NAMESPACE}"

# Check PVCs
echo ""
echo "💾 PVC Status:"
kubectl get pvc -n "${NAMESPACE}"
kubectl get pvc -n NEIMAN-database 2>/dev/null || true

# Check Resources
echo ""
echo "📊 Resource Usage:"
kubectl top pods -n "${NAMESPACE}" 2>/dev/null || echo "  Metrics server not available"

echo ""
echo "✅ Health check complete"