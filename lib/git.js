const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const CACHE_TTL_MS = 5000;
const GIT_TIMEOUT_MS = 1500;

function cachePath(dir) {
  const hash = crypto.createHash('sha1').update(dir).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `claude-statusline-git-${hash}.json`);
}

function readCache(file) {
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() - cached.at < CACHE_TTL_MS) return cached.status;
  } catch {
    return undefined;
  }
  return undefined;
}

function parsePorcelain(output) {
  const status = { branch: null, ahead: 0, behind: 0, dirty: false };
  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) status.branch = line.slice(14);
    else if (line.startsWith('# branch.ab ')) {
      const [ahead, behind] = line.slice(12).split(' ');
      status.ahead = Math.abs(parseInt(ahead, 10)) || 0;
      status.behind = Math.abs(parseInt(behind, 10)) || 0;
    } else if (line && !line.startsWith('#')) status.dirty = true;
  }
  if (status.branch === '(detached)') status.branch = 'detached';
  return status;
}

function queryGit(dir) {
  try {
    const output = execFileSync('git', ['-C', dir, 'status', '--porcelain=v2', '--branch', '--untracked-files=normal'], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parsePorcelain(output);
  } catch {
    return null;
  }
}

function gitStatus(dir) {
  const file = cachePath(dir);
  const cached = readCache(file);
  if (cached !== undefined) return cached;
  const status = queryGit(dir);
  try {
    fs.writeFileSync(file, JSON.stringify({ at: Date.now(), status }));
  } catch {
    return status;
  }
  return status;
}

module.exports = { gitStatus };
