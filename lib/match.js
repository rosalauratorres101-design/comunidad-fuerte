'use strict';
// Government (or any institution) matching funds.
//
// Through the official link, an office pledges to match community donations
// 1:1 up to a cap. The resident can then ask for the matched amount: the
// fundraising agent sends the office a PayPal invoice, and the agent's policy
// in code caps the invoice at what is actually owed (community donations
// received, up to the pledge, minus what was already invoiced). When the
// invoice is paid, the money enters the same milestone-verified fund.

function bad(msg) { const e = new Error(msg); e.status = 400; return e; }
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const round2 = n => Math.round(n * 100) / 100;
const MAX_CAP = 100000;

function pledge(inc, body) {
  const b = body || {};
  const office = clean(b.office, 120);
  const email = clean(b.email, 120);
  const cap = round2(Number(b.cap));
  if (!office) throw bad('Write the name of your office or department.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Enter a valid email for the PayPal invoice.');
  if (!(cap > 0) || cap > MAX_CAP) throw bad(`The matching limit must be between 1 and ${MAX_CAP} USD.`);
  if (inc.match && inc.match.active) throw bad('This report already has an active matching pledge.');
  inc.match = { active: true, office, email, ratio: 1, cap, at: new Date().toISOString(), invoices: [] };
  return inc.match;
}

// Community donations count toward the match; matching and sponsor payments do not.
function communityRaised(transactions, incId) {
  return round2(transactions.filter(t => t.incidentId === incId && t.kind === 'donation' && t.status === 'COMPLETED' && !t.matchId && !t.paypalInvoiceId)
    .reduce((s, t) => s + Number(t.amount), 0));
}

function status(inc, transactions) {
  const m = inc.match;
  if (!m) return null;
  const raised = communityRaised(transactions, inc.id);
  const eligible = round2(Math.min(raised * m.ratio, m.cap));
  const invoiced = round2(m.invoices.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + Number(i.amount), 0));
  const paid = round2(m.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0));
  return { active: m.active, office: m.office, ratio: m.ratio, cap: m.cap, at: m.at, communityRaised: raised, eligible, invoiced, paid, owed: round2(Math.max(0, eligible - invoiced)), invoices: m.invoices.map(({ qr, ...x }) => x) };
}

module.exports = { pledge, status, communityRaised, MAX_CAP };
