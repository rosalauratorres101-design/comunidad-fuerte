'use strict';
// Fundraising agent (agentic commerce).
// Claude runs a tool-use loop over the official PayPal Agent Toolkit invoice
// tools to ask a local sponsor (a business, a cooperative, a family abroad) to
// fund one milestone: it creates the invoice, sends it and makes a QR code the
// community can print for people without the app.
//
// Design rule: the agent can REQUEST money but can never SEND it. Payouts stay
// behind AI photo verification plus a named human verifier (server.js).
// Every tool call passes a policy check in code before it runs.

const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('./config');

const ALLOWED = ['get_fund_status', 'create_invoice', 'send_invoice', 'generate_invoice_qr_code', 'get_invoice'];
const MAX_STEPS = 8;

let toolkit = null;
function getToolkit() {
  if (toolkit) return toolkit;
  if (!config.paypalLive) return null;
  const { PayPalAgentToolkit } = require('@paypal/agent-toolkit/openai');
  toolkit = new PayPalAgentToolkit({
    clientId: config.paypalClientId,
    clientSecret: config.paypalSecret,
    configuration: {
      actions: { invoices: { create: true, send: true, generateQRC: true, get: true } },
      context: { sandbox: !/api-m\.paypal\.com/.test(config.paypalBase) }
    }
  });
  return toolkit;
}
// Tests inject a stand-in toolkit with the same interface.
function setToolkitForTests(tk) { toolkit = tk; }

function fakeId(prefix) { return prefix + '-' + crypto.randomBytes(5).toString('hex').toUpperCase(); }

function invoiceTotal(args) {
  return (args.items || []).reduce((sum, it) => sum + Number(it.quantity || 1) * Number(it.unit_amount && it.unit_amount.value || 0), 0);
}

// Policy in code: what the agent is allowed to do in this run.
function policyCheck(name, args, ctx) {
  if (!ALLOWED.includes(name)) return { ok: false, reason: `Tool "${name}" is not allowed for the fundraising agent.` };
  const a = { ...(args || {}) };
  if (name === 'create_invoice') {
    if (ctx.invoiceId) return { ok: false, reason: 'Only one invoice per run.' };
    if (String(a.currency_code || '').toUpperCase() !== 'USD') return { ok: false, reason: 'Currency must be USD.' };
    const recipient = a.primary_recipients && a.primary_recipients[0] && a.primary_recipients[0].billing_info && a.primary_recipients[0].billing_info.email_address;
    if (!recipient || recipient.toLowerCase() !== ctx.sponsor.email.toLowerCase()) return { ok: false, reason: 'The invoice must go to the sponsor email a person entered.' };
    const total = invoiceTotal(a);
    if (!(total > 0)) return { ok: false, reason: 'The invoice total must be greater than zero.' };
    if (total > ctx.maxAmount + 1e-9) return { ok: false, reason: `The invoice total ${total.toFixed(2)} is above the ${ctx.maxAmount.toFixed(2)} USD allowed for this milestone.` };
    a.reference = `${ctx.incidentId}/${ctx.milestoneId}`; // traceability is not optional
    return { ok: true, args: a };
  }
  if (['send_invoice', 'generate_invoice_qr_code', 'get_invoice'].includes(name)) {
    if (!ctx.invoiceId || a.invoice_id !== ctx.invoiceId) return { ok: false, reason: 'The agent may only act on the invoice it created in this run.' };
    if (name === 'send_invoice') { delete a.additional_recipients; a.send_to_recipient = true; }
    return { ok: true, args: a };
  }
  return { ok: true, args: a };
}

function parseMaybeJson(s) {
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch (_) { return s; }
}

function invoiceIdFrom(result) {
  const r = parseMaybeJson(result);
  const text = typeof r === 'string' ? r : JSON.stringify(r);
  const m = text.match(/INV2-[A-Z0-9-]+/);
  return m ? m[0] : (r && r.id) || null;
}

function payerLink(invoiceId) {
  const host = /api-m\.paypal\.com/.test(config.paypalBase) ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
  return `${host}/invoice/p/#${invoiceId}`;
}

function summarize(obj, max = 220) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function fundStatus(ctx) {
  return {
    incident: ctx.incidentId,
    problem: ctx.problem,
    place: ctx.place,
    safety_tier: ctx.tier,
    milestone: { id: ctx.milestoneId, title: ctx.milestoneTitle, amount_usd: ctx.maxAmount, acceptance_criteria: ctx.criteria },
    fund: ctx.fund,
    sponsor: ctx.sponsor,
    language: ctx.lang
  };
}

// Convert Agent Toolkit (OpenAI-format) tools to Claude tool definitions.
function claudeTools(tk) {
  const fromToolkit = tk.getTools()
    .filter(t => ALLOWED.includes(t.function.name))
    .map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
  return [{
    name: 'get_fund_status',
    description: 'Read-only: the incident, the milestone to fund, its amount limit, the fund balance and the sponsor contact entered by a person.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  }, ...fromToolkit];
}

async function callClaude(body) {
  const res = await fetch(config.anthropicBase + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Claude API error ' + res.status + ': ' + ((json.error && json.error.message) || res.statusText));
  return json;
}

const SYSTEM = `You are the fundraising agent of Comunidad Fuerte, a platform that helps communities respond to pollution and unsafe shared infrastructure.
Goal: ask ONE sponsor to fund ONE verified milestone through a PayPal invoice, then send it and create a QR code.
Steps: call get_fund_status; create_invoice addressed to the sponsor email with a single line item for the milestone, amount at most the milestone amount, currency USD, a short respectful note in the sponsor's language explaining the problem and that payouts are released only after photo verification and community approval; send_invoice; generate_invoice_qr_code. Then reply with one short sentence summarizing what you did.
Never invent amounts, never invoice anyone else, never promise outcomes. If a tool is blocked by policy, adapt or stop.`;

async function runLive(ctx) {
  const tk = getToolkit();
  const log = [];
  const messages = [{ role: 'user', content: `Fund milestone ${ctx.milestoneId} of incident ${ctx.incidentId} with sponsor ${ctx.sponsor.name} <${ctx.sponsor.email}>.` }];
  const tools = claudeTools(tk);
  let qr = null;
  let finalText = '';
  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await callClaude({ model: config.claudeModel, max_tokens: 1500, system: SYSTEM, tools, messages });
    messages.push({ role: 'assistant', content: resp.content });
    const uses = (resp.content || []).filter(b => b.type === 'tool_use');
    finalText = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim() || finalText;
    if (!uses.length) break;
    const results = [];
    for (const use of uses) {
      const check = policyCheck(use.name, use.input, ctx);
      if (!check.ok) {
        log.push({ tool: use.name, input: summarize(use.input), blocked: true, result: check.reason });
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'Blocked by policy: ' + check.reason, is_error: true });
        continue;
      }
      let output;
      try {
        if (use.name === 'get_fund_status') {
          output = JSON.stringify(fundStatus(ctx));
        } else {
          const r = await tk.handleToolCall({ id: use.id, type: 'function', function: { name: use.name, arguments: JSON.stringify(check.args) } });
          output = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
        }
      } catch (err) {
        log.push({ tool: use.name, input: summarize(check.args), error: true, result: err.message });
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'Error: ' + err.message, is_error: true });
        continue;
      }
      if (use.name === 'create_invoice') {
        ctx.invoiceId = invoiceIdFrom(output);
        ctx.amount = invoiceTotal(check.args);
      }
      if (use.name === 'generate_invoice_qr_code') {
        const m = String(output).match(/([A-Za-z0-9+/=]{200,})/);
        if (m) qr = 'data:image/png;base64,' + m[1];
      }
      log.push({ tool: use.name, input: summarize(check.args), result: summarize(output) });
      results.push({ type: 'tool_result', tool_use_id: use.id, content: output.slice(0, 8000) });
    }
    messages.push({ role: 'user', content: results });
    if (resp.stop_reason === 'end_turn') break;
  }
  if (!ctx.invoiceId) throw new Error('The agent did not create an invoice. ' + (log.filter(l => l.blocked).map(l => l.result).join(' ') || finalText));
  const link = payerLink(ctx.invoiceId);
  if (!qr) qr = await QRCode.toDataURL(link, { margin: 1, width: 360 });
  return { invoiceId: ctx.invoiceId, amount: ctx.amount, payLink: link, qr, log, summary: finalText, simulated: false };
}

// Demo: the same steps and the same policy checks, with simulated PayPal ids.
async function runDemo(ctx, origin) {
  const log = [];
  log.push({ tool: 'get_fund_status', input: '{}', result: summarize(fundStatus(ctx)) });
  const args = {
    currency_code: 'USD',
    primary_recipients: [{ billing_info: { email_address: ctx.sponsor.email, name: { given_name: ctx.sponsor.name } } }],
    items: [{ name: ctx.milestoneTitle.slice(0, 200), quantity: '1', unit_amount: { currency_code: 'USD', value: ctx.maxAmount.toFixed(2) } }],
    note: ctx.lang === 'es'
      ? `Su apoyo financia esta etapa de la respuesta comunitaria en ${ctx.place}. El pago a la brigada se libera solo después de verificar fotos y con aprobación comunitaria.`
      : `Your support funds this step of the community response in ${ctx.place}. Payment to the crew is released only after photo verification and community approval.`
  };
  const check = policyCheck('create_invoice', args, ctx);
  if (!check.ok) throw new Error(check.reason);
  ctx.invoiceId = fakeId('SIM-INV');
  ctx.amount = invoiceTotal(check.args);
  log.push({ tool: 'create_invoice', input: summarize(check.args), result: summarize({ id: ctx.invoiceId, status: 'DRAFT', simulated: true }) });
  log.push({ tool: 'send_invoice', input: summarize({ invoice_id: ctx.invoiceId, send_to_recipient: true }), result: summarize({ status: 'SENT', simulated: true }) });
  const link = `${origin}/#/sponsor/${ctx.incidentId}/${ctx.sponsorshipId}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360 });
  log.push({ tool: 'generate_invoice_qr_code', input: summarize({ invoice_id: ctx.invoiceId }), result: 'QR image created (simulated invoice link)' });
  return {
    invoiceId: ctx.invoiceId, amount: ctx.amount, payLink: link, qr, log, simulated: true,
    summary: ctx.lang === 'es' ? `Creé y envié una factura simulada de ${ctx.amount.toFixed(2)} USD a ${ctx.sponsor.name} y generé el código QR.` : `Created and sent a simulated ${ctx.amount.toFixed(2)} USD invoice to ${ctx.sponsor.name} and generated the QR code.`
  };
}

async function runFundraisingAgent(ctx, origin) {
  if (config.aiLive && config.paypalLive) return runLive(ctx);
  return runDemo(ctx, origin);
}

// Check whether a sponsor paid. Live: Agent Toolkit get_invoice. Demo: explicit simulation only.
async function checkInvoice(sponsorship, simulatePaid) {
  if (sponsorship.simulated) {
    return simulatePaid ? { status: 'PAID', paid: sponsorship.amount, simulated: true } : { status: 'SENT', paid: 0, simulated: true };
  }
  const tk = getToolkit();
  if (!tk) throw new Error('PayPal is not configured.');
  const r = await tk.handleToolCall({ id: 'check-' + Date.now(), type: 'function', function: { name: 'get_invoice', arguments: JSON.stringify({ invoice_id: sponsorship.invoiceId }) } });
  const inv = parseMaybeJson(r.content) || {};
  const status = inv.status || 'UNKNOWN';
  const paidValue = Number((inv.payments && inv.payments.paid_amount && inv.payments.paid_amount.value) || (status === 'PAID' || status === 'MARKED_AS_PAID' ? sponsorship.amount : 0));
  return { status, paid: paidValue, simulated: false };
}

module.exports = { runFundraisingAgent, checkInvoice, policyCheck, invoiceTotal, setToolkitForTests, invoiceIdFrom };
