#!/usr/bin/env bash
# ==============================================================================
# NEIMAN Desktop Runner — Real-Life Operations & Desktop Orchestration
# ==============================================================================
# Runs the full NEIMAN Autonomous Organization OS desktop experience:
# 1. Configures dedicated local persistent SQLite storage:
#    ~/.local/share/neiman/production.db
# 2. Applies database migrations automatically with zero mock/demo data.
# 3. Ensures FastAPI backend is active and healthy on port 8000.
# 4. Supports dual desktop execution modes:
#    - ./run-desktop.sh (or --release): launches standalone compiled AppImage
#    - ./run-desktop.sh --dev: launches hot-reload development desktop runtime
# ==============================================================================

set -euo pipefail
umask 077

TARGET="${BASH_SOURCE[0]}"
while [ -h "$TARGET" ]; do
    DIR="$(cd -P "$(dirname "$TARGET")" && pwd)"
    TARGET="$(readlink "$TARGET")"
    [[ $TARGET != /* ]] && TARGET="$DIR/$TARGET"
done
ROOT_DIR="$(cd -P "$(dirname "$TARGET")" && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"

# Ensure user toolchains (~/.local/bin for uv, ~/.cargo/bin, mise shims) are on PATH
for p in "${HOME}/.local/bin" "${HOME}/.cargo/bin" "${HOME}/.local/share/mise/shims"; do
    if [ -d "${p}" ] && [[ ":$PATH:" != *":${p}:"* ]]; then
        export PATH="${p}:${PATH}"
    fi
done




MODE="release"
for arg in "$@"; do
    case "$arg" in
        --dev)
            MODE="dev"
            ;;
        --release)
            MODE="release"
            ;;
        -h|--help)
            echo "Usage: $0 [--release | --dev]"
            echo ""
            echo "Options:"
            echo "  --release   Launch compiled native AppImage binary (default)"
            echo "  --dev       Launch development desktop runtime with hot reload"
            exit 0
            ;;
    esac
done

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
API_URL="http://127.0.0.1:${API_PORT}"
WEB_URL="http://127.0.0.1:${WEB_PORT}"
if [ -x "${API_DIR}/.venv/bin/python" ]; then
    API_PYTHON="${API_DIR}/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    API_PYTHON="$(command -v python3)"
else
    echo "[!] Python 3 is required to verify the local API mode." >&2
    exit 1
fi

# Real-life operational persistent storage
DATA_DIR="${HOME}/.local/share/neiman"
mkdir -p "${DATA_DIR}"
DB_FILE="${DATA_DIR}/production.db"
export DATABASE_URL="sqlite+aiosqlite:///${DB_FILE}"
export DISABLE_AUTH="true"
export ENVIRONMENT="desktop"

echo "================================================================="
echo "   NEIMAN — Autonomous Organization OS (Desktop Host)            "
echo "================================================================="
echo "[+] Operation Mode : Real-Life Operations (Zero Demo Data)"
echo "[+] Target Database: ${DB_FILE}"
echo "[+] Execution Mode : ${MODE}"

# ------------------------------------------------------------------------------
# 1. Database Schema Migration (Zero Demo Data)
# ------------------------------------------------------------------------------
echo "[*] Checking and migrating persistent database schema..."
if [ -x "${API_DIR}/.venv/bin/python" ]; then
    (cd "${API_DIR}" && "${API_DIR}/.venv/bin/python" -m nexora.scripts.ensure_desktop_secrets)
elif command -v uv >/dev/null 2>&1; then
    (cd "${API_DIR}" && uv run python -m nexora.scripts.ensure_desktop_secrets)
else
    (cd "${API_DIR}" && python3 -m nexora.scripts.ensure_desktop_secrets)
fi
if [ -x "${API_DIR}/.venv/bin/alembic" ]; then
    (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" "${API_DIR}/.venv/bin/alembic" upgrade head)
elif command -v uv >/dev/null 2>&1; then
    (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" uv run alembic upgrade head)
else
    echo "[!] Alembic is required to migrate the database before startup." >&2
    exit 1
fi
echo "[+] Database schema ready."
if [ -x "${API_DIR}/.venv/bin/python" ] && [ -n "${NEIMAN_BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
    (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" "${API_DIR}/.venv/bin/python" -m nexora.scripts.init_admin)
fi

# ------------------------------------------------------------------------------
# 2. Backend Orchestration (FastAPI API server)
# ------------------------------------------------------------------------------
API_PID=""
WEB_PID=""

cleanup() {
    local exit_status=$?
    trap - EXIT SIGINT SIGTERM
    echo ""
    echo "[*] Shutting down NEIMAN Desktop session..."
    if [ -n "${API_PID}" ] && kill -0 "${API_PID}" 2>/dev/null; then
        echo "[*] Stopping backend API server (PID: ${API_PID})..."
        kill "${API_PID}" 2>/dev/null || true
    fi
    if [ -n "${WEB_PID}" ] && kill -0 "${WEB_PID}" 2>/dev/null; then
        echo "[*] Stopping web frontend server (PID: ${WEB_PID})..."
        kill "${WEB_PID}" 2>/dev/null || true
    fi
    exit "${exit_status}"
}
trap cleanup EXIT
trap 'exit 130' SIGINT
trap 'exit 143' SIGTERM

echo "[*] Checking if NEIMAN API backend is running on port ${API_PORT}..."
if curl -s -f --connect-timeout 1 "${API_URL}/health" >/dev/null 2>&1; then
    API_HEALTH="$(curl -s -f --connect-timeout 2 "${API_URL}/health" || true)"
    API_MODE_OK="$(printf '%s' "${API_HEALTH}" | "${API_PYTHON}" -c 'import json,sys; data=json.load(sys.stdin); print("true" if data.get("environment") in ("desktop", "development") and data.get("auth_disabled") is True else "false")' 2>/dev/null || true)"
    if [ "${API_MODE_OK}" = "true" ]; then
        echo "[+] Found desktop-mode backend active at ${API_URL} (authentication disabled)"
    else
        echo "[!] Existing API on ${API_URL} is not running in desktop mode with authentication disabled."
        API_PROCESS_PID="$("${API_PYTHON}" - "${API_DIR}" "${API_PORT}" <<'PY'
import os
import pathlib
import sys

expected_directory = pathlib.Path(sys.argv[1]).resolve()
expected_port = sys.argv[2]
for process in pathlib.Path("/proc").iterdir():
    if not process.name.isdigit():
        continue
    try:
        if pathlib.Path(os.readlink(process / "cwd")).resolve() != expected_directory:
            continue
        arguments = (process / "cmdline").read_bytes().decode().split("\0")
        arguments = [argument for argument in arguments if argument]
        if "nexora.main:app" not in arguments or "uvicorn" not in arguments:
            continue
        if "--host" not in arguments or arguments[arguments.index("--host") + 1] != "127.0.0.1":
            continue
        if "--port" not in arguments or arguments[arguments.index("--port") + 1] != expected_port:
            continue
        print(process.name)
        break
    except (FileNotFoundError, PermissionError, ProcessLookupError, OSError, ValueError, IndexError):
        continue
PY
)"
        if [ -z "${API_PROCESS_PID}" ]; then
            echo "[!] Refusing to reuse or stop an unidentified process. Stop the service on port ${API_PORT}, then rerun ./run-desktop.sh." >&2
            exit 1
        fi
        echo "[*] Restarting this project's existing loopback API process (PID: ${API_PROCESS_PID}) with desktop settings..."
        kill "${API_PROCESS_PID}"
        API_STOPPED=false
        for i in {1..20}; do
            API_PROCESS_STATE="$(awk '{print $3}' "/proc/${API_PROCESS_PID}/stat" 2>/dev/null || true)"
            if ! kill -0 "${API_PROCESS_PID}" 2>/dev/null || [ "${API_PROCESS_STATE}" = "Z" ]; then
                API_STOPPED=true
                break
            fi
            sleep 0.25
        done
        if [ "${API_STOPPED}" != "true" ]; then
            echo "[!] Existing API process did not stop after SIGTERM; refusing to launch a second server." >&2
            exit 1
        fi
        API_PID=""
        echo "[*] Starting background FastAPI backend on port ${API_PORT}..."
        if [ -x "${API_DIR}/.venv/bin/python" ]; then
            (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" "${API_DIR}/.venv/bin/python" -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        elif command -v uv >/dev/null 2>&1; then
            (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" uv run uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        else
            (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" python3 -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        fi
        API_PID=$!
        echo -n "[*] Waiting for desktop backend readiness..."
        API_READY=false
        for i in {1..20}; do
            if curl -s -f --connect-timeout 1 "${API_URL}/health" >/dev/null 2>&1; then
                API_HEALTH="$(curl -s -f --connect-timeout 2 "${API_URL}/health" || true)"
                API_MODE_OK="$(printf '%s' "${API_HEALTH}" | "${API_PYTHON}" -c 'import json,sys; data=json.load(sys.stdin); print("true" if data.get("environment") in ("desktop", "development") and data.get("auth_disabled") is True else "false")' 2>/dev/null || true)"
                if [ "${API_MODE_OK}" = "true" ]; then
                    API_READY=true
                    echo " ready!"
                    break
                fi
            fi
            sleep 0.5
            echo -n "."
        done
        if [ "${API_READY}" != "true" ]; then
            echo ""
            echo "[!] Restarted API did not report desktop mode with authentication disabled." >&2
            exit 1
        fi
    fi
else
    # Check if a stale or unresponsive uvicorn process is holding the API port
    STALE_API_PID="$("${API_PYTHON}" - "${API_DIR}" "${API_PORT}" <<'PY'
import pathlib, sys
expected_port = sys.argv[2]
for process in pathlib.Path("/proc").iterdir():
    if not process.name.isdigit():
        continue
    try:
        arguments = (process / "cmdline").read_bytes().decode().split("\0")
        if "nexora.main:app" in arguments and "--port" in arguments and arguments[arguments.index("--port") + 1] == expected_port:
            print(process.name)
            break
    except (FileNotFoundError, PermissionError, ProcessLookupError, OSError, ValueError, IndexError):
        continue
PY
)"
    if [ -n "${STALE_API_PID}" ]; then
        echo "[*] Cleaning up unresponsive API process on port ${API_PORT} (PID: ${STALE_API_PID})..."
        kill -9 "${STALE_API_PID}" 2>/dev/null || true
        sleep 0.5
    fi

    echo "[*] Starting background FastAPI backend on port ${API_PORT}..."
    if [ -x "${API_DIR}/.venv/bin/python" ]; then
        (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" "${API_DIR}/.venv/bin/python" -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        API_PID=$!
    elif command -v uv >/dev/null 2>&1; then
        (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" uv run uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        API_PID=$!
    else
        (cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" python3 -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" --log-level warning) &
        API_PID=$!
    fi

    # Wait up to 10 seconds for backend to become responsive
    echo -n "[*] Waiting for backend readiness..."
    API_READY=false
    for i in {1..20}; do
        if curl -s -f --connect-timeout 1 "${API_URL}/health" >/dev/null 2>&1; then
            API_READY=true
            echo " ready!"
            break
        fi
        sleep 0.5
        echo -n "."
    done
    if [ "${API_READY}" != "true" ]; then
        echo ""
        echo "[!] Backend did not become healthy; refusing to launch the desktop." >&2
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# 3. Web Frontend Orchestration (Ensures port 3000 is served)
# ------------------------------------------------------------------------------
if [ "${MODE}" = "release" ]; then
    WEB_BUILD_ID="${WEB_DIR}/.next/BUILD_ID"
    NEED_WEB_BUILD=false
    if [ ! -f "${WEB_BUILD_ID}" ]; then
        NEED_WEB_BUILD=true
    else
        NEWEST_WEB_SRC=""
        if [ -d "${WEB_DIR}/src" ]; then
            NEWEST_WEB_SRC=$(find "${WEB_DIR}/src" "${WEB_DIR}/next.config.js" "${WEB_DIR}/package.json" -type f -newer "${WEB_BUILD_ID}" 2>/dev/null | head -n 1 || true)
        fi
        if [ -n "${NEWEST_WEB_SRC}" ]; then
            echo "[*] Detected frontend changes after the last build: ${NEWEST_WEB_SRC}"
            NEED_WEB_BUILD=true
        fi
    fi
    if [ "${NEED_WEB_BUILD}" = "true" ]; then
        if [ ! -x "${WEB_DIR}/node_modules/.bin/next" ]; then
            echo "[!] Frontend source changed but Next.js dependencies are not installed; run npm install in ${WEB_DIR}." >&2
            exit 1
        fi
        echo "[*] Building the updated local frontend..."
        (cd "${WEB_DIR}" && npm run build)
    fi
fi

echo "[*] Checking if Next.js frontend is active on port ${WEB_PORT}..."
if curl -s -f --connect-timeout 1 "${WEB_URL}" >/dev/null 2>&1; then
    echo "[+] Found existing frontend active at ${WEB_URL}"
else
    echo "[*] Starting local Next.js frontend service..."
    if [ "${MODE}" = "release" ] && [ -f "${WEB_DIR}/.next/standalone/server.js" ]; then
        if [ ! -d "${WEB_DIR}/.next/standalone/.next/static" ]; then
            cp -r "${WEB_DIR}/.next/static" "${WEB_DIR}/.next/standalone/.next/" 2>/dev/null || true
            cp -r "${WEB_DIR}/public" "${WEB_DIR}/.next/standalone/" 2>/dev/null || true
        fi
        (cd "${WEB_DIR}/.next/standalone" && PORT="${WEB_PORT}" node server.js) >/dev/null 2>&1 &
        WEB_PID=$!
    elif [ "${MODE}" = "release" ] && [ -f "${WEB_DIR}/.next/BUILD_ID" ]; then
        (cd "${WEB_DIR}" && npm run start -- -p "${WEB_PORT}") >/dev/null 2>&1 &
        WEB_PID=$!
    else
        (cd "${WEB_DIR}" && npm run dev -- -p "${WEB_PORT}") >/dev/null 2>&1 &
        WEB_PID=$!
    fi


    echo -n "[*] Waiting for frontend readiness..."
    WEB_READY=false
    for i in {1..30}; do
        if curl -s -f --connect-timeout 1 "${WEB_URL}" >/dev/null 2>&1; then
            WEB_READY=true
            echo " ready!"
            break
        fi
        sleep 0.5
        echo -n "."
    done
    if [ "${WEB_READY}" != "true" ]; then
        echo ""
        echo "[!] Frontend did not become healthy; refusing to launch the desktop." >&2
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# 4. Launch Desktop Application
# ------------------------------------------------------------------------------
export WEBKIT_DISABLE_COMPOSITING_MODE=1

APPIMAGE_DIR="${WEB_DIR}/src-tauri/target/release/bundle/appimage"
APPIMAGE_PATH=""
if [ -d "${APPIMAGE_DIR}" ]; then
    APPIMAGE_PATH=$(find "${APPIMAGE_DIR}" -name "*.AppImage" 2>/dev/null | sort -V | tail -n 1 || true)
fi
if [ -z "${APPIMAGE_PATH}" ]; then
    APPIMAGE_PATH="${APPIMAGE_DIR}/NEIMAN-desktop_1.0.1_amd64.AppImage"
fi
STANDALONE_BIN="${WEB_DIR}/src-tauri/target/release/app"

if [ "${MODE}" = "release" ]; then
    NEED_REBUILD=false
    BUILD_FAILED=false
    if [ ! -f "${STANDALONE_BIN}" ] && [ ! -f "${APPIMAGE_PATH}" ]; then
        echo "[!] No compiled desktop binary found. Triggering automated build..."
        NEED_REBUILD=true
    elif [ -f "${STANDALONE_BIN}" ]; then
        # Check if any Rust or Web frontend sources have been modified after binary was compiled
        NEWEST_SRC=""
        if [ -d "${WEB_DIR}/src-tauri/src" ] && [ -d "${WEB_DIR}/src" ]; then
            NEWEST_SRC=$(find "${WEB_DIR}/src-tauri/src" "${WEB_DIR}/src" -type f -newer "${STANDALONE_BIN}" 2>/dev/null | head -n 1 || true)
        fi
        if [ -n "${NEWEST_SRC}" ]; then
            echo "[*] Detected source code changes (newer than compiled binary: ${NEWEST_SRC})."
            echo "[*] Automatically compiling updated native desktop binary..."
            NEED_REBUILD=true
        fi
    fi

    if [ "${NEED_REBUILD}" = "true" ]; then
        (cd "${WEB_DIR}/src-tauri" && cargo build --release) || {
            echo "[!] Notice: Native desktop binary build failed; falling back to browser interface..."
            BUILD_FAILED=true
        }
    fi

    if [ "${BUILD_FAILED}" = "false" ] && [ -f "${APPIMAGE_PATH}" ]; then
        echo "[*] Launching compiled AppImage release binary..."
        chmod +x "${APPIMAGE_PATH}"
        "${APPIMAGE_PATH}"
    elif [ "${BUILD_FAILED}" = "false" ] && [ -f "${STANDALONE_BIN}" ]; then
        echo "[*] Launching compiled native desktop binary..."
        chmod +x "${STANDALONE_BIN}"
        "${STANDALONE_BIN}"
    else
        echo "[*] Launching NEIMAN in default web browser (${WEB_URL})..."
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "${WEB_URL}" >/dev/null 2>&1 &
        fi
        echo "[+] NEIMAN is running at ${WEB_URL}"
        echo "    Press Ctrl+C to stop services."
        wait "${WEB_PID}" 2>/dev/null || wait
    fi
else
    echo "[*] Launching Tauri Desktop runtime in development mode..."
    cd "${WEB_DIR}"
    npx --yes @tauri-apps/cli dev || {
        echo "[*] Launching NEIMAN in default web browser (${WEB_URL})..."
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "${WEB_URL}" >/dev/null 2>&1 &
        fi
        wait "${WEB_PID}" 2>/dev/null || wait
    }
fi
