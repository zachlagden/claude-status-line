#!/usr/bin/env node
const path = require('path');
const f = require('./lib/format');
const { gitStatus } = require('./lib/git');
const { lastPromptAt } = require('./lib/transcript');
const { whatsappState } = require('./lib/whatsapp');

const SEPARATOR = f.paint(f.DIM, ' │ ');
const RIGHT_MARGIN = 4;
const HOME = require('os').homedir();
const MAX_PATH_PARTS = 2;
const REVIEW_COLOURS = { approved: f.GREEN, changes_requested: f.RED, pending: f.YELLOW, draft: f.DIM };

function nowSeconds() {
  return Date.now() / 1000;
}

function modelSegment(data) {
  const parts = [f.paint(f.BOLD, data.model?.display_name || 'Claude')];
  if (data.effort?.level) parts.push(f.paint(f.DIM, data.effort.level));
  if (data.fast_mode) parts.push(f.paint(f.YELLOW, '⚡'));
  return parts.join(' ');
}

function displayName(dir) {
  if (dir === HOME) return '~';
  return path.basename(dir) || dir;
}

function shortPath(dir, projectDir) {
  const relative = path.relative(projectDir, dir);
  const insideProject = relative && !relative.startsWith('..') && !path.isAbsolute(relative) && projectDir !== path.sep;
  const underHome = !insideProject && dir.startsWith(`${HOME}${path.sep}`);
  const prefix = insideProject ? '' : underHome ? '~/' : '/';
  const remainder = insideProject ? relative : underHome ? dir.slice(HOME.length + 1) : dir.slice(1);
  const parts = remainder.split(path.sep).filter(Boolean);
  if (parts.length <= MAX_PATH_PARTS) return `${prefix}${parts.join('/')}`;
  return `${prefix}…/${parts.slice(-MAX_PATH_PARTS).join('/')}`;
}

function folderSegment(data) {
  const currentDir = data.workspace?.current_dir || data.cwd || process.cwd();
  const projectDir = data.workspace?.project_dir || currentDir;
  const repo = data.workspace?.repo;
  const url = repo?.host && repo?.owner && repo?.name ? `https://${repo.host}/${repo.owner}/${repo.name}` : null;
  const project = f.link(url, f.paint(f.CYAN, displayName(projectDir)));
  if (currentDir === projectDir) return project;
  return `${project} ${f.paint(f.DIM, `› ${shortPath(currentDir, projectDir)}`)}`;
}

function gitSegment(data) {
  const status = gitStatus(data.workspace?.current_dir || data.cwd || process.cwd());
  if (!status?.branch) return null;
  const parts = [f.paint(f.MAGENTA, `⎇ ${status.branch}${status.dirty ? '*' : ''}`)];
  if (status.ahead) parts.push(f.paint(f.GREEN, `↑${status.ahead}`));
  if (status.behind) parts.push(f.paint(f.RED, `↓${status.behind}`));
  return parts.join(' ');
}

function prSegment(data) {
  if (!data.pr?.number) return null;
  const prefix = data.pr.kind === 'mr' ? '!' : '#';
  const state = data.pr.review_state;
  const label = state ? `${prefix}${data.pr.number} ${state.replace('_', ' ')}` : `${prefix}${data.pr.number}`;
  return f.link(data.pr.url, f.paint(REVIEW_COLOURS[state] || f.RESET, label));
}

function worktreeSegment(data) {
  const name = data.worktree?.name || data.workspace?.git_worktree;
  return name ? f.paint(f.DIM, `wt ${name}`) : null;
}

function agentSegment(data) {
  return data.agent?.name ? f.paint(f.YELLOW, `@${data.agent.name}`) : null;
}

function whatsappSegment() {
  const state = whatsappState();
  return state.ok ? null : f.paint(f.RED, `WhatsApp ${state.label}`);
}

function clockSegment() {
  return f.paint(f.DIM, f.clockTime(new Date()));
}

function contextTokens(window) {
  const usage = window.current_usage;
  if (usage) return (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  if (window.used_percentage != null && window.context_window_size) return (window.used_percentage / 100) * window.context_window_size;
  return null;
}

function contextSegment(data) {
  const window = data.context_window || {};
  const tokens = contextTokens(window);
  const pct = tokens == null ? null : f.contextPct(tokens, window.context_window_size);
  if (pct == null) return f.paint(f.DIM, `${'░'.repeat(10)} --`);
  return f.bar(pct);
}

function limitWindow(label, window) {
  if (!window || window.used_percentage == null) return null;
  const pct = Math.round(window.used_percentage);
  const reset = window.resets_at ? f.paint(f.DIM, ` ↻ ${f.resetLabel(window.resets_at)}`) : '';
  return `${f.paint(f.DIM, label)} ${f.paint(f.usageColour(pct), `${pct}%`)}${reset}`;
}

function rateLimitSegment(data) {
  const limits = data.rate_limits || {};
  const windows = [
    limitWindow('5h', limits.five_hour),
    limitWindow('7d', limits.seven_day),
    limitWindow('spend', limits.spend_limit),
  ].filter(Boolean);
  return windows.length ? windows.join(f.paint(f.DIM, ' · ')) : null;
}

function costSegment(data) {
  const cost = data.cost?.total_cost_usd;
  const elapsed = data.cost?.total_duration_ms;
  const parts = [];
  if (cost != null) parts.push(`$${cost.toFixed(2)}`);
  if (elapsed != null) parts.push(f.paint(f.DIM, f.duration(elapsed / 1000)));
  return parts.length ? parts.join(f.paint(f.DIM, ' · ')) : null;
}

function linesSegment(data) {
  const added = data.cost?.total_lines_added || 0;
  const removed = data.cost?.total_lines_removed || 0;
  if (!added && !removed) return null;
  return `${f.paint(f.GREEN, `+${added}`)} ${f.paint(f.RED, `−${removed}`)}`;
}

function cacheSegment(data) {
  const cache = data.prompt_cache;
  if (!cache?.caching_observed) return null;
  if (!cache.warm || !cache.expires_at) return f.paint(f.DIM, 'cache cold');
  const left = cache.expires_at - nowSeconds();
  if (left <= 0) return f.paint(f.DIM, 'cache cold');
  return `${f.paint(f.DIM, 'cache')} ${f.paint(left < 60 ? f.YELLOW : f.GREEN, f.duration(left))}`;
}

function lastPromptSegment(data) {
  const at = lastPromptAt(data.transcript_path);
  if (!at) return null;
  return f.paint(f.DIM, `↩ ${f.duration((Date.now() - at) / 1000)} ago`);
}

function fitLine(segments, width) {
  let visible = segments.filter((segment) => segment.text);
  const render = () => visible.map((segment) => segment.text).join(SEPARATOR);
  while (width > 0 && visible.length > 1 && f.visibleLength(render()) > width) {
    const lowest = Math.max(...visible.map((segment) => segment.priority));
    const dropIndex = visible.map((segment) => segment.priority).lastIndexOf(lowest);
    visible = visible.filter((_, index) => index !== dropIndex);
  }
  return render();
}

function render(data) {
  const width = (parseInt(process.env.COLUMNS || '0', 10) || 0) - RIGHT_MARGIN;
  const top = [
    { priority: 0, text: whatsappSegment() },
    { priority: 0, text: modelSegment(data) },
    { priority: 0, text: folderSegment(data) },
    { priority: 1, text: gitSegment(data) },
    { priority: 1, text: prSegment(data) },
    { priority: 2, text: worktreeSegment(data) },
    { priority: 2, text: agentSegment(data) },
    { priority: 3, text: clockSegment() },
  ];
  const bottom = [
    { priority: 0, text: contextSegment(data) },
    { priority: 1, text: rateLimitSegment(data) },
    { priority: 2, text: costSegment(data) },
    { priority: 2, text: cacheSegment(data) },
    { priority: 3, text: linesSegment(data) },
    { priority: 3, text: lastPromptSegment(data) },
  ];
  return `${fitLine(top, width)}\n${fitLine(bottom, width)}`;
}

function main() {
  let input = '';
  const timeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    clearTimeout(timeout);
    try {
      process.stdout.write(render(JSON.parse(input)));
    } catch (error) {
      process.stdout.write(`statusline error: ${error.message}`);
    }
  });
}

main();
