'use strict';
// Official link: lets a government office answer inside the app.
//
// The owner of a report creates a link and sends it with the report to the
// authority. The office sees what the person chose to share (the report itself,
// photos, evidence fingerprints, applicable laws), but never the reporter's
// name if the report is anonymous, and never their contact details. The office
// records its answer: received (with a case number), in progress (with an
// estimated date), resolved, forwarded to another authority, or not within its
// authority. Each answer is added to the report's tamper-evident record and the
// owner sees it in the Report tab. The owner can turn the link off at any time.

const crypto = require('crypto');
const { redactContacts } = require('./privacy');

const STATUSES = ['received', 'in_progress', 'resolved', 'forwarded', 'not_ours'];
const MAX_UPDATES = 100;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
function bad(msg) { const e = new Error(msg); e.status = 400; return e; }

function create(inc) {
  const token = crypto.randomBytes(18).toString('base64url');
  inc.official = { ...(inc.official || { updates: [] }), tokenHash: sha(token), active: true, createdAt: new Date().toISOString() };
  inc.official.updates = inc.official.updates || [];
  return token;
}

function revoke(inc) {
  if (inc.official) { inc.official.active = false; inc.official.tokenHash = null; }
}

function findByToken(incidents, token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 64) return null;
  const h = sha(token);
  return incidents.find(i => i.official && i.official.active && i.official.tokenHash === h) || null;
}

function latest(inc) {
  const u = (inc.official && inc.official.updates) || [];
  return u.length ? u[u.length - 1] : null;
}

function update(inc, body) {
  const b = body || {};
  if (!inc.official || !inc.official.active) throw bad('This link is no longer active.');
  if (inc.official.updates.length >= MAX_UPDATES) throw bad('Too many updates on this report.');
  const status = STATUSES.includes(b.status) ? b.status : null;
  if (!status) throw bad('Choose a status.');
  const office = redactContacts(clean(b.office, 120));
  if (!office) throw bad('Write the name of your office or department.');
  const eta = /^\d{4}-\d{2}-\d{2}$/.test(String(b.eta || '')) ? b.eta : '';
  const u = {
    status, office,
    officer: redactContacts(clean(b.officer, 80)),
    caseNumber: clean(b.caseNumber, 60),
    eta,
    forwardedTo: status === 'forwarded' ? redactContacts(clean(b.forwardedTo, 160)) : '',
    note: redactContacts(clean(b.note, 1000)),
    at: new Date().toISOString()
  };
  if (status === 'forwarded' && !u.forwardedTo) throw bad('Write which authority it was forwarded to.');
  inc.official.updates.push(u);
  return u;
}

module.exports = { STATUSES, create, revoke, findByToken, update, latest };
