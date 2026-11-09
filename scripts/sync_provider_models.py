#!/usr/bin/env python3
"""
NEIMAN OS — Periodic AI Provider Model Dynamic Synchronization Script
Executes periodic checks across all configured AI provider API keys.
1. Queries vendor /v1/models or vendor-native discovery endpoints.
2. Synchronizes discovered models dynamically without hardcoded names.
3. Soft-deactivates (is_active=False) models no longer returned by the API key.
4. Updates health timestamps and active routing pools.
"""

import asyncio
import os
import sys

# Ensure apps/api is in python path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API_DIR = os.path.join(REPO_ROOT, "apps", "api")
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)


async def main() -> int:
    print("[INFO] Starting NEIMAN AI Provider Model Dynamic Sync...")
    try:
        from nexora.database import get_db_context
        from nexora.domains.intelligence.service import IntelligenceService

        async with get_db_context() as session:
            service = IntelligenceService(session)
            summary = await service.sync_configured_providers_models()
            await session.commit()

        print(f"[OK] Total Configured Providers Checked: {summary['total_providers_checked']}")
        print(f"[OK] Total Discovered/Added Models: {summary['total_models_added']}")
        print(f"[OK] Total Models Soft-Deactivated: {summary['total_models_soft_deactivated']}")
        print(f"[OK] Total Active Models: {summary['total_models_active']}")

        for prov in summary.get("synced_providers", []):
            name = prov.get("display_name") or prov.get("provider_name")
            print(
                f"  - {name}: discovered {prov.get('discovered_count')}, "
                f"added {prov.get('added_count')}, "
                f"deactivated {prov.get('deactivated_count')}, "
                f"active {prov.get('active_models_count')}"
            )
        return 0
    except Exception as exc:
        print(f"[ERROR] Sync failed: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

