#!/usr/bin/env bash
# ==============================================================================
# NEIMAN OS — System Setup Trigger & State Reset Engine (neiman-setup)
# ==============================================================================
# Overwrites and resets all operational state, databases, vectors, and caches
# to the initial first-time setup protocol for the Software Development Company.
# ==============================================================================

set -euo pipefail

# Terminal Color Palette
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_DIM="\033[2m"
CLR_RED="\033[1;31m"
CLR_GREEN="\033[1;32m"
CLR_YELLOW="\033[1;33m"
CLR_BLUE="\033[1;34m"
CLR_MAGENTA="\033[1;35m"
CLR_CYAN="\033[1;36m"
CLR_WHITE="\033[1;37m"

TARGET="${BASH_SOURCE[0]}"
while [ -h "$TARGET" ]; do
    DIR="$(cd -P "$(dirname "$TARGET")" && pwd)"
    TARGET="$(readlink "$TARGET")"
    [[ $TARGET != /* ]] && TARGET="$DIR/$TARGET"
done

INSTALL_REPO="%%REPO_DIR%%"
if [ "${INSTALL_REPO}" != "%""%REPO_DIR%""%" ] && [ -d "${INSTALL_REPO}/.git" ]; then
    ROOT_DIR="${INSTALL_REPO}"
elif [ -d "$(dirname "$TARGET")/../.git" ]; then
    ROOT_DIR="$(cd -P "$(dirname "$TARGET")/.." && pwd)"
elif [ -d "${HOME}/Projects/Sila/.git" ]; then
    ROOT_DIR="${HOME}/Projects/Sila"
elif [ -f "${HOME}/.local/share/neiman/repo_path" ] && [ -d "$(cat "${HOME}/.local/share/neiman/repo_path")/.git" ]; then
    ROOT_DIR="$(cat "${HOME}/.local/share/neiman/repo_path")"
elif git rev-parse --show-toplevel >/dev/null 2>&1; then
    ROOT_DIR="$(git rev-parse --show-toplevel)"
else
    echo -e "${CLR_RED}Error: Unable to locate NEIMAN repository root.${CLR_RESET}" >&2
    exit 1
fi

AUTO_CONFIRM=0
CLEAN_ONLY=0
EXEC_MODE="release"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -y|--yes|--force)
            AUTO_CONFIRM=1
            shift
            ;;
        --clean-only|--no-launch)
            CLEAN_ONLY=1
            shift
            ;;
        --dev)
            EXEC_MODE="dev"
            shift
            ;;
        --release)
            EXEC_MODE="release"
            shift
            ;;
        --web-only)
            EXEC_MODE="web"
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
        -h|--help)
            echo -e "${CLR_BOLD}NEIMAN OS Setup Trigger (neiman-setup)${CLR_RESET}"
            echo ""
            echo "Usage: neiman-setup [options]"
            echo ""
            echo "Options:"
            echo "  -y, --yes, --force     Bypass interactive confirmation prompt"
            echo "  --clean-only           Wipe and reset state without launching UI"
            echo "  --dev                  Wipe and launch desktop in development mode"
            echo "  --release              Wipe and launch compiled desktop binary (default)"
            echo "  --web-only             Wipe and launch web interface only"
            echo "  --api-port PORT        API backend port (default: 8000)"
            echo "  --web-port PORT        Web frontend port (default: 3000)"
            echo "  -h, --help             Show this help message"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

DATA_DIR="${HOME}/.local/share/neiman"
mkdir -p "${DATA_DIR}"
DB_FILE="${DATA_DIR}/production.db"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"

echo ""
echo -e "${CLR_RED}╔════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}"
echo -e "${CLR_RED}║${CLR_WHITE}${CLR_BOLD}   NEIMAN OS — System Setup Protocol Trigger (neiman-setup)                ${CLR_RED}║${CLR_RESET}"
echo -e "${CLR_RED}╚════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}"
echo -e " ${CLR_DIM}Repository Root :${CLR_RESET} ${ROOT_DIR}"
echo -e " ${CLR_DIM}Target Database :${CLR_RESET} ${DB_FILE}"
echo -e " ${CLR_DIM}Execution Mode  :${CLR_RESET} ${EXEC_MODE} $([ ${CLEAN_ONLY} -eq 1 ] && echo "(clean-only: UI launch suppressed)")"
echo ""

# Interactive Confirmation
if [ "${AUTO_CONFIRM}" -eq 0 ] && [ -t 0 ]; then
    echo -e "${CLR_YELLOW}⚠️  WARNING: This operation will overwrite and reset all operational databases,${CLR_RESET}"
    echo -e "${CLR_YELLOW}   vector storage, and client tokens to initiate the clean setup protocol.${CLR_RESET}"
    echo ""
    read -r -p "Are you sure you want to proceed with full setup overwrite? [y/N]: " CONFIRM_REPLY
    case "${CONFIRM_REPLY}" in
        [yY]|[yY][eE][sS])
            echo ""
            ;;
        *)
            echo -e "${CLR_DIM}Operation cancelled by user.${CLR_RESET}"
            exit 0
            ;;
    esac
fi

# 1. Terminate any dangling processes holding locks on ports/database
echo -e "${CLR_CYAN}[*] Inspecting and terminating stale local processes...${CLR_RESET}"
pkill -f "uvicorn nexora.main:app" 2>/dev/null || true
pkill -f "NEIMAN-desktop" 2>/dev/null || true

# 2. Safely archive prior database if present
if [ -f "${DB_FILE}" ]; then
    STAMP="$(date +%Y%m%d_%H%M%S)"
    BAK_FILE="${DATA_DIR}/production_${STAMP}.db.bak"
    echo -e "${CLR_CYAN}[*] Archiving existing database to ${BAK_FILE}...${CLR_RESET}"
    cp -f "${DB_FILE}" "${BAK_FILE}" 2>/dev/null || true
fi

# 3. Wipe all persistent databases and vector indexes
echo -e "${CLR_CYAN}[*] Wiping persistent databases and vector cache...${CLR_RESET}"
rm -f "${DATA_DIR}/production.db"* 2>/dev/null || true
rm -f "${API_DIR}/NEIMAN.db"* "${API_DIR}/nexora.db"* 2>/dev/null || true
rm -rf "${DATA_DIR}/.vectors_lancedb" 2>/dev/null || true

# 4. Clean webview storage and write .setup_required signal
echo -e "${CLR_CYAN}[*] Resetting webview storage and setting setup signal...${CLR_RESET}"
rm -rf "${HOME}/.local/share/org.NEIMAN.desktop/localstorage" 2>/dev/null || true
rm -rf "${DATA_DIR}/localstorage" 2>/dev/null || true
touch "${DATA_DIR}/.setup_required"

# 5. Apply pristine database schema migrations
echo -e "${CLR_CYAN}[*] Applying fresh database migrations via Alembic...${CLR_RESET}"
cd "${API_DIR}"
if [ -x ".venv/bin/alembic" ]; then
    DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" .venv/bin/alembic upgrade head
elif command -v uv >/dev/null 2>&1; then
    DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" uv run alembic upgrade head
else
    DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" python3 -m alembic upgrade head
fi
cd "${ROOT_DIR}"

echo ""
echo -e "${CLR_GREEN}╔════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}"
echo -e "${CLR_GREEN}║${CLR_WHITE}${CLR_BOLD}   [+] System State Successfully Overwritten to Clean Setup Protocol       ${CLR_GREEN}║${CLR_RESET}"
echo -e "${CLR_GREEN}╚════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}"
echo -e "  ${CLR_DIM}• Database  :${CLR_RESET} Clean schema migrated with 0 organizations (setup ready)"
echo -e "  ${CLR_DIM}• Memory    :${CLR_RESET} Vector cache purged"
echo -e "  ${CLR_DIM}• Protocol  :${CLR_RESET} First-time Software Development Company setup active"
echo ""

if [ "${CLEAN_ONLY}" -eq 1 ]; then
    echo -e "${CLR_DIM}UI launch skipped (--clean-only).${CLR_RESET}"
    echo -e "To launch manually, run: ${CLR_BOLD}neiman${CLR_RESET} or open ${CLR_CYAN}http://localhost:${WEB_PORT}/dashboard?setup=true${CLR_RESET}"
    exit 0
fi

# 6. Launch NEIMAN in setup mode
echo -e "${CLR_CYAN}[*] Launching NEIMAN into Setup Protocol (${EXEC_MODE} mode)...${CLR_RESET}"
if [ "${EXEC_MODE}" = "web" ]; then
    cd "${WEB_DIR}"
    exec npm run dev -- -p "${WEB_PORT}"
elif [ "${EXEC_MODE}" = "dev" ]; then
    exec "${ROOT_DIR}/run-desktop.sh" --dev
else
    exec "${ROOT_DIR}/run-desktop.sh" --release
fi
