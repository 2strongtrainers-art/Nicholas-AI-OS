#!/bin/zsh
set -euo pipefail
set +x
umask 077

ROOT="${NICHOLAS_AI_OS_ROOT:-${HOME}/Nicholas-AI-OS}"
SOURCE="$ROOT/scripts/hermes_switchboard_worker.py"
INSTALL_DIR="$HOME/.local/share/nicholas-ai"
SCRIPT="$INSTALL_DIR/hermes_switchboard_worker.py"
CONFIG_DIR="$HOME/.config/nicholas-ai-switchboard"
WORKER_KEY_FILE="$CONFIG_DIR/hermes-worker.key"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.hermes-switchboard-worker.plist"
LOG_DIR="$HOME/Library/Logs"
LOCK_FILE="$HOME/.hermes-switchboard-worker.lock"

[[ -f "$SOURCE" ]] || { echo "Hermes Switchboard worker missing: $SOURCE" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 3; }
[[ -s "$WORKER_KEY_FILE" ]] || { echo "Hermes worker credential file is missing" >&2; exit 4; }

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$INSTALL_DIR" "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
chmod 600 "$WORKER_KEY_FILE"
cp "$SOURCE" "$SCRIPT"
chmod 700 "$SCRIPT"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nicholas.hermes-switchboard-worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${SCRIPT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${LOG_DIR}/HermesSwitchboardLaunchAgent.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/HermesSwitchboardLaunchAgent.err.log</string>
</dict>
</plist>
EOF
chmod 600 "$PLIST"

DOMAIN="gui/$(id -u)"
launchctl bootout "$DOMAIN/com.nicholas.hermes-switchboard-worker" >/dev/null 2>&1 || true
# The PID-file lock can survive a forced LaunchAgent termination. At this point
# the managed worker has been unloaded, so removing it is a controlled reset.
rm -f "$LOCK_FILE"
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/com.nicholas.hermes-switchboard-worker"
launchctl kickstart -k "$DOMAIN/com.nicholas.hermes-switchboard-worker" >/dev/null 2>&1 || true

echo "HERMES_SWITCHBOARD_WORKER_INSTALLED=1"
echo "HERMES_SWITCHBOARD_POLL_SECONDS=30"
echo "HERMES_SWITCHBOARD_STABLE_COPY=1"
echo "HERMES_WORKER_CREDENTIAL_PROTECTED_FILE=1"
echo "HERMES_STALE_LOCK_RESET=1"