#!/bin/bash
# Removes the TalentFlow LaunchAgent.

LABEL="com.talentflow.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm "$PLIST"
  echo "✅  TalentFlow service removed."
else
  echo "ℹ️   No TalentFlow service found."
fi
