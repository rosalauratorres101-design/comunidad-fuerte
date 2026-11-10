'use strict';
// Privacy: every report (consultation) is private to the person who made it.
//
// - When a report is saved, the server makes a random owner key and returns it
//   once. Only its SHA-256 is stored, so a copy of the database cannot open a report.
// - Every /api/incidents/:id route needs that key in the X-Owner-Key header.
//   The browser keeps the keys of its own reports; nobody can list other reports.
// - Photos and recordings are served only through short-lived signed links that
//   are handed out with an authorised report, never from a public folder.
// - Public pages (impact numbers, money ledger) show totals and categories only:
//   no place, description, photos, names of donors or reporter.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const MEDIA_TTL_SECONDS = 12 * 3600;
let secret = null;

function getSecret() {
  if (secret) return secret;
  if (process.env.MEDIA_LINK_SECRET) { secret = Buffer.from(process.env.MEDIA_LINK_SECRET); return secret; }
  const dir = path.join(config.dataDir, 'private');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '.link-secret');
  if (fs.existsSync(file)) secret = fs.readFileSync(file);
  else { secret = crypto.randomBytes(32); fs.writeFileSync(file, secret, { mode: 0o600 }); }
  return secret;
}

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function newKey() {
  return crypto.randomBytes(24).toString('base64url');
}

function keyMatches(inc, key) {
  if (!inc || !inc.ownerKeyHash || typeof key !== 'string' || key.length < 16 || key.length > 100) return false;
  const a = Buffer.from(sha256(key), 'hex');
  const b = Buffer.from(inc.ownerKeyHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(name, exp) {
  return crypto.createHmac('sha256', getSecret()).update(name + '|' + exp).digest('base64url');
}

// '/media/img_x.jpg' -> '/media/img_x.jpg?exp=...&sig=...'
function signedUrl(publicUrl, now = Date.now()) {
  if (!publicUrl || !publicUrl.startsWith('/media/')) return publicUrl;
  const name = publicUrl.slice('/media/'.length).split('?')[0];
  // Round expiry to the hour so the same link is reused while a page is open.
  const exp = Math.ceil((now / 1000 + MEDIA_TTL_SECONDS) / 3600) * 3600;
  return `/media/${name}?exp=${exp}&sig=${sign(name, exp)}`;
}

function verifyMedia(name, exp, sig, now = Date.now()) {
  if (!/^[a-z]+_[a-f0-9]+\.[a-z0-9]+$/.test(String(name))) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < now / 1000) return false;
  const want = Buffer.from(sign(name, e));
  const got = Buffer.from(String(sig || ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// Show only initials of a person's name on public pages ("Ana López" -> "A. L.").
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return parts.length ? parts.map(p => p[0].toUpperCase() + '.').join(' ') : '';
}

// Remove email addresses and phone numbers from free text before it is stored.
// Contact details of people are never kept in reports, notes or answers.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s().-]{5,}\d/g;
function isPhone(m) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(m.trim())) return false; // a date
  const digits = m.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) return true;
  return /^\d{3}[\s.-]\d{4}$/.test(m.trim()); // local 7-digit number
}
function redactContacts(text) {
  return String(text == null ? '' : text)
    .replace(EMAIL_RE, '[email removed]')
    .replace(PHONE_CANDIDATE_RE, m => (isPhone(m) ? '[phone removed]' : m));
}

module.exports = { redactContacts, newKey, keyMatches, sha256, signedUrl, verifyMedia, initials, MEDIA_TTL_SECONDS };
