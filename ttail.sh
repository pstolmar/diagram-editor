#!/usr/bin/env bash
set -euo pipefail

# Tail planner + executor logs for the current repo.
# Use from another terminal while t/claudium is running.
touch .claude/job.raw.txt
tail -n 40 -F .claude/job.raw.txt .claude/logs/*.log 2>/dev/null
