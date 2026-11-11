#!/usr/bin/env bash
# ==============================================================================
# NEIMAN OS — System Installer & Update Manager
# ==============================================================================
# Installs NEIMAN onto the local Linux workstation:
# 1. Links/copies binaries and launch commands into ~/.local/bin/neiman
# 2. Creates desktop entry in ~/.local/share/applications/neiman.desktop
# 3. Installs high-resolution application icon
# 4. Sets up updater tool (~/.local/bin/neiman-update) to pull updates from GitHub
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
DATA_DIR="${HOME}/.local/share/neiman"

echo "================================================================="
echo "   NEIMAN Autonomous Organization OS — System Installation       "
echo "================================================================="

SKIP_BUILD=0
RESET_DB=0
API_PORT="8000"
WEB_PORT="3000"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build)
            SKIP_BUILD=1
            shift
            ;;
        --reset-db|--clean|-c)
            RESET_DB=1
            shift
            ;;
        --api-port)
            API_PORT="$2"
            shift 2
            ;;
        --web-port)
            WEB_PORT="$2"
            shift 2
            ;;
        --update)
            # Accepted for compatibility with neiman-update
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-build       Skip compiling desktop binaries and frontend bundles"
            echo "  --reset-db, -c     Wipe existing local database and start with clean migrations"
            echo "  --api-port PORT    Configure API backend port (default: 8000)"
            echo "  --web-port PORT    Configure Web frontend port (default: 3000)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Terminate any active or stale uvicorn daemon so migrations and code update cleanly
pkill -f "uvicorn nexora.main:app" 2>/dev/null || true

# Auto-sync repository updates from remote if git is available
if [ -d "${REPO_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
    echo "[*] Synchronizing latest NEIMAN OS updates from GitHub..."
    git -C "${REPO_DIR}" pull origin main --quiet 2>/dev/null || true
fi

# Automatically ensure all required toolchains (uv, node, npm, cargo) are available
echo "[*] Verifying runtime toolchains..."

# Expand PATH with standard user-level tool directories
for p in "${HOME}/.local/share/mise/shims" "${HOME}/.cargo/bin" "${HOME}/.local/bin" "${HOME}/.local/share/fnm"; do
    if [ -d "${p}" ] && [[ ":$PATH:" != *":${p}:"* ]]; then
        export PATH="${p}:${PATH}"
    fi
done

# 1. Automatically install Astral uv if missing
if ! command -v uv >/dev/null 2>&1; then
    echo "[*] 'uv' not found. Installing Astral uv automatically..."
    if command -v curl >/dev/null 2>&1; then
        curl -LsSf https://astral.sh/uv/install.sh | sh || true
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- https://astral.sh/uv/install.sh | sh || true
    fi
    for p in "${HOME}/.local/bin" "${HOME}/.cargo/bin"; do
        if [ -d "${p}" ] && [[ ":$PATH:" != *":${p}:"* ]]; then
            export PATH="${p}:${PATH}"
        fi
    done
fi

# 2. Automatically install Node.js and npm if missing
if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    echo "[*] Node.js/npm not found. Installing automatically..."

    # Strategy A: mise toolchain manager (built-in on Omarchy)
    if command -v mise >/dev/null 2>&1; then
        echo "[*] Installing Node.js LTS via mise..."
        mise use -g node@lts || true
        eval "$(mise activate bash)" 2>/dev/null || true
        export PATH="${HOME}/.local/share/mise/shims:${PATH}"
    fi

    # Strategy B: System package manager
    if ! command -v npm >/dev/null 2>&1; then
        if command -v pacman >/dev/null 2>&1; then
            echo "[*] Installing nodejs and npm via pacman..."
            if [ "${EUID}" -eq 0 ]; then
                pacman -S --noconfirm --needed nodejs npm || true
            elif command -v sudo >/dev/null 2>&1; then
                sudo pacman -S --noconfirm --needed nodejs npm || true
            fi
        elif command -v apt-get >/dev/null 2>&1; then
            echo "[*] Installing nodejs and npm via apt-get..."
            if [ "${EUID}" -eq 0 ]; then
                apt-get update && apt-get install -y nodejs npm || true
            elif command -v sudo >/dev/null 2>&1; then
                sudo apt-get update && sudo apt-get install -y nodejs npm || true
            fi
        elif command -v dnf >/dev/null 2>&1; then
            echo "[*] Installing nodejs and npm via dnf..."
            if [ "${EUID}" -eq 0 ]; then
                dnf install -y nodejs npm || true
            elif command -v sudo >/dev/null 2>&1; then
                sudo dnf install -y nodejs npm || true
            fi
        fi
    fi

    # Strategy C: Rootless Fast Node Manager (fnm) fallback
    if ! command -v npm >/dev/null 2>&1; then
        echo "[*] Installing Fast Node Manager (fnm) for rootless setup..."
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "${HOME}/.local/share/fnm" --skip-shell || true
        fi
        if [ -x "${HOME}/.local/share/fnm/fnm" ]; then
            export PATH="${HOME}/.local/share/fnm:${PATH}"
            eval "$("${HOME}/.local/share/fnm/fnm" env)" 2>/dev/null || true
            fnm install --lts || true
            fnm use lts || true
        fi
    fi

    for p in "${HOME}/.local/share/mise/shims" "${HOME}/.local/share/fnm" "/usr/local/bin" "/usr/bin"; do
        if [ -d "${p}" ] && [[ ":$PATH:" != *":${p}:"* ]]; then
            export PATH="${p}:${PATH}"
        fi
    done
fi

mkdir -p "${BIN_DIR}" "${APPS_DIR}" "${ICONS_DIR}" "${DATA_DIR}"

if [ "${RESET_DB}" -eq 1 ]; then
    echo "[*] Database reset requested: cleaning up old database files..."
    rm -f "${DATA_DIR}/production.db"* "${REPO_DIR}/apps/api/NEIMAN.db"* "${REPO_DIR}/apps/api/nexora.db"* 2>/dev/null || true
fi

# 0. Ensure environment and dependencies are ready
echo "[*] Setting up API environment and dependencies..."
cd "${REPO_DIR}/apps/api"
if [ ! -f .env ]; then
    cp .env.example .env 2>/dev/null || true
fi

# Synchronize .env across repo root and user config directory
if [ -f "${REPO_DIR}/apps/api/.env" ]; then
    if [ ! -f "${REPO_DIR}/.env" ]; then
        ln -sf "apps/api/.env" "${REPO_DIR}/.env" 2>/dev/null || cp "${REPO_DIR}/apps/api/.env" "${REPO_DIR}/.env" 2>/dev/null || true
    fi
    mkdir -p "${HOME}/.config/neiman"
    cp "${REPO_DIR}/apps/api/.env" "${HOME}/.config/neiman/.env" 2>/dev/null || true
fi

if command -v uv >/dev/null 2>&1; then
    uv sync --python 3.12
else
    echo "[!] Warning: 'uv' not available. Skipping API dependency sync."
fi

echo "[*] Ensuring local database schema is migrated..."
if command -v uv >/dev/null 2>&1; then
    uv run alembic upgrade head
elif [ -x ".venv/bin/alembic" ]; then
    .venv/bin/alembic upgrade head
elif command -v alembic >/dev/null 2>&1; then
    alembic upgrade head
fi

echo "[*] Synchronizing universal AI providers into local database..."
SEED_SCRIPT="import asyncio; from nexora.database import get_db_context; from nexora.domains.intelligence.service import IntelligenceService; asyncio.run((lambda: [asyncio.get_event_loop().run_until_complete if False else None, (lambda s: (s.seed_default_providers_if_empty(), s.db.commit()))(IntelligenceService(None))])()) if False else None"
cat << 'EOF' > /tmp/_neiman_seed.py
import asyncio
from nexora.database import get_db_context
from nexora.domains.intelligence.service import IntelligenceService

async def _seed():
    async with get_db_context() as session:
        svc = IntelligenceService(session)
        await svc.seed_default_providers_if_empty()
        await session.commit()

asyncio.run(_seed())
EOF
if [ -x ".venv/bin/python" ]; then
    .venv/bin/python /tmp/_neiman_seed.py 2>/dev/null || true
elif command -v uv >/dev/null 2>&1; then
    uv run python /tmp/_neiman_seed.py 2>/dev/null || true
elif command -v python3 >/dev/null 2>&1; then
    python3 /tmp/_neiman_seed.py 2>/dev/null || true
fi
rm -f /tmp/_neiman_seed.py
cd "${REPO_DIR}"

echo "[*] Ensuring Web frontend dependencies are installed..."
cd "${REPO_DIR}/apps/web"
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS=false" > .env.local
    echo "NEXT_PUBLIC_API_URL=http://localhost:${API_PORT}" >> .env.local
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "[!] Error: 'npm' could not be automatically installed. Please install Node.js manually." >&2
    exit 1
fi

if [ ! -d "node_modules" ]; then
    npm install --prefer-offline --no-fund
    npm audit fix --prefer-offline 2>/dev/null || true
fi
cd "${REPO_DIR}"

# Build desktop binary if not already compiled and not skipped
STANDALONE_BIN="${REPO_DIR}/apps/web/src-tauri/target/release/app"
if [ "${SKIP_BUILD}" -eq 0 ] && [ ! -f "${STANDALONE_BIN}" ]; then
    # Ensure system build tools & libraries for Tauri
    if ! command -v pkg-config >/dev/null 2>&1 && ! command -v pkgconf >/dev/null 2>&1; then
        echo "[*] Ensuring Tauri Linux build dependencies (pkgconf, webkit2gtk)..."
        if command -v pacman >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
            sudo pacman -S --noconfirm --needed pkgconf webkit2gtk-4.1 gtk3 glib2 || true
        elif command -v apt-get >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
            sudo apt-get install -y pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev || true
        elif command -v dnf >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
            sudo dnf install -y pkgconf-pkg-config webkit2gtk4.1-devel gtk3-devel || true
        fi
    fi

    if ! command -v cargo >/dev/null 2>&1; then
        echo "[*] Rust/Cargo not found. Attempting automatic installation..."
        if command -v pacman >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
            sudo pacman -S --noconfirm --needed rust || true
        elif command -v curl >/dev/null 2>&1; then
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || true
            if [ -f "${HOME}/.cargo/env" ]; then
                source "${HOME}/.cargo/env"
            fi
        fi
    fi

    if ! command -v cargo >/dev/null 2>&1; then
        echo "[!] Notice: 'cargo' not available. Skipping desktop binary compilation."
        echo "    NEIMAN web and CLI interfaces will be ready for immediate use."
    else
        echo "[*] Compiling NEIMAN desktop application binary (this takes ~1-2 min on initial install)..."
        cd "${REPO_DIR}/apps/web"
        rm -rf .next
        npm run build
        if ! npx tauri build --no-bundle; then
            echo "[!] Notice: Tauri desktop binary compilation failed (system webkit library missing)."
            echo "    Continuing installation; Web and CLI environments are fully functional."
        fi
        cd "${REPO_DIR}"
    fi
fi

if command -v cargo >/dev/null 2>&1; then
    echo "[*] Compiling NEIMAN TUI native release binary (apps/tui-rs)..."
    cargo build --release --manifest-path "${REPO_DIR}/apps/tui-rs/Cargo.toml" --quiet 2>/dev/null || cargo build --release --manifest-path "${REPO_DIR}/apps/tui-rs/Cargo.toml" || true
fi

cd "${REPO_DIR}"

# 1. Install Icons
echo "[*] Installing application icons..."
mkdir -p "${HOME}/.local/share/icons/hicolor/32x32/apps" \
         "${HOME}/.local/share/icons/hicolor/128x128/apps" \
         "${HOME}/.local/share/icons/hicolor/512x512/apps"

cp "${REPO_DIR}/apps/web/src-tauri/icons/32x32.png" "${HOME}/.local/share/icons/hicolor/32x32/apps/neiman.png" 2>/dev/null || true
cp "${REPO_DIR}/apps/web/src-tauri/icons/128x128.png" "${HOME}/.local/share/icons/hicolor/128x128/apps/neiman.png" 2>/dev/null || true
cp "${REPO_DIR}/apps/web/src-tauri/icons/icon.png" "${HOME}/.local/share/icons/hicolor/512x512/apps/neiman.png" 2>/dev/null || true

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

# 2. Install Canonical 2-Command System (neiman-cli & neiman-desktop)
echo "[*] Installing canonical commands to ${BIN_DIR}..."
ln -sf "${REPO_DIR}/neiman-cli" "${BIN_DIR}/neiman-cli"
chmod +x "${REPO_DIR}/neiman-cli" "${BIN_DIR}/neiman-cli"

ln -sf "${REPO_DIR}/neiman-desktop" "${BIN_DIR}/neiman-desktop"
chmod +x "${REPO_DIR}/neiman-desktop" "${BIN_DIR}/neiman-desktop"

# Also link into /usr/local/bin if writable or via sudo so command is instantly available
if [ -w "/usr/local/bin" ]; then
    ln -sf "${REPO_DIR}/neiman-cli" "/usr/local/bin/neiman-cli" 2>/dev/null || true
    ln -sf "${REPO_DIR}/neiman-desktop" "/usr/local/bin/neiman-desktop" 2>/dev/null || true
elif command -v sudo >/dev/null 2>&1; then
    sudo ln -sf "${REPO_DIR}/neiman-cli" "/usr/local/bin/neiman-cli" 2>/dev/null || true
    sudo ln -sf "${REPO_DIR}/neiman-desktop" "/usr/local/bin/neiman-desktop" 2>/dev/null || true
fi

# Ensure ~/.local/bin is persisted in shell configuration
for rc in "${HOME}/.bashrc" "${HOME}/.zshrc" "${HOME}/.bash_profile" "${HOME}/.profile"; do
    if [ -f "${rc}" ] && ! grep -q '\.local/bin' "${rc}" 2>/dev/null; then
        echo 'export PATH="${HOME}/.local/bin:${PATH}"' >> "${rc}"
    fi
done

# Persist system-wide in /etc/profile.d if permitted
if [ -d "/etc/profile.d" ]; then
    if [ -w "/etc/profile.d" ]; then
        echo 'export PATH="${HOME}/.local/bin:${PATH}"' > /etc/profile.d/neiman.sh 2>/dev/null || true
    elif command -v sudo >/dev/null 2>&1; then
        echo 'export PATH="${HOME}/.local/bin:${PATH}"' | sudo tee /etc/profile.d/neiman.sh >/dev/null 2>&1 || true
    fi
fi

# Clean up any legacy or deprecated binaries
rm -f "${BIN_DIR}/neiman" "${BIN_DIR}/neiman-update" "${BIN_DIR}/neiman-setup"

# 3. Install Desktop Entry (.desktop)
echo "[*] Registering desktop application entry..."
cat << EOF > "${APPS_DIR}/neiman.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=NEIMAN
GenericName=Autonomous Organization OS
Comment=NEIMAN — Multi-Agent Autonomous Organization Operating System
Exec=${BIN_DIR}/neiman-desktop
Icon=neiman
Terminal=false
Categories=Development;Office;Utility;
Keywords=neiman;autonomous;ai;agent;organization;
StartupNotify=true
StartupWMClass=NEIMAN-desktop
EOF

chmod +x "${APPS_DIR}/neiman.desktop"

# Refresh desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${APPS_DIR}" 2>/dev/null || true
fi

# 4. Integrate with Omarchy Menu if available
OMARCHY_EXT="${HOME}/.config/omarchy/extensions/omarchy-menu.jsonc"
if [ -d "${HOME}/.config/omarchy/extensions" ] || [ -f "${OMARCHY_EXT}" ]; then
    echo "[*] Registering with Omarchy launcher menu..."
    mkdir -p "${HOME}/.config/omarchy/extensions"
    if [ ! -f "${OMARCHY_EXT}" ]; then
        echo "{}" > "${OMARCHY_EXT}"
    fi
    if ! grep -q "apps.neiman" "${OMARCHY_EXT}" 2>/dev/null; then
        python3 -c "
import json
path = '${OMARCHY_EXT}'
with open(path, 'r') as f:
    raw = f.read()
# Inject before last closing brace
neiman_entry = '''  // >>> neiman-app
  \"apps.neiman\": {
    \"icon\": \"󰚩\",
    \"label\": \"NEIMAN\",
    \"description\": \"Autonomous Organization OS\",
    \"aliases\": [\"neiman\", \"neiman-desktop\", \"neiman-cli\", \"ai\", \"organization\", \"agents\"],
    \"action\": \"${BIN_DIR}/neiman-desktop\"
  },
  // <<< neiman-app\n'''
if '}' in raw:
    idx = raw.rfind('}')
    updated = raw[:idx] + neiman_entry + raw[idx:]
    with open(path, 'w') as f:
        f.write(updated)
" 2>/dev/null || true
    fi
    if command -v omarchy-menu >/dev/null 2>&1; then
        omarchy-menu refresh 2>/dev/null || true
    fi
fi

echo ""
echo "================================================================="
echo "[+] Installation complete! Strictly 2 commands exposed:"
echo ""
echo "  • Desktop GUI:  Run 'neiman-desktop' (or launch 'NEIMAN' from menu)"
echo "  • Terminal CLI: Run 'neiman-cli' (boots TUI; run 'neiman-cli help' for commands)"
if ! command -v neiman-cli >/dev/null 2>&1; then
    echo ""
    echo "  [!] Notice: ~/.local/bin is not yet in your active shell's PATH."
    echo "      Run: export PATH=\"\${HOME}/.local/bin:\${PATH}\" (or run 'source ~/.bashrc')"
fi
echo "================================================================="
