'use strict';
// Unit tests: safety rules, evidence chain, metadata stripping, source
// verification, and the learning loop. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-unit-'));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.PAYPAL_CLIENT_ID;

const safety = require('../lib/safety');
const store = require('../lib/store');
const media = require('../lib/media');
const ai = require('../lib/ai');
const knowledge = require('../lib/knowledge');

test('rule floor: drums or chemical smell are always Red', () => {
  assert.strictEqual(safety.ruleAssessment({ observations: ['containers'] }).floor, 'red');
  assert.strictEqual(safety.ruleAssessment({ observations: ['plastic'], smell: 'chemical' }).floor, 'red');
  assert.strictEqual(safety.ruleAssessment({ observations: ['plastic'], description: 'hay un tambo tirado' }).floor, 'red');
});

test('rule floor: rotting sargassum is Yellow, fresh sargassum with no signs is Green', () => {
  assert.strictEqual(safety.ruleAssessment({ observations: ['sargassum_rotting'], smell: 'rotten_egg' }).floor, 'yellow');
  assert.strictEqual(safety.ruleAssessment({ observations: ['sargassum_fresh'], symptoms: ['none'], smell: 'none', affected: 'none' }).floor, 'green');
});

test('breathing difficulty flags an emergency', () => {
  const r = safety.ruleAssessment({ observations: ['sargassum_rotting'], symptoms: ['breathing'] });
  assert.strictEqual(r.floor, 'red');
  assert.strictEqual(r.emergency, true);
});

test('AI can raise but never lower the tier', () => {
  const rule = { floor: 'red', flags: [] };
  assert.strictEqual(safety.combine(rule, { tier: 'green', confidence: 0.99 }).tier, 'red');
  const rule2 = { floor: 'green', flags: [] };
  assert.strictEqual(safety.combine(rule2, { tier: 'yellow', confidence: 0.9 }).tier, 'yellow');
});

test('low AI confidence moves the tier up one level', () => {
  const r = safety.combine({ floor: 'green', flags: [] }, { tier: 'green', confidence: 0.3 });
  assert.strictEqual(r.tier, 'yellow');
  assert.ok(r.notes.includes('low_confidence_bumped_up'));
});

test('a lower tier requires new photo evidence', () => {
  assert.strictEqual(safety.canChangeTier('red', 'yellow', 0).allowed, false);
  assert.strictEqual(safety.canChangeTier('red', 'yellow', 1).allowed, true);
  assert.strictEqual(safety.canChangeTier('yellow', 'red', 0).allowed, true);
});

test('Red incidents cannot fund cleanup; Yellow must start with PPE', () => {
  const red = safety.validateMilestones('red', [{ category: 'labor', amount: 100 }]);
  assert.ok(red.length && /not allowed/.test(red[0]));
  const yellow = safety.validateMilestones('yellow', [{ category: 'labor', amount: 100 }, { category: 'ppe', amount: 50 }]);
  assert.ok(yellow.some(e => /PPE/.test(e)));
  assert.deepStrictEqual(safety.validateMilestones('yellow', [{ category: 'ppe', amount: 50 }, { category: 'labor', amount: 100 }]), []);
});

test('payout gate: verification, named approver, no self-payment, enough funds', () => {
  const incident = { assessment: { tier: 'yellow' } };
  const milestone = { category: 'ppe', amount: 100, status: 'verified', verification: { decision: 'pass' } };
  const ok = safety.payoutCheck({ incident, milestone, approver: { name: 'Ana', email: 'a@x.org' }, recipient: { email: 'b@x.org' }, available: 200 });
  assert.deepStrictEqual(ok, []);
  const self = safety.payoutCheck({ incident, milestone, approver: { name: 'Ana', email: 'a@x.org' }, recipient: { email: 'A@x.org' }, available: 200 });
  assert.ok(self.some(r => /themselves/.test(r)));
  const broke = safety.payoutCheck({ incident, milestone, approver: { name: 'Ana' }, recipient: { email: 'b@x.org' }, available: 50 });
  assert.ok(broke.some(r => /available/.test(r)));
  const unverified = safety.payoutCheck({ incident, milestone: { ...milestone, verification: { decision: 'fail' } }, approver: { name: 'Ana' }, recipient: { email: 'b@x.org' }, available: 500 });
  assert.ok(unverified.some(r => /verification/.test(r)));
});

test('questions asking to approach a Red hazard are removed', () => {
  const out = safety.filterQuestions([{ en: 'Can you get closer to read the label?' }, { en: 'Is anyone pregnant nearby?' }], 'red');
  assert.strictEqual(out.length, 1);
});

test('hash chain detects tampering', () => {
  store.load();
  store.appendEvent('a', null, { n: 1 });
  store.appendEvent('b', null, { n: 2 });
  assert.strictEqual(store.verifyChain().ok, true);
  store.get().events[0].data.n = 99;
  const v = store.verifyChain();
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.brokenAt, 1);
  store.reset();
});

test('JPEG EXIF (APP1) is removed from public copies', () => {
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x10]), Buffer.from('Exif\0\0GPSDATA!')]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, app0, sos]);
  const out = media.stripJpeg(jpg);
  assert.ok(!out.includes(Buffer.from('GPSDATA')));
  assert.ok(out.includes(Buffer.from([0xff, 0xe0])));
  assert.ok(out.includes(Buffer.from([0xff, 0xda])));
});

test('live search results without a retrieved source are discarded; unconfirmed phones are masked', () => {
  const resp = {
    content: [
      { type: 'web_search_tool_result', content: [{ url: 'https://www.epa.gov/real-page/' }] },
      { type: 'text', text: 'x', citations: [{ url: 'https://www.epa.gov/real-page', cited_text: 'Call 1-800-424-8802 to report.' }] }
    ]
  };
  const items = [
    { name: { en: 'Real' }, contact: { en: 'Call 1-800-424-8802 or 555-123-4567' }, source: { url: 'https://epa.gov/real-page' } },
    { name: { en: 'Invented' }, source: { url: 'https://made-up.example/org' } }
  ];
  const { kept, dropped } = ai.verifyAgainstSources(items, ai.retrievedSources(resp));
  assert.strictEqual(kept.length, 1);
  assert.strictEqual(dropped, 1);
  assert.ok(kept[0].contact.en.includes('1-800-424-8802'));
  assert.ok(kept[0].contact.en.includes('[number not confirmed]'));
});

test('extractJson reads fenced and bare JSON', () => {
  assert.deepStrictEqual(ai.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(ai.extractJson('Here: [1,2]'), [1, 2]);
  assert.strictEqual(ai.extractJson('no json'), null);
});

test('learning: cost estimate moves to the median of real costs after 3 outcomes', () => {
  knowledge.reset();
  assert.strictEqual(knowledge.costEstimate('sargassum', 'ppe', 240).basis, 'template');
  for (const actual of [200, 300, 260]) knowledge.recordOutcome({ incidentId: 'i' + actual, type: 'sargassum', category: 'ppe', estimated: 240, actual });
  const est = knowledge.costEstimate('sargassum', 'ppe', 240);
  assert.strictEqual(est.basis, 'community_data');
  assert.strictEqual(est.amount, 260);
});

test('learning: methods with better community results rank first', () => {
  knowledge.reset();
  knowledge.recordOutcome({ incidentId: 'x1', type: 'sargassum', category: 'labor', actual: 100, methodIds: ['sarg-forecast'] });
  knowledge.rateOutcome('x1', 'worked', ['sarg-forecast']);
  const list = knowledge.methodsFor('sargassum', 'yellow');
  assert.strictEqual(list[0].id, 'sarg-forecast');
});

test('knowledge: new findings wait for review and need a named reviewer', () => {
  knowledge.reset();
  const added = knowledge.addFindings('methods', [{ title: { en: 'New method' }, types: ['oil'], tiers: ['yellow'], source: { url: 'https://example.org/new', checked: '2026-10-17' } }]);
  assert.strictEqual(added, 1);
  const pending = knowledge.summary().pendingMethods;
  assert.strictEqual(pending.length, 1);
  assert.throws(() => knowledge.review('methods', pending[0].id, 'approved', ''), /reviewer/);
  knowledge.review('methods', pending[0].id, 'approved', 'Ana');
  assert.strictEqual(knowledge.summary().pendingMethods.length, 0);
  assert.strictEqual(knowledge.addFindings('methods', [{ title: { en: 'dup' }, types: ['oil'], tiers: ['yellow'], source: { url: 'https://example.org/new/', checked: '2026-10-18' } }]), 0);
});

test('every curated method and sourced organization has a URL and a check date', () => {
  const content = require('../lib/content');
  for (const m of content.REMEDIATION) {
    assert.ok(m.source && /^https:\/\//.test(m.source.url), m.id);
    assert.ok(m.source.checked, m.id);
  }
  for (const o of content.ORGS) {
    if (o.source) assert.ok(/^https:\/\//.test(o.source.url), o.id);
    else assert.strictEqual(o.confidence, 'not_confirmed', o.id);
  }
});

test('all 10 protocol languages have 5 steps per tier', () => {
  const content = require('../lib/content');
  const langs = Object.keys(content.PROTOCOLS);
  assert.strictEqual(langs.length, 10);
  for (const l of langs) for (const tier of ['green', 'yellow', 'red']) {
    assert.strictEqual(content.PROTOCOLS[l][tier].steps.length, 5, `${l} ${tier}`);
    assert.ok(content.PROTOCOLS[l][tier].title, `${l} ${tier} title`);
  }
});

// ---------------------------------------------------------------------------
// Fundraising agent (PayPal Agent Toolkit + Claude tool use)
// ---------------------------------------------------------------------------
const agent = require('../lib/agent');
const config = require('../lib/config');

function agentCtx(over) {
  return { sponsorshipId: 'sp_1', incidentId: 'inc_1', milestoneId: 'ms_2', milestoneTitle: 'Clear 400 m of beach', criteria: 'photos', maxAmount: 640,
    sponsor: { name: 'Coop', email: 'coop@example.com' }, tier: 'yellow', problem: 'Sargassum', place: 'Mahahual', fund: { raised: 0 }, lang: 'en', ...over };
}
const invoiceArgs = (email, value) => ({ currency_code: 'USD', primary_recipients: [{ billing_info: { email_address: email } }], items: [{ name: 'x', quantity: '1', unit_amount: { currency_code: 'USD', value } }] });

test('agent policy: only the entered sponsor, only up to the milestone amount, only its own invoice', () => {
  const ctx = agentCtx();
  assert.strictEqual(agent.policyCheck('create_invoice', invoiceArgs('other@example.com', '100.00'), ctx).ok, false);
  assert.strictEqual(agent.policyCheck('create_invoice', invoiceArgs('coop@example.com', '900.00'), ctx).ok, false);
  const good = agent.policyCheck('create_invoice', invoiceArgs('COOP@example.com', '640.00'), ctx);
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.args.reference, 'inc_1/ms_2');
  assert.strictEqual(agent.policyCheck('send_invoice', { invoice_id: 'INV2-OTHER' }, { ...ctx, invoiceId: 'INV2-MINE' }).ok, false);
  assert.strictEqual(agent.policyCheck('create_refund', {}, ctx).ok, false);
  assert.strictEqual(agent.policyCheck('send_invoice', { invoice_id: 'INV2-MINE', additional_recipients: ['x@y.z'] }, { ...ctx, invoiceId: 'INV2-MINE' }).args.additional_recipients, undefined);
});

test('agent demo run creates a QR and a simulated invoice within policy', async () => {
  const r = await agent.runFundraisingAgent(agentCtx(), 'http://localhost:3000');
  assert.strictEqual(r.simulated, true);
  assert.ok(r.qr.startsWith('data:image/png;base64,'));
  assert.strictEqual(r.amount, 640);
  assert.deepStrictEqual(r.log.map(l => l.tool), ['get_fund_status', 'create_invoice', 'send_invoice', 'generate_invoice_qr_code']);
});

test('agent live loop: Claude tool calls run through the Agent Toolkit, blocked calls are reported back', async () => {
  const saved = { aiLive: config.aiLive, paypalLive: config.paypalLive, anthropicKey: config.anthropicKey };
  const realFetch = global.fetch;
  Object.assign(config, { aiLive: true, paypalLive: true, anthropicKey: 'k' });
  const executed = [];
  agent.setToolkitForTests({
    getTools: () => ['create_invoice', 'send_invoice', 'generate_invoice_qr_code', 'get_invoice', 'list_invoices'].map(n => ({ type: 'function', function: { name: n, description: n, parameters: { type: 'object', properties: {} } } })),
    handleToolCall: async call => {
      executed.push(call.function.name);
      if (call.function.name === 'create_invoice') return { content: JSON.stringify({ rel: 'self', href: 'https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-ABCD-1234' }) };
      return { content: JSON.stringify({ ok: true }) };
    }
  });
  const turns = [
    // 1) tries to over-invoice (blocked), 2) correct invoice, 3) send + QR, 4) done
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'create_invoice', input: invoiceArgs('coop@example.com', '5000.00') }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'create_invoice', input: invoiceArgs('coop@example.com', '640.00') }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't3', name: 'send_invoice', input: { invoice_id: 'INV2-ABCD-1234' } }, { type: 'tool_use', id: 't4', name: 'generate_invoice_qr_code', input: { invoice_id: 'INV2-ABCD-1234' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Invoice sent.' }] }
  ];
  const sentBodies = [];
  global.fetch = async (url, opts) => { sentBodies.push(JSON.parse(opts.body)); return { ok: true, json: async () => turns.shift() }; };
  try {
    const r = await agent.runFundraisingAgent(agentCtx(), 'http://localhost');
    assert.strictEqual(r.invoiceId, 'INV2-ABCD-1234');
    assert.strictEqual(r.amount, 640);
    assert.ok(r.log[0].blocked, 'over-limit invoice blocked');
    assert.deepStrictEqual(executed, ['create_invoice', 'send_invoice', 'generate_invoice_qr_code']);
    assert.ok(r.payLink.includes('INV2-ABCD-1234'));
    assert.ok(sentBodies[0].tools.some(tl => tl.name === 'create_invoice' && tl.input_schema), 'toolkit tools converted to Claude format');
    const blockedResult = sentBodies[1].messages.at(-1).content[0];
    assert.strictEqual(blockedResult.is_error, true);
  } finally {
    global.fetch = realFetch;
    Object.assign(config, saved);
    agent.setToolkitForTests(null);
  }
});

// ---------------------------------------------------------------------------
// Building and infrastructure hazards, responsibility and formal reports
// ---------------------------------------------------------------------------
const responsibility = require('../lib/responsibility');
const letters = require('../lib/letters');

const stairs = { domain: 'infrastructure', observations: ['crack_anchor', 'rust_stain', 'gap_trip'], crackWidth: '1to3', injuries: 'none', movement: 'unsure',
  propertyType: 'condo_common', jurisdiction: 'US-TX', builtYear: 2020, developerSelling: 'yes', placeLabel: 'Entrance stairs, Austin, TX', country: 'US' };

test('infrastructure rules: crack at anchor is Yellow; a moving railing or serious injury is Red', () => {
  assert.strictEqual(safety.ruleAssessment(stairs).floor, 'yellow');
  assert.strictEqual(safety.ruleAssessment({ ...stairs, movement: 'yes' }).floor, 'red');
  const hurt = safety.ruleAssessment({ ...stairs, injuries: 'serious' });
  assert.strictEqual(hurt.floor, 'red');
  assert.strictEqual(hurt.emergency, true);
  assert.strictEqual(safety.ruleAssessment({ domain: 'infrastructure', observations: ['crack'], crackWidth: 'hairline' }).floor, 'green');
  assert.strictEqual(safety.ruleAssessment({ domain: 'infrastructure', observations: ['crack'], crackGrowing: true }).floor, 'yellow');
});

test('infrastructure funding: evidence, barriers and pressure only, never DIY repair labor', () => {
  assert.ok(!safety.allowedCategories('yellow', 'infrastructure').includes('labor'));
  assert.deepStrictEqual(safety.validateMilestones('yellow', [{ category: 'engineering', amount: 800 }], 'infrastructure'), []);
  assert.ok(safety.validateMilestones('green', [{ category: 'labor', amount: 100 }], 'infrastructure').length);
});

test('never ask to push or lean on a damaged railing', () => {
  const out = safety.filterQuestions([{ en: 'Can you push the railing to see if it moves?' }, { es: '¿Puedes recargarte en el barandal?' }, { en: 'When did you first notice it?' }], 'yellow');
  assert.strictEqual(out.length, 1);
});

test('responsibility (Texas condo common area): association, builder, city; declarant warning; 10-year deadline', () => {
  const r = responsibility.analyze(stairs);
  assert.deepStrictEqual(r.parties.map(p => p.id), ['association', 'builder', 'city']);
  assert.ok(r.parties.find(p => p.id === 'city').role.en.includes('Austin'));
  assert.ok(r.warnings.some(w => w.en.includes('120 days after 75%')));
  assert.strictEqual(r.deadlines[0].year, 2030);
  assert.ok(r.parties.every(p => p.basis.every(b => /^https:\/\//.test(b.url))));
});

test('responsibility (Texas rental): landlord duty under § 92.052', () => {
  const r = responsibility.analyze({ ...stairs, propertyType: 'rental' });
  assert.strictEqual(r.parties[0].id, 'landlord');
  assert.ok(r.parties[0].basis[0].url.includes('92.052'));
});

test('responsibility outside Texas gives a general guide without Texas citations', () => {
  const r = responsibility.analyze({ ...stairs, jurisdiction: 'MX', placeLabel: 'Guadalajara' });
  assert.strictEqual(r.jurisdiction, 'general');
  assert.ok(r.parties.every(p => p.basis.length === 0));
});

test('letters: builder notice cites Chapter 27, certified mail, lists defects and photo fingerprints', () => {
  const inc = { id: 'inc_x', createdAt: '2026-10-18T12:00:00Z', answers: stairs, photos: [{ at: '2026-10-18T12:00:00Z', sha256: 'abc123' }],
    assessment: { tier: 'yellow', flags: ['crack_at_railing_anchor', 'rust_from_embedded_steel'] }, monitoring: [{ at: '2026-10-18T12:00:00Z', widthMm: 2 }] };
  const b = letters.build('builder', inc, 'en', { name: 'Resident' }, {});
  assert.ok(b.subject.includes('27.004'));
  assert.ok(b.body.includes('CERTIFIED MAIL'));
  assert.ok(b.body.includes('base plate of the handrail'));
  assert.ok(b.body.includes('SHA-256 abc123'));
  assert.ok(b.body.includes('2 mm'));
  const a = letters.build('association', inc, 'es', {}, {});
  assert.ok(a.body.includes('[Tu nombre]'));
  assert.ok(a.body.includes('declarante'));
  const f = letters.followUps('builder', '2026-10-19');
  assert.deepStrictEqual(f.map(x => x.date), ['2026-11-23', '2026-12-18']);
});

// ---------------------------------------------------------------------------
// Repair cost by place
// ---------------------------------------------------------------------------
const costs = require('../lib/costs');
const stairFlags = ['crack_at_railing_anchor', 'rust_from_embedded_steel', 'gap_or_trip_hazard'];

test('cost items follow the reported signs; engineer only from Yellow up', () => {
  assert.deepStrictEqual(costs.itemsFor(['crack_1_to_3mm'], 'green'), ['seal_cracks']);
  const y = costs.itemsFor(stairFlags, 'yellow');
  assert.strictEqual(y[0], 'engineer');
  assert.ok(y.includes('handrail') && y.includes('patch') && y.includes('leveling'));
  assert.ok(costs.itemsFor(['crack_growing'], 'yellow').includes('replace_step'));
});

test('cost by place: Austin uses BEA price parity; Mexico scales labor only and shows pesos', () => {
  const austin = costs.estimate({ country: 'US', jurisdiction: 'US-TX', placeLabel: 'Austin, TX' }, stairFlags, 'yellow', []);
  assert.strictEqual(austin.factor.kind, 'rpp');
  assert.strictEqual(austin.currency, 'USD');
  const us = 800 + 100 + 200 + 700 + 650 + 400;
  assert.ok(Math.abs(austin.totalUsd - us * 0.98066) <= 3);
  const mx = costs.estimate({ country: 'MX', jurisdiction: 'MX' }, stairFlags, 'yellow', []);
  const pl = 10.328951 / 19.2375083333333;
  const expected = 800 * pl + (us - 800) * (0.8 * pl + 0.2);
  assert.ok(Math.abs(mx.totalUsd - expected) <= 3, `${mx.totalUsd} vs ${expected}`);
  assert.strictEqual(mx.currency, 'MXN');
  assert.ok(mx.totalLocal > mx.totalUsd * 15);
  assert.strictEqual(mx.lowUsd, Math.round(mx.totalUsd * 0.7));
});

test('cost: 3 or more real local quotes replace the formula for that item', () => {
  const quotes = [100, 140, 120].map(usd => ({ item: 'seal_cracks', usd, country: 'MX' }));
  const e = costs.estimate({ country: 'MX' }, ['crack_1_to_3mm'], 'green', quotes);
  assert.strictEqual(e.items[0].usd, 120);
  assert.strictEqual(e.items[0].basis.kind, 'community');
  assert.strictEqual(Math.round(costs.toUsd(1923.75083333333, 'MXN')), 100);
});

test('cost: unknown country falls back to US averages and says so', () => {
  const e = costs.estimate({ country: 'XX' }, ['crack_1_to_3mm'], 'green', []);
  assert.strictEqual(e.factor.kind, 'unknown');
  assert.strictEqual(e.items[0].usd, 100);
});

test('summary: headings and safety steps follow the chosen language; case text stays in base language', () => {
  const summary = require('../lib/summary');
  const { PROTOCOLS_INFRA } = require('../lib/content-infra');
  const inc = { id: 'inc_test', domain: 'infrastructure', createdAt: '2026-10-01T00:00:00Z', location: { label: 'Austin, TX' },
    answers: { jurisdiction: 'us-tx', propertyType: 'condo_common', builtYear: 2020 }, photos: [{ sha256: 'abc' }], monitoring: [], reports: [],
    assessment: { tier: 'yellow', type: 'structural_damage', flags: ['crack'], confidence: 0.8, summary: { en: 'Cracked stairs.', es: 'Escalera agrietada.' } } };
  const args = { inc, targets: [], sent: [], cost: null, fund: { raised: 0, paid: 0, available: 0, milestones: [] }, chain: { ok: true, length: 3 } };
  for (const lang of summary.LANGS) {
    const out = summary.build({ ...args, lang, base: lang === 'es' ? 'es' : 'en' });
    assert.strictEqual(out.lang, lang);
    assert.strictEqual(out.sections[0].title, summary.HEAD[lang].risk);
    const todo = out.sections.find(s => s.id === 'todo');
    assert.deepStrictEqual(todo.items, (PROTOCOLS_INFRA[lang] || PROTOCOLS_INFRA.en).yellow.steps);
  }
  assert.strictEqual(summary.build({ ...args, lang: 'ar', base: 'en' }).dir, 'rtl');
});

test('responsibility verdict: builder pays and association acts when signs point to a construction defect', () => {
  const r = require('../lib/responsibility');
  const base = { jurisdiction: 'US-TX', propertyType: 'condo_common', builtYear: 2020, placeLabel: 'Austin, TX' };
  const strong = r.verdictFor({ ...base, builderPatched: 'yes', sameDefectElsewhere: 'same_hoa' }, 'condo_common', true, 2020, 2026);
  assert.strictEqual(strong.strength, 'strong');
  assert.match(strong.pays.en, /builder or developer, because the evidence points to a construction defect/);
  assert.match(strong.acts.en, /association/);
  assert.match(strong.acts.en, /both buildings/);
  assert.strictEqual(strong.reasons.length, 3);
  assert.match(strong.cautions[0].en, /builder already patched it/);
  const possible = r.verdictFor(base, 'condo_common', true, 2020, 2026);
  assert.strictEqual(possible.strength, 'possible');
  assert.match(possible.pays.en, /if the damage is a construction defect/);
  const expired = r.verdictFor({ ...base, builtYear: 2012 }, 'condo_common', true, 2012, 2026);
  assert.strictEqual(expired.strength, 'expired');
  assert.strictEqual(r.verdictFor(base, 'rental', true, 2020, 2026), null);
  assert.strictEqual(r.verdictFor(base, 'condo_common', false, 2020, 2026), null);
});

test('letters: background lists earlier builder patches and the other building', () => {
  const letters = require('../lib/letters');
  const inc = { id: 'inc_x', createdAt: '2026-10-18T12:00:00Z', answers: { builderPatched: 'yes', sameDefectElsewhere: 'same_hoa', builtYear: 2020, placeLabel: 'Stairs' }, assessment: { tier: 'yellow', flags: ['crack'] }, photos: [], monitoring: [] };
  const b = letters.build('builder', inc, 'en', {}, {}).body;
  assert.match(b, /previously patched this area/);
  assert.match(b, /same builder, shows the same conditions/);
  assert.match(b, /copy of any written warranty/);
  const h = letters.build('association', inc, 'es', {}, {}).body;
  assert.match(h, /6\. Que la inspección, el aviso y el reclamo al constructor incluyan también el otro edificio/);
});

test('community problems: category sets the starting tier; urgency, injuries and hazardous waste only raise it', () => {
  const r = a => safety.ruleAssessment({ domain: 'community', ...a });
  assert.strictEqual(r({ category: 'gas_smell' }).floor, 'red');
  assert.strictEqual(r({ category: 'gas_smell' }).emergency, true);
  assert.strictEqual(r({ category: 'power_line' }).floor, 'red');
  assert.strictEqual(r({ category: 'streetlight' }).floor, 'green');
  assert.strictEqual(r({ category: 'streetlight', urgency: 'immediate' }).floor, 'yellow');
  assert.strictEqual(r({ category: 'road' }).floor, 'yellow');
  assert.strictEqual(r({ category: 'road', injuries: 'serious' }).floor, 'red');
  assert.strictEqual(r({ category: 'illegal_dumping' }).floor, 'green');
  assert.strictEqual(r({ category: 'illegal_dumping', hazardous: 'yes' }).floor, 'red');
  assert.strictEqual(r({ category: 'flooding', urgency: 'immediate' }).emergency, true);
  assert.strictEqual(r({ category: 'made_up' }).type, 'cm_other_community');
  // Red community problems never fund hands-on work.
  assert.deepStrictEqual(safety.allowedCategories('red', 'community'), ['advocacy', 'interpretation', 'legal']);
  assert.ok(safety.validateMilestones('red', [{ category: 'barriers', amount: 40 }], 'community').length > 0);
  assert.deepStrictEqual(safety.validateMilestones('yellow', [{ category: 'barriers', amount: 40 }], 'community'), []);
});

test('community problems: Austin channels come from verified pages; elsewhere the app does not invent numbers', () => {
  const cc = require('../lib/content-community');
  const gas = cc.channelsFor('gas_smell', { austin: true, texas: true, emergency: true, tier: 'red' });
  assert.deepStrictEqual(gas.map(x => x.tel), ['911', '1-800-959-5325']);
  assert.ok(gas[1].basis[0].url.includes('texasgasservice.com'));
  assert.strictEqual(cc.channelsFor('water_leak', { austin: true })[0].tel, '512-972-1000');
  assert.strictEqual(cc.channelsFor('power_line', { austin: true })[0].tel, '512-322-9100');
  const rental = cc.channelsFor('rental_repairs', { austin: true, texas: true });
  assert.deepStrictEqual(rental.map(x => x.kind), ['landlord', 'city']);
  const abroad = cc.channelsFor('gas_smell', { austin: false, texas: false, emergency: true });
  assert.ok(abroad.every(x => !x.tel), 'no phone numbers outside verified places');
  // Safety steps exist in all 10 languages, with the special first step for gas, power lines and flooding.
  for (const lang of Object.keys(cc.PROTOCOLS_COMMUNITY)) {
    for (const tier of ['green', 'yellow', 'red']) assert.strictEqual(cc.PROTOCOLS_COMMUNITY[lang][tier].steps.length, 4);
    for (const c of ['gas_smell', 'power_line', 'flooding']) assert.ok(cc.SPECIAL_STEPS[lang][c].length > 20, lang + c);
  }
  assert.strictEqual(Object.keys(cc.PROTOCOLS_COMMUNITY).length, 10);
});

test('law watch: every cited rule and contact has facts, a check date and a review interval; reviewers are required', () => {
  const laws = require('../lib/laws');
  const resp = require('../lib/responsibility');
  const cc = require('../lib/content-community');
  for (const r of laws.REGISTRY) {
    assert.ok(r.facts.length >= 1 && r.facts.every(x => x.en && x.es), r.id);
    assert.ok(r.reviewEveryDays >= 30, r.id);
  }
  // Every legal source and every Austin channel the app cites is watched.
  const cited = [...Object.values(resp.LAW), ...Object.values(cc.SRC)].map(x => x.url);
  for (const url of cited) assert.ok(laws.BY_URL.has(url), 'not watched: ' + url);
  assert.throws(() => laws.markVerified('tx_ch27', ''), /named reviewer/);
  const c = laws.proposeChange('tx_92_052', { note: 'test change', by: 'unit' });
  assert.strictEqual(laws.list().find(x => x.id === 'tx_92_052').state, 'pending_change');
  assert.throws(() => laws.resolveChange(c.id, 'accepted', ''), /named reviewer/);
  laws.resolveChange(c.id, 'declined', 'Reviewer');
  assert.strictEqual(laws.list().find(x => x.id === 'tx_92_052').state, 'current');
});

test('sargassum: every solution has a stage, who can do it, evidence and an opened source; rules and cautions are present', () => {
  const content = require('../lib/content');
  const sarg = content.REMEDIATION.filter(m => m.types.includes('sargassum'));
  assert.ok(sarg.length >= 20);
  const stages = new Set(sarg.map(m => m.stage));
  for (const st of ['prediction', 'offshore', 'beach', 'health', 'use', 'causes']) assert.ok(stages.has(st), st);
  for (const m of sarg) {
    assert.ok(['community', 'authorities', 'industry', 'research'].includes(m.actor), m.id);
    assert.ok(['field_tested', 'lab_studied', 'experimental'].includes(m.evidence), m.id);
    assert.ok(m.source && /^https:/.test(m.source.url) && m.source.checked, m.id);
    assert.ok(m.title.es && m.summary.es, m.id);
  }
  // Sinking at sea is flagged as not allowed in Mexico; compost warns about arsenic.
  assert.match(content.REMEDIATION.find(m => m.id === 'sarg-deep-sinking').caution.es, /No está permitido en México/);
  assert.match(content.REMEDIATION.find(m => m.id === 'sarg-cocompost').caution.en, /Arsenic/);
  assert.match(content.REMEDIATION.find(m => m.id === 'sarg-semarnat-rules').summary.en, /72 hours/);
});

test('Quintana Roo channels appear only for places in Quintana Roo', () => {
  const knowledge = require('../lib/knowledge');
  const ids = (place) => knowledge.orgsFor('MX', 'environment', place).map(o => o.id);
  assert.ok(ids('Playa del Pueblo, Tulum').includes('mx-zofemat'));
  assert.ok(ids('Mahahual, Quintana Roo').includes('mx-redsargazo'));
  assert.ok(!ids('Veracruz, Ver.').includes('mx-zofemat'));
  assert.ok(ids('Veracruz, Ver.').includes('mx-profepa'));
});

test('hazard level follows the safety standard of the country where it happens', () => {
  const h = require('../lib/hazard');
  const d = (tier, flags, c) => h.display(tier, flags, c);
  // United States: ANSI Z535 / OSHA, with an orange WARNING level for serious yellow signs.
  assert.strictEqual(d('red', [], 'US').word.en, 'DANGER');
  assert.strictEqual(d('yellow', ['crack_at_railing_anchor'], 'US').level, 'warning');
  assert.strictEqual(d('yellow', ['crack_at_railing_anchor'], 'US').color, 'orange');
  assert.strictEqual(d('yellow', ['dead_animals'], 'US').word.en, 'CAUTION');
  // Mexico: NOM-026-STPS-2008 has no orange level.
  assert.strictEqual(d('yellow', ['decomposing_sargassum'], 'MX').word.es, 'ADVERTENCIA DE PELIGRO');
  assert.strictEqual(d('yellow', ['decomposing_sargassum'], 'MX').color, 'yellow');
  assert.strictEqual(d('red', [], 'MX').word.es, 'PROHIBICIÓN');
  assert.strictEqual(d('green', [], 'MX').word.es, 'CONDICIÓN SEGURA');
  // EU and UK: Directive 92/58/EEC.
  assert.strictEqual(d('yellow', ['rotten_egg_odor_h2s'], 'FR').standard.id, 'EU');
  assert.strictEqual(d('yellow', ['rotten_egg_odor_h2s'], 'GB').color, 'yellow');
  // Anywhere else: ISO 3864.
  assert.strictEqual(d('yellow', ['rotten_egg_odor_h2s'], 'BR').standard.id, 'ISO');
  assert.strictEqual(d('yellow', ['rotten_egg_odor_h2s'], 'BR').word.pt, 'ADVERTÊNCIA');
  // Signal words exist in all 10 languages.
  for (const w of Object.values(h.WORDS)) assert.strictEqual(Object.keys(w).length, 10);
  // The display never changes the internal tier.
  assert.strictEqual(d('yellow', ['crack_at_railing_anchor'], 'US').tier, 'yellow');
});
