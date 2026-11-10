'use strict';
// Living knowledge base: how the app keeps updating and improving.
//
//  1. Updates   - live searches add NEW methods and organizations as
//                 "pending review"; they show with that label until an expert
//                 approves them. Items not re-checked in 90 days are flagged.
//  2. Learning  - every paid milestone records the real cost and the
//                 community's rating of what worked. Cost estimates move to the
//                 median of real costs, and methods are ranked by outcomes.
//  3. Feedback  - anyone can report wrong or outdated information; nothing
//                 changes until a named reviewer accepts it.
// Safety protocols are NEVER changed automatically.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const content = require('./content');
const { newId, sha256 } = require('./store');

const STALE_DAYS = 90;
const MIN_OUTCOMES_FOR_COST = 3;
const FILE = () => path.join(config.dataDir, 'knowledge.json');

let kb = null;

function empty() {
  return { methods: [], orgs: [], outcomes: [], suggestions: [], quotes: [], changelog: [], lastRefresh: null };
}

function load() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  try {
    kb = fs.existsSync(FILE()) ? JSON.parse(fs.readFileSync(FILE(), 'utf8')) : empty();
  } catch (_) {
    kb = empty();
  }
  return kb;
}

function get() { return kb || load(); }

function save() {
  const tmp = FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(get(), null, 2));
  fs.renameSync(tmp, FILE());
}

function reset() { kb = empty(); save(); }

function log(kind, summary) {
  get().changelog.unshift({ at: new Date().toISOString(), kind, summary });
  get().changelog = get().changelog.slice(0, 200);
}

function urlKey(u) {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).toLowerCase();
  } catch (_) { return String(u || '').toLowerCase(); }
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - Date.parse(dateStr)) / 864e5;
}

function freshness(item) {
  const checked = item.source && item.source.checked;
  return daysSince(checked) > STALE_DAYS ? 'recheck' : 'current';
}

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------
function outcomeScore(methodId) {
  const rows = get().outcomes.filter(o => (o.methodIds || []).includes(methodId) && o.rating);
  const tally = { worked: 0, partly: 0, failed: 0 };
  for (const r of rows) if (tally[r.rating] !== undefined) tally[r.rating]++;
  const n = rows.length;
  const score = n ? (tally.worked + 0.5 * tally.partly) / n : null;
  return { n, ...tally, score };
}

function methodsFor(type, tier) {
  const seed = content.REMEDIATION.filter(m => m.types.includes(type) && m.tiers.includes(tier))
    .map(m => ({ ...m, origin: 'curated', review: 'approved' }));
  const learned = get().methods.filter(m => m.types.includes(type) && m.tiers.includes(tier) && m.review !== 'rejected');
  const all = [...seed, ...learned].map(m => ({ ...m, freshness: freshness(m), outcomes: outcomeScore(m.id) }));
  // Approved first; within that, best community outcomes first; untested keep curated order.
  return all.sort((a, b) => {
    if ((a.review === 'approved') !== (b.review === 'approved')) return a.review === 'approved' ? -1 : 1;
    const sa = a.outcomes.score, sb = b.outcomes.score;
    if (sa !== null && sb !== null && sa !== sb) return sb - sa;
    if (sa !== null && sb === null) return -1;
    if (sb !== null && sa === null) return 1;
    return 0;
  });
}

// Add live findings as pending review (deduplicated by source URL).
function addFindings(kind, items) {
  const list = kind === 'orgs' ? get().orgs : get().methods;
  const curated = (kind === 'orgs' ? content.ORGS : content.REMEDIATION).map(x => x.source && urlKey(x.source.url));
  let added = 0;
  for (const it of items || []) {
    const key = urlKey(it.source && it.source.url);
    if (!key || curated.includes(key)) continue;
    const existing = list.find(x => urlKey(x.source && x.source.url) === key);
    if (existing) {
      existing.source.checked = it.source.checked;
      continue;
    }
    list.push({ ...it, id: (kind === 'orgs' ? 'org_' : 'm_') + sha256(key).slice(0, 10), review: 'pending', addedAt: new Date().toISOString() });
    added++;
  }
  if (added) log('finding', `${added} new ${kind === 'orgs' ? 'organization(s)' : 'method(s)'} found by live search; pending expert review.`);
  save();
  return added;
}

function placeMatches(o, place) {
  if (!o.places) return true;
  return new RegExp(o.places, 'i').test(String(place || ''));
}

function orgsFor(country, domain, place) {
  const d = domain || 'environment';
  const seed = content.ORGS.filter(o => (o.domains || ['environment']).includes(d) && (o.countries.includes('*') || (country && o.countries.includes(country))) && placeMatches(o, place))
    .map(o => ({ ...o, origin: 'curated', review: 'approved' }));
  const learned = get().orgs.filter(o => o.review !== 'rejected' && (o.domains || ['environment']).includes(d) && (o.countries || ['*']).some(c => c === '*' || c === country));
  return [...seed, ...learned].map(o => ({ ...o, freshness: o.source ? freshness(o) : 'unsourced' }));
}

function review(kind, id, decision, reviewer) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Decision must be approved or rejected.');
  if (!reviewer || !String(reviewer).trim()) throw new Error('A named reviewer is required.');
  const list = kind === 'orgs' ? get().orgs : get().methods;
  const item = list.find(x => x.id === id);
  if (!item) throw new Error('Item not found.');
  item.review = decision;
  item.reviewedBy = String(reviewer).trim();
  item.reviewedAt = new Date().toISOString();
  const title = (item.title && item.title.en) || (item.name && item.name.en) || id;
  log('review', `${item.reviewedBy} ${decision} "${title}".`);
  save();
  return item;
}

// ---------------------------------------------------------------------------
// Learning from outcomes
// ---------------------------------------------------------------------------
function recordOutcome({ incidentId, type, category, estimated, actual, methodIds }) {
  const row = { id: newId('out'), incidentId, type, category, estimated: Number(estimated), actual: Number(actual), methodIds: methodIds || [], rating: null, at: new Date().toISOString() };
  get().outcomes.push(row);
  save();
  return row;
}

function rateOutcome(incidentId, rating, methodIds) {
  if (!['worked', 'partly', 'failed'].includes(rating)) throw new Error('Rating must be worked, partly or failed.');
  const rows = get().outcomes.filter(o => o.incidentId === incidentId);
  if (!rows.length) throw new Error('No completed milestones to rate yet.');
  for (const r of rows) {
    r.rating = rating;
    if (methodIds && methodIds.length) r.methodIds = methodIds;
  }
  log('learning', `Community rated incident ${incidentId}: ${rating}.`);
  save();
  return rows.length;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function costEstimate(type, category, templateAmount) {
  const rows = get().outcomes.filter(o => o.type === type && o.category === category && o.actual > 0);
  if (rows.length >= MIN_OUTCOMES_FOR_COST) {
    return { amount: Math.round(median(rows.map(r => r.actual))), basis: 'community_data', n: rows.length };
  }
  return { amount: templateAmount, basis: 'template', n: rows.length };
}

// ---------------------------------------------------------------------------
// Real local repair quotes (community price data, by country and item)
// ---------------------------------------------------------------------------
function addQuote(q) {
  const k = get();
  k.quotes = k.quotes || [];
  const row = { id: newId('q'), ...q, at: new Date().toISOString() };
  k.quotes.push(row);
  log('learning', `Local quote recorded for ${q.item} in ${q.country}.`);
  save();
  return row;
}

function quotes() { return get().quotes || []; }

// ---------------------------------------------------------------------------
// Corrections from users (human-reviewed)
// ---------------------------------------------------------------------------
function suggest({ target, text, by }) {
  if (!text || String(text).trim().length < 5) throw new Error('Describe the correction in a few words.');
  const s = { id: newId('sug'), target: String(target || 'general'), text: String(text).trim().slice(0, 1000), by: String(by || 'anonymous').slice(0, 80), status: 'open', at: new Date().toISOString() };
  get().suggestions.unshift(s);
  log('feedback', `New correction received for "${s.target}".`);
  save();
  return s;
}

function resolveSuggestion(id, decision, reviewer, note) {
  if (!['accepted', 'declined'].includes(decision)) throw new Error('Decision must be accepted or declined.');
  if (!reviewer || !String(reviewer).trim()) throw new Error('A named reviewer is required.');
  const s = get().suggestions.find(x => x.id === id);
  if (!s) throw new Error('Suggestion not found.');
  Object.assign(s, { status: decision, reviewer: String(reviewer).trim(), note: note || '', resolvedAt: new Date().toISOString() });
  log('feedback', `${s.reviewer} ${decision} the correction for "${s.target}".`);
  save();
  return s;
}

// ---------------------------------------------------------------------------
// Scheduled refresh: re-search each pollution type for new methods and orgs.
// ---------------------------------------------------------------------------
const REFRESH_TYPES = ['sargassum', 'oil', 'water_discoloration', 'chemical_unknown', 'plastic_waste'];

async function refresh(ai) {
  const started = new Date().toISOString();
  const laws = require('./laws');
  if (!config.aiLive) {
    const stale = content.REMEDIATION.filter(m => freshness(m) === 'recheck').length;
    const rulesDue = laws.due().length;
    get().lastRefresh = { at: started, mode: 'demo', added: 0, stale, rulesDue };
    log('refresh', `Refresh ran in demo mode: no live search. ${stale} curated item(s) and ${rulesDue} rule(s) or contact(s) due for re-check.`);
    save();
    return get().lastRefresh;
  }
  let added = 0;
  let dropped = 0;
  for (const type of REFRESH_TYPES) {
    for (const tier of type === 'chemical_unknown' ? ['red'] : ['yellow']) {
      const pseudo = { id: 'refresh', assessment: { type, tier }, answers: { placeLabel: 'global', country: '' } };
      try {
        const r = await ai.remediation(pseudo);
        added += addFindings('methods', r.methods);
        dropped += r.dropped;
      } catch (err) {
        log('error', `Refresh failed for ${type}: ${err.message}`);
      }
    }
  }
  let rules = { checked: 0, changes: 0 };
  try { rules = await laws.checkDue(ai); } catch (err) { log('error', `Rule check failed: ${err.message}`); }
  get().lastRefresh = { at: started, mode: 'live', added, dropped, rulesChecked: rules.checked, ruleChanges: rules.changes };
  log('refresh', `Live refresh added ${added} item(s) for review; ${dropped} unsourced item(s) discarded; ${rules.checked} rule(s) re-checked, ${rules.changes} possible change(s) sent to review.`);
  save();
  return get().lastRefresh;
}

function summary() {
  const k = get();
  return {
    lastRefresh: k.lastRefresh,
    pendingMethods: k.methods.filter(m => m.review === 'pending'),
    pendingOrgs: k.orgs.filter(o => o.review === 'pending'),
    openSuggestions: k.suggestions.filter(s => s.status === 'open'),
    outcomes: k.outcomes.length,
    rated: k.outcomes.filter(o => o.rating).length,
    staleCurated: content.REMEDIATION.filter(m => freshness(m) === 'recheck').map(m => m.id),
    changelog: k.changelog.slice(0, 30)
  };
}

module.exports = {
  _kb: get, _save: save, _log: log,
  load, reset, methodsFor, addQuote, quotes, orgsFor, addFindings, review, recordOutcome, rateOutcome,
  costEstimate, suggest, resolveSuggestion, refresh, summary, STALE_DAYS
};
