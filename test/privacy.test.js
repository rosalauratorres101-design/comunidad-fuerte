'use strict';
// Privacy: reports are visible only with their owner key; media needs signed links;
// public pages carry no place, description or names.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

test('reports are private to their owner', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-priv-'));
  const port = 5400 + Math.floor(Math.random() * 400);
  const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir, KNOWLEDGE_REFRESH_HOURS: '0', ANTHROPIC_API_KEY: '', PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '' };
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.on('data', d => { if (String(d).includes('running at')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code)));
  });
  const base = `http://localhost:${port}`;
  const req = async (p, body, key) => {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['X-Owner-Key'] = key;
    const r = await fetch(base + p, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  const created = await req('/api/incidents', { consent: true, anonymous: false, reporterName: 'Maria Lopez', answers: { domain: 'infrastructure', placeLabel: '123 Secret Lane, unit 9', description: 'Private details here', country: 'US' }, photos: [{ role: 'wide', sampleId: 'C_stairs' }] });
  assert.strictEqual(created.status, 201);
  const { id, ownerKey } = created.body;
  assert.ok(ownerKey && ownerKey.length >= 30, 'owner key returned once');
  assert.ok(!('ownerKeyHash' in created.body), 'hash never sent');

  // Nobody else can open, list or act on it.
  assert.strictEqual((await req('/api/incidents/' + id)).status, 404);
  assert.strictEqual((await req('/api/incidents/' + id, null, 'x'.repeat(32))).status, 404);
  assert.strictEqual((await req(`/api/incidents/${id}/summary`)).status, 404);
  assert.strictEqual((await req(`/api/incidents/${id}/evidence`)).status, 404);
  assert.strictEqual((await req(`/api/incidents/${id}/followup`, { answers: [] })).status, 404);
  const list = await req('/api/incidents');
  assert.ok(list.status === 404 || (Array.isArray(list.body) && !list.body.length), 'no public list');
  assert.deepStrictEqual((await req('/api/incidents/mine', { owned: [{ id, key: 'wrong-key-wrong-key-123' }] })).body, []);

  // The owner can.
  const mine = await req('/api/incidents/' + id, null, ownerKey);
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.body.location.label, '123 Secret Lane, unit 9');
  assert.strictEqual((await req('/api/incidents/mine', { owned: [{ id, key: ownerKey }] })).body.length, 1);

  // Photos: only through signed links.
  const url = mine.body.photos[0].publicUrl;
  assert.match(url, /^\/media\/img_[a-f0-9]+\.jpg\?exp=\d+&sig=/);
  assert.strictEqual((await fetch(base + url)).status, 200);
  assert.strictEqual((await fetch(base + url.split('?')[0])).status, 404, 'unsigned link refused');
  assert.strictEqual((await fetch(base + url.replace(/sig=.{4}/, 'sig=AAAA'))).status, 404, 'tampered link refused');

  // Stored key is only a hash.
  const db = fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8');
  assert.ok(!db.includes(ownerKey), 'raw key is not stored');

  // Public pages: no place, description or names.
  const seeded = await req('/api/demo/seed', {});
  assert.strictEqual(seeded.body.owned.length, 4);
  const ledger = JSON.stringify((await req('/api/ledger')).body);
  const impact = JSON.stringify((await req('/api/impact')).body);
  for (const secret of ['Secret Lane', 'Private details', 'Maria', 'Mahahual', 'Cooperativa', 'Brigada', 'Community verifier', id]) {
    assert.ok(!ledger.includes(secret), 'ledger leaks ' + secret);
    assert.ok(!impact.includes(secret), 'impact leaks ' + secret);
  }
});

test('privacy helpers', () => {
  const privacy = require('../lib/privacy');
  assert.strictEqual(privacy.initials('Ana María López'), 'A. M. L.');
  assert.strictEqual(privacy.initials(''), '');
  const key = privacy.newKey();
  assert.ok(privacy.keyMatches({ ownerKeyHash: privacy.sha256(key) }, key));
  assert.ok(!privacy.keyMatches({ ownerKeyHash: privacy.sha256(key) }, key + 'x'));
  assert.ok(!privacy.keyMatches({}, key));
  const u = privacy.signedUrl('/media/img_ab12.jpg');
  const q = new URLSearchParams(u.split('?')[1]);
  assert.ok(privacy.verifyMedia('img_ab12.jpg', q.get('exp'), q.get('sig')));
  assert.ok(!privacy.verifyMedia('img_ab13.jpg', q.get('exp'), q.get('sig')));
  assert.ok(!privacy.verifyMedia('img_ab12.jpg', q.get('exp'), q.get('sig'), (Number(q.get('exp')) + 1) * 1000), 'expired');
  assert.ok(!privacy.verifyMedia('../db.json', q.get('exp'), q.get('sig')));
});

test('anonymous statistics protect small groups and carry no personal data', () => {
  const stats = require('../lib/stats');
  const mk = (i, over) => ({
    id: 'inc_' + i, createdAt: '2026-10-0' + ((i % 9) + 1) + 'T10:00:00Z', domain: 'environment',
    location: { label: 'Secret street ' + i, country: 'MX', lat: 18.71 + i * 0.001, lng: -87.71 },
    answers: { country: 'MX', description: 'private text ' + i }, reporter: { name: 'Person ' + i },
    assessment: { type: 'sargassum', tier: 'yellow' }, reports: [], ...over
  });
  const few = stats.build({ incidents: [mk(1), mk(2)] }, {});
  assert.strictEqual(few.enough, false, 'fewer than K: nothing published');
  assert.strictEqual(few.total, null);

  const incidents = [mk(1), mk(2), mk(3), mk(4), mk(5, { assessment: { type: 'oil', tier: 'red' } }), mk(6, { statsOptIn: false })];
  const s = stats.build({ incidents }, {});
  assert.strictEqual(s.total, 5, 'opted-out report not counted');
  assert.strictEqual(s.optedOut, 1);
  assert.deepStrictEqual(s.byType.find(r => r.key === 'sargassum'), { key: 'sargassum', n: 4 });
  assert.ok(!s.byType.some(r => r.key === 'oil'), 'a single oil report is not shown by name');
  const other = s.byType.find(r => r.key === 'other');
  assert.strictEqual(other.n, null); assert.ok(other.fewer);
  assert.strictEqual(s.hotspots.length, 1);
  assert.strictEqual(s.hotspots[0].lat, 18.7);
  const text = JSON.stringify(s) + stats.toCsv(s);
  for (const secret of ['Secret street', 'private text', 'Person', 'inc_1', '18.71']) assert.ok(!text.includes(secret), 'stats leak ' + secret);

  const filtered = stats.build({ incidents }, { country: 'US' });
  assert.strictEqual(filtered.enough, false);
  assert.deepStrictEqual(stats.parseFilters({ country: 'mx', from: '2026-13', domain: 'x' }), { country: 'MX', domain: '', type: '', from: '', to: '' });
});

test('laws by level: international, national, state and local, honest when not verified', () => {
  const j = require('../lib/jurisdiction');
  const tulum = j.forIncident({ domain: 'environment', answers: { country: 'MX', placeLabel: 'Playa Paraíso, Tulum, Quintana Roo' }, assessment: { type: 'sargassum' } });
  assert.deepStrictEqual([tulum.where.country, tulum.where.state, tulum.where.locality], ['MX', 'MX-ROO', 'MX-ROO-Tulum']);
  const ids = lv => tulum.layers.find(l => l.level === lv).rules.map(r => r.id);
  assert.ok(ids('international').includes('intl_escazu'));
  assert.ok(!ids('international').includes('std_iso3864'), 'ISO colours hidden where NOM-026 applies');
  assert.ok(ids('national').includes('mx_sargazo_2021') && ids('national').includes('mx_lgeepa_189'));
  assert.ok(ids('state').includes('qroo_ppa'));
  assert.ok(ids('local').includes('tulum_zofemat'));

  const austin = j.forIncident({ domain: 'infrastructure', answers: { country: 'US', jurisdiction: 'US-TX', propertyType: 'condo_common', placeLabel: '100 Example St, Austin, TX 78701' }, assessment: { type: 'structural_damage' } });
  assert.strictEqual(austin.where.locality, 'US-TX-Austin');
  assert.ok(austin.layers.find(l => l.level === 'state').rules.some(r => r.id === 'tx_ch27'));
  assert.ok(!austin.layers.flatMap(l => l.rules).some(r => r.id === 'mx_sargazo_2021' || r.id === 'tx_92_052'), 'no rules from other places or topics');

  const colombia = j.forIncident({ domain: 'environment', answers: { country: 'CO', placeLabel: 'Cartagena' }, assessment: { type: 'oil' } });
  assert.strictEqual(colombia.layers.find(l => l.level === 'national').coverage, 'not_verified');
  assert.ok(colombia.layers.find(l => l.level === 'international').rules.some(r => r.id === 'std_iso3864'));
  assert.ok(!colombia.layers.flatMap(l => l.rules).some(r => r.id === 'intl_escazu'), 'treaty shown only where verified');

  assert.deepStrictEqual(j.appCompliance('US', 'US-TX').rules.map(r => r.id), ['tx_tdpsa']);
  assert.deepStrictEqual(j.appCompliance('ES').rules.map(r => r.id), ['eu_gdpr']);
  assert.deepStrictEqual(j.appCompliance('MX').rules.map(r => r.id), ['mx_lfpdppp_2025']);

  const summary = require('../lib/summary');
  const s = summary.build({ inc: { id: 'inc_x', createdAt: '2026-10-19T00:00:00Z', domain: 'environment', lang: 'es', answers: { country: 'CO', placeLabel: 'Cartagena' }, assessment: { type: 'oil', tier: 'yellow', flags: [] }, photos: [], plan: { milestones: [] } }, targets: [], resp: null, sent: [], cost: null, fund: { raised: 0, paid: 0, available: 0 }, chain: { ok: true, total: 1 }, lang: 'es', base: 'es', legal: colombia });
  const laws = s.sections.find(x => x.id === 'laws');
  assert.ok(laws && laws.items.some(i => i.includes('aún no ha verificado')), 'summary says when a level is not verified');
});

test('escalation: overdue reports get the next verified authority and a drafted message', () => {
  const esc = require('../lib/escalation');
  const inc = { id: 'inc_t1', domain: 'environment', answers: { country: 'MX', placeLabel: 'Playa Paraíso, Tulum, Quintana Roo' }, assessment: { type: 'sargassum', tier: 'yellow' },
    reports: [{ id: 'rep_1', targetId: 'tulum_zofemat', kind: 'org', targetName: 'Zofemat Tulum', sentAt: '2026-09-01', status: 'sent', followUps: [{ date: '2026-09-08', label: { en: 'x', es: 'x' } }] },
      { id: 'rep_2', targetId: 'x', kind: 'org', targetName: 'Other', sentAt: '2026-10-18', status: 'sent', followUps: [{ date: '2026-10-25', label: { en: 'x', es: 'x' } }] }] };
  const items = esc.forIncident(inc, '2026-10-19');
  assert.strictEqual(items.length, 1, 'only the overdue report');
  assert.strictEqual(items[0].overdueSince, '2026-09-08');
  const ids = items[0].next.map(n => n.ruleId);
  assert.deepStrictEqual(ids.slice(0, 2), ['qroo_ppa', 'mx_lgeepa_189'], 'state, then national');
  assert.ok(!ids.includes('tulum_zofemat'), 'never the same office again');
  const d = esc.draft(inc, 'rep_1', 'qroo_ppa', 'es', { name: 'R. T.' });
  assert.ok(d.subject.includes('Seguimiento sin respuesta') && d.body.includes('2026-09-01') && d.body.includes('Procuraduría') && d.body.includes('R. T.'));

  const builder = { id: 'inc_t2', domain: 'infrastructure', answers: { country: 'US', jurisdiction: 'US-TX', propertyType: 'condo_common', placeLabel: 'Austin, TX' }, assessment: { type: 'structural_damage', tier: 'yellow' },
    reports: [{ id: 'rep_b', targetId: 'builder', kind: 'builder', targetName: 'Builder', sentAt: '2026-06-01', status: 'no_answer', responseAt: '2026-08-15T00:00:00Z', followUps: [] }] };
  const b = esc.forIncident(builder, '2026-10-19');
  assert.strictEqual(b[0].next[0].ruleId, 'tx_ch27', 'Chapter 27 next step first');
  assert.ok(b[0].next[0].how.en.includes('60 days have passed') && !b[0].next[0].waitUntil);
  builder.reports[0].sentAt = '2026-10-01';
  const early = esc.forIncident(builder, '2026-10-19')[0].next[0];
  assert.strictEqual(early.waitUntil, '2026-11-30', 'before day 60 the app says to wait');
  assert.ok(b[0].next.some(n => n.ruleId === 'atx_code'), 'local code compliance after a private party');
});

test('neighbor support: limited public view, anonymous confirmations, co-signers in letters', () => {
  const sup = require('../lib/support');
  const inc = { id: 'inc_s', createdAt: '2026-10-05T10:00:00Z', domain: 'environment', answers: { country: 'MX', placeLabel: 'Calle Secreta 12, Tulum', description: 'private' }, assessment: { type: 'sargassum', tier: 'yellow' }, reporter: { name: 'Maria' } };
  const token = sup.create(inc);
  assert.ok(!JSON.stringify(inc).includes(token), 'only a hash of the token is stored');
  assert.strictEqual(sup.findByToken([inc], token), inc);
  assert.strictEqual(sup.findByToken([inc], 'x'.repeat(24)), null);
  const v = sup.publicView(inc, null);
  const txt = JSON.stringify(v);
  for (const secret of ['Calle Secreta', 'private', 'Maria', 'inc_s']) assert.ok(!txt.includes(secret), 'support page leaks ' + secret);
  assert.deepStrictEqual(v.area, { en: 'Tulum', es: 'Tulum' });
  sup.add(inc, { kind: 'confirm', affected: 'me' });
  assert.throws(() => sup.add(inc, { kind: 'cosign', name: 'Ana P.' }), /agree/);
  sup.add(inc, { kind: 'cosign', name: 'Ana P.', agree: true });
  assert.deepStrictEqual(sup.counts(inc), { confirmed: 2, cosigned: 1 });
  assert.ok(sup.letterLine(inc, 'es').includes('2 persona(s) confirmaron') && sup.letterLine(inc, 'es').includes('Ana P.'));
  sup.revoke(inc);
  assert.strictEqual(sup.findByToken([inc], token), null, 'revoked link stops working');
});

test('official link: authority answers are recorded; link can be turned off', () => {
  const off = require('../lib/official');
  const inc = { id: 'inc_o' };
  const token = off.create(inc);
  assert.ok(!JSON.stringify(inc).includes(token));
  assert.strictEqual(off.findByToken([inc], token), inc);
  assert.throws(() => off.update(inc, { status: 'received' }), /office/);
  assert.throws(() => off.update(inc, { status: 'forwarded', office: 'City' }), /forwarded/);
  assert.throws(() => off.update(inc, { status: 'deleted', office: 'City' }), /status/);
  const u = off.update(inc, { status: 'in_progress', office: 'Austin Code', caseNumber: '26-0001', eta: '2026-11-15', note: 'Inspection scheduled' });
  assert.deepStrictEqual([u.status, u.caseNumber, u.eta], ['in_progress', '26-0001', '2026-11-15']);
  assert.strictEqual(off.latest(inc).office, 'Austin Code');
  off.revoke(inc);
  assert.strictEqual(off.findByToken([inc], token), null);
});

test('matching funds: capped at community donations and the pledge limit', () => {
  const match = require('../lib/match');
  const inc = { id: 'inc_m' };
  assert.throws(() => match.pledge(inc, { office: 'City', email: 'bad', cap: 100 }), /email/);
  assert.throws(() => match.pledge(inc, { office: 'City', email: 'a@city.gov', cap: 0 }), /limit/);
  match.pledge(inc, { office: 'City of Example', email: 'grants@city.gov', cap: 500 });
  assert.throws(() => match.pledge(inc, { office: 'Other', email: 'x@y.org', cap: 100 }), /already/);
  const tx = [
    { incidentId: 'inc_m', kind: 'donation', status: 'COMPLETED', amount: 300 },
    { incidentId: 'inc_m', kind: 'donation', status: 'COMPLETED', amount: 400 },
    { incidentId: 'inc_m', kind: 'donation', status: 'COMPLETED', amount: 1000, paypalInvoiceId: 'INV-SPONSOR' },
    { incidentId: 'other', kind: 'donation', status: 'COMPLETED', amount: 999 }
  ];
  let st = match.status(inc, tx);
  assert.deepStrictEqual([st.communityRaised, st.eligible, st.owed], [700, 500, 500], 'sponsors do not count; capped at the pledge');
  inc.match.invoices.push({ id: 'mt1', amount: 500, status: 'SENT' });
  st = match.status(inc, tx);
  assert.strictEqual(st.owed, 0, 'nothing owed twice');
});

test('answers: an expired warranty is explained, with Texas rules only in Texas, and a reply is drafted', () => {
  const responses = require('../lib/responses');
  const laws = require('../lib/laws');
  const tx = { id: 'inc_r', domain: 'infrastructure', answers: { country: 'US', jurisdiction: 'US-TX', propertyType: 'condo_common', builtYear: 2020, sameDefectElsewhere: 'same_hoa', boughtFromBuilder: 'yes', placeLabel: 'Entrance stairs, Austin, TX' }, assessment: { type: 'structural_damage' } };
  const g = responses.guidance(tx, 'warranty_denied', laws.list());
  const text = g.points.map(p => p.en).join(' ');
  assert.ok(text.includes('two different things') && text.includes('until about 2030') && text.includes('engineer') && text.includes('§ 82.119'));
  assert.deepStrictEqual(g.basis.map(b => b.id).sort(), ['tx_16_009', 'tx_82_119', 'tx_centex_buecher', 'tx_limits']);
  const mx = { id: 'inc_m2', domain: 'infrastructure', answers: { country: 'MX', placeLabel: 'Cancún' }, assessment: { type: 'structural_damage' } };
  const gm = responses.guidance(mx, 'warranty_denied', laws.list());
  assert.ok(gm.points.some(p => p.en.includes('has not verified')) && gm.basis.length === 0, 'no Texas law outside Texas');
  const d = responses.draft(tx, { id: 'r1', responseType: 'warranty_denied', responder: 'Veronica' }, 'es', { name: 'R. T.', unit: 'Unidad 1' });
  assert.ok(d.body.startsWith('Hola Veronica') && d.body.includes('ingeniero estructural') && d.body.includes('R. T.'));
});

test('emails and phone numbers are removed from stored text, dates and codes are kept', () => {
  const { redactContacts } = require('../lib/privacy');
  assert.strictEqual(redactContacts('Builder, name@builder.example'), 'Builder, [email removed]');
  assert.strictEqual(redactContacts('Call (512) 555-0100 or +52 998 555 0100'), 'Call [phone removed] or [phone removed]');
  assert.strictEqual(redactContacts('Sent 2026-10-18; crack 3.5 mm; 29 CFR 1910.145; ZIP 78701'), 'Sent 2026-10-18; crack 3.5 mm; 29 CFR 1910.145; ZIP 78701');
});
