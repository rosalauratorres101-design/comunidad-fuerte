'use strict';
// Small JSON-file database with atomic writes and a hash-chained event log.
// Every state change appends an event whose hash covers the previous hash,
// so any later edit to the history is detectable (see verifyChain).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const DB_FILE = () => path.join(config.dataDir, 'db.json');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function emptyDb() {
  return { version: 1, incidents: [], transactions: [], events: [] };
}

let db = null;

function ensureDirs() {
  for (const d of [config.dataDir, path.join(config.dataDir, 'private'), path.join(config.dataDir, 'public')]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function load() {
  ensureDirs();
  const file = DB_FILE();
  if (fs.existsSync(file)) {
    try {
      db = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      const backup = file + '.corrupt-' + Date.now();
      fs.copyFileSync(file, backup);
      console.error('Database file was unreadable; saved a copy at', backup);
      db = emptyDb();
    }
  } else {
    db = emptyDb();
  }
  return db;
}

function save() {
  const file = DB_FILE();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file);
}

function get() {
  if (!db) load();
  return db;
}

function newId(prefix) {
  return prefix + '_' + crypto.randomBytes(5).toString('hex');
}

function canonical(value) {
  // Stable JSON (sorted keys) so the same data always hashes the same way.
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

function appendEvent(type, incidentId, data) {
  const d = get();
  const prev = d.events.length ? d.events[d.events.length - 1].hash : 'GENESIS';
  const event = {
    seq: d.events.length + 1,
    at: new Date().toISOString(),
    type,
    incidentId: incidentId || null,
    data: data || {},
    prevHash: prev
  };
  event.hash = sha256(prev + '|' + canonical({ seq: event.seq, at: event.at, type, incidentId: event.incidentId, data: event.data }));
  d.events.push(event);
  save();
  return event;
}

function verifyChain() {
  const d = get();
  let prev = 'GENESIS';
  for (const e of d.events) {
    const expect = sha256(prev + '|' + canonical({ seq: e.seq, at: e.at, type: e.type, incidentId: e.incidentId, data: e.data }));
    if (e.prevHash !== prev || e.hash !== expect) {
      return { ok: false, brokenAt: e.seq, total: d.events.length };
    }
    prev = e.hash;
  }
  return { ok: true, total: d.events.length, head: prev };
}

function reset() {
  db = emptyDb();
  ensureDirs();
  for (const sub of ['private', 'public']) {
    const dir = path.join(config.dataDir, sub);
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  }
  save();
}

module.exports = { load, save, get, newId, appendEvent, verifyChain, sha256, canonical, reset };
