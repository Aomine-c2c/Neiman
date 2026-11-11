---
name: terraform-iac
description: Infrastructure-as-Code Terraform authoring, state locking with DynamoDB/Postgres, variable typing, and drift detection.
---

# Terraform Infrastructure as Code Skill

## Core Practices
- **Remote State Locking**: Never keep local `.tfstate` files. Store in S3/GCS with server-side encryption and distributed locking (DynamoDB/Postgres).
- **Strict Variable Typing**: Every variable must declare explicit `type`, `description`, and validation constraints.
- **Explicit Provider Versions**: Pin exact provider version constraints (`~> 5.0`).
- **Resource Tagging**: Mandatory tags across all cloud assets (`Environment`, `ManagedBy: Terraform`, `Project: Neiman`).

