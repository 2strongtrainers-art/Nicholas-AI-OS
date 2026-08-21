#!/bin/zsh
set -euo pipefail

REPO="$HOME/Nicholas-AI-OS"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.openmontage-worker.plist"
LOG="$HOME/Library/Logs/OpenMontageWorker.log"
PYTHON_BIN="/usr/local/bin/python3"
WORKER="$REPO/scripts/openmontage_worker.py"

if [[ ! -d "$HOME/OpenMontage" ]]; then
  echo "ERROR: $HOME/OpenMontage not found"
  exit 1
fi
if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a Git repository"
  exit 1
fi
if [[ ! -x "$PYTHON_BIN" ]]; then
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
mkdir -p "$REPO/jobs/openmontage"
chmod +x "$WORKER"

cat > "$PLIST" <<EOF
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
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>$HOME</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.openmontage-worker"

sleep 2

echo ""
echo "=== OpenMontage bridge installed ==="
echo "Worker: $WORKER"
echo "Queue:  $REPO/jobs/openmontage"
echo "Output: iCloud Drive/OpenMontage Output"
echo "Log:    $LOG"
echo ""
launchctl print "gui/$(id -u)/com.nicholas.openmontage-worker" | grep -E 'state =|last exit code' || true
