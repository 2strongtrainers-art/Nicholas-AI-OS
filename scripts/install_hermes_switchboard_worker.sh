#!/bin/zsh
set -euo pipefail
set +x
umask 077

ROOT="${NICHOLAS_AI_OS_ROOT:-${HOME}/Nicholas-AI-OS}"
SCRIPT="$ROOT/scripts/hermes_switchboard_worker.py"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.hermes-switchboard-worker.plist"
LOG_DIR="$HOME/Library/Logs"

[[ -f "$SCRIPT" ]] || { echo "Hermes Switchboard worker missing: $SCRIPT" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 3; }
command -v security >/dev/null 2>&1 || { echo "macOS Keychain is required" >&2; exit 4; }

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
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
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/com.nicholas.hermes-switchboard-worker"
launchctl kickstart -k "$DOMAIN/com.nicholas.hermes-switchboard-worker" >/dev/null 2>&1 || true

echo "HERMES_SWITCHBOARD_WORKER_INSTALLED=1"
echo "HERMES_SWITCHBOARD_POLL_SECONDS=30"
