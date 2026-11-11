#!/usr/bin/env bash
set -e
umask 077
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${API_PORT:-8000}"
API_URL="http://127.0.0.1:${API_PORT}"

# Ensure user toolchains (~/.local/bin for uv, ~/.cargo/bin for rust, mise shims) are on PATH early
for p in "${HOME}/.local/bin" "${HOME}/.cargo/bin" "${HOME}/.local/share/mise/shims" "/usr/local/bin"; do
    if [ -d "${p}" ] && [[ ":$PATH:" != *":${p}:"* ]]; then
        export PATH="${p}:${PATH}"
    fi
done

# Ensure backend daemon is active with latest code and credentials
echo "[*] Booting NEIMAN OS backend with latest intelligence configuration..."
DATA_DIR="${HOME}/.local/share/neiman"
mkdir -p "${DATA_DIR}"
# Normalize SQLite URL with 4 slashes for absolute file paths
CLEAN_DATA_DIR="/${DATA_DIR#/}"
export DATABASE_URL="sqlite+aiosqlite:///${CLEAN_DATA_DIR}/production.db"
export DISABLE_AUTH="${DISABLE_AUTH:-true}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export PYTHONPATH="$ROOT_DIR/apps/api"

cd "$ROOT_DIR/apps/api"

BACKEND_ONLINE=0
if curl -s -f --connect-timeout 1 "${API_URL}/health" >/dev/null 2>&1; then
    BACKEND_ONLINE=1
fi

# Ensure .venv exists with all required dependencies
if [ ! -x ".venv/bin/python" ]; then
    echo "[*] Initializing backend virtual environment with Python 3.12..."
    if command -v uv >/dev/null 2>&1; then
        uv sync --quiet || uv sync
    fi
fi

if [ "$BACKEND_ONLINE" -eq 0 ]; then
    if [ -x ".venv/bin/alembic" ]; then
        .venv/bin/alembic upgrade head
    elif command -v uv >/dev/null 2>&1; then
        uv run alembic upgrade head
    else
        echo "[!] Alembic is required to migrate the database before startup." >&2
        exit 1
    fi

    if [ -x ".venv/bin/python" ]; then
        nohup .venv/bin/python -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" >> "${DATA_DIR}/daemon.log" 2>&1 &
    elif command -v uv >/dev/null 2>&1; then
        nohup uv run uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" >> "${DATA_DIR}/daemon.log" 2>&1 &
    elif command -v python3 >/dev/null 2>&1; then
        nohup python3 -m uvicorn nexora.main:app --host 127.0.0.1 --port "${API_PORT}" >> "${DATA_DIR}/daemon.log" 2>&1 &
    else
        echo "[!] Python is required to start the NEIMAN API." >&2
        exit 1
    fi
fi

SPINNER=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
SPIN_IDX=0

printf "[*] Waiting for NEIMAN OS backend to reach healthy state... "
for i in {1..40}; do
    if curl -s -f --connect-timeout 1 "${API_URL}/health" >/dev/null 2>&1; then
        BACKEND_ONLINE=1
        break
    fi
    printf "\r[*] Waiting for NEIMAN OS backend to reach healthy state... %s " "${SPINNER[$SPIN_IDX]}"
    SPIN_IDX=$(( (SPIN_IDX + 1) % ${#SPINNER[@]} ))
    sleep 0.25
done

if [ "$BACKEND_ONLINE" -eq 1 ]; then
    printf "\r[✓] NEIMAN OS backend verified healthy and operational.        \n"
else
    printf "\r[✗] Error: Backend daemon failed to reach healthy state within 10s.\n"
    if [ -f "${DATA_DIR}/daemon.log" ]; then
        echo "── Recent daemon log entries (${DATA_DIR}/daemon.log) ──"
        tail -n 25 "${DATA_DIR}/daemon.log"
    fi
    echo "[!] Aborting Cockpit launch to prevent offline error state."
    echo "[*] Run './run-tui.sh' again or inspect '${DATA_DIR}/daemon.log'."
    exit 1
fi

cd "$ROOT_DIR/apps/tui-rs"

# Build the TUI from the current sources when the Rust toolchain is available.
if command -v cargo >/dev/null 2>&1; then
    cargo build --release
fi

if [ -f "$ROOT_DIR/apps/tui-rs/target/release/tui-rs" ]; then
    exec "$ROOT_DIR/apps/tui-rs/target/release/tui-rs" "$@"
elif command -v cargo >/dev/null 2>&1; then
    exec cargo run --release -- "$@"
else
    echo "[!] TUI binary not found and Cargo is unavailable. Install Rust or build apps/tui-rs first." >&2
    exit 1
fi

