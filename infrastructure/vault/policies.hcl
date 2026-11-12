# Vault configuration for NEIMAN secrets management
# This should be deployed as part of the Vault setup

# Enable KV v2 secrets engine at NEIMAN/
path "NEIMAN/" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# API secrets
path "NEIMAN/api/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Web secrets
path "NEIMAN/web/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Database secrets (dynamic credentials)
path "database/creds/NEIMAN-api" {
  capabilities = ["read"]
}

path "database/creds/NEIMAN-web" {
  capabilities = ["read"]
}

# Policy for NEIMAN-api service account
policy "NEIMAN-api-policy" {
  path "NEIMAN/api/*" {
    capabilities = ["read"]
  }
  path "database/creds/NEIMAN-api" {
    capabilities = ["read"]
  }
}

# Policy for NEIMAN-web service account
policy "NEIMAN-web-policy" {
  path "NEIMAN/web/*" {
    capabilities = ["read"]
  }
}

# Kubernetes auth role for NEIMAN-api
# This should be configured in Vault:
# vault write auth/kubernetes/role/NEIMAN-api \
#     bound_service_account_names=NEIMAN-api \
#     bound_service_account_namespaces=NEIMAN \
#     policies=NEIMAN-api-policy \
#     ttl=24h

# Kubernetes auth role for NEIMAN-web
# vault write auth/kubernetes/role/NEIMAN-web \
#     bound_service_account_names=NEIMAN-web \
#     bound_service_account_namespaces=NEIMAN \
#     policies=NEIMAN-web-policy \
#     ttl=24h