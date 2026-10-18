#!/usr/bin/env bash
# Runs a command; on failure, publishes the relevant output lines as GitHub error annotations
# (annotations are visible in the run summary and through the API, unlike raw logs).
# Usage: annotate-run.sh "<title>" <command> [args…]
set -uo pipefail
title="$1"; shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  encode() { sed -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'BEGIN{ORS="%0A"} {print}'; }
  key=$(grep -E "error:|ERROR|FAILURE|What went wrong|Caused by|Execution failed|\.java:[0-9]+|\.xml:[0-9]+|^e: |^> |Could not|not found" "$log" | head -45)
  if [ -n "$key" ]; then echo "::error title=${title} (key lines)::$(printf '%s\n' "$key" | encode)"; fi
  echo "::error title=${title} (last lines)::$(tail -45 "$log" | encode)"
fi
exit "$status"
