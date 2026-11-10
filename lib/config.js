'use strict';
// Configuration and mode detection.
// DEMO mode runs with no keys: AI answers come from a rule-based engine and
// PayPal calls are simulated (clearly labeled). LIVE mode turns on per service
// as soon as its keys are present in .env.

const fs = require('fs');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const ROOT = path.join(__dirname, '..');
loadDotEnv(path.join(ROOT, '.env'));

const env = process.env;

const config = {
  root: ROOT,
  port: Number(env.PORT || 3000),
  dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
  // Anthropic (Claude) — live AI when a key is present
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  anthropicBase: (env.ANTHROPIC_API_BASE || 'https://api.anthropic.com').replace(/\/$/, ''),
  claudeModel: env.CLAUDE_MODEL || 'claude-sonnet-5-5',
  // PayPal sandbox — live payments when both credentials are present
  paypalClientId: env.PAYPAL_CLIENT_ID || '',
  paypalSecret: env.PAYPAL_CLIENT_SECRET || '',
  paypalBase: (env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(/\/$/, ''),
  currency: 'USD',
  // Safety and governance thresholds
  aiConfidenceFloor: Number(env.AI_CONFIDENCE_FLOOR || 0.6),
  maxPayoutPerMilestone: Number(env.MAX_PAYOUT_PER_MILESTONE || 2000),
  publicLocationDecimals: 2, // ~1 km precision on public copies
  // Public servers (judging, real use): set ALLOW_RESET=false so nobody can erase all records.
  allowReset: env.ALLOW_RESET !== 'false'
};

// Example data ("Load a completed example") always runs simulated, even on a live
// server: requests inside this scope see aiLive and paypalLive as false, so no
// real sandbox payment or AI call is made and every record is labeled simulated.
// The scope is per request, so real users at the same moment are not affected.
config.exampleScope = new AsyncLocalStorage();
config.seedSecret = crypto.randomBytes(24).toString('hex');
const inExample = () => Boolean(config.exampleScope.getStore());
config.aiLiveConfigured = Boolean(config.anthropicKey);
config.paypalLiveConfigured = Boolean(config.paypalClientId && config.paypalSecret);
Object.defineProperty(config, 'aiLive', { enumerable: true, get: () => config.aiLiveConfigured && !inExample(), set: v => { config.aiLiveConfigured = Boolean(v); } });
Object.defineProperty(config, 'paypalLive', { enumerable: true, get: () => config.paypalLiveConfigured && !inExample(), set: v => { config.paypalLiveConfigured = Boolean(v); } });

module.exports = config;
