const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const HEALTH_URL = process.env.WHATSAPP_BRIDGE_HEALTH_URL || 'http://127.0.0.1:8080/api/health';
const CACHE_TTL_MS = 10000;
const REQUEST_TIMEOUT_SECONDS = '1';
const CACHE_FILE = path.join(
  os.tmpdir(),
  `claude-statusline-whatsapp-${crypto.createHash('sha1').update(HEALTH_URL).digest('hex').slice(0, 12)}.json`,
);

function readCache() {
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - cached.at < CACHE_TTL_MS) return cached.state;
  } catch {
    return undefined;
  }
  return undefined;
}

function writeCache(state) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), state }));
  } catch {
    return;
  }
}

function fetchState() {
  try {
    const body = execFileSync('curl', ['-s', '-m', REQUEST_TIMEOUT_SECONDS, HEALTH_URL], { encoding: 'utf8' });
    const health = JSON.parse(body);
    if (health.logged_out) return { ok: false, label: 'logged out' };
    if (!health.connected) return { ok: false, label: 'disconnected' };
    return { ok: true };
  } catch {
    return { ok: false, label: 'not running' };
  }
}

function whatsappState() {
  const cached = readCache();
  if (cached !== undefined) return cached;
  const state = fetchState();
  writeCache(state);
  return state;
}

module.exports = { whatsappState };
