#!/bin/bash
# TalentFlow service entry point — run by launchd at login.
# Adds Homebrew and common Node paths so npm/tsx are found.

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Resolve the project root regardless of where this script lives
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR" || exit 1

exec npm run dev
