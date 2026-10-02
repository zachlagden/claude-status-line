<div align="center">

# claude-status-line

A two-line status line for [Claude Code](https://code.claude.com), with a row for each running subagent.

[![GitHub stars](https://img.shields.io/github/stars/zachlagden/claude-status-line?style=flat&logo=github)](https://github.com/zachlagden/claude-status-line/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/zachlagden/claude-status-line?style=flat)](https://github.com/zachlagden/claude-status-line/commits/main)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![No dependencies](https://img.shields.io/badge/dependencies-none-blue?style=flat)](#install)

<img src="assets/screenshot.png" alt="Claude Code with the status line and two subagent rows" width="100%">

</div>

## What it shows

### Main status line

When the terminal is too narrow, each line drops its lowest-priority segments first.

| Line | Segments |
|---|---|
| Top | Model, effort and fast mode, project folder (linked to its repo), git branch with dirty, ahead and behind markers, pull request and review state, worktree, agent name, clock |
| Bottom | Context bar measured against the auto-compact threshold, 5-hour, 7-day and spend limits with reset times, session cost and duration, prompt cache time left, lines added and removed, time since your last prompt |

### Subagent rows

One row per subagent: its name, the tool call it's running now, a context bar with its token count, and its model, effort and elapsed time.

> [!WARNING]
> The subagent rows misbehave with [Agent Teams](https://code.claude.com/docs/en/agent-teams) turned on (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

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

It needs Node.js 18 or later, with `git` on the `PATH`.

## Caching

Git status is cached for 5 seconds in a file under the system temp directory, so a refresh every 5 seconds runs `git status` at most once per folder.
