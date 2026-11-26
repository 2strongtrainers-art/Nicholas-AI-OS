#!/usr/bin/env bash
set -euo pipefail

UPSTREAM_REPO="https://github.com/bilawalsidhu/gods-eye-view.git"
APP_ROOT="${GODS_EYE_HOME:-$HOME/.nicholas-ai-os/apps/gods-eye-view}"
PORT="${GODS_EYE_PORT:-4173}"
HOST="127.0.0.1"
PID_FILE="$APP_ROOT/.nicholas-gods-eye.pid"
LOG_FILE="$APP_ROOT/.nicholas-gods-eye.log"
NODE_TARGET="24.14.0"

say() { printf '[Gods Eye] %s\n' "$*"; }
fail() { printf '[Gods Eye] ERROR: %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

node_supported() {
  have node || return 1
  node -e 'const [M,m,p]=process.versions.node.split(".").map(Number); process.exit(((M===24 && (m>14 || (m===14 && p>=0))) || M===26) ? 0 : 1)' >/dev/null 2>&1
}

load_nvm() {
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
    return 0
  fi
  return 1
}

ensure_node() {
  if node_supported; then
    return 0
  fi

  if load_nvm; then
    say "Installing/using Node $NODE_TARGET with nvm..."
    nvm install "$NODE_TARGET" >/dev/null
    nvm use "$NODE_TARGET" >/dev/null
  fi

  node_supported || fail "God's Eye View requires Node 24.14+ (but <25) or Node 26. Install Node $NODE_TARGET, then run this command again."
  have npm || fail "npm is required but was not found."
}

ensure_checkout() {
  have git || fail "git is required but was not found."
  mkdir -p "$(dirname "$APP_ROOT")"

  if [ ! -d "$APP_ROOT/.git" ]; then
    say "Cloning the canonical God's Eye View project..."
    git clone --depth 1 "$UPSTREAM_REPO" "$APP_ROOT"
  else
    say "Using existing checkout at $APP_ROOT"
  fi
}

install_deps() {
  cd "$APP_ROOT"
  say "Installing locked dependencies..."
  npm ci
  say "Running the project's setup doctor..."
  npm run doctor
}

is_running() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

wait_for_server() {
  local i
  for i in $(seq 1 60); do
    if curl -fsS "http://$HOST:$PORT" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

open_browser() {
  local url="http://localhost:$PORT"
  if [ "$(uname -s)" = "Darwin" ] && have open; then
    open "$url" >/dev/null 2>&1 || true
  elif have xdg-open; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
  say "Open $url"
}

start_app() {
  ensure_checkout
  ensure_node
  install_deps

  if is_running; then
    say "Already running (PID $(cat "$PID_FILE"))."
    open_browser
    return 0
  fi

  cd "$APP_ROOT"
  say "Starting God's Eye View on http://localhost:$PORT ..."
  nohup npm run dev -- --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  if wait_for_server; then
    say "God's Eye View is operational."
    open_browser
  else
    say "Startup did not become healthy within 60 seconds. Recent log output:"
    tail -n 60 "$LOG_FILE" || true
    exit 1
  fi
}

stop_app() {
  if ! is_running; then
    say "God's Eye View is not running."
    rm -f "$PID_FILE"
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  say "Stopping PID $pid..."
  kill "$pid" 2>/dev/null || true
  sleep 1
  rm -f "$PID_FILE"
  say "Stopped."
}

status_app() {
  if is_running && curl -fsS "http://$HOST:$PORT" >/dev/null 2>&1; then
    say "RUNNING: http://localhost:$PORT (PID $(cat "$PID_FILE"))"
    return 0
  fi
  say "STOPPED or unhealthy."
  [ -f "$LOG_FILE" ] && say "Log: $LOG_FILE"
  return 1
}

update_app() {
  ensure_checkout
  ensure_node
  stop_app || true
  cd "$APP_ROOT"
  say "Updating from the canonical upstream repository..."
  git fetch origin main
  git checkout main
  git pull --ff-only origin main
  install_deps
  start_app
}

case "${1:-start}" in
  start) start_app ;;
  stop) stop_app ;;
  restart) stop_app || true; start_app ;;
  update) update_app ;;
  status) status_app ;;
  logs) [ -f "$LOG_FILE" ] && tail -n 100 -f "$LOG_FILE" || fail "No log file yet." ;;
  *)
    cat <<EOF
Usage: $0 [start|stop|restart|update|status|logs]

Environment overrides:
  GODS_EYE_HOME  Installation directory (default: ~/.nicholas-ai-os/apps/gods-eye-view)
  GODS_EYE_PORT  Local port (default: 4173)
EOF
    exit 2
    ;;
esac
