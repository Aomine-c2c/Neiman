---
name: kubernetes-ops
description: Declarative Kubernetes manifest authoring, Helm values tuning, HPA autoscaling, and zero-downtime rolling deployment strategies.
---

# Kubernetes Operations Skill

## Manifest Integrity Rules
- **Resource Limits**: Every container specification must define explicit `resources.requests` and `resources.limits` for CPU and Memory.
- **Probes**: Mandatory `livenessProbe` (restart dead process) and `readinessProbe` (prevent traffic ingress before initialization).
- **Pod Disruption Budgets**: High-availability deployments must specify `PodDisruptionBudget` (`minAvailable: 1` or `maxUnavailable: 25%`).
- **Security Context**: Enforce `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, and drop all capabilities (`capabilities: { drop: ["ALL"] }`).

## Deployment Blueprint
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexora-api
  labels:
    app.kubernetes.io/name: nexora-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: nexora-api
  template:
    metadata:
      labels:
        app: nexora-api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
      containers:
        - name: api
          image: nexora-api:0.2.0
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
```

