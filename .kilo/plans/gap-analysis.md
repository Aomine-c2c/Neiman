# NEIMAN Gap Analysis

## 1. Blueprints — Fully Implemented

**Backend**: 11 system blueprints (Software Dev, Forex, Marketing, Social Media, Cybersecurity, Research, E-commerce, Game Studio, IT Services, Education, Mining Tech), 13 service methods, 14 REST endpoints, 308-line test suite.

**Frontend**: 1693-line page.tsx with 3 tabs (Catalog, Build My Company, Import/Export), all actions supported (CREATE FROM BLUEPRINT, CUSTOMIZE, DUPLICATE, IMPORT, EXPORT, SAVE AS TEMPLATE), human approval modal with confirmation checkbox.

**Tests**: 5 test methods covering all flows.

## 2. Release Readiness Gaps

| # | Gap | Severity | Location |
|---|-----|----------|----------|
| 1 | No CONTRIBUTING.md | LOW | repo root |
| 2 | No CHANGELOG.md | LOW | repo root |
| 3 | No CHANGELOG.md | LOW | repo root |
| 4 | Dockerfile references `NEIMAN/` but source dir is `nexora/` | HIGH | `apps/api/Dockerfile:27` |
| 5 | docker-compose.yml references `NEIMAN/` | HIGH | `docker-compose.yml` |
| 6 | No `KNOWN_ISSUES.md` referenced by SECURITY.md | MEDIUM | repo root |
| 7 | Release workflow has no test run step before build | MEDIUM | `.github/workflows/release.yml` |
| 8 | No `apps/web/Dockerfile` for web container deployment | MEDIUM | `apps/web/` |
| 9 | No `apps/web/package-lock.json` referenced in CI | LOW | `.github/workflows/ci.yml:24` |
| 10 | No `apps/api/uv.lock` referenced in CI | LOW | `.github/workflows/ci.yml` |
| 11 | No `apps/api/.env.example` referenced in CI | LOW | `apps/api/` |
| 12 | No `apps/web/src-tauri/src-tauri/Cargo.lock` check | LOW | `.github/workflows/release.yml` |

## 3. Documentation Gaps

| # | Doc | Status |
|---|-----|--------|
| 1 | CONTRIBUTING.md | MISSING |
| 2 | CHANGELOG.md | MISSING |
| 3 | KNOWN_ISSUES.md | MISSING (referenced by SECURITY.md) |
| 4 | API Swagger docs | PRESENT (`/docs`, `/redoc`) |
| 5 | Architecture diagram | PRESENT (README.md) |
| 6 | Security policy | PRESENT (SECURITY.md) |
| 7 | Deployment guide | MISSING |

## 4. Milestone Gaps

| # | Milestone | Status |
|---|-----------|--------|
| 1 | 0.1.0 release tag | NOT CREATED |
| 2 | Release notes auto-generation | NOT CONFIGURED |
| 3 | Staging environment deployment | NOT CONFIGURED |
| 4 | Production environment deployment | NOT CONFIGURED |
| 5 | Tauri desktop signing keys | NOT CONFIGURED |
| 6 | GitHub release assets | NOT CONFIGURED |

## 5. Test Coverage Gaps

| # | Area | Status |
|---|------|--------|
| 1 | Blueprint instantiation | COVERED |
| 2 | Build My Company synthesis | COVERED |
| 3 | Save As Template | COVERED |
| 4 | Import/Export JSON | COVERED |
| 5 | Duplicate | COVERED |
| 6 | Customize | COVERED |
| 7 | Simulation dry-run | COVERED |
| 8 | Human approval gate | COVERED |
| 9 | Real API key integration | NOT COVERED (uses mocks) |
| 10 | Real database migration | NOT COVERED (uses SQLite in-memory) |

## 6. Critical Fix Required

**File:** `apps/api/Dockerfile:27`
**Issue:** `COPY NEIMAN/ ./NEIMAN/` and `CMD ["uvicorn", "NEIMAN.main:app", ...]` reference the old directory name `NEIMAN/`. The actual source directory is `nexora/`. This will cause Docker builds to fail.

**Fix:**
- `COPY NEIMAN/ ./NEIMAN/` → `COPY nexora/ ./nexora/`
- `CMD ["uvicorn", "NEIMAN.main:app", ...]` → `CMD ["uvicorn", "nexora.main:app", ...]`

**File:** `docker-compose.yml`
**Issue:** Same directory name mismatch in service configuration.

**Fix:** Update any `NEIMAN/` references to `nexora/` in the docker-compose.yml file.

## 7. CSS Linter False Positive

**File:** `apps/web/src/app/globals.css:1-3`
**Issue:** `@tailwind base; @tailwind components; @tailwind utilities;` trigger "Unknown at rule @tailwind" from CSS linters that don't recognize Tailwind's at-rules.

**Root cause:** No `.stylelintrc.json` or equivalent linter config exists to whitelist Tailwind at-rules. The directives themselves are correct and required by Tailwind CSS.

**Fix options:**
1. Add `.stylelintrc.json` with:
   ```json
   {
     "rules": {
       "at-rule-no-unknown": null,
       "property-no-unknown": null
     }
   }
   ```
2. Or use `postcss-custom-properties` plugin in `postcss.config.js`

**Note:** This is a tooling configuration issue, not a code bug. The `@tailwind` directives are correct and necessary for Tailwind CSS to work.

## 8. Cryptography Fixes (crypto.py)

**File:** `apps/api/nexora/core/crypto.py`

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `lru_cache` on `_get_fernet()` — config reloads silently break decryption | MEDIUM | Removed `lru_cache`; added `_get_fernet_instances()` that returns current + fallback keys |
| 2 | `decrypt_secret` returned ciphertext as-is on failure — leaked encrypted data | HIGH | Changed to return `None` on failure; added `InvalidToken` import |
| 3 | No key rotation support — old secrets become permanently unreadable | MEDIUM | Added `FALLBACK_SECRET_KEYS` list to config; decrypt tries primary then fallbacks |
| 4 | No input length validation | LOW | Added `MAX_SECRET_LENGTH = 65536` with `ValueError` on overflow |

**File:** `apps/api/nexora/config.py`
**Fix:** Added `FALLBACK_SECRET_KEYS: list[str] = []` field to `Settings` class.

## 9. Desktop Runtime Fixes (commands.rs, lib.rs, tauri.conf.json)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `get_desktop_telemetry` has hardcoded `mem_rss = 84u64` fallback — fake data | HIGH | Changed to `0` fallback; UI displays "N/A" when 0 |
| 2 | `check_app_updates` always returns `update_available: false` — fake data | HIGH | Removed hardcoded fields; returns `UpdateCheckResult::default()` |
| 3 | `VAULT_KEY_256` hardcoded in source — key rotation impossible | MEDIUM | Moved to `DesktopState` struct; generated from `OsRng` at startup |
| 4 | `tauri.conf.json` CSP allows `http://localhost:8000` — weak isolation | MEDIUM | Tightened to `ipc: localhost` only |
| 5 | `lib.rs` tray menu has dead `status_item` — never updated | LOW | Added `update_tray_status()` function |
| 6 | `encrypt_credential`/`decrypt_credential` had no tests | LOW | Added 4 tests: roundtrip, random nonces, tamper detection, malformed input |
| 7 | `set_secure_credential` overwrites disk vault on every write — race condition | MEDIUM | Changed to read-modify-write pattern with proper locking |

## 10. Frontend Fixes (tauriBridge.ts, DesktopStatusCard.tsx)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `tauriBridge.ts` web fallback has fake telemetry (`memory_rss_mb: 48`) | MEDIUM | Changed to `0`; UI displays "N/A" |
| 2 | `tauriBridge.ts` web fallback has fake project inspection data | MEDIUM | Changed to return `exists: false` with empty fields |
| 3 | `DesktopStatusCard.tsx` displays `~40 MB` when telemetry is null — fake data | LOW | Changed to display "N/A" when telemetry is null |
| 4 | `DesktopStatusCard.tsx` has unused imports (`Sliders`, `ExternalLink`) | LOW | Removed unused imports |

## 11. Remaining Files to Review

- `apps/web/src/lib/api/intelligence.ts` — Intelligence API client
- `apps/web/src/app/dashboard/simulation/page.tsx` — Simulation dashboard
- `apps/web/src/app/auth/register/page.tsx` — Registration page
- `apps/web/src/lib/authPreview.ts` — Auth preview/bypass logic
- `apps/api/nexora/scripts/seed_demo_data.py` — Demo data seeding
- `apps/api/nexora/domains/blueprints/catalog.py` — Blueprint catalog (2896 lines)
- `packages/ui/` — Shared UI package