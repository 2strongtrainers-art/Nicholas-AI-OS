#!/bin/zsh
set -euo pipefail

REPO="$HOME/Nicholas-AI-OS"
PLIST="$HOME/Library/LaunchAgents/com.nicholas.paper-daytrader-feed.plist"
LOG="$HOME/Library/Logs/PaperDayTraderFeed.log"
RUNTIME="$HOME/.nicholas-ai-os/paper-daytrader"
RUNNER="$REPO/scripts/run_paper_daytrade_feed_once.py"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a Git repository"
  exit 1
fi
if [[ ! -f "$RUNNER" ]]; then
  echo "ERROR: paper feed runner missing: $RUNNER"
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

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" "$RUNTIME"
chmod +x "$RUNNER"
AUTOMATION_PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nicholas.paper-daytrader-feed</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$RUNNER</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
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
    <key>PAPER_DAYTRADER_SYMBOLS</key>
    <string>SPY,QQQ,NVDA,AAPL,MSFT,AMD</string>
    <key>NICHOLAS_AI_OS_REPO</key>
    <string>2strongtrainers-art/Nicholas-AI-OS</string>
  </dict>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.nicholas.paper-daytrader-feed"

sleep 6
if [[ ! -f "$RUNTIME/status.json" ]]; then
  echo "ERROR: feed LaunchAgent started but no status file was produced"
  exit 1
fi

if ! grep -q '"paper_only": true' "$RUNTIME/status.json"; then
  echo "ERROR: feed status did not verify paper_only=true"
  exit 1
fi
if ! grep -q '"live_execution_enabled": false' "$RUNTIME/status.json"; then
  echo "ERROR: feed status did not verify live_execution_enabled=false"
  exit 1
fi

echo "PAPER_DAYTRADER_FEED_INSTALLED=1"
echo "PAPER_DAYTRADER_LIVE_EXECUTION=0"
echo "PAPER_DAYTRADER_INTERVAL_SECONDS=60"
echo "PAPER_DAYTRADER_STATUS=$RUNTIME/status.json"
echo "PAPER_DAYTRADER_LOG=$LOG"
cat "$RUNTIME/status.json"
