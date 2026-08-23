#!/bin/zsh
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.nicholas.automation-keepawake.plist"
LOG="$HOME/Library/Logs/AutomationKeepAwake.log"
LABEL="com.nicholas.automation-keepawake"
DOMAIN="gui/$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
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
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"
sleep 1

echo "KEEP_AWAKE_INSTALLED=1"
echo "POLICY=Prevent idle system sleep while connected to AC power; display sleep remains allowed"
launchctl print "$DOMAIN/$LABEL" | grep -E 'state =|pid =|last exit code' || true
/usr/bin/pmset -g assertions | grep -E 'PreventSystemSleep|PreventUserIdleSystemSleep|Listed by owning process' || true
