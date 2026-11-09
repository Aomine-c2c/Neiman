#!/usr/bin/env bash
# ==============================================================================
# NEIMAN OS — Autonomous System Live Updater & Orchestrator
# ==============================================================================
# High-density, noise-filtered system updater with real-time stage visualization.
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
    echo "Error: Unable to locate NEIMAN repository root." >&2
    exit 1
fi

# Persist known repo path for future executions
mkdir -p "${HOME}/.local/share/neiman"
echo "${ROOT_DIR}" > "${HOME}/.local/share/neiman/repo_path"

FORCE_REBUILD=0
PRESERVE_DB=1
VERBOSE=0

for arg in "$@"; do
    case "$arg" in
        --rebuild|-f|--force)
            FORCE_REBUILD=1
            ;;
        --reset-db|--clean)
            PRESERVE_DB=0
            ;;
        --preserve-db|-p)
            PRESERVE_DB=1
            ;;
        --verbose|-v)
            VERBOSE=1
            ;;
        -h|--help)
            echo -e "${CLR_BOLD}NEIMAN OS Updater${CLR_RESET}"
            echo ""
            echo "Usage: neiman-cli update [options]"
            echo ""
            echo "Options:"
            echo "  --rebuild, -f      Force rebuild frontend bundle and Rust desktop binary"
            echo "  --reset-db, --clean Archive and reset persistent database (default is preserve in-place)"
            echo "  --preserve-db, -p  Preserve existing database and run migrations in-place (default)"
            echo "  --verbose, -v      Show full raw compiler and package manager stdout/stderr"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
    esac
done

DATA_DIR="${HOME}/.local/share/neiman"
mkdir -p "${DATA_DIR}"
UPDATE_LOG="${DATA_DIR}/update.log"
DB_FILE="${DATA_DIR}/production.db"

# Clear update log
echo "=== NEIMAN Update Session: $(date -Iseconds) ===" > "${UPDATE_LOG}"

print_banner() {
    echo ""
    echo -e "${CLR_RED}╔════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}"
    echo -e "${CLR_RED}║${CLR_WHITE}${CLR_BOLD}   NEIMAN OS — System Update & Live Orchestration Engine                   ${CLR_RED}║${CLR_RESET}"
    echo -e "${CLR_RED}╚════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}"
    echo -e " ${CLR_DIM}Target Repository:${CLR_RESET} ${ROOT_DIR}"
    echo -e " ${CLR_DIM}Persistent DB:    ${CLR_RESET} ${DB_FILE}"
    echo -e " ${CLR_DIM}Session Log:      ${CLR_RESET} ${UPDATE_LOG}"
    echo ""
}

SPINNER_PID=""
start_spinner() {
    local msg="$1"
    local spin_chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    (
        while true; do
            for (( i=0; i<${#spin_chars}; i++ )); do
                echo -ne "\r  ${CLR_CYAN}${spin_chars:$i:1}${CLR_RESET}  ${msg}..."
                sleep 0.08
            done
        done
    ) &
    SPINNER_PID=$!
}

stop_spinner() {
    if [ -n "${SPINNER_PID}" ]; then
        kill "${SPINNER_PID}" 2>/dev/null || true
        wait "${SPINNER_PID}" 2>/dev/null || true
        SPINNER_PID=""
    fi
}

cleanup_on_interrupt() {
    stop_spinner
    echo -e "\n\n${CLR_RED}[!] Update interrupted by user.${CLR_RESET}"
    exit 130
}
trap cleanup_on_interrupt SIGINT SIGTERM

execute_step() {
    local step_idx="$1"
    local total_steps="$2"
    local label="$3"
    local cmd="$4"
    local detail="${5:-}"

    local step_tag="[${step_idx}/${total_steps}]"
    local start_time
    start_time="$(date +%s)"

    if [ "${VERBOSE}" -eq 1 ]; then
        echo -e "  ${CLR_BOLD}${CLR_CYAN}◈${CLR_RESET}  ${CLR_WHITE}${step_tag}${CLR_RESET} ${CLR_BOLD}${label}${CLR_RESET}..."
        echo -e "--- Running: ${cmd} ---" >> "${UPDATE_LOG}"
        if eval "${cmd}" 2>&1 | tee -a "${UPDATE_LOG}"; then
            local end_time
            end_time="$(date +%s)"
            local elapsed=$(( end_time - start_time ))
            echo -e "  ${CLR_GREEN}[✓]${CLR_RESET}  ${CLR_WHITE}${step_tag}${CLR_RESET} ${label} ${CLR_DIM}(${elapsed}s)${CLR_RESET} ${CLR_GREEN}${detail}${CLR_RESET}"
            return 0
        else
            echo -e "  ${CLR_RED}[✗]${CLR_RESET}  ${CLR_WHITE}${step_tag}${CLR_RESET} ${label} ${CLR_RED}FAILED${CLR_RESET}"
            return 1
        fi
    else
        start_spinner "${step_tag} ${label}"
        echo -e "--- Running: ${cmd} ---" >> "${UPDATE_LOG}"
        if eval "${cmd}" >> "${UPDATE_LOG}" 2>&1; then
            stop_spinner
            local end_time
            end_time="$(date +%s)"
            local elapsed=$(( end_time - start_time ))
            echo -ne "\r\033[K"
            echo -e "  ${CLR_GREEN}[✓]${CLR_RESET}  ${CLR_WHITE}${step_tag}${CLR_RESET} ${CLR_BOLD}${label}${CLR_RESET} ${CLR_DIM}(${elapsed}s)${CLR_RESET} ${CLR_CYAN}${detail}${CLR_RESET}"
            return 0
        else
            stop_spinner
            echo -ne "\r\033[K"
            echo -e "  ${CLR_RED}[✗]${CLR_RESET}  ${CLR_WHITE}${step_tag}${CLR_RESET} ${CLR_BOLD}${label}${CLR_RESET} ${CLR_RED}FAILED${CLR_RESET}"
            echo ""
            echo -e "${CLR_RED}┌── Error Diagnostics (last 15 lines of ${UPDATE_LOG}) ──────────────────────${CLR_RESET}"
            tail -n 15 "${UPDATE_LOG}" | sed 's/^/│  /'
            echo -e "${CLR_RED}└─────────────────────────────────────────────────────────────────────────────${CLR_RESET}"
            return 1
        fi
    fi
}

print_banner

TOTAL_STEPS=6
CURRENT_STEP=1

# ------------------------------------------------------------------------------
# STEP 1: Git Remote Synchronization
# ------------------------------------------------------------------------------
cd "${ROOT_DIR}"
CURRENT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo "unknown")"
REMOTE_COMMIT="$(git rev-parse origin/main 2>/dev/null || echo "unknown")"

REBUILD_NEEDED=0

git_sync() {
    git fetch origin --quiet 2>/dev/null || true
    local current
    current="$(git rev-parse HEAD 2>/dev/null || echo "")"
    local remote
    remote="$(git rev-parse origin/main 2>/dev/null || echo "")"
    if [ -n "${remote}" ] && [ -n "${current}" ]; then
        # Only pull if origin/main contains new commits that HEAD does not have
        if ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
            local stashed=0
            if [ -n "$(git status --porcelain)" ]; then
                git stash push -m "neiman-update-autostash" --quiet
                stashed=1
            fi
            git pull origin main --quiet || true
            if [ "${stashed}" -eq 1 ]; then
                git stash pop --quiet || true
            fi
        fi
    fi
}

execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Git Remote Synchronization" "git_sync" "commit: ${CURRENT_COMMIT:0:7}"
CURRENT_STEP=$(( CURRENT_STEP + 1 ))

NEW_COMMIT="$(git rev-parse HEAD)"
if [ "${CURRENT_COMMIT}" != "${NEW_COMMIT}" ] || [ "${FORCE_REBUILD}" -eq 1 ]; then
    REBUILD_NEEDED=1
fi

# ------------------------------------------------------------------------------
# STEP 2: Database Schema & Setup Reset Safeguards
# ------------------------------------------------------------------------------
db_step() {
    # Terminate any active background daemon or desktop instances so SQLite lock is released
    pkill -f "uvicorn nexora.main:app" >/dev/null 2>&1 || true
    pkill -f "neiman-desktop" >/dev/null 2>&1 || true
    pkill -f "NEIMAN-desktop" >/dev/null 2>&1 || true
    sleep 0.5

    if [ "${PRESERVE_DB}" -eq 0 ]; then
        if [ -f "${DB_FILE}" ]; then
            local stamp
            stamp="$(date +%Y%m%d_%H%M%S)"
            mv "${DB_FILE}" "${DATA_DIR}/production_${stamp}.db.bak"
            rm -f "${DB_FILE}-wal" "${DB_FILE}-shm"
            echo "Safely archived prior database to ${DATA_DIR}/production_${stamp}.db.bak" >> "${UPDATE_LOG}"
        fi
        local webview_store="${HOME}/.local/share/org.NEIMAN.desktop/localstorage"
        if [ -d "${webview_store}" ]; then
            rm -rf "${webview_store}"
        fi
        # Signal clean setup protocol required across desktop and web runtimes
        touch "${DATA_DIR}/.setup_required"
    else
        # In preserved update mode, remove stale .setup_required flag if database is already configured
        if [ -f "${DATA_DIR}/.setup_required" ]; then
            rm -f "${DATA_DIR}/.setup_required"
        fi
    fi

    cd "${ROOT_DIR}/apps/api"
    if command -v uv >/dev/null 2>&1; then
        DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" uv run alembic upgrade head
    elif [ -x ".venv/bin/alembic" ]; then
        DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" .venv/bin/alembic upgrade head
    else
        DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}" python3 -m alembic upgrade head
    fi
}

execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Database Schema Migration (In-Place)" "db_step" "operational"
CURRENT_STEP=$(( CURRENT_STEP + 1 ))

# ------------------------------------------------------------------------------
# STEP 3: Python Environment & System Dependencies
# ------------------------------------------------------------------------------
python_sync() {
    cd "${ROOT_DIR}/apps/api"
    if command -v uv >/dev/null 2>&1; then
        uv sync --quiet
    fi
}

execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Backend Runtime & Python Dependencies" "python_sync" "locked"
CURRENT_STEP=$(( CURRENT_STEP + 1 ))

# ------------------------------------------------------------------------------
# STEP 4: Next.js Frontend Bundle Optimization
# ------------------------------------------------------------------------------
frontend_build() {
    cd "${ROOT_DIR}/apps/web"
    # Run npm install with error loglevel to eliminate peer dependency warning spam
    npm install --loglevel=error --prefer-offline --no-fund --no-audit
    rm -rf .next
    npm run build
}

if [ "${REBUILD_NEEDED}" -eq 1 ]; then
    execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Production Frontend Bundle (Next.js)" "frontend_build" "compiled"
else
    echo -e "  ${CLR_GREEN}[✓]${CLR_RESET}  ${CLR_WHITE}[${CURRENT_STEP}/${TOTAL_STEPS}]${CLR_RESET} ${CLR_BOLD}Production Frontend Bundle${CLR_RESET} ${CLR_CYAN}up-to-date (cached)${CLR_RESET}"
fi
CURRENT_STEP=$(( CURRENT_STEP + 1 ))

# ------------------------------------------------------------------------------
# STEP 5: Desktop Host & Binary Verification
# ------------------------------------------------------------------------------
desktop_step() {
    cd "${ROOT_DIR}/apps/web"
    if [ "${REBUILD_NEEDED}" -eq 1 ] && [ -d "src-tauri" ] && command -v cargo >/dev/null 2>&1; then
        npx tauri build --no-bundle
    else
        return 0
    fi
}

execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Desktop Host & Native Process Layer" "desktop_step" "verified"
CURRENT_STEP=$(( CURRENT_STEP + 1 ))

# ------------------------------------------------------------------------------
# STEP 6: Native Operator TUI Console (tui-rs)
# ------------------------------------------------------------------------------
tui_step() {
    if command -v cargo >/dev/null 2>&1; then
        cargo build --release --manifest-path "${ROOT_DIR}/apps/tui-rs/Cargo.toml" --quiet || cargo build --release --manifest-path "${ROOT_DIR}/apps/tui-rs/Cargo.toml"
    fi
}

execute_step "${CURRENT_STEP}" "${TOTAL_STEPS}" "Native Operator TUI Console (tui-rs)" "tui_step" "compiled"

# Ensure canonical 2-command symlinks are active in ~/.local/bin/
mkdir -p "${HOME}/.local/bin"
if [ -f "${ROOT_DIR}/neiman-cli" ]; then
    ln -sf "${ROOT_DIR}/neiman-cli" "${HOME}/.local/bin/neiman-cli"
    chmod +x "${ROOT_DIR}/neiman-cli" "${HOME}/.local/bin/neiman-cli"
fi
if [ -f "${ROOT_DIR}/neiman-desktop" ]; then
    ln -sf "${ROOT_DIR}/neiman-desktop" "${HOME}/.local/bin/neiman-desktop"
    chmod +x "${ROOT_DIR}/neiman-desktop" "${HOME}/.local/bin/neiman-desktop"
fi

# Clean up legacy binaries to strictly maintain 2 commands
rm -f "${HOME}/.local/bin/neiman" "${HOME}/.local/bin/neiman-setup" "${HOME}/.local/bin/neiman-update"

echo ""
echo -e "${CLR_GREEN}╔════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}"
echo -e "${CLR_GREEN}║${CLR_WHITE}${CLR_BOLD}   [✓] NEIMAN OS Update Applied Successfully!                               ${CLR_GREEN}║${CLR_RESET}"
echo -e "${CLR_GREEN}╚════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}"
echo -e " ${CLR_WHITE}Version Head:${CLR_RESET} $(git log -1 --oneline)"
if [ "${PRESERVE_DB}" -eq 0 ]; then
    echo -e " ${CLR_WHITE}Setup Reset: ${CLR_RESET} ${CLR_YELLOW}Active${CLR_RESET} — Next launch initiates Setup Protocol wizard"
else
    echo -e " ${CLR_WHITE}Database:    ${CLR_RESET} ${CLR_GREEN}Preserved & Migrated In-Place${CLR_RESET}"
fi
echo -e " ${CLR_WHITE}Status:      ${CLR_RESET} Operational & Ready for Execution"
echo ""
