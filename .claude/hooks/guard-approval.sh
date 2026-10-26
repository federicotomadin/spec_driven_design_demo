#!/bin/bash
# Approving a spec is a human decision: if an agent tries
# `harness move <id> approved`, Claude Code asks the user for confirmation.
# Any other command falls through to the normal permission flow (no output).
input=$(cat)

if printf '%s' "$input" | grep -Eq 'harness[^"]*move[^"]*[[:space:]]approved'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "An agent wants to APPROVE a spec. Confirm only if you reviewed it and agree with its contents."
  }
}
JSON
fi
exit 0
