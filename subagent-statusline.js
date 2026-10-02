#!/usr/bin/env node
const path = require('path');
const f = require('./lib/format');
const { lastToolUse } = require('./lib/transcript');

const SEPARATOR = f.paint(f.DIM, ' · ');
const BAR_SEGMENTS = 5;
const MIN_TITLE = 12;
const MAX_TITLE = 48;
const MIN_ACTIVITY = 8;
const TOOL_LABELS = { SendMessage: 'Sending a message', ToolSearch: 'Loading tools', TodoWrite: 'Updating tasks' };

function shortModel(model) {
  if (!model) return null;
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

function elapsed(startTime) {
  if (!startTime) return null;
  const startMs = typeof startTime === 'number' ? (startTime < 1e12 ? startTime * 1000 : startTime) : Date.parse(startTime);
  if (!startMs) return null;
  return f.duration((Date.now() - startMs) / 1000);
}

function contextPart(task) {
  if (!task.tokenCount) return null;
  const tokens = f.paint(f.DIM, f.compactTokens(task.tokenCount));
  if (!task.contextWindowSize) return tokens;
  return `${f.bar(f.contextPct(task.tokenCount, task.contextWindowSize), BAR_SEGMENTS)} ${tokens}`;
}

function metaPart(task) {
  const parts = [shortModel(task.model), typeof task.effort === 'string' ? task.effort : null, elapsed(task.startTime)];
  const text = parts.filter(Boolean).join(' ');
  return text ? f.paint(f.DIM, text) : null;
}

function agentTranscript(data, taskId) {
  if (!data.transcript_path || !data.session_id || !/^[\w-]+$/.test(taskId || '')) return null;
  return path.join(path.dirname(data.transcript_path), data.session_id, 'subagents', `agent-${taskId}.jsonl`);
}

function describeCall(call) {
  if (TOOL_LABELS[call.name]) return TOOL_LABELS[call.name];
  const input = call.input;
  if (input.file_path) return `${call.name} ${path.basename(input.file_path)}`;
  if (input.description) return input.description;
  if (input.pattern) return `${call.name} ${input.pattern}`;
  if (input.url) return `${call.name} ${input.url.replace(/^https?:\/\//, '')}`;
  if (input.query) return `${call.name} ${input.query}`;
  if (input.command) return `${call.name} ${input.command}`;
  return call.name;
}

function currentActivity(task, data) {
  if (task.status && task.status !== 'running') return null;
  const call = lastToolUse(agentTranscript(data, task.id));
  return call ? describeCall(call) : null;
}

function firstLine(text) {
  return (text || '').split('\n')[0].trim();
}

function row(task, columns, data) {
  const title = firstLine(task.name || task.description) || task.type || 'agent';
  const activity = firstLine(currentActivity(task, data) || task.label);
  const status = task.status && task.status !== 'running' ? f.paint(f.DIM, task.status) : null;
  const tail = [contextPart(task), metaPart(task), status].filter(Boolean);
  const tailWidth = f.visibleLength(tail.join(SEPARATOR)) + f.visibleLength(SEPARATOR);
  const titleRoom = Math.max(MIN_TITLE, Math.min(MAX_TITLE, columns - tailWidth));
  const name = f.paint(f.BOLD, f.truncate(title, titleRoom));
  const room = columns - tailWidth - f.visibleLength(name) - f.visibleLength(SEPARATOR);
  const showActivity = activity && activity !== title && room > MIN_ACTIVITY;
  const activityText = showActivity ? f.paint(f.DIM, f.truncate(activity, room)) : null;
  return [name, activityText, ...tail].filter(Boolean).join(SEPARATOR);
}

function render(data) {
  const columns = data.columns || parseInt(process.env.COLUMNS || '0', 10) || 120;
  return (data.tasks || [])
    .map((task) => JSON.stringify({ id: task.id, content: row(task, columns, data) }))
    .join('\n');
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
    } catch {
      process.exit(0);
    }
  });
}

main();
