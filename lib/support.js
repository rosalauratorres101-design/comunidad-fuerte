'use strict';
// Neighbor support link.
//
// The owner of a private report can create a separate link for neighbors. The
// link shows only a limited view (kind of problem, hazard level, city or state,
// month) - never the address, description, photos or the reporter's name.
// Neighbors can confirm "I see this problem too" anonymously, or co-sign the
// request with a name they choose. The count (and co-signers who agreed) is
// added to the letters the owner sends. The owner can turn the link off.

const crypto = require('crypto');
const jurisdiction = require('./jurisdiction');

const MAX_SUPPORTERS = 500;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function create(inc) {
  const token = crypto.randomBytes(18).toString('base64url');
  inc.support = { ...(inc.support || { entries: [] }), tokenHash: sha(token), active: true, createdAt: new Date().toISOString() };
  inc.support.entries = inc.support.entries || [];
  return token;
}

function revoke(inc) {
  if (inc.support) { inc.support.active = false; inc.support.tokenHash = null; }
}

function findByToken(incidents, token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 64) return null;
  const h = sha(token);
  return incidents.find(i => i.support && i.support.active && i.support.tokenHash === h) || null;
}

function counts(inc) {
  const e = (inc.support && inc.support.entries) || [];
  return { confirmed: e.length, cosigned: e.filter(x => x.kind === 'cosign').length };
}

// What a neighbor sees: no address, description, photos or names.
function publicView(inc, hazardInfo) {
  const w = jurisdiction.resolve(inc.answers);
  const area = [w.locality, w.state, w.country].filter(Boolean)[0] || '';
  return {
    type: inc.assessment.type,
    tier: inc.assessment.tier,
    hazard: hazardInfo,
    domain: inc.domain,
    area: area ? w.name(area) : null,
    month: String(inc.createdAt || '').slice(0, 7),
    ...counts(inc)
  };
}

function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

function add(inc, body) {
  const b = body || {};
  if (!inc.support || !inc.support.active) { const e = new Error('This link is no longer active.'); e.status = 400; throw e; }
  if (inc.support.entries.length >= MAX_SUPPORTERS) { const e = new Error('This request already has the maximum number of supporters.'); e.status = 400; throw e; }
  const kind = b.kind === 'cosign' ? 'cosign' : 'confirm';
  const entry = { kind, at: new Date().toISOString() };
  if (kind === 'cosign') {
    const name = clean(b.name, 80);
    if (!name) { const e = new Error('Write the name you want to sign with.'); e.status = 400; throw e; }
    if (b.agree !== true) { const e = new Error('Please agree to have your name included in the letters.'); e.status = 400; throw e; }
    entry.name = name;
  }
  entry.affected = ['me', 'family', 'neighbors', 'seen'].includes(b.affected) ? b.affected : 'seen';
  inc.support.entries.push(entry);
  return counts(inc);
}

// Line added to letters, in the letter's language.
function letterLine(inc, lang) {
  const { confirmed, cosigned } = counts(inc);
  if (!confirmed) return '';
  const names = ((inc.support && inc.support.entries) || []).filter(x => x.kind === 'cosign').map(x => x.name);
  if (lang === 'es') {
    return `\n\nApoyo vecinal: ${confirmed} persona(s) confirmaron este problema por medio de Comunidad Fuerte` + (cosigned ? `; ${cosigned} firmaron esta solicitud: ${names.join(', ')}.` : '.');
  }
  return `\n\nNeighbor support: ${confirmed} person(s) confirmed this problem through Comunidad Fuerte` + (cosigned ? `; ${cosigned} co-signed this request: ${names.join(', ')}.` : '.');
}

module.exports = { create, revoke, findByToken, publicView, add, counts, letterLine, MAX_SUPPORTERS };
