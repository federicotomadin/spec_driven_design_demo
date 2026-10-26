#!/bin/bash
# When the agent finishes, run the harness. If it is red, block the stop once
# and hand the summary back so it can fix it or document the block.
input=$(cat)
cd "$(dirname "$0")/../.." || exit 0

# Already continuing because of this hook: let it stop (one retry, like Cursor's loop_limit).
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then exit 0; fi

NODE=$(command -v node || ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then exit 0; fi

if output=$("$NODE" harness/cli.js check 2>&1); then exit 0; fi

HARNESS_OUTPUT=$(printf '%s' "$output" | grep -E '\[FAIL\]|^[[:space:]]+- ' | head -20) \
  "$NODE" -e 'process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "The harness is red (`npm run harness -- check`). Fix it or, if you are blocked, document it in progress/current.md and move the spec to blocked:\n" + process.env.HARNESS_OUTPUT
  }))'
