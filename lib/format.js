const fs = require('fs');
const os = require('os');
const path = require('path');

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

const ONE_MILLION = 1_000_000;
const DEFAULT_1M_COMPACT_AT = 967_000;
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const ANSI_PATTERN = /\x1b\[[0-9;]*m|\x1b\]8;;[^\x1b]*\x1b\\/g;

function paint(colour, text) {
  return `${colour}${text}${RESET}`;
}

function link(url, text) {
  if (!url) return text;
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

function visibleLength(text) {
  return [...text.replace(ANSI_PATTERN, '')].length;
}

function truncate(text, max) {
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}

function userSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function autoCompactDisabled(settings) {
  return process.env.DISABLE_AUTO_COMPACT === '1' || process.env.DISABLE_COMPACT === '1' || settings.autoCompactEnabled === false;
}

function compactThreshold(windowSize) {
  const settings = userSettings();
  if (autoCompactDisabled(settings)) return windowSize;
  const configured = parseInt(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || '', 10) || settings.autoCompactWindow;
  const base = configured > 0 ? configured : windowSize >= ONE_MILLION ? DEFAULT_1M_COMPACT_AT : windowSize;
  const threshold = Math.min(windowSize, base);
  const pctOverride = parseInt(process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE || '', 10);
  if (pctOverride > 0 && pctOverride < 100) return Math.round((threshold * pctOverride) / 100);
  return threshold;
}

function contextPct(tokens, windowSize) {
  if (!windowSize) return null;
  return Math.max(0, Math.min(100, Math.round((tokens / compactThreshold(windowSize)) * 100)));
}

function usageColour(pct) {
  if (pct < 50) return GREEN;
  if (pct < 65) return YELLOW;
  if (pct < 80) return ORANGE;
  return RED;
}

function bar(pct, segments = 10) {
  const filled = Math.max(0, Math.min(segments, Math.floor((pct / 100) * segments)));
  return paint(usageColour(pct), `${'█'.repeat(filled)}${'░'.repeat(segments - filled)} ${pct}%`);
}

function duration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds % 60}s`;
}

function clockTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function resetLabel(resetsAtSeconds) {
  const secondsLeft = resetsAtSeconds - Date.now() / 1000;
  if (secondsLeft < 86400) return duration(secondsLeft);
  const at = new Date(resetsAtSeconds * 1000);
  return `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${clockTime(at)}`;
}

function compactTokens(tokens) {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}

module.exports = {
  RESET, DIM, BOLD, GREEN, YELLOW, ORANGE, RED, CYAN, MAGENTA,
  paint, link, visibleLength, truncate, contextPct, usageColour, bar, duration, clockTime, resetLabel, compactTokens,
};
