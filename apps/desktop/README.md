# NEIMAN Desktop Application (Tauri Runtime)

The NEIMAN Desktop Application encapsulates the Next.js web application within a native OS container powered by Tauri v2 and Rust.

## Architecture

- **Native Core**: Located at `apps/web/src-tauri`
- **Runner Script**: `./run-desktop.sh` (or `make dev-desktop`)
- **Capabilities & Permissions**: Sandboxed in `apps/web/src-tauri/capabilities/default.json`
- **Zero-Trust Local Vault**: Hardware AES-256-GCM encrypted credential vault

## Running Desktop

```bash
# Production AppImage / release mode
./run-desktop.sh

# Hot-reload development mode
./run-desktop.sh --dev
```
