#!/bin/bash

# ============================================================
# KDL Starter Kit — Claude Code Plugin Installer
#
# These are Claude Code slash commands — they can't run in bash.
# This script prints the exact block to paste into Claude Code.
#
# How to use:
#   1. Run:  bash install-plugins.sh
#   2. Copy the printed block
#   3. Open Claude Code in this project folder
#   4. Paste the block and run each line
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      Claude Code Plugin Install Commands             ║"
echo "║                                                      ║"
echo "║  Open Claude Code in this folder, then paste the    ║"
echo "║  block below and run each line one at a time.        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "─── COPY FROM HERE ──────────────────────────────────────"
echo ""
echo "/plugin install feature-dev@claude-plugins-official"
echo "/plugin install code-review@claude-plugins-official"
echo "/plugin install commit-commands@claude-plugins-official"
echo "/plugin install security-guidance@claude-plugins-official"
echo "/plugin install frontend-design@claude-plugins-official"
echo "/plugin install hookify@claude-plugins-official"
echo "/plugin install ralph-wiggum@claude-plugins-official"
echo "/plugin install pr-review-toolkit@claude-plugins-official"
echo ""
echo "─── COPY TO HERE ────────────────────────────────────────"
echo ""
echo "Plugins install once globally in ~/.claude/plugins/"
echo "Available in all future Claude Code sessions."
echo ""
echo "Plugin → Agent mapping:"
echo "  feature-dev        → Agent 3 (Backend Coder), Agent 5 (Frontend Coder)"
echo "  code-review        → Agent 8 (Code Reviewer)"
echo "  commit-commands    → All code-writing agents"
echo "  security-guidance  → Agent 2, 3, 7 (always-on hook for backend)"
echo "  frontend-design    → Agent 4, 5 (Phase 4)"
echo "  hookify            → Agent 1 (Orchestrator)"
echo "  ralph-wiggum       → Agent 3, 5 (self-correction loops)"
echo "  pr-review-toolkit  → Agent 8 (large phase reviews)"
echo ""
