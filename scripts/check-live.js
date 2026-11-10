'use strict';
// Verifies the live keys before recording the demo video.
// Verifica las claves reales antes de grabar el video.
//
// Usage / Uso:
//   npm run check-live
//   npm run check-live -- --payout-to=sb-personal@personal.example.com --invoice-to=sb-personal@personal.example.com
//
// Only sandbox: it refuses to run against the live PayPal API.

const config = require('../lib/config');

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const results = [];
const ok = (name, detail) => { results.push(['PASS', name, detail]); console.log(`✔ ${name}${detail ? ' — ' + detail : ''}`); };
const bad = (name, detail) => { results.push(['FAIL', name, detail]); console.log(`✘ ${name} — ${detail}`); };

async function claude() {
  if (!config.aiLive) return bad('Claude', 'ANTHROPIC_API_KEY is empty in .env / falta la clave en .env');
  try {
    const res = await fetch(config.anthropicBase + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.claudeModel, max_tokens: 20, messages: [{ role: 'user', content: 'Reply with the word OK.' }] })
    });
    const j = await res.json();
    if (!res.ok) return bad('Claude', `${res.status} ${j.error && j.error.message}`);
    ok('Claude', `model ${j.model} answered`);
    const s = await fetch(config.anthropicBase + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.claudeModel, max_tokens: 300, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }], messages: [{ role: 'user', content: 'Search for the US EPA page about sargassum and human health and give its URL.' }] })
    });
    const sj = await s.json();
    const searched = (sj.content || []).some(b => b.type === 'web_search_tool_result');
    if (s.ok && searched) ok('Claude web search', 'search tool available'); else bad('Claude web search', s.ok ? 'no search result returned; web search may be disabled for your organization (Console → Settings → Capabilities)' : `${s.status} ${sj.error && sj.error.message}`);
  } catch (err) { bad('Claude', err.message); }
}

async function paypal() {
  if (!config.paypalLive) return bad('PayPal', 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET empty in .env');
  if (/api-m\.paypal\.com/.test(config.paypalBase)) return bad('PayPal', 'This checker only runs against the sandbox.');
  const pp = require('../lib/paypal');
  try {
    const order = await pp.createDonationOrder({ incidentId: 'check-live', amount: 1, description: 'Comunidad Fuerte live check' });
    ok('PayPal Orders v2', `order ${order.id} created (status ${order.status})`);
  } catch (err) { return bad('PayPal Orders v2', err.message); }
  if (args['payout-to']) {
    try {
      const p = await pp.sendPayout({ senderItemId: 'check-live', email: args['payout-to'], amount: 1, note: 'Comunidad Fuerte live check' });
      ok('PayPal Payouts', `batch ${p.batchId} status ${p.status}`);
    } catch (err) { bad('PayPal Payouts', err.message + ' (the sandbox business account may need Payouts enabled and a balance / la cuenta sandbox puede requerir Payouts habilitado y saldo)'); }
  } else {
    console.log('… Payouts skipped: add --payout-to=<sandbox personal email>');
  }
  if (args['invoice-to']) {
    try {
      const { PayPalAgentToolkit } = require('@paypal/agent-toolkit/openai');
      const tk = new PayPalAgentToolkit({ clientId: config.paypalClientId, clientSecret: config.paypalSecret, configuration: { actions: { invoices: { create: true } }, context: { sandbox: true } } });
      const r = await tk.handleToolCall({ id: 'chk', type: 'function', function: { name: 'create_invoice', arguments: JSON.stringify({ currency_code: 'USD', primary_recipients: [{ billing_info: { email_address: args['invoice-to'] } }], items: [{ name: 'Comunidad Fuerte live check', quantity: '1', unit_amount: { currency_code: 'USD', value: '1.00' } }] }) } });
      const text = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
      const id = (text.match(/INV2-[A-Z0-9-]+/) || [])[0];
      if (id) ok('PayPal Agent Toolkit', `draft invoice ${id} created (not sent)`); else bad('PayPal Agent Toolkit', text.slice(0, 300));
    } catch (err) { bad('PayPal Agent Toolkit', err.message); }
  } else {
    console.log('… Agent Toolkit skipped: add --invoice-to=<sandbox personal email>');
  }
}

(async () => {
  console.log(`Comunidad Fuerte live check — model ${config.claudeModel}, PayPal ${config.paypalBase}\n`);
  await claude();
  await paypal();
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
