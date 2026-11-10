'use strict';
// Anonymous community statistics.
//
// Reports stay private, but their non-identifying facts feed shared numbers that
// make the app stronger and that communities, cities and researchers can use:
// how many reports of each kind, where problems cluster, how fast authorities
// answer, what repairs cost and which methods worked.
//
// Privacy rules (built into the code, not left to the reader):
//   - Only reports whose owner allowed it (statsOptIn !== false) are counted.
//   - No free text, names, photos, exact places, report ids or exact dates.
//   - Time is grouped by month; places by country and ~10 km map squares.
//   - Small-number protection: any group with fewer than K reports is merged into
//     "Other" or shown only as "fewer than K", so one person's report cannot be
//     picked out. With fewer than K reports in total, nothing is shown.
//   - One dimension at a time (no cross-tables that could isolate a single report).

const K = 3;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function clean(v, re) {
  const s = String(v == null ? '' : v).trim();
  return s && re.test(s) ? s : '';
}

function parseFilters(q) {
  q = q || {};
  return {
    country: clean(q.country, /^[A-Za-z]{2}$/).toUpperCase(),
    domain: clean(q.domain, /^(environment|infrastructure|community)$/),
    type: clean(q.type, /^[a-z0-9_]{2,40}$/),
    from: clean(q.from, MONTH_RE),
    to: clean(q.to, MONTH_RE)
  };
}

const monthOf = iso => String(iso || '').slice(0, 7);

function eligible(incidents, f) {
  return incidents.filter(i => {
    if (i.statsOptIn === false) return false;
    const a = i.assessment || {};
    const country = ((i.location && i.location.country) || (i.answers && i.answers.country) || '').toUpperCase();
    const m = monthOf(i.createdAt);
    if (f.country && country !== f.country) return false;
    if (f.domain && i.domain !== f.domain) return false;
    if (f.type && a.type !== f.type) return false;
    if (f.from && m < f.from) return false;
    if (f.to && m > f.to) return false;
    return true;
  });
}

// Count by key, then protect small groups.
function protectedCounts(items, keyFn, { keepOrder = false } = {}) {
  const counts = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (k === null || k === undefined || k === '') continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let rows = [...counts.entries()].map(([key, n]) => ({ key, n }));
  if (!keepOrder) rows.sort((a, b) => b.n - a.n || String(a.key).localeCompare(String(b.key)));
  else rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const big = rows.filter(r => r.n >= K);
  const small = rows.filter(r => r.n < K);
  const otherN = small.reduce((s, r) => s + r.n, 0);
  const out = big.map(r => ({ key: r.key, n: r.n }));
  if (keepOrder) {
    // Time series: keep every month in place, but hide small values.
    return rows.map(r => (r.n >= K ? { key: r.key, n: r.n } : { key: r.key, n: null, fewer: true }));
  }
  if (otherN >= K) out.push({ key: 'other', n: otherN, groups: small.length });
  else if (otherN > 0) out.push({ key: 'other', n: null, fewer: true, groups: small.length });
  return out;
}

function countryOf(i) {
  return ((i.location && i.location.country) || (i.answers && i.answers.country) || '').toUpperCase() || 'unknown';
}

function hotspots(items) {
  const cells = new Map();
  for (const i of items) {
    const lat = Number(i.location && i.location.lat);
    const lng = Number(i.location && i.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || i.location.lat == null) continue;
    const key = `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`;
    const c = cells.get(key) || { n: 0, types: {} };
    c.n++;
    const t = (i.assessment && i.assessment.type) || 'unknown';
    c.types[t] = (c.types[t] || 0) + 1;
    cells.set(key, c);
  }
  return [...cells.entries()].filter(([, c]) => c.n >= K).map(([key, c]) => {
    const [lat, lng] = key.split(',').map(Number);
    const top = Object.entries(c.types).sort((a, b) => b[1] - a[1])[0];
    return { lat, lng, n: c.n, topType: top && top[1] >= K ? top[0] : null };
  }).sort((a, b) => b.n - a.n).slice(0, 25);
}

function median(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round1 = n => Math.round(n * 10) / 10;
const round2 = n => Math.round(n * 100) / 100;
const protect = n => (n >= K ? n : n > 0 ? null : 0);

function build({ incidents, transactions, outcomes }, query) {
  const filters = parseFilters(query);
  const items = eligible(incidents || [], filters);
  const base = { generatedAt: new Date().toISOString(), k: K, filters, optedOut: (incidents || []).filter(i => i.statsOptIn === false).length };
  if (items.length < K) return { ...base, total: null, enough: false };

  // Follow-up with authorities: how many were sent, answered, resolved and how fast.
  const reports = items.flatMap(i => i.reports || []);
  const answered = reports.filter(r => r.status === 'answered' || r.status === 'resolved');
  const days = answered.filter(r => r.responseAt && r.sentAt)
    .map(r => (new Date(r.responseAt) - new Date(r.sentAt + 'T00:00:00Z')) / 86400000)
    .filter(d => Number.isFinite(d) && d >= 0);
  const ids = new Set(items.map(i => i.id));
  const tx = (transactions || []).filter(t => ids.has(t.incidentId) && t.status !== 'CREATED');
  const milestones = items.flatMap(i => (i.plan && i.plan.milestones) || []);
  const ratings = items.map(i => i.rating && i.rating.rating).filter(Boolean);
  const raised = tx.filter(t => t.kind === 'donation').reduce((s, t) => s + Number(t.amount || 0), 0);
  const paidOut = tx.filter(t => t.kind === 'payout').reduce((s, t) => s + Number(t.amount || 0), 0);
  const outs = (outcomes || []).filter(o => ids.has(o.incidentId) && Number.isFinite(o.actual) && Number.isFinite(o.estimated) && o.estimated > 0);

  return {
    ...base,
    enough: true,
    total: items.length,
    byDomain: protectedCounts(items, i => i.domain || 'environment'),
    byType: protectedCounts(items, i => (i.assessment && i.assessment.type) || 'unknown'),
    byTier: protectedCounts(items, i => (i.assessment && i.assessment.tier) || 'red'),
    byCountry: protectedCounts(items, countryOf),
    byMonth: protectedCounts(items, i => monthOf(i.createdAt), { keepOrder: true }).slice(-12),
    byCategory: protectedCounts(items.filter(i => i.domain === 'community'), i => (i.answers && i.answers.category) || null),
    hotspots: hotspots(items),
    authorities: {
      sent: protect(reports.length),
      answered: protect(answered.length),
      resolved: protect(reports.filter(r => r.status === 'resolved').length),
      noAnswer: protect(reports.filter(r => r.status === 'no_answer').length),
      medianDaysToAnswer: days.length >= K ? round1(median(days)) : null
    },
    work: {
      milestonesPaid: protect(milestones.filter(m => m.status === 'paid').length),
      raised: tx.filter(t => t.kind === 'donation').length >= K ? round2(raised) : null,
      paidOut: tx.filter(t => t.kind === 'payout').length >= K ? round2(paidOut) : null
    },
    outcomes: {
      rated: protect(ratings.length),
      worked: protect(ratings.filter(r => r === 'worked').length),
      partly: protect(ratings.filter(r => r === 'partly').length),
      notWorked: protect(ratings.filter(r => r === 'not' || r === 'failed' || r === 'no').length)
    },
    learning: {
      costRecords: protect(outs.length),
      // Actual cost as a share of the first estimate: below 1 means work came in cheaper.
      medianActualVsEstimate: outs.length >= K ? round2(median(outs.map(o => o.actual / o.estimated))) : null
    }
  };
}

// Flat table for spreadsheets. Hidden values are written as "<K".
function toCsv(s, label) {
  const rows = [['section', 'key', 'label', 'reports']];
  const lab = label || (x => x);
  const cell = r => (r.n === null ? `<${s.k}` : String(r.n));
  if (!s.enough) {
    rows.push(['total', 'all', 'Not enough reports to publish statistics', `<${s.k}`]);
  } else {
    rows.push(['total', 'all', 'All reports counted', String(s.total)]);
    for (const sec of ['byDomain', 'byType', 'byTier', 'byCountry', 'byMonth', 'byCategory']) {
      for (const r of s[sec]) rows.push([sec, r.key, lab(sec, r.key), cell(r)]);
    }
    for (const h of s.hotspots) rows.push(['hotspot', `${h.lat},${h.lng}`, h.topType ? lab('byType', h.topType) : '', String(h.n)]);
    for (const [k, v] of Object.entries(s.authorities)) rows.push(['authorities', k, '', v === null ? `<${s.k}` : String(v)]);
    for (const [k, v] of Object.entries(s.work)) rows.push(['work', k, '', v === null ? `<${s.k}` : String(v)]);
    for (const [k, v] of Object.entries(s.outcomes)) rows.push(['outcomes', k, '', v === null ? `<${s.k}` : String(v)]);
    for (const [k, v] of Object.entries(s.learning)) rows.push(['learning', k, '', v === null ? `<${s.k}` : String(v)]);
  }
  const q = v => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
  return rows.map(r => r.map(x => q(String(x))).join(',')).join('\n') + '\n';
}

module.exports = { K, build, toCsv, parseFilters };
