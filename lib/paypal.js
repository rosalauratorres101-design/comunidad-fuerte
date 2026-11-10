'use strict';
// PayPal integration: Orders API v2 (donations in) and Payouts API (milestone
// and interpreter payments out). Uses the sandbox by default.
// Without credentials, calls are simulated and every record is marked
// simulated: true so nothing is ever presented as a real payment.

const crypto = require('crypto');
const config = require('./config');

let cachedToken = null; // { value, expiresAt }

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const auth = Buffer.from(config.paypalClientId + ':' + config.paypalSecret).toString('base64');
  const res = await fetch(config.paypalBase + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error('PayPal authentication failed: ' + (json.error_description || res.status));
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 300) * 1000 };
  return cachedToken.value;
}

async function api(method, pathname, body, extraHeaders) {
  const token = await accessToken();
  const res = await fetch(config.paypalBase + pathname, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json.details && json.details[0] && (json.details[0].description || json.details[0].issue)) || json.message || res.statusText;
    const err = new Error('PayPal error ' + res.status + ': ' + detail);
    err.status = res.status;
    throw err;
  }
  return json;
}

function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Amount must be a positive number.');
  if (n > 10000) throw new Error('Amount is above the 10,000 USD demo limit.');
  return n.toFixed(2);
}

function fakeId(prefix) {
  return prefix + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ---------------------------------------------------------------------------
// Donations (Orders API v2)
// ---------------------------------------------------------------------------
async function createDonationOrder({ incidentId, amount, description }) {
  const value = money(amount);
  if (!config.paypalLive) {
    return { id: fakeId('SIM-ORDER'), status: 'CREATED', simulated: true, amount: value };
  }
  const order = await api('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: incidentId,
      custom_id: incidentId,
      description: String(description || 'Community response fund').slice(0, 127),
      amount: { currency_code: config.currency, value }
    }]
  }, { 'PayPal-Request-Id': incidentId + '-' + Date.now() });
  return { id: order.id, status: order.status, simulated: false, amount: value };
}

async function captureDonationOrder(orderId, simulatedAmount) {
  if (!config.paypalLive) {
    return { id: orderId, status: 'COMPLETED', captureId: fakeId('SIM-CAPTURE'), amount: money(simulatedAmount), payer: 'sandbox-donor@example.com', simulated: true };
  }
  const json = await api('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {});
  const unit = json.purchase_units && json.purchase_units[0];
  const cap = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  return {
    id: json.id,
    status: json.status,
    captureId: cap && cap.id,
    amount: cap && cap.amount && cap.amount.value,
    customId: (cap && cap.custom_id) || (unit && unit.custom_id) || null,
    payer: json.payer && json.payer.email_address,
    simulated: false
  };
}

// ---------------------------------------------------------------------------
// Payouts API (batch with one item per call, keyed by milestone)
// ---------------------------------------------------------------------------
async function sendPayout({ senderItemId, email, amount, note, subject }) {
  const value = money(amount);
  if (!config.paypalLive) {
    return { batchId: fakeId('SIM-BATCH'), status: 'SUCCESS', simulated: true, amount: value, receiver: email };
  }
  const json = await api('POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: senderItemId + '-' + Date.now(),
      email_subject: subject || 'Community response payment',
      email_message: note || 'Payment released after verification.'
    },
    items: [{
      recipient_type: 'EMAIL',
      amount: { value, currency: config.currency },
      receiver: email,
      note: String(note || '').slice(0, 4000),
      sender_item_id: senderItemId
    }]
  });
  const header = json.batch_header || {};
  return { batchId: header.payout_batch_id, status: header.batch_status, simulated: false, amount: value, receiver: email };
}

async function payoutStatus(batchId) {
  if (!config.paypalLive || String(batchId).startsWith('SIM-')) return { batchId, status: 'SUCCESS', simulated: true };
  const json = await api('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}`);
  return { batchId, status: json.batch_header && json.batch_header.batch_status, simulated: false };
}

module.exports = { createDonationOrder, captureDonationOrder, sendPayout, payoutStatus, money };
