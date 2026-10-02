# claude-status-line

A custom status line for [Claude Code](https://code.claude.com), plus a status line for subagent rows. Plain Node.js, no dependencies.

## Main status line

Two lines, which drop their lowest-priority segments when the terminal is too narrow.

- Top line: model, effort and fast mode, project folder (linked to its repo), git branch with dirty, ahead and behind markers, pull request and review state, worktree, agent name and the clock.
- Bottom line: context bar measured against the auto-compact threshold, 5-hour, 7-day and spend limits with reset times, session cost and duration, prompt cache time left, lines added and removed, and time since your last prompt.

## Subagent status line

One row per running subagent: its name, the tool call it's running now, a context bar with token count, and its model, effort and elapsed time.

## Install

Clone into `~/.claude/statusline`:

```sh
git clone https://github.com/zachlagden/claude-status-line ~/.claude/statusline
```

Add this to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"${HOME}/.claude/statusline/statusline.js\"",
    "refreshInterval": 5
  },
  "subagentStatusLine": {
    "type": "command",
    "command": "node \"${HOME}/.claude/statusline/subagent-statusline.js\""
  }
}
```

It needs Node.js 18 or later, plus `git` and `curl` on the `PATH`.

## WhatsApp bridge segment

The top line shows a red warning when a local WhatsApp MCP bridge is down, logged out or not running. It checks `http://127.0.0.1:8080/api/health` by default; set `WHATSAPP_BRIDGE_HEALTH_URL` to point it elsewhere. If you don't run a bridge, remove `whatsappSegment()` from the `top` list in `statusline.js`.

## Caching

Git status is cached for 5 seconds and the bridge check for 10 seconds, in files under the system temp directory.
