const fs = require('fs');

const TAIL_BYTES = 512 * 1024;

function readTail(file) {
  const { size } = fs.statSync(file);
  const start = Math.max(0, size - TAIL_BYTES);
  const buffer = Buffer.alloc(size - start);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString('utf8');
}

function isHumanPrompt(entry) {
  return entry.type === 'user' && entry.origin?.kind === 'human' && !entry.isSidechain;
}

function lastPromptAt(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const lines = readTail(transcriptPath).split('\n');
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (!lines[index].includes('"human"')) continue;
      try {
        const entry = JSON.parse(lines[index]);
        if (isHumanPrompt(entry)) return Date.parse(entry.timestamp) || null;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function lastToolUse(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  try {
    const lines = readTail(transcriptPath).split('\n');
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (!lines[index].includes('"tool_use"')) continue;
      try {
        const content = JSON.parse(lines[index]).message?.content;
        const call = Array.isArray(content) ? content.filter((part) => part.type === 'tool_use').pop() : null;
        if (call) return { name: call.name, input: call.input || {} };
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = { lastPromptAt, lastToolUse };
