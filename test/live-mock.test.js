'use strict';
// Live-mode integration test against local mock servers that imitate the
// Claude Messages API and the PayPal sandbox. Proves the request shapes and
// response handling without real keys. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function listen(handler) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (_) { parsed = body; }
        handler(req, parsed, res);
      });
    });
    srv.listen(0, () => resolve(srv));
  });
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

test('live mode: Claude classification, verification, PayPal orders, capture and payouts', async t => {
  const calls = { claude: [], paypal: [] };

  const claude = await listen((req, body, res) => {
    calls.claude.push({ headers: req.headers, body });
    const prompt = JSON.stringify(body.messages);
    if (body.tools) {
      // remediation / help search with one retrieved source and one invented
      return json(res, 200, { content: [
        { type: 'server_tool_use', name: 'web_search', input: { query: 'x' } },
        { type: 'web_search_tool_result', content: [{ url: 'https://real.example.org/guide' }] },
        { type: 'text', text: '[{"title":{"en":"Real method","es":"Método real"},"summary":{"en":"s","es":"s"},"cost":"low","skill":"basic","evidence":"field_tested","materials":{"en":"m","es":"m"},"time":{"en":"t","es":"t"},"source":{"title":"Guide","url":"https://real.example.org/guide"}},{"title":{"en":"Invented"},"source":{"title":"Fake","url":"https://fake.example.org/x"}}]' }
      ] });
    }
    if (prompt.includes('Acceptance criteria')) {
      return json(res, 200, { content: [{ type: 'text', text: '{"decision":"pass","confidence":0.4,"reasoning_en":"Looks done","reasoning_es":"Parece hecho"}' }] });
    }
    return json(res, 200, { content: [{ type: 'text', text: '```json\n{"type":"sargassum","tier":"green","confidence":0.92,"observations_en":["mats"],"reasoning_en":"r","reasoning_es":"r","follow_up":[{"en":"Can you get closer to smell it?","es":"x"},{"en":"Since when?","es":"¿Desde cuándo?"}]}\n```' }] });
  });

  const paypal = await listen((req, body, res) => {
    calls.paypal.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === '/v1/oauth2/token') return json(res, 200, { access_token: 'TOKEN', expires_in: 3600 });
    if (req.url === '/v2/checkout/orders') return json(res, 201, { id: 'ORDER123', status: 'CREATED' });
    if (req.url === '/v2/checkout/orders/ORDER123/capture') {
      return json(res, 201, { id: 'ORDER123', status: 'COMPLETED', payer: { email_address: 'buyer@example.com' },
        purchase_units: [{ custom_id: body === null ? '' : undefined, payments: { captures: [{ id: 'CAP1', amount: { value: '900.00' }, custom_id: calls.incidentId }] } }] });
    }
    if (req.url === '/v1/payments/payouts') return json(res, 201, { batch_header: { payout_batch_id: 'BATCH1', batch_status: 'PENDING' } });
    return json(res, 404, { message: 'not mocked' });
  });

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-live-'));
  const port = 4300 + Math.floor(Math.random() * 500);
  const env = {
    ...process.env, PORT: String(port), DATA_DIR: dataDir, KNOWLEDGE_REFRESH_HOURS: '0',
    ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_API_BASE: `http://localhost:${claude.address().port}`,
    PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_API_BASE: `http://localhost:${paypal.address().port}`
  };
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); claude.close(); paypal.close(); });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', d => { if (String(d).includes('running at')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code)));
  });
  const base = `http://localhost:${port}`;
  const keys = {};
  const post = async (p, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const id = (/^\/api\/incidents\/([^/]+)/.exec(p) || [])[1];
    if (id && keys[id]) headers['X-Owner-Key'] = keys[id];
    const r = await fetch(base + p, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (j && j.ownerKey) keys[j.id] = j.ownerKey;
    return { status: r.status, body: j };
  };

  const cfg = await (await fetch(base + '/api/config')).json();
  assert.strictEqual(cfg.aiLive, true);
  assert.strictEqual(cfg.paypalLive, true);
  assert.strictEqual(cfg.paypalClientId, 'cid');

  // Rules say yellow (rotting sargassum); Claude says green with high confidence -> stays yellow.
  const inc = (await post('/api/incidents', { consent: true, answers: { observations: ['sargassum_rotting'], smell: 'rotten_egg', country: 'MX' }, photos: [{ role: 'wide', sampleId: 'A_before' }] })).body;
  calls.incidentId = inc.id;
  assert.strictEqual(inc.assessment.tier, 'yellow');
  assert.ok(inc.assessment.notes.includes('ai_lower_than_rules_ignored'));
  assert.strictEqual(inc.assessment.source, 'claude');
  assert.strictEqual(inc.assessment.followUp.length, 1, 'unsafe follow-up question was filtered');
  const first = calls.claude[0];
  assert.strictEqual(first.headers['x-api-key'], 'test-key');
  assert.strictEqual(first.headers['anthropic-version'], '2023-06-01');
  assert.ok(first.body.messages[0].content.some(b => b.type === 'image'), 'photo sent to Claude');

  // Remediation: invented source discarded, real one stored as pending review.
  const rem = (await post(`/api/incidents/${inc.id}/remediation`)).body;
  assert.strictEqual(rem.dropped, 1);
  assert.strictEqual(rem.liveAdded, 1);
  assert.ok(rem.methods.some(m => m.review === 'pending' && m.source.url === 'https://real.example.org/guide'));
  const searchCall = calls.claude.find(c => c.body.tools);
  assert.strictEqual(searchCall.body.tools[0].type, 'web_search_20250305');

  // Donation through Orders v2.
  const order = (await post(`/api/incidents/${inc.id}/donations/order`, { amount: 900 })).body;
  assert.strictEqual(order.id, 'ORDER123');
  const orderCall = calls.paypal.find(c => c.url === '/v2/checkout/orders');
  assert.strictEqual(orderCall.headers.authorization, 'Bearer TOKEN');
  assert.strictEqual(orderCall.body.intent, 'CAPTURE');
  assert.strictEqual(orderCall.body.purchase_units[0].custom_id, inc.id);
  assert.strictEqual(orderCall.body.purchase_units[0].amount.value, '900.00');
  const cap = (await post(`/api/incidents/${inc.id}/donations/capture`, { orderId: 'ORDER123' })).body;
  assert.strictEqual(cap.fund.raised, 900);

  // Milestone: Claude says pass with LOW confidence -> needs human review.
  const ev = (await post(`/api/incidents/${inc.id}/milestones/ms_1/evidence`, { photos: [{ sampleId: 'A_ppe' }] })).body;
  assert.strictEqual(ev.plan.milestones[0].status, 'needs_review');
  const noCheck = await post(`/api/incidents/${inc.id}/milestones/ms_1/approve`, { approver: { name: 'Ana', email: 'ana@x.org' }, recipient: { name: 'Crew', email: 'crew@x.org' } });
  assert.strictEqual(noCheck.status, 400);
  const paid = (await post(`/api/incidents/${inc.id}/milestones/ms_1/approve`, { approver: { name: 'Ana', email: 'ana@x.org' }, recipient: { name: 'Crew', email: 'crew@x.org' }, reviewedPhotos: true })).body;
  assert.strictEqual(paid.plan.milestones[0].status, 'paid');
  const payoutCall = calls.paypal.find(c => c.url === '/v1/payments/payouts');
  assert.strictEqual(payoutCall.body.items[0].receiver, 'crew@x.org');
  assert.strictEqual(payoutCall.body.items[0].amount.currency, 'USD');
  assert.strictEqual(payoutCall.body.items[0].recipient_type, 'EMAIL');
  assert.strictEqual(paid.fund.paid, Number(paid.plan.milestones[0].amount));

  // The example loader stays simulated on a live server: no Claude or PayPal calls, all money labeled simulated.
  const before = { claude: calls.claude.length, paypal: calls.paypal.length };
  const seeded = await post('/api/demo/seed', {});
  assert.strictEqual(seeded.status, 200);
  assert.strictEqual(calls.claude.length, before.claude, 'no Claude calls for example data');
  assert.strictEqual(calls.paypal.length, before.paypal, 'no PayPal calls for example data');
  const ledger = await (await fetch(base + '/api/ledger')).json();
  const exampleRows = ledger.filter(r => r.simulated);
  assert.ok(exampleRows.length >= 5, 'example payments are labeled simulated');
  assert.ok(ledger.some(r => !r.simulated), 'the real sandbox payment stays labeled sandbox');
  const cfg2 = await (await fetch(base + '/api/config')).json();
  assert.strictEqual(cfg2.paypalLive, true, 'the server is still live for real users');

  const chain = await (await fetch(base + '/api/chain')).json();
  assert.strictEqual(chain.ok, true);
});

test('live mode: rule re-check keeps only changes backed by a retrieved page, and nothing changes until a reviewer decides', async t => {
  let mode = 'changed_verified';
  const claude = await listen((req, body, res) => {
    const prompt = JSON.stringify(body.messages);
    if (prompt.includes('The app relies on these facts')) {
      const url = mode === 'changed_unverified' ? 'https://not-retrieved.example.org/x' : 'https://statutes.example.gov/ch27';
      return json(res, 200, { content: [
        { type: 'web_search_tool_result', content: [{ url: 'https://statutes.example.gov/ch27' }] },
        { type: 'text', text: JSON.stringify({ results: [{ fact: 1, status: mode === 'ok' ? 'still_accurate' : 'changed', now_says: 'Notice is now due 90 days before suit.', source_url: url, source_title: 'Statute' }] }) }
      ] });
    }
    return json(res, 200, { content: [{ type: 'text', text: '[]' }] });
  });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-law-'));
  const port = 4900 + Math.floor(Math.random() * 300);
  const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir, KNOWLEDGE_REFRESH_HOURS: '0', ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_API_BASE: `http://localhost:${claude.address().port}` };
  delete env.PAYPAL_CLIENT_ID;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); claude.close(); });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', d => { if (String(d).includes('running at')) resolve(); });
    child.on('exit', code => reject(new Error('server exited ' + code)));
  });
  const base = `http://localhost:${port}`;
  const keys = {};
  const post = async (p, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const id = (/^\/api\/incidents\/([^/]+)/.exec(p) || [])[1];
    if (id && keys[id]) headers['X-Owner-Key'] = keys[id];
    const r = await fetch(base + p, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (j && j.ownerKey) keys[j.id] = j.ownerKey;
    return { status: r.status, body: j };
  };

  // A change backed by a page the search really retrieved goes to review.
  let r = (await post('/api/laws/tx_ch27/check')).body;
  assert.strictEqual(r.result, 'changed');
  assert.strictEqual(r.rule.state, 'pending_change');
  assert.match(r.rule.pending[0].note, /90 days/);
  // A claimed change citing a page that was never retrieved is not trusted.
  mode = 'changed_unverified';
  r = (await post('/api/laws/tx_92_052/check')).body;
  assert.strictEqual(r.result, 'unclear');
  assert.strictEqual(r.rule.state, 'unclear');
  // Confirmed accurate.
  mode = 'ok';
  r = (await post('/api/laws/tx_82_107/check')).body;
  assert.strictEqual(r.result, 'still_accurate');
  assert.strictEqual(r.rule.state, 'current');
  // Reviewer decision is required and is what flags the rule as changed.
  const pendingId = (await (await fetch(base + '/api/laws')).json()).rules.find(x => x.id === 'tx_ch27').pending[0].id;
  assert.strictEqual((await post('/api/laws/changes/' + pendingId, { decision: 'accepted', reviewer: '' })).status, 400);
  await post('/api/laws/changes/' + pendingId, { decision: 'accepted', reviewer: 'Ana' });
  const st = await (await fetch(base + '/api/laws')).json();
  assert.strictEqual(st.rules.find(x => x.id === 'tx_ch27').state, 'changed');
  // After the app text is updated, a reviewer re-checks it and the warning clears.
  await post('/api/laws/tx_ch27/verify', { reviewer: 'Ana' });
  const st2 = await (await fetch(base + '/api/laws')).json();
  assert.strictEqual(st2.rules.find(x => x.id === 'tx_ch27').state, 'current');
});
