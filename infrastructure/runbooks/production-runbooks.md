# NEIMAN Production Runbooks

## Table of Contents
1. [API Health Check](#api-health-check)
2. [Database Issues](#database-issues)
3. [High Latency / Errors](#high-latency--errors)
4. [Agent Execution Failures](#agent-execution-failures)
5. [Council Deliberation Stuck](#council-deliberation-stuck)
6. [Workflow Stuck](#workflow-stuck)
7. [Resource Exhaustion](#resource-exhaustion)
8. [Secret Rotation](#secret-rotation)
9. [Deployment Rollback](#deployment-rollback)
10. [Disaster Recovery](#disaster-recovery)

---

## API Health Check

### Symptoms
- Monitoring alerts: `NEIMAN_api_down` or `NEIMAN_api_high_error_rate`
- Users report 5xx errors or timeouts

### Diagnosis
```bash
# Check pod status
kubectl get pods -n NEIMAN -l app=NEIMAN-api

# Check logs
kubectl logs -n NEIMAN -l app=NEIMAN-api --tail=100

# Check health endpoint
kubectl exec -n NEIMAN -it <pod-name> -- curl localhost:8000/health

# Check metrics
kubectl exec -n NEIMAN -it <pod-name> -- curl localhost:8000/metrics | grep -E "up|http_requests"
```

### Resolution
1. **Pods not ready**: Check events `kubectl describe pod -n NEIMAN <pod-name>`
2. **Database connection**: Verify PostgreSQL is accessible
3. **Redis connection**: Verify Redis is accessible
4. **OOM kills**: Check `kubectl describe pod` for OOMKilled

---

## Database Issues

### Symptoms
- `connection refused` or `too many connections` errors
- Slow queries in logs
- Migration failures

### Diagnosis
```bash
# Check PostgreSQL pod
kubectl get pods -n NEIMAN-database

# Check connections
kubectl exec -n NEIMAN-database -it postgresql-0 -- psql -U NEIMAN -c "SELECT count(*) FROM pg_stat_activity;"

# Check long-running queries
kubectl exec -n NEIMAN-database -it postgresql-0 -- psql -U NEIMAN -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"

# Check replication lag (if using replicas)
kubectl exec -n NEIMAN-database -it postgresql-0 -- psql -U NEIMAN -c "SELECT * FROM pg_stat_replication;"
```

### Resolution
1. **Too many connections**: Increase `max_connections` or add PgBouncer
2. **Slow queries**: Add indexes, analyze query plans
3. **Migration failed**: Check Alembic logs, manual intervention may be needed
4. **Disk full**: Expand PVC or clean up old data

---

## High Latency / Errors

### Symptoms
- P95 latency > 2s
- Error rate > 1%
- HPA scaling up aggressively

### Diagnosis
```bash
# Check HPA status
kubectl get hpa -n NEIMAN

# Check resource usage
kubectl top pods -n NEIMAN

# Check metrics
kubectl exec -n NEIMAN -it <api-pod> -- curl localhost:8000/metrics | grep -E "http_request_duration|http_requests_total"

# Check external dependencies (LLM APIs)
kubectl logs -n NEIMAN -l app=NEIMAN-api | grep -i "timeout\|rate.limit\|llm"
```

### Resolution
1. **CPU/Memory pressure**: HPA should scale up; check if maxReplicas reached
2. **LLM API latency**: Check provider status pages, implement circuit breakers
3. **Database slow**: Check query performance, connection pool settings
4. **Queue buildup**: Check Redis queue depths, consider scaling workers

---

## Agent Execution Failures

### Symptoms
- `NEIMAN_agent_executions_total{status="failed"}` increasing
- Workflow tasks stuck in "running" state
- Agent logs show errors

### Diagnosis
```bash
# Check recent failed executions
kubectl exec -n NEIMAN -it <api-pod> -- python -c "
from NEIMAN.domains.agents.repository import AgentExecutionRepository
# query failed executions
"

# Check agent logs
kubectl logs -n NEIMAN -l app=NEIMAN-api | grep -i "agent.*execution.*failed"

# Check resource limits
kubectl describe pod -n NEIMAN <api-pod> | grep -A5 Limits
```

### Resolution
1. **Resource limits**: Increase memory/CPU limits for agent execution
2. **LLM rate limits**: Implement backoff, use alternative providers
3. **Tool failures**: Check tool implementations, add retries
4. **Policy violations**: Review policy engine logs, adjust policies

---

## Council Deliberation Stuck

### Symptoms
- Deliberation status stuck in "discussion" or "synthesis"
- No progress for > 30 minutes
- `NEIMAN_active_councils` metric high

### Diagnosis
```bash
# Check deliberation status
kubectl exec -n NEIMAN -it <api-pod> -- python -c "
from NEIMAN.domains.councils.repository import CouncilRepository
# query stuck deliberations
"

# Check for agent timeouts
kubectl logs -n NEIMAN -l app=NEIMAN-api | grep -i "council.*timeout\|deliberation.*stuck"
```

### Resolution
1. **Agent timeout**: Increase council agent timeouts
2. **Synthesis failure**: Check synthesis agent logs, fallback to simple majority
3. **Manual intervention**: Use admin API to force decision or cancel

---

## Workflow Stuck

### Symptoms
- Workflow execution stuck in "running" for > expected duration
- Tasks not progressing
- `NEIMAN_active_workflows` not decreasing

### Diagnosis
```bash
# Check workflow execution status
kubectl exec -n NEIMAN -it <api-pod> -- python -c "
from NEIMAN.domains.workflows.repository import WorkflowExecutionRepository
# query stuck executions
"

# Check for pending approvals
kubectl exec -n NEIMAN -it <api-pod> -- python -c "
from NEIMAN.domains.governance.repository import ApprovalRepository
# query pending approvals
"

# Check resource requests
kubectl exec -n NEIMAN -it <api-pod> -- python -c "
from NEIMAN.domains.resources.repository import ResourceRequestRepository
# query pending requests
"
```

### Resolution
1. **Pending approval**: Notify approvers, escalate if needed
2. **Resource request denied**: Check resource quotas, adjust or wait
3. **Task failure**: Check task logs, retry or skip with compensation
4. **Deadlock**: Manual intervention to cancel and restart

---

## Resource Exhaustion

### Symptoms
- Pods OOMKilled or CPU throttled
- PVC full alerts
- HPA at maxReplicas but still overloaded

### Diagnosis
```bash
# Check resource usage
kubectl top pods -n NEIMAN
kubectl top nodes

# Check PVC usage
kubectl get pvc -n NEIMAN
kubectl get pvc -n NEIMAN-database

# Check Redis memory
kubectl exec -n NEIMAN-database -it redis-0 -- redis-cli INFO memory
```

### Resolution
1. **Memory**: Increase limits, fix memory leaks, add more replicas
2. **CPU**: Optimize hot paths, increase limits, add replicas
3. **Disk**: Expand PVCs, clean up old logs/data, enable log rotation
4. **Redis**: Increase memory, evict old keys, use clustering

---

## Secret Rotation

### Procedure
```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update in Vault
vault kv put NEIMAN/api/auth secret_key=<new_key>

# 3. External Secrets will sync automatically (within 1h)
# Or force sync:
kubectl annotate externalsecret NEIMAN-api-secrets -n NEIMAN force-sync=$(date +%s) --overwrite

# 4. Restart API pods to pick up new secret
kubectl rollout restart deployment/NEIMAN-api -n NEIMAN

# 5. Verify
kubectl logs -n NEIMAN -l app=NEIMAN-api | grep -i "startup\|secret"
```

### API Keys (LLM Providers)
```bash
# Update in Vault
vault kv put NEIMAN/api/llm openai_key=<new_key> anthropic_key=<new_key>

# Force sync and restart
kubectl annotate externalsecret NEIMAN-api-secrets -n NEIMAN force-sync=$(date +%s) --overwrite
kubectl rollout restart deployment/NEIMAN-api -n NEIMAN
```

---

## Deployment Rollback

### Helm Rollback
```bash
# List releases
helm list -n NEIMAN

# Rollback to previous revision
helm rollback NEIMAN-api -n NEIMAN

# Rollback to specific revision
helm rollback NEIMAN-api 3 -n NEIMAN

# Verify
helm status NEIMAN-api -n NEIMAN
kubectl rollout status deployment/NEIMAN-api -n NEIMAN
```

### ArgoCD Rollback
```bash
# Via CLI
argocd app rollback NEIMAN-api 3

# Via UI: Applications > NEIMAN-api > History > Rollback
```

### Manual Image Rollback
```bash
# Update image tag in values or kustomization
kubectl set image deployment/NEIMAN-api api=ghcr.io/ORG/NEIMAN-api:v0.9.9 -n NEIMAN
kubectl rollout status deployment/NEIMAN-api -n NEIMAN
```

---

## Disaster Recovery

### Database Restore
```bash
# 1. Find latest backup
aws s3 ls s3://NEIMAN-backups/postgresql/

# 2. Restore to new instance
# (Use pg_restore or point-in-time recovery)

# 3. Update DNS / connection string
# 4. Verify data integrity
# 5. Switch traffic
```

### Full Cluster Restore
```bash
# 1. Restore etcd (if self-managed)
# 2. Reinstall ArgoCD
# 3. ArgoCD will sync all applications
# 4. Verify all services healthy
# 5. Run smoke tests
```

### RTO/RPO Targets
| Component | RTO | RPO |
|-----------|-----|-----|
| API | 15 min | 1 hour |
| Web | 10 min | 1 hour |
| Database | 30 min | 5 min |
| Redis | 10 min | 1 hour (acceptable loss) |

---

## Contacts
- **Primary On-Call**: +1-XXX-XXX-XXXX
- **Secondary On-Call**: +1-XXX-XXX-XXXX
- **Slack**: #NEIMAN-oncall
- **PagerDuty**: NEIMAN-production

---

## Links
- [Grafana Dashboards](https://grafana.NEIMAN.example.com)
- [ArgoCD](https://argocd.NEIMAN.example.com)
- [Vault](https://vault.NEIMAN.example.com)
- [Runbook Repository](https://github.com/ORG/NEIMAN/tree/main/infrastructure/runbooks)