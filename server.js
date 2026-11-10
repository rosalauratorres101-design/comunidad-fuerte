'use strict';
// Comunidad Fuerte — server.
// Run: npm start  (demo mode with no keys; add keys in .env for live AI/PayPal)

const path = require('path');
const express = require('express');
const config = require('./lib/config');
const store = require('./lib/store');
const safety = require('./lib/safety');
const content = require('./lib/content');
const ai = require('./lib/ai');
const paypal = require('./lib/paypal');
const media = require('./lib/media');
const knowledge = require('./lib/knowledge');
const agent = require('./lib/agent');
const responsibility = require('./lib/responsibility');
const letters = require('./lib/letters');
const costs = require('./lib/costs');
const summary = require('./lib/summary');
const hazard = require('./lib/hazard');
const laws = require('./lib/laws');
const communityContent = require('./lib/content-community');
const privacy = require('./lib/privacy');
const stats = require('./lib/stats');
const jurisdiction = require('./lib/jurisdiction');
const escalation = require('./lib/escalation');
const support = require('./lib/support');
const official = require('./lib/official');
const match = require('./lib/match');
const responses = require('./lib/responses');

store.load();
knowledge.load();

// Reports saved before privacy keys existed get a key now; the keys are written
// once to data/private/owner-keys-migrated.json for the operator to hand back.
(function migrateOwnerKeys() {
  const missing = store.get().incidents.filter(i => !i.ownerKeyHash);
  if (!missing.length) return;
  const fs = require('fs');
  const file = path.join(config.dataDir, 'private', 'owner-keys-migrated.json');
  let out = {};
  try { out = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* new file */ }
  for (const inc of missing) {
    const key = privacy.newKey();
    inc.ownerKeyHash = privacy.sha256(key);
    out[inc.id] = key;
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  store.save();
  console.log(`Privacy: ${missing.length} older report(s) got access keys (see data/private/owner-keys-migrated.json).`);
})();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '40mb' }));
// Requests made by the example loader run in simulated mode (see lib/config.js).
app.use((req, res, next) => {
  if (req.get('X-Example-Seed') === config.seedSecret) return config.exampleScope.run({ example: true }, () => next());
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use('/vendor/ag-grid', express.static(path.join(__dirname, 'node_modules/ag-grid-community/dist')));
app.use('/vendor/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/atkinson-hyperlegible/files')));
// Photos and recordings: only through signed, expiring links (see lib/privacy.js).
app.get('/media/:name', (req, res) => {
  const { name } = req.params;
  if (!privacy.verifyMedia(name, req.query.exp, req.query.sig)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(config.dataDir, 'public', name), err => { if (err && !res.headersSent) res.status(404).end(); });
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  const status = err.status && err.status < 500 ? 400 : err.httpStatus || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Unexpected error' });
});

function fail(message, httpStatus = 400) {
  const err = new Error(message);
  err.httpStatus = httpStatus;
  throw err;
}

function findIncident(id) {
  const inc = store.get().incidents.find(i => i.id === id);
  if (!inc) fail('Incident not found.', 404);
  return inc;
}

function fundOf(incidentId) {
  const tx = store.get().transactions.filter(t => t.incidentId === incidentId);
  const raised = tx.filter(t => t.kind === 'donation' && t.status === 'COMPLETED').reduce((s, t) => s + Number(t.amount), 0);
  const paid = tx.filter(t => t.kind === 'payout' && t.status !== 'FAILED').reduce((s, t) => s + Number(t.amount), 0);
  return { raised: round2(raised), paid: round2(paid), available: round2(raised - paid) };
}

const round2 = n => Math.round(n * 100) / 100;

function roundCoord(v) {
  const f = Math.pow(10, config.publicLocationDecimals);
  return Number.isFinite(Number(v)) ? Math.round(Number(v) * f) / f : null;
}

// Replace every stored media path with a signed, expiring link.
function signMedia(v) {
  if (Array.isArray(v)) return v.map(signMedia);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === 'publicUrl' && typeof x === 'string' ? privacy.signedUrl(x) : signMedia(x);
    return o;
  }
  return v;
}

// Full view of a report. Only sent to the report's owner (see requireOwner).
function publicIncident(inc) {
  const { reporter, location, photos, followUpAnswers, voice, ownerKeyHash, ...rest } = inc;
  return signMedia({
    ...rest,
    hazard: hazard.forIncident(inc),
    voice: voice ? media.publicPhoto(voice) : null,
    reporter: inc.anonymous ? null : reporter,
    location: location ? { label: location.label, country: location.country, lat: roundCoord(location.lat), lng: roundCoord(location.lng) } : null,
    photos: (photos || []).map(media.publicPhoto),
    plan: inc.plan ? {
      ...inc.plan,
      milestones: inc.plan.milestones.map(m => ({ ...m, evidence: (m.evidence || []).map(media.publicPhoto) }))
    } : null,
    interpreters: (inc.interpreters || []).map(({ recording, email, ...r }) => ({ ...r, recording: recording && media.publicPhoto(recording) })),
    followUpAnswers: followUpAnswers || [],
    sponsorships: (inc.sponsorships || []).map(sp => ({ ...sp, sponsor: { name: sp.sponsor.name } })),
    fund: fundOf(inc.id),
    match: match.status(inc, store.get().transactions),
    official: inc.official ? { active: inc.official.active, createdAt: inc.official.createdAt, updates: inc.official.updates || [] } : null,
    support: inc.support ? { active: inc.support.active, createdAt: inc.support.createdAt, entries: inc.support.entries || [], ...support.counts(inc) } : null,
    private: true
  });
}

function templateKey(type, tier) {
  if (type === 'cm_rental_repairs') return `community_rental:${tier}`;
  if (String(type).startsWith('cm_')) return `community:${tier}`;
  const exact = `${type}:${tier}`;
  if (content.PLAN_TEMPLATES[exact]) return exact;
  if (tier === 'red') return 'red';
  return `default:${tier}`;
}

function buildPlan(type, tier) {
  const template = content.PLAN_TEMPLATES[templateKey(type, tier)] || content.PLAN_TEMPLATES.red;
  return {
    templateKey: templateKey(type, tier),
    milestones: template.map((t, i) => {
      const est = knowledge.costEstimate(type, t.category, t.amount);
      return {
        id: 'ms_' + (i + 1),
        order: i + 1,
        category: t.category,
        title: t.title,
        detail: t.detail,
        criteria: t.criteria,
        amount: est.amount,
        estimate: { basis: est.basis, n: est.n, template: t.amount },
        status: 'open',
        evidence: [],
        verification: null,
        approval: null,
        payout: null
      };
    })
  };
}

async function assess(answers, photos) {
  const rule = safety.ruleAssessment(answers);
  let aiOut;
  let aiError = null;
  try {
    aiOut = await ai.classify(answers, photos);
  } catch (err) {
    aiError = err.message;
    aiOut = { source: 'unavailable', type: rule.type, tier: 'red', confidence: 0, observations: [], reasoning: { en: 'AI analysis was unavailable, so the most cautious tier applies until it can run.', es: 'El análisis con IA no estuvo disponible, así que se aplica el nivel más cauteloso hasta que pueda ejecutarse.' }, followUp: [] };
  }
  const combined = safety.combine(rule, aiOut);
  const type = answers.domain === 'infrastructure' ? 'structural_damage'
    : answers.domain === 'community' ? rule.type
    : rule.type === 'chemical_unknown' ? 'chemical_unknown' : (aiOut.type && aiOut.type !== 'unknown' && aiOut.type !== 'structural_damage' ? aiOut.type : rule.type);
  return {
    type,
    tier: combined.tier,
    ruleFloor: rule.floor,
    flags: rule.flags,
    emergency: rule.emergency,
    aiTier: aiOut.tier,
    confidence: aiOut.confidence,
    source: aiOut.source,
    aiError,
    observations: aiOut.observations,
    reasoning: aiOut.reasoning,
    notes: combined.notes,
    followUp: safety.filterQuestions(aiOut.followUp, combined.tier),
    at: new Date().toISOString()
  };
}

function clean(s, max = 500) {
  return String(s == null ? '' : s).slice(0, max);
}

// Free text that is stored: emails and phone numbers are removed (privacy).
function text(s, max = 500) {
  return privacy.redactContacts(clean(s, max));
}

function sanitizeAnswers(a) {
  a = a || {};
  const arr = v => (Array.isArray(v) ? v : v ? [v] : []).map(x => clean(x, 40)).slice(0, 12);
  return {
    observations: arr(a.observations),
    safeDistance: clean(a.safeDistance, 10),
    symptoms: arr(a.symptoms),
    smell: clean(a.smell, 20),
    affected: clean(a.affected, 20),
    containers: clean(a.containers, 10),
    description: text(a.description, 2000),
    helpers: Math.max(0, Math.min(500, Number(a.helpers) || 0)),
    tools: clean(a.tools, 300),
    placeLabel: clean(a.placeLabel, 200),
    country: clean(a.country, 2).toUpperCase(),
    domain: ['infrastructure', 'community'].includes(a.domain) ? a.domain : 'environment',
    category: clean(a.category, 30),
    urgency: clean(a.urgency, 12),
    hazardous: clean(a.hazardous, 10),
    propertyType: clean(a.propertyType, 20),
    jurisdiction: clean(a.jurisdiction, 10),
    region: /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(String(a.region || '')) ? a.region : '',
    builtYear: Number(a.builtYear) >= 1800 && Number(a.builtYear) <= 2100 ? Number(a.builtYear) : null,
    developerSelling: clean(a.developerSelling, 10),
    builderPatched: clean(a.builderPatched, 10),
    sameDefectElsewhere: clean(a.sameDefectElsewhere, 12),
    boughtFromBuilder: clean(a.boughtFromBuilder, 10),
    injuries: clean(a.injuries, 10),
    movement: clean(a.movement, 10),
    crackWidth: clean(a.crackWidth, 10),
    crackGrowing: a.crackGrowing === true
  };
}

// ---------------------------------------------------------------------------
// Config and reference data
// ---------------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    aiLive: config.aiLive,
    paypalLive: config.paypalLive,
    paypalClientId: config.paypalLive ? config.paypalClientId : null,
    currency: config.currency,
    typeLabels: content.TYPE_LABELS,
    protocols: content.PROTOCOLS,
    protocolIcons: content.PROTOCOL_ICONS,
    protocolReview: content.PROTOCOL_REVIEW,
    protocolsInfra: content.PROTOCOLS_INFRA,
    protocolIconsInfra: content.PROTOCOL_ICONS_INFRA,
    allowedCategoriesInfra: safety.INFRA_CATEGORIES,
    protocolsCommunity: content.PROTOCOLS_COMMUNITY,
    specialSteps: content.SPECIAL_STEPS,
    protocolIconsCommunity: content.PROTOCOL_ICONS_COMMUNITY,
    communityCategories: communityContent.CATEGORIES,
    allowedCategoriesCommunity: safety.COMMUNITY_CATEGORIES,
    countries: Object.entries(costs.COUNTRIES).map(([code, c]) => ({ code, name: c.name, currency: c.currency })),
    costItems: Object.fromEntries(Object.entries(costs.ITEMS).map(([id, it]) => [id, it.label])),
    localLanguages: content.LOCAL_LANGUAGES,
    interpreterFee: content.INTERPRETER_FEE,
    allowedCategories: { green: safety.allowedCategories('green'), yellow: safety.allowedCategories('yellow'), red: safety.allowedCategories('red') },
    staleDays: knowledge.STALE_DAYS,
    allowReset: config.allowReset
  });
});

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------
// Reports are private: there is no public list. A browser asks only for the
// reports whose keys it holds.
app.post('/api/incidents/mine', (req, res) => {
  const owned = Array.isArray(req.body && req.body.owned) ? req.body.owned.slice(0, 200) : [];
  const all = store.get().incidents;
  const out = [];
  for (const o of owned) {
    const inc = all.find(i => i.id === String(o && o.id));
    if (inc && privacy.keyMatches(inc, o.key)) out.push(publicIncident(inc));
  }
  res.json(out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
});

// Every other /api/incidents/:id route needs the owner key.
app.use('/api/incidents/:id', (req, res, next) => {
  const inc = store.get().incidents.find(i => i.id === req.params.id);
  // Same answer for "does not exist" and "not yours", so ids cannot be probed.
  if (!inc || !privacy.keyMatches(inc, req.get('X-Owner-Key'))) return res.status(404).json({ error: 'Report not found, or this device does not have its access code.' });
  next();
});

app.get('/api/incidents/:id', wrap(async (req, res) => {
  res.json(publicIncident(findIncident(req.params.id)));
}));

app.post('/api/incidents', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.consent !== true) fail('Consent is required before a report can be saved.');
  const answers = sanitizeAnswers(b.answers);
  const photos = (b.photos || []).slice(0, 6).map(p => media.saveImage(p, clean(p.role, 20)));
  const voice = b.voiceDataUrl ? media.saveAudio(b.voiceDataUrl) : null;
  const assessment = await assess(answers, photos);
  const incident = {
    id: store.newId('inc'),
    createdAt: new Date().toISOString(),
    lang: b.lang === 'es' ? 'es' : 'en',
    domain: answers.domain,
    anonymous: b.anonymous !== false,
    // Anonymous statistics: counted unless the person turns it off.
    statsOptIn: b.statsOptIn !== false,
    reporter: b.anonymous === false ? { name: clean(b.reporterName, 80) } : null,
    location: { label: answers.placeLabel, country: answers.country, lat: Number(b.lat) || null, lng: Number(b.lng) || null },
    answers,
    photos,
    voice,
    assessment,
    tierHistory: [{ tier: assessment.tier, at: assessment.at, reason: 'initial_assessment' }],
    plan: buildPlan(assessment.type, assessment.tier),
    remediation: null,
    help: null,
    interpreters: [],
    disputes: [],
    followUpAnswers: [],
    monitoring: [],
    reports: []
  };
  const ownerKey = privacy.newKey();
  incident.ownerKeyHash = privacy.sha256(ownerKey);
  store.get().incidents.push(incident);
  store.save();
  store.appendEvent('incident_created', incident.id, {
    answersHash: store.sha256(store.canonical(answers)),
    photos: photos.map(p => ({ id: p.id, sha256: p.sha256, role: p.role })),
    voice: voice ? { id: voice.id, sha256: voice.sha256 } : null,
    tier: assessment.tier, ruleFloor: assessment.ruleFloor, type: assessment.type, aiSource: assessment.source
  });
  // The key is returned only here, once. The browser keeps it.
  res.status(201).json({ ...publicIncident(incident), ownerKey });
}));

// The owner can turn anonymous statistics on or off at any time.
app.post('/api/incidents/:id/stats-optin', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  inc.statsOptIn = req.body.optIn !== false;
  store.save();
  store.appendEvent('stats_choice', inc.id, { optIn: inc.statsOptIn });
  res.json(publicIncident(inc));
}));

app.post('/api/incidents/:id/followup', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const items = (req.body.answers || []).slice(0, 5).map(x => ({ q: clean(x.q, 300), a: text(x.a, 1000) }));
  inc.followUpAnswers = (inc.followUpAnswers || []).concat(items.map(x => ({ ...x, at: new Date().toISOString() })));
  // Answers can only raise the tier (hazard words), never lower it.
  const extra = items.map(x => x.a).join(' ');
  const rule = safety.ruleAssessment({ ...inc.answers, description: inc.answers.description + ' ' + extra });
  if (safety.rank(rule.floor) > safety.rank(inc.assessment.tier)) {
    inc.assessment.tier = rule.floor;
    inc.assessment.flags = [...new Set([...(inc.assessment.flags || []), ...rule.flags])];
    inc.tierHistory.push({ tier: rule.floor, at: new Date().toISOString(), reason: 'follow_up_answers' });
    inc.plan = buildPlan(inc.assessment.type, inc.assessment.tier);
    store.appendEvent('tier_changed', inc.id, { tier: rule.floor, reason: 'follow_up_answers' });
  }
  store.save();
  store.appendEvent('follow_up_answered', inc.id, { count: items.length, hash: store.sha256(store.canonical(items)) });
  res.json(publicIncident(inc));
}));

app.post('/api/incidents/:id/reassess', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const answers = sanitizeAnswers({ ...inc.answers, ...(req.body.answers || {}) });
  const newPhotos = (req.body.photos || []).slice(0, 6).map(p => media.saveImage(p, clean(p.role || 'reassess', 20)));
  const next = await assess(answers, newPhotos.length ? newPhotos : inc.photos);
  const check = safety.canChangeTier(inc.assessment.tier, next.tier, newPhotos.length);
  inc.photos = inc.photos.concat(newPhotos);
  if (!check.allowed) {
    store.save();
    store.appendEvent('reassessment_blocked', inc.id, { proposed: next.tier, reason: check.reason });
    return res.status(409).json({ error: 'A lower tier needs new photo evidence. Add a new photo and try again.', code: check.reason, incident: publicIncident(inc) });
  }
  const changed = next.tier !== inc.assessment.tier;
  inc.answers = answers;
  inc.assessment = next;
  if (changed) {
    inc.tierHistory.push({ tier: next.tier, at: next.at, reason: 'reassessment_with_new_evidence' });
    inc.plan = buildPlan(next.type, next.tier);
  }
  store.save();
  store.appendEvent('reassessed', inc.id, { tier: next.tier, changed, photos: newPhotos.map(p => p.sha256) });
  res.json(publicIncident(inc));
}));

app.post('/api/incidents/:id/dispute', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const note = text(req.body.note, 1000);
  inc.disputes.push({ note, at: new Date().toISOString() });
  store.save();
  store.appendEvent('dispute_logged', inc.id, { noteHash: store.sha256(note) });
  res.json({ ok: true, message: 'Your disagreement is recorded. The tier only changes with new photo evidence.' });
}));

// ---------------------------------------------------------------------------
// Finders
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/remediation', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const { type, tier } = inc.assessment;
  let liveAdded = 0;
  let dropped = 0;
  let error = null;
  try {
    const live = await ai.remediation(inc);
    dropped = live.dropped;
    liveAdded = knowledge.addFindings('methods', live.methods);
  } catch (err) {
    error = err.message;
  }
  inc.remediation = { methods: knowledge.methodsFor(type, tier), liveAdded, dropped, error, at: new Date().toISOString(), mode: config.aiLive ? 'live' : 'demo' };
  store.save();
  res.json(inc.remediation);
}));

app.post('/api/incidents/:id/help', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  let liveAdded = 0;
  let dropped = 0;
  let error = null;
  try {
    const live = await ai.helpFinder(inc);
    dropped = live.dropped;
    liveAdded = knowledge.addFindings('orgs', live.orgs.map(o => ({ ...o, domains: [inc.domain || 'environment'] })));
  } catch (err) {
    error = err.message;
  }
  const order = ['immediate', 'authority', 'health', 'international', 'legal', 'science', 'funding', 'language', 'media'];
  const orgs = knowledge.orgsFor(inc.answers.country, inc.domain, inc.answers.placeLabel).sort((a, b) => order.indexOf(a.urgency) - order.indexOf(b.urgency));
  inc.help = { orgs, liveAdded, dropped, error, at: new Date().toISOString(), mode: config.aiLive ? 'live' : 'demo' };
  store.save();
  res.json(inc.help);
}));

app.post('/api/incidents/:id/draft', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const orgs = knowledge.orgsFor(inc.answers.country, inc.domain, inc.answers.placeLabel);
  const org = orgs.find(o => o.id === req.body.orgId) || orgs[0];
  const lang = clean(req.body.lang || inc.lang, 5);
  const text = await ai.draftMessage(inc, org, lang);
  res.json({ text, org: org && org.name });
}));

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/plan', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  if ((inc.plan.milestones || []).some(m => m.status !== 'open')) fail('The plan can no longer change: work on a milestone has already started.');
  const proposed = (req.body.milestones || []).slice(0, 8).map((m, i) => ({
    id: 'ms_' + (i + 1), order: i + 1,
    category: clean(m.category, 20),
    title: { en: clean(m.title && (m.title.en || m.title), 140), es: clean(m.title && (m.title.es || m.title.en || m.title), 140) },
    detail: { en: clean(m.detail && (m.detail.en || m.detail), 400), es: clean(m.detail && (m.detail.es || m.detail.en || m.detail), 400) },
    criteria: { en: clean(m.criteria && (m.criteria.en || m.criteria), 400), es: clean(m.criteria && (m.criteria.es || m.criteria.en || m.criteria), 400) },
    amount: round2(Number(m.amount)),
    estimate: { basis: 'edited', n: 0 },
    status: 'open', evidence: [], verification: null, approval: null, payout: null
  }));
  const errors = safety.validateMilestones(inc.assessment.tier, proposed, inc.domain);
  if (errors.length) return res.status(400).json({ error: errors.join(' '), errors });
  inc.plan = { templateKey: 'edited', milestones: proposed };
  store.save();
  store.appendEvent('plan_set', inc.id, { milestones: proposed.map(m => ({ id: m.id, category: m.category, amount: m.amount })) });
  res.json(publicIncident(inc));
}));

// ---------------------------------------------------------------------------
// Donations (PayPal Orders v2)
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/donations/order', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const label = (content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown).en;
  const order = await paypal.createDonationOrder({ incidentId: inc.id, amount: req.body.amount, description: `Community response fund: ${label} (${inc.id})` });
  store.get().transactions.push({
    id: store.newId('tx'), incidentId: inc.id, kind: 'donation', amount: Number(order.amount), currency: config.currency,
    status: 'CREATED', paypalOrderId: order.id, simulated: order.simulated, counterparty: 'Donor', createdAt: new Date().toISOString()
  });
  store.save();
  res.json({ id: order.id, simulated: order.simulated });
}));

app.post('/api/incidents/:id/donations/capture', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const tx = store.get().transactions.find(t => t.paypalOrderId === req.body.orderId && t.incidentId === inc.id && t.kind === 'donation');
  if (!tx) fail('Donation order not found for this incident.', 404);
  if (tx.status === 'COMPLETED') return res.json({ transaction: tx, fund: fundOf(inc.id) });
  const cap = await paypal.captureDonationOrder(tx.paypalOrderId, tx.amount);
  if (!cap.simulated && cap.customId && cap.customId !== inc.id) fail('Captured payment belongs to a different incident.');
  Object.assign(tx, {
    status: cap.status, captureId: cap.captureId, amount: Number(cap.amount || tx.amount),
    counterparty: cap.payer || 'Donor', completedAt: new Date().toISOString()
  });
  const event = store.appendEvent('donation_captured', inc.id, { orderId: tx.paypalOrderId, captureId: tx.captureId, amount: tx.amount, simulated: tx.simulated });
  tx.eventHash = event.hash;
  store.save();
  res.json({ transaction: tx, fund: fundOf(inc.id) });
}));

// ---------------------------------------------------------------------------
// Milestones: evidence → AI verification → human approval → PayPal payout
// ---------------------------------------------------------------------------
function findMilestone(inc, mid) {
  const m = (inc.plan.milestones || []).find(x => x.id === mid);
  if (!m) fail('Milestone not found.', 404);
  return m;
}

app.post('/api/incidents/:id/milestones/:mid/evidence', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const m = findMilestone(inc, req.params.mid);
  if (m.status === 'paid') fail('This milestone is already paid.');
  if (!safety.allowedCategories(inc.assessment.tier, inc.domain).includes(m.category)) fail(`A ${inc.assessment.tier} incident cannot fund "${m.category}".`);
  const order = inc.plan.milestones.indexOf(m);
  const previousOpen = inc.plan.milestones.slice(0, order).find(x => x.status !== 'paid');
  if (previousOpen) fail('Complete the earlier milestones first.');
  const photos = (req.body.photos || []).slice(0, 4).map(p => media.saveImage(p, 'evidence'));
  if (!photos.length) fail('Add at least one evidence photo.');
  m.evidence = photos;
  const before = inc.photos.find(p => p.role === 'wide') || inc.photos[0];
  let v;
  try {
    v = await ai.verifyMilestone(m, before, photos, inc.lang);
  } catch (err) {
    v = { source: 'unavailable', decision: 'needs_review', confidence: 0, reasoning: { en: 'AI verification was unavailable; a human verifier must review the photos.', es: 'La verificación con IA no estuvo disponible; una persona verificadora debe revisar las fotos.' }, error: err.message };
  }
  m.verification = { ...v, at: new Date().toISOString() };
  m.status = v.decision === 'pass' ? 'verified' : v.decision === 'fail' ? 'rejected' : 'needs_review';
  store.save();
  store.appendEvent('milestone_verification', inc.id, { milestone: m.id, decision: v.decision, confidence: v.confidence, source: v.source, photos: photos.map(p => p.sha256) });
  res.json(publicIncident(inc));
}));

app.post('/api/incidents/:id/milestones/:mid/approve', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const m = findMilestone(inc, req.params.mid);
  const approver = { name: clean(req.body.approver && req.body.approver.name, 80), email: clean(req.body.approver && req.body.approver.email, 120) };
  const recipient = { name: clean(req.body.recipient && req.body.recipient.name, 80), email: clean(req.body.recipient && req.body.recipient.email, 120) };
  const fund = fundOf(inc.id);
  const reasons = safety.payoutCheck({ incident: inc, milestone: m, approver, recipient, available: fund.available });
  if (m.verification && m.verification.decision === 'needs_review' && req.body.reviewedPhotos !== true) {
    reasons.push('This milestone needs human review: confirm you checked the photos yourself.');
  }
  if (reasons.length) return res.status(400).json({ error: reasons.join(' '), reasons });
  const payout = await paypal.sendPayout({
    senderItemId: `${inc.id}-${m.id}`,
    email: recipient.email,
    amount: m.amount,
    subject: 'Community response payment released',
    note: `${m.title.en} — verified and approved by ${approver.name}. Incident ${inc.id}.`
  });
  m.approval = { by: approver.name, at: new Date().toISOString(), reviewedPhotos: req.body.reviewedPhotos === true };
  m.payout = { ...payout, recipientName: recipient.name, at: new Date().toISOString() };
  m.status = 'paid';
  const tx = {
    id: store.newId('tx'), incidentId: inc.id, kind: 'payout', amount: Number(payout.amount), currency: config.currency,
    status: payout.status || 'PENDING', paypalBatchId: payout.batchId, simulated: payout.simulated,
    counterparty: recipient.name || recipient.email, milestoneId: m.id, purpose: m.title.en, approvedBy: approver.name, createdAt: new Date().toISOString()
  };
  const event = store.appendEvent('payout_sent', inc.id, { milestone: m.id, amount: tx.amount, batchId: tx.paypalBatchId, approvedBy: approver.name, simulated: tx.simulated });
  tx.eventHash = event.hash;
  store.get().transactions.push(tx);
  store.save();
  knowledge.recordOutcome({
    incidentId: inc.id, type: inc.assessment.type, category: m.category,
    estimated: m.estimate && m.estimate.template, actual: m.amount,
    methodIds: (inc.remediation && inc.remediation.methods || []).slice(0, 3).map(x => x.id)
  });
  res.json(publicIncident(inc));
}));

app.post('/api/incidents/:id/rate', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const count = knowledge.rateOutcome(inc.id, clean(req.body.rating, 10), (req.body.methodIds || []).map(x => clean(x, 40)));
  inc.rating = { rating: clean(req.body.rating, 10), at: new Date().toISOString() };
  store.save();
  store.appendEvent('outcome_rated', inc.id, { rating: inc.rating.rating, milestones: count });
  res.json({ ok: true, rated: count });
}));

// ---------------------------------------------------------------------------
// Community interpreters (local and Indigenous languages)
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/interpreters', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const b = req.body || {};
  if (b.consent !== true) fail('The interpreter must consent to sharing the recording publicly.');
  const language = clean(b.language, 60);
  if (!language) fail('Name the language and variant of the recording.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || ''))) fail('A valid PayPal email is required to pay the interpreter.');
  const recording = media.saveAudio(b.audioDataUrl);
  const entry = {
    id: store.newId('itp'), name: clean(b.name, 80), email: clean(b.email, 120), language, tier: clean(b.tier || inc.assessment.tier, 10),
    recording, status: 'pending', fee: content.INTERPRETER_FEE, at: new Date().toISOString()
  };
  inc.interpreters.push(entry);
  store.save();
  store.appendEvent('interpreter_recording', inc.id, { interpreter: entry.id, language, sha256: recording.sha256 });
  res.status(201).json(publicIncident(inc));
}));

app.post('/api/incidents/:id/interpreters/:iid/approve', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const entry = (inc.interpreters || []).find(x => x.id === req.params.iid);
  if (!entry) fail('Recording not found.', 404);
  if (entry.status === 'paid') fail('This interpreter was already paid.');
  const approver = { name: clean(req.body.approver && req.body.approver.name, 80), email: clean(req.body.approver && req.body.approver.email, 120) };
  if (!approver.name) fail('A named reviewer must approve the recording.');
  if (approver.email && approver.email.toLowerCase() === entry.email.toLowerCase()) fail('The reviewer cannot approve their own recording.');
  const fund = fundOf(inc.id);
  if (entry.fee > fund.available + 1e-9) fail(`Only ${fund.available.toFixed(2)} USD is available in this incident's fund.`);
  const payout = await paypal.sendPayout({
    senderItemId: `${inc.id}-${entry.id}`, email: entry.email, amount: entry.fee,
    subject: 'Interpreter payment', note: `Safety protocol recording in ${entry.language}, approved by ${approver.name}.`
  });
  entry.status = 'paid';
  entry.approval = { by: approver.name, at: new Date().toISOString() };
  entry.payout = payout;
  const event = store.appendEvent('interpreter_paid', inc.id, { interpreter: entry.id, amount: entry.fee, batchId: payout.batchId, approvedBy: approver.name, simulated: payout.simulated });
  store.get().transactions.push({
    id: store.newId('tx'), incidentId: inc.id, kind: 'payout', amount: entry.fee, currency: config.currency, status: payout.status,
    paypalBatchId: payout.batchId, simulated: payout.simulated, counterparty: entry.name || 'Interpreter', purpose: `Interpreter: ${entry.language}`,
    approvedBy: approver.name, eventHash: event.hash, createdAt: new Date().toISOString()
  });
  store.save();
  res.json(publicIncident(inc));
}));

// ---------------------------------------------------------------------------
// Fundraising agent (PayPal Agent Toolkit + Claude). Requests money, never sends it.
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/sponsor', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const m = findMilestone(inc, clean(req.body.milestoneId, 20));
  const sponsor = { name: clean(req.body.sponsor && req.body.sponsor.name, 120), email: clean(req.body.sponsor && req.body.sponsor.email, 120) };
  if (!sponsor.name) fail('Enter the sponsor name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sponsor.email)) fail('Enter a valid sponsor email.');
  if (m.status === 'paid') fail('This milestone is already paid.');
  inc.sponsorships = inc.sponsorships || [];
  if (inc.sponsorships.some(sp => sp.milestoneId === m.id && ['SENT', 'PAID'].includes(sp.status))) fail('This milestone already has an open sponsor invoice.');
  const sponsorshipId = store.newId('sp');
  const label = content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown;
  const lang = req.body.lang === 'es' ? 'es' : 'en';
  const ctx = {
    sponsorshipId, incidentId: inc.id, milestoneId: m.id, milestoneTitle: m.title[lang] || m.title.en, criteria: m.criteria[lang] || m.criteria.en,
    maxAmount: Number(m.amount), sponsor, tier: inc.assessment.tier, problem: label[lang], place: inc.answers.placeLabel || inc.id, fund: fundOf(inc.id), lang
  };
  const origin = `${req.protocol}://${req.get('host')}`;
  const run = await agent.runFundraisingAgent(ctx, origin);
  const sp = {
    id: sponsorshipId, milestoneId: m.id, sponsor, amount: run.amount, invoiceId: run.invoiceId, payLink: run.payLink, qr: run.qr,
    status: 'SENT', simulated: run.simulated, log: run.log, summary: run.summary, at: new Date().toISOString(), requestedBy: clean(req.body.requestedBy, 80)
  };
  inc.sponsorships.push(sp);
  store.save();
  store.appendEvent('sponsor_invoice_sent', inc.id, { sponsorship: sp.id, milestone: m.id, amount: sp.amount, invoiceId: sp.invoiceId, simulated: sp.simulated, agentSteps: run.log.length });
  res.status(201).json(publicIncident(inc));
}));

app.post('/api/incidents/:id/sponsor/:sid/check', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const sp = (inc.sponsorships || []).find(x => x.id === req.params.sid);
  if (!sp) fail('Sponsorship not found.', 404);
  if (sp.status === 'PAID') return res.json(publicIncident(inc));
  const r = await agent.checkInvoice(sp, req.body.simulatePaid === true);
  sp.status = r.status;
  sp.checkedAt = new Date().toISOString();
  if (['PAID', 'MARKED_AS_PAID'].includes(r.status) && r.paid > 0) {
    sp.status = 'PAID';
    const event = store.appendEvent('sponsor_paid', inc.id, { sponsorship: sp.id, invoiceId: sp.invoiceId, amount: r.paid, simulated: r.simulated });
    store.get().transactions.push({
      id: store.newId('tx'), incidentId: inc.id, kind: 'donation', amount: Number(r.paid), currency: config.currency, status: 'COMPLETED',
      paypalInvoiceId: sp.invoiceId, simulated: r.simulated, counterparty: sp.sponsor.name, purpose: 'Sponsor invoice: ' + sp.milestoneId,
      eventHash: event.hash, createdAt: new Date().toISOString(), completedAt: new Date().toISOString()
    });
  }
  store.save();
  res.json(publicIncident(inc));
}));

// ---------------------------------------------------------------------------
// Report to the right institution: who to contact, in what order, how, and
// the follow-up dates each report starts. Works for both domains.
// ---------------------------------------------------------------------------
const CHANNEL_OF_ORG = { immediate: 'phone', authority: 'official_channel', health: 'read', international: 'email', legal: 'email', science: 'email', funding: 'email', language: 'email', media: 'email' };

function communityTargets(inc) {
  const a = inc.answers;
  const austin = /austin/i.test(a.placeLabel || '') && (a.country === 'US' || !a.country);
  const texas = austin || a.jurisdiction === 'US-TX' || /\b(tx|texas)\b/i.test(a.placeLabel || '');
  const r = a.category === 'rental_repairs' ? responsibility.analyze({ ...a, propertyType: 'rental', jurisdiction: texas ? 'US-TX' : a.jurisdiction }) : null;
  const targets = communityContent.channelsFor(a.category, { austin, texas, emergency: inc.assessment.emergency, tier: inc.assessment.tier })
    .map(c => ({ ...c, method: c.kind === 'phone' || c.kind === 'info' ? 'phone' : c.kind === 'landlord' ? letters.CHANNELS.landlord.method : (austin ? 'austin_311' : 'official_channel') }));
  return { responsibility: r, targets: targets.sort((x, y) => x.order - y.order) };
}

function guidanceFor(inc) {
  const list = laws.list();
  return Object.fromEntries((inc.reports || []).filter(r => r.status === 'answered' && r.responseType).map(r => [r.id, responses.guidance(inc, r.responseType, list)]));
}

function reportTargets(inc) {
  if (inc.domain === 'community') return communityTargets(inc);
  if (inc.domain === 'infrastructure') {
    const r = responsibility.analyze(inc.answers);
    const order = { association: 1, landlord: 1, builder: 2, city: 3 };
    const targets = r.parties.filter(p => p.letter).map(p => ({
      id: p.id, kind: p.letter, name: p.role, why: p.duty, basis: p.basis,
      method: letters.CHANNELS[p.letter].method, order: order[p.letter] || 4,
      url: p.letter === 'city' && /austin/i.test(inc.answers.placeLabel || '') ? 'https://www.austintexas.gov/department/code-compliance-resources' : null
    }));
    if (inc.assessment.emergency) targets.unshift({ id: 'emergency', kind: 'phone', name: { en: 'Emergency services (911)', es: 'Emergencias (911)' }, why: { en: 'Someone was seriously injured.', es: 'Alguien resultó gravemente lesionado.' }, basis: [], method: 'phone', order: 0 });
    return { responsibility: r, targets: targets.sort((a, b) => a.order - b.order) };
  }
  const orgs = knowledge.orgsFor(inc.answers.country, inc.domain, inc.answers.placeLabel).filter(o => ['immediate', 'authority', 'international', 'legal'].includes(o.urgency));
  const rank = { immediate: 0, authority: 1, legal: 2, international: 3 };
  const targets = orgs.filter(o => o.urgency !== 'immediate' || inc.assessment.emergency || inc.assessment.tier === 'red').map(o => ({
    id: o.id, kind: 'org', name: o.name, why: o.why, contact: o.contact, basis: o.source ? [{ title: o.source.title, url: o.source.url }] : [],
    confidence: o.confidence, method: CHANNEL_OF_ORG[o.urgency] || 'email', order: rank[o.urgency] ?? 5, url: o.source && o.source.url
  }));
  return { responsibility: null, targets: targets.sort((a, b) => a.order - b.order) };
}

// What an answer means and a reply draft (lib/responses.js).
app.post('/api/incidents/:id/reports/:rid/reply-draft', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const r = (inc.reports || []).find(x => x.id === req.params.rid);
  if (!r) fail('Report not found.', 404);
  const lang = req.body.lang === 'es' ? 'es' : 'en';
  const sender = { name: clean(req.body.sender && req.body.sender.name, 80), unit: clean(req.body.sender && req.body.sender.unit, 160) };
  res.json(responses.draft(inc, r, lang, sender));
}));

// Escalation when nobody answers (lib/escalation.js).
app.get('/api/incidents/:id/escalation', wrap(async (req, res) => {
  res.json(escalation.forIncident(findIncident(req.params.id)));
}));

app.post('/api/incidents/:id/escalation-draft', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const b = req.body || {};
  const lang = b.lang === 'es' ? 'es' : 'en';
  const sender = { name: clean(b.sender && b.sender.name, 80), contact: clean(b.sender && b.sender.contact, 120) };
  const d = escalation.draft(inc, clean(b.reportId, 40), clean(b.ruleId, 40), lang, sender);
  res.json({ subject: d.subject, body: d.body + support.letterLine(inc, lang), step: d.step });
}));

// Neighbor support link (lib/support.js). The owner creates or turns it off.
app.post('/api/incidents/:id/support-link', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  if (req.body && req.body.off === true) {
    support.revoke(inc);
    store.save();
    store.appendEvent('support_link_off', inc.id, {});
    return res.json(publicIncident(inc));
  }
  const token = support.create(inc);
  store.save();
  store.appendEvent('support_link_created', inc.id, {});
  res.json({ ...publicIncident(inc), supportToken: token });
}));

// Official link for the authority (lib/official.js). The owner creates or turns it off.
app.post('/api/incidents/:id/official-link', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  if (req.body && req.body.off === true) {
    official.revoke(inc);
    store.save();
    store.appendEvent('official_link_off', inc.id, {});
    return res.json(publicIncident(inc));
  }
  const token = official.create(inc);
  store.save();
  store.appendEvent('official_link_created', inc.id, {});
  res.json({ ...publicIncident(inc), officialToken: token });
}));

// Matching funds: the resident asks for the matched amount; the agent sends the
// office a PayPal invoice capped at what is owed.
app.post('/api/incidents/:id/match/request', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const st = match.status(inc, store.get().transactions);
  if (!st || !st.active) fail('There is no active matching pledge.');
  if (!(st.owed > 0)) fail('Nothing to request yet: matching follows community donations.');
  const lang = req.body.lang === 'es' ? 'es' : 'en';
  const id = store.newId('mt');
  const label = content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown;
  const ctx = {
    sponsorshipId: id, incidentId: inc.id, milestoneId: 'match',
    milestoneTitle: lang === 'es' ? `Fondos iguales de ${inc.match.office}` : `Matching funds from ${inc.match.office}`,
    criteria: '', maxAmount: st.owed, sponsor: { name: inc.match.office, email: inc.match.email }, tier: inc.assessment.tier,
    problem: label[lang], place: (inc.location && inc.location.label) || inc.id, fund: fundOf(inc.id), lang
  };
  const run = await agent.runFundraisingAgent(ctx, `${req.protocol}://${req.get('host')}`);
  const inv = { id, amount: run.amount, invoiceId: run.invoiceId, status: 'SENT', simulated: run.simulated, log: run.log, summary: run.summary, at: new Date().toISOString() };
  inc.match.invoices.push(inv);
  store.save();
  store.appendEvent('match_invoice_sent', inc.id, { match: id, amount: inv.amount, invoiceId: inv.invoiceId, simulated: inv.simulated });
  res.status(201).json(publicIncident(inc));
}));

app.post('/api/incidents/:id/match/:mid/check', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const inv = ((inc.match && inc.match.invoices) || []).find(x => x.id === req.params.mid);
  if (!inv) fail('Matching invoice not found.', 404);
  if (inv.status === 'PAID') return res.json(publicIncident(inc));
  const r = await agent.checkInvoice(inv, req.body.simulatePaid === true);
  inv.status = r.status;
  inv.checkedAt = new Date().toISOString();
  if (['PAID', 'MARKED_AS_PAID'].includes(r.status) && r.paid > 0) {
    inv.status = 'PAID';
    const event = store.appendEvent('match_paid', inc.id, { match: inv.id, invoiceId: inv.invoiceId, amount: r.paid, simulated: r.simulated });
    store.get().transactions.push({
      id: store.newId('tx'), incidentId: inc.id, kind: 'donation', amount: Number(r.paid), currency: config.currency, status: 'COMPLETED',
      matchId: inv.id, paypalInvoiceId: inv.invoiceId, simulated: r.simulated, counterparty: inc.match.office, purpose: 'Matching funds',
      eventHash: event.hash, createdAt: new Date().toISOString(), completedAt: new Date().toISOString()
    });
  }
  store.save();
  res.json(publicIncident(inc));
}));

app.get('/api/incidents/:id/report-targets', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  res.json({ ...reportTargets(inc), sent: inc.reports || [], laws: laws.statusByUrl(), legal: jurisdiction.forIncident(inc), escalation: escalation.forIncident(inc), guidance: guidanceFor(inc) });
}));

app.post('/api/incidents/:id/report-draft', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const lang = req.body.lang === 'es' ? 'es' : 'en';
  const kind = clean(req.body.kind, 20);
  // Personal details are used for this draft only and are not stored.
  const sender = { name: clean(req.body.sender && req.body.sender.name, 80), unit: clean(req.body.sender && req.body.sender.unit, 160), contact: clean(req.body.sender && req.body.sender.contact, 120) };
  const recipient = { name: clean(req.body.recipient && req.body.recipient.name, 300) };
  if (kind === 'org') {
    const orgs = knowledge.orgsFor(inc.answers.country, inc.domain, inc.answers.placeLabel);
    const org = orgs.find(o => o.id === req.body.orgId) || orgs[0];
    const text = await ai.draftMessage(inc, org, lang);
    const [first, ...rest] = text.split('\n');
    return res.json({ subject: first.replace(/^(Subject|Asunto):\s*/, ''), body: (rest.join('\n').trim() || text) + support.letterLine(inc, lang) });
  }
  const d = letters.build(kind, inc, lang, sender, recipient);
  res.json({ subject: d.subject.replace(/^(Subject|Asunto):\s*/, ''), body: d.body + support.letterLine(inc, lang) });
}));

app.post('/api/incidents/:id/reports', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const b = req.body || {};
  const kind = clean(b.kind, 20);
  const sentAt = /^\d{4}-\d{2}-\d{2}$/.test(String(b.sentAt || '')) ? b.sentAt : new Date().toISOString().slice(0, 10);
  const entry = {
    id: store.newId('rep'), targetId: clean(b.targetId, 40), kind, targetName: text(b.targetName, 160),
    method: clean(b.method, 30), tracking: clean(b.tracking, 80), sentAt,
    followUps: kind === 'builder' && clean(b.method, 30) !== 'certified_mail' ? letters.followUps('org', sentAt) : letters.followUps(kind, sentAt), status: 'sent', at: new Date().toISOString()
  };
  inc.reports = inc.reports || [];
  inc.reports.push(entry);
  store.save();
  store.appendEvent('report_sent', inc.id, { report: entry.id, target: entry.targetName, method: entry.method, tracking: entry.tracking, sentAt });
  res.status(201).json({ ...reportTargets(inc), sent: inc.reports, laws: laws.statusByUrl(), legal: jurisdiction.forIncident(inc), escalation: escalation.forIncident(inc), guidance: guidanceFor(inc) });
}));

app.post('/api/incidents/:id/reports/:rid/response', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const r = (inc.reports || []).find(x => x.id === req.params.rid);
  if (!r) fail('Report not found.', 404);
  r.status = ['answered', 'resolved', 'no_answer'].includes(req.body.status) ? req.body.status : 'answered';
  r.responseNote = text(req.body.note, 1000);
  if (r.status === 'answered') {
    r.responseType = responses.TYPES.includes(req.body.responseType) ? req.body.responseType : 'other';
    r.responder = text(req.body.responder, 120);
  }
  r.responseAt = new Date().toISOString();
  store.save();
  store.appendEvent('report_response', inc.id, { report: r.id, status: r.status, responseType: r.responseType || null, noteHash: store.sha256(r.responseNote) });
  res.json({ ...reportTargets(inc), sent: inc.reports, laws: laws.statusByUrl(), legal: jurisdiction.forIncident(inc), escalation: escalation.forIncident(inc), guidance: guidanceFor(inc) });
}));

// ---------------------------------------------------------------------------
// One-page case summary in the chosen language
// ---------------------------------------------------------------------------
app.get('/api/incidents/:id/summary', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const lang = summary.LANGS.includes(req.query.lang) ? req.query.lang : 'en';
  const base = lang === 'es' ? 'es' : 'en';
  const { targets, responsibility: resp } = reportTargets(inc);
  const cost = inc.domain === 'infrastructure' ? costs.estimate(inc.answers, inc.assessment.flags, inc.assessment.tier, knowledge.quotes()) : null;
  let out = summary.build({ inc, targets, resp, sent: inc.reports || [], cost, fund: fundOf(inc.id), chain: store.verifyChain(), lang, base, legal: jurisdiction.forIncident(inc) });
  let translation = lang === base ? 'original' : 'unavailable';
  if (lang !== base && config.aiLive) {
    try { out = await ai.translateSummary(out, lang); translation = 'machine'; } catch (err) { translation = 'failed'; }
  }
  res.json({ ...out, translation, aiLive: config.aiLive });
}));

// ---------------------------------------------------------------------------
// Approximate repair cost by country or community (infrastructure).
// ---------------------------------------------------------------------------
app.get('/api/incidents/:id/cost', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  if (inc.domain !== 'infrastructure') fail('Repair cost estimates are for building and infrastructure reports.');
  const est = costs.estimate(inc.answers, inc.assessment.flags, inc.assessment.tier, knowledge.quotes());
  res.json({ ...est, quotes: (inc.quotes || []) });
}));

app.post('/api/incidents/:id/quotes', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  const item = clean(req.body.item, 30);
  if (!costs.ITEMS[item]) fail('Choose which repair the quote is for.');
  const amount = Number(req.body.amount);
  if (!(amount > 0)) fail('Enter the quoted amount.');
  const currency = clean(req.body.currency || 'USD', 3).toUpperCase();
  const usd = costs.toUsd(amount, currency);
  if (!usd) fail('Currency not supported yet.');
  const factor = costs.locationFactor(inc.answers);
  const q = { item, amount, currency, usd: Math.round(usd * 100) / 100, provider: text(req.body.provider, 120), country: factor.code || 'XX', incidentId: inc.id };
  knowledge.addQuote(q);
  inc.quotes = inc.quotes || [];
  inc.quotes.push({ ...q, at: new Date().toISOString() });
  store.save();
  store.appendEvent('quote_recorded', inc.id, { item, amount, currency, provider: q.provider });
  const est = costs.estimate(inc.answers, inc.assessment.flags, inc.assessment.tier, knowledge.quotes());
  res.status(201).json({ ...est, quotes: inc.quotes });
}));

// ---------------------------------------------------------------------------
// Crack monitoring: dated photos with width; growth raises the tier.
// ---------------------------------------------------------------------------
app.post('/api/incidents/:id/monitor', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  if (inc.domain !== 'infrastructure') fail('Monitoring is for building and infrastructure reports.');
  const width = Number(req.body.widthMm);
  if (!(width >= 0 && width <= 200)) fail('Enter the crack width in millimeters.');
  const photo = req.body.photo ? media.saveImage(req.body.photo, 'monitor') : null;
  inc.monitoring = inc.monitoring || [];
  inc.monitoring.push({ at: new Date().toISOString(), widthMm: Math.round(width * 10) / 10, note: text(req.body.note, 300), photo });
  const widths = inc.monitoring.map(m => m.widthMm);
  const growing = widths.length >= 2 && widths[widths.length - 1] - widths[0] >= 0.5;
  inc.answers.crackWidth = width > 3 ? 'over3' : width >= 1 ? '1to3' : inc.answers.crackWidth;
  inc.answers.crackGrowing = growing || inc.answers.crackGrowing;
  const rule = safety.ruleAssessment(inc.answers);
  if (safety.rank(rule.floor) > safety.rank(inc.assessment.tier)) {
    inc.assessment.tier = rule.floor;
    inc.tierHistory.push({ tier: rule.floor, at: new Date().toISOString(), reason: 'crack_monitoring' });
    inc.plan = buildPlan(inc.assessment.type, inc.assessment.tier);
    store.appendEvent('tier_changed', inc.id, { tier: rule.floor, reason: 'crack_monitoring' });
  }
  inc.assessment.flags = [...new Set([...(inc.assessment.flags || []), ...rule.flags])];
  store.save();
  store.appendEvent('crack_measured', inc.id, { widthMm: width, growing, photo: photo && photo.sha256 });
  res.status(201).json(publicIncident(inc));
}));

// ---------------------------------------------------------------------------
// Impact summary for the home page
// ---------------------------------------------------------------------------
app.get('/api/impact', (req, res) => {
  const d = store.get();
  const incidents = d.incidents;
  const milestones = incidents.flatMap(i => (i.plan && i.plan.milestones) || []);
  const paid = milestones.filter(m => m.status === 'paid');
  const tx = d.transactions.filter(t => t.status !== 'CREATED');
  const recordings = incidents.flatMap(i => i.interpreters || []);
  res.json({
    incidents: incidents.length,
    byTier: { green: incidents.filter(i => i.assessment.tier === 'green').length, yellow: incidents.filter(i => i.assessment.tier === 'yellow').length, red: incidents.filter(i => i.assessment.tier === 'red').length },
    volunteers: incidents.reduce((s, i) => s + (Number(i.answers.helpers) || 0), 0),
    raised: round2(tx.filter(t => t.kind === 'donation').reduce((s, t) => s + Number(t.amount), 0)),
    paidOut: round2(tx.filter(t => t.kind === 'payout').reduce((s, t) => s + Number(t.amount), 0)),
    milestonesPaid: paid.length,
    verifiedByAI: paid.filter(m => m.verification && m.verification.decision === 'pass').length,
    humanReviewed: paid.filter(m => m.verification && m.verification.decision === 'needs_review').length,
    rejectedEvidence: d.events.filter(e => e.type === 'milestone_verification' && e.data.decision === 'fail').length,
    protocolLanguages: Object.keys(content.PROTOCOLS).length,
    localRecordings: recordings.length,
    sponsors: incidents.flatMap(i => i.sponsorships || []).length,
    chain: store.verifyChain()
  });
});

// One click for judges: a completed sargassum response and an escalated chemical report.
app.post('/api/demo/seed', wrap(async (req, res) => {
  const base = `http://127.0.0.1:${app.locals.port || config.port}`;
  const keys = {};
  const call = async (path, body) => {
    const id = (/^\/api\/incidents\/([^/]+)/.exec(path) || [])[1];
    const headers = { 'Content-Type': 'application/json', 'X-Example-Seed': config.seedSecret };
    if (id && keys[id]) headers['X-Owner-Key'] = keys[id];
    const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'seed step failed');
    if (j.ownerKey) keys[j.id] = j.ownerKey;
    return j;
  };
  const a = await call('/api/incidents', { consent: true, lang: 'es', answers: { observations: ['sargassum_rotting'], safeDistance: 'yes', symptoms: ['eyes'], smell: 'rotten_egg', affected: 'none', containers: 'no', description: 'Sargassum piling up for three days near homes.', helpers: 8, placeLabel: 'Mahahual, Quintana Roo (example)', country: 'MX' }, photos: [{ role: 'wide', sampleId: 'A_before' }] });
  await call(`/api/incidents/${a.id}/remediation`);
  await call(`/api/incidents/${a.id}/help`);
  const order = await call(`/api/incidents/${a.id}/donations/order`, { amount: 900 });
  await call(`/api/incidents/${a.id}/donations/capture`, { orderId: order.id });
  const sp = await call(`/api/incidents/${a.id}/sponsor`, { milestoneId: 'ms_3', sponsor: { name: 'Cooperativa Pesquera (example)', email: 'coop@example.com' }, lang: 'es' });
  await call(`/api/incidents/${a.id}/sponsor/${sp.sponsorships[0].id}/check`, { simulatePaid: true });
  const steps = [['ms_1', 'A_ppe', 'Ferretería del Puerto (example)', 'ferreteria@example.com'], ['ms_2', 'A_after_good', 'Brigada Mahahual (example)', 'brigada@example.com'], ['ms_3', 'A_truck', 'Transportes (example)', 'transportes@example.com']];
  for (const [mid, sample, name, email] of steps) {
    await call(`/api/incidents/${a.id}/milestones/${mid}/evidence`, { photos: [{ sampleId: sample }] });
    await call(`/api/incidents/${a.id}/milestones/${mid}/approve`, { approver: { name: 'Community verifier (example)', email: 'verifier@example.com' }, recipient: { name, email }, reviewedPhotos: true });
  }
  await call(`/api/incidents/${a.id}/rate`, { rating: 'worked' });
  const b = await call('/api/incidents', { consent: true, lang: 'es', answers: { observations: ['foam_color', 'containers'], safeDistance: 'yes', symptoms: ['throat'], smell: 'chemical', affected: 'few_animals', containers: 'yes', description: 'White foam below a pipe, two drums on the bank.', placeLabel: 'River bank, central Mexico (example)', country: 'MX' }, photos: [{ role: 'wide', sampleId: 'B_river' }] });
  await call(`/api/incidents/${b.id}/help`);
  // Two more short sargassum reports so the anonymous statistics have enough data to show.
  const more = [];
  for (const [place, lat, lng] of [['Playa Paraíso, Tulum, Quintana Roo (example)', 20.2185, -87.4335], ['Playa del Carmen, Quintana Roo (example)', 20.6296, -87.0739]]) {
    const r = await call('/api/incidents', { consent: true, lang: 'es', lat, lng, answers: { observations: ['sargassum_rotting'], safeDistance: 'yes', symptoms: ['none'], smell: 'rotten_egg', affected: 'none', containers: 'no', description: 'Sargassum on the beach (example).', placeLabel: place, country: 'MX' }, photos: [{ role: 'wide', sampleId: 'A_before' }] });
    more.push(r.id);
  }
  const ids = [a.id, b.id, ...more];
  res.json({ ok: true, incidents: ids, owned: ids.map(id => ({ id, key: keys[id] })) });
}));

// ---------------------------------------------------------------------------
// Ledger and evidence
// ---------------------------------------------------------------------------
app.get('/api/ledger', (req, res) => {
  const incidents = store.get().incidents;
  const rows = store.get().transactions.filter(t => t.status !== 'CREATED').map(t => {
    const inc = incidents.find(i => i.id === t.incidentId);
    // Public page: no place, description or report id; donors stay anonymous and
    // the people paid or approving show as initials only.
    const { incidentId, paypalOrderId, ...pub } = t;
    return {
      ...pub,
      incidentLabel: inc ? (content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown).en : '',
      incidentType: inc ? inc.assessment.type : null,
      // Public institutions that match funds are named; people stay anonymous or as initials.
      counterparty: t.matchId ? t.counterparty : t.kind === 'donation' ? 'Donor' : privacy.initials(t.counterparty),
      approvedBy: t.approvedBy ? privacy.initials(t.approvedBy) : undefined,
      tier: inc && inc.assessment.tier
    };
  }).reverse();
  res.json(rows);
});

app.get('/api/incidents/:id/evidence', wrap(async (req, res) => {
  const inc = findIncident(req.params.id);
  res.json({
    incident: publicIncident(inc),
    events: store.get().events.filter(e => e.incidentId === inc.id),
    chain: store.verifyChain(),
    generatedAt: new Date().toISOString()
  });
}));

app.get('/api/chain', (req, res) => res.json(store.verifyChain()));

// Authority side of the official link: the report the person chose to share.
function officialView(inc) {
  const p = publicIncident(inc);
  const { support: sp, official: of, sponsorships, interpreters, followUpAnswers, ...rest } = p;
  return {
    ...rest,
    reporter: inc.anonymous ? null : p.reporter,
    support: sp ? { confirmed: sp.confirmed, cosigned: sp.cosigned } : null,
    updates: (inc.official && inc.official.updates) || [],
    legal: jurisdiction.forIncident(inc),
    events: store.get().events.filter(e => e.incidentId === inc.id).map(e => ({ seq: e.seq, at: e.at, type: e.type, hash: e.hash })),
    chain: store.verifyChain()
  };
}

app.get('/api/official/:token', (req, res) => {
  const inc = official.findByToken(store.get().incidents, req.params.token);
  if (!inc) return res.status(404).json({ error: 'This link is not active.' });
  res.json(officialView(inc));
});

// The office pledges matching funds through its official link.
app.post('/api/official/:token/match', wrap(async (req, res) => {
  const inc = official.findByToken(store.get().incidents, req.params.token);
  if (!inc) return res.status(404).json({ error: 'This link is not active.' });
  const m = match.pledge(inc, req.body);
  store.save();
  store.appendEvent('match_pledged', inc.id, { office: m.office, cap: m.cap, ratio: m.ratio });
  res.status(201).json(officialView(inc));
}));

app.post('/api/official/:token', wrap(async (req, res) => {
  const inc = official.findByToken(store.get().incidents, req.params.token);
  if (!inc) return res.status(404).json({ error: 'This link is not active.' });
  if (supportLimited('off:' + req.params.token)) return res.status(429).json({ error: 'Too many updates in a short time. Try again later.' });
  const u = official.update(inc, req.body);
  store.save();
  store.appendEvent('official_update', inc.id, { status: u.status, office: u.office, caseNumber: u.caseNumber, eta: u.eta, forwardedTo: u.forwardedTo, noteHash: store.sha256(u.note) });
  res.status(201).json(officialView(inc));
}));

// Public side of the neighbor support link: limited view, no personal data.
const supportHits = new Map();
function supportLimited(token) {
  const now = Date.now();
  const list = (supportHits.get(token) || []).filter(t => now - t < 10 * 60 * 1000);
  list.push(now);
  supportHits.set(token, list);
  return list.length > 30;
}

app.get('/api/support/:token', (req, res) => {
  const inc = support.findByToken(store.get().incidents, req.params.token);
  if (!inc) return res.status(404).json({ error: 'This link is not active.' });
  res.json(support.publicView(inc, hazard.forIncident(inc)));
});

app.post('/api/support/:token', wrap(async (req, res) => {
  const inc = support.findByToken(store.get().incidents, req.params.token);
  if (!inc) return res.status(404).json({ error: 'This link is not active.' });
  if (supportLimited(req.params.token)) return res.status(429).json({ error: 'Too many answers in a short time. Try again later.' });
  const c = support.add(inc, req.body);
  store.save();
  store.appendEvent('neighbor_support', inc.id, { kind: req.body && req.body.kind === 'cosign' ? 'cosign' : 'confirm', total: c.confirmed });
  res.status(201).json(support.publicView(inc, hazard.forIncident(inc)));
}));

// ---------------------------------------------------------------------------
// Anonymous community statistics (see lib/stats.js for the privacy rules)
// ---------------------------------------------------------------------------
function statsData() {
  const d = store.get();
  return { incidents: d.incidents, transactions: d.transactions, outcomes: knowledge._kb().outcomes };
}

app.get('/api/stats', (req, res) => {
  res.json(stats.build(statsData(), req.query));
});

app.get('/api/stats.csv', (req, res) => {
  const s = stats.build(statsData(), req.query);
  const countryName = code => (costs.COUNTRIES[code] && costs.COUNTRIES[code].name && costs.COUNTRIES[code].name.en) || code;
  const label = (sec, key) => {
    if (key === 'other') return 'Other (small groups combined)';
    if (sec === 'byType') return (content.TYPE_LABELS[key] || {}).en || key;
    if (sec === 'byCountry') return countryName(key);
    if (sec === 'byCategory') return (communityContent.LABELS && communityContent.LABELS[key] && communityContent.LABELS[key].en) || key;
    return key;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="comunidad-fuerte-statistics.csv"');
  res.send(stats.toCsv(s, label));
});

// ---------------------------------------------------------------------------
// Living knowledge base
// ---------------------------------------------------------------------------
app.get('/api/knowledge', (req, res) => res.json(knowledge.summary()));

// Law and contact watch
// Laws that govern the app itself (privacy) for a country and state.
app.get('/api/legal/app', (req, res) => {
  const country = /^[A-Za-z]{2}$/.test(String(req.query.country || '')) ? String(req.query.country).toUpperCase() : '';
  const state = /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(String(req.query.state || '')) ? req.query.state : '';
  res.json(jurisdiction.appCompliance(country, state));
});

app.get('/api/laws', (req, res) => res.json({ rules: laws.list(), aiLive: config.aiLive }));
app.post('/api/laws/:id/verify', wrap(async (req, res) => {
  res.json(laws.markVerified(clean(req.params.id, 40), clean(req.body.reviewer, 80), clean(req.body.note, 500)));
}));
app.post('/api/laws/:id/check', wrap(async (req, res) => {
  if (!config.aiLive) fail('A live check needs the Claude key. In demo mode, a reviewer can re-check the page by hand.');
  res.json(await laws.checkOne(ai, clean(req.params.id, 40)));
}));
app.post('/api/laws/changes', wrap(async (req, res) => {
  const b = req.body || {};
  if (!String(b.note || '').trim()) fail('Describe what changed and where you saw it.');
  res.status(201).json(laws.proposeChange(clean(b.lawId, 40), { note: clean(b.note, 1000), sourceUrl: clean(b.sourceUrl, 300), by: clean(b.by, 80) || 'community member' }));
}));
app.post('/api/laws/changes/:id', wrap(async (req, res) => {
  res.json(laws.resolveChange(clean(req.params.id, 40), clean(req.body.decision, 10), clean(req.body.reviewer, 80), clean(req.body.note, 500)));
}));

app.post('/api/knowledge/refresh', wrap(async (req, res) => {
  res.json(await knowledge.refresh(ai));
}));

app.post('/api/knowledge/review', wrap(async (req, res) => {
  const b = req.body || {};
  res.json(knowledge.review(b.kind === 'orgs' ? 'orgs' : 'methods', clean(b.id, 40), clean(b.decision, 10), clean(b.reviewer, 80)));
}));

app.post('/api/feedback', wrap(async (req, res) => {
  res.status(201).json(knowledge.suggest({ target: clean(req.body.target, 120), text: req.body.text, by: clean(req.body.by, 80) }));
}));

app.post('/api/feedback/:id/resolve', wrap(async (req, res) => {
  res.json(knowledge.resolveSuggestion(req.params.id, clean(req.body.decision, 10), clean(req.body.reviewer, 80), clean(req.body.note, 500)));
}));

// ---------------------------------------------------------------------------
// Demo utilities
// ---------------------------------------------------------------------------
app.post('/api/demo/reset', wrap(async (req, res) => {
  if (!config.allowReset) fail('Clearing all records is turned off on this server.', 403);
  if (config.paypalLive && req.body.confirm !== 'RESET') fail('Type RESET to confirm clearing all records.');
  store.reset();
  knowledge.reset();
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Scheduled knowledge refresh (live AI only). Set KNOWLEDGE_REFRESH_HOURS=0 to disable.
const refreshHours = Number(process.env.KNOWLEDGE_REFRESH_HOURS || 24);
if (config.aiLive && refreshHours > 0) {
  setInterval(() => knowledge.refresh(ai).catch(err => console.error('Knowledge refresh failed:', err.message)), refreshHours * 3600 * 1000).unref();
}

if (require.main === module) {
  const server = app.listen(config.port, () => {
    app.locals.port = server.address().port;
    console.log(`Comunidad Fuerte running at http://localhost:${config.port}`);
    console.log(`AI: ${config.aiLive ? 'LIVE (Claude ' + config.claudeModel + ')' : 'DEMO (rule-based, no key)'} | PayPal: ${config.paypalLive ? 'SANDBOX (live API calls)' : 'SIMULATED (no keys)'}`);
  });
}

module.exports = app;
