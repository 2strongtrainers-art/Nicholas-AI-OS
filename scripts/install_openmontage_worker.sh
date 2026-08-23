#!/bin/zsh
set -euo pipefail

REPO="$HOME/Nicholas-AI-OS"
WORKER_PLIST="$HOME/Library/LaunchAgents/com.nicholas.openmontage-worker.plist"
KEEP_AWAKE_PLIST="$HOME/Library/LaunchAgents/com.nicholas.automation-keepawake.plist"
LOG="$HOME/Library/Logs/OpenMontageWorker.log"
KEEP_AWAKE_LOG="$HOME/Library/Logs/AutomationKeepAwake.log"
WORKER="$REPO/scripts/openmontage_worker_resilient.py"
BASE_WORKER="$REPO/scripts/openmontage_worker.py"

if [[ ! -d "$HOME/OpenMontage" ]]; then
  echo "ERROR: $HOME/OpenMontage not found"
  exit 1
fi
if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a Git repository"
  exit 1
fi
if [[ ! -f "$WORKER" || ! -f "$BASE_WORKER" ]]; then
  echo "ERROR: resilient OpenMontage worker files are missing"
  exit 1
fi

PYTHON_BIN=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [[ -x "$candidate" ]]; then
    PYTHON_BIN="$candidate"
    break
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI not found"
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI not found"
  exit 1
fi

echo "Checking GitHub authentication..."
gh auth status >/dev/null

echo "Updating Nicholas-AI-OS..."
cd "$REPO"
git pull --ff-only

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
mkdir -p "$HOME/Library/Mobile Documents/com~apple~CloudDocs/OpenMontage Output"
mkdir -p "$REPO/jobs/openmontage" "$REPO/status"
chmod +x "$WORKER" "$BASE_WORKER"

AUTOMATION_PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$WORKER_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nicholas.openmontage-worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$WORKER</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$AUTOMATION_PATH</string>
    <key>HOME</key>
    <string>$HOME</string>
  </dict>
</dict>
</plist>
EOF

# Keep the Mac awake while connected to AC power so remote GitHub jobs are not
# silently stranded by normal idle system sleep. Display sleep is unaffected.
# On battery, caffeinate -s does not assert AC system-sleep prevention.
cat > "$KEEP_AWAKE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nicholas.automation-keepawake</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-s</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$KEEP_AWAKE_LOG</string>
  <key>StandardErrorPath</key>
  <string>$KEEP_AWAKE_LOG</string>
</dict>
</plist>
EOF

plutil -lint "$WORKER_PLIST" >/dev/null
plutil -lint "$KEEP_AWAKE_PLIST" >/dev/null

launchctl bootout "gui/$(id -u)" "$WORKER_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$KEEP_AWAKE_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$KEEP_AWAKE_PLIST"
launchctl bootstrap "gui/$(id -u)" "$WORKER_PLIST"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.automation-keepawake"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.openmontage-worker"

sleep 2

echo ""
echo "=== Nicholas AI OS Mac automation hardened ==="
echo "Worker:     $WORKER"
echo "Queue:      $REPO/jobs/openmontage"
echo "Heartbeat:  $REPO/status/openmontage-worker.json (published about every 15 min)"
echo "Output:     iCloud Drive/OpenMontage Output"
echo "Worker log: $LOG"
echo "Keep-awake: enabled on AC power via caffeinate -s"
echo ""
echo "Worker LaunchAgent:"
launchctl print "gui/$(id -u)/com.nicholas.openmontage-worker" | grep -E 'state =|last exit code' || true
echo "Keep-awake LaunchAgent:"
launchctl print "gui/$(id -u)/com.nicholas.automation-keepawake" | grep -E 'state =|last exit code' || true
