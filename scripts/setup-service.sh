#!/bin/bash
# Installs TalentFlow as a macOS login service (LaunchAgent).
# Run once: bash scripts/setup-service.sh

set -e

LABEL="com.talentflow.app"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/TalentFlow"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Create directories
mkdir -p "$PLIST_DIR" "$LOG_DIR"

# Unload existing agent if present
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi

# Write the plist
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_DIR/scripts/start.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>

  <!-- Start automatically when you log in -->
  <key>RunAtLoad</key>
  <true/>

  <!-- Restart automatically if the process crashes -->
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/stderr.log</string>
</dict>
</plist>
EOF

# Load the agent
launchctl load "$PLIST"

echo ""
echo "✅  TalentFlow service installed and started."
echo ""
echo "    App:   http://localhost:5173"
echo "    Logs:  $LOG_DIR/"
echo ""
echo "    To stop:      launchctl unload '$PLIST'"
echo "    To start:     launchctl load   '$PLIST'"
echo "    To uninstall: bash '$PROJECT_DIR/scripts/uninstall-service.sh'"
echo ""
