'use strict';
// Rules by level. Every report is placed in its jurisdictions, from the widest
// to the closest: international -> national -> state or province -> local.
// For each level the app lists only rules it has verified (lib/laws.js), and
// says plainly when it has not verified that level for this place yet, instead
// of guessing. When rules at different levels differ on safety, the report
// shows the stricter safety rule and tells people to confirm with the local
// authority; the app does not decide legal conflicts.
//
// Codes: INTL, EU (regional block), ISO country (MX), country-state (MX-ROO,
// US-TX), country-state-locality (MX-ROO-Tulum, US-TX-Austin).

const laws = require('./laws');
const hazard = require('./hazard');
const costs = require('./costs');

const LEVELS = ['international', 'national', 'state', 'local'];

// States and localities the app can recognise from the place a person typed.
// Add a line here when rules for a new place are verified.
const PLACES = [
  { code: 'MX-ROO-Tulum', re: /\btulum\b/i },
  { code: 'US-TX-Austin', re: /\baustin\b/i },
  { code: 'MX-ROO', re: /quintana\s*roo|\bq\.?\s*roo\b|canc[uú]n|playa del carmen|mahahual|bacalar|chetumal|cozumel|isla mujeres|puerto morelos|holbox|tulum/i },
  { code: 'US-TX', re: /\btexas\b|,\s*tx\b|\btx\s*\d{5}|\baustin\b|\bhouston\b|\bdallas\b|san antonio|el paso/i }
];

const NAMES = {
  INTL: { en: 'International', es: 'Internacional' },
  EU: { en: 'European Union', es: 'Unión Europea' },
  MX: { en: 'Mexico', es: 'México' },
  US: { en: 'United States', es: 'Estados Unidos' },
  'MX-ROO': { en: 'Quintana Roo', es: 'Quintana Roo' },
  'US-TX': { en: 'Texas', es: 'Texas' },
  'MX-ROO-Tulum': { en: 'Tulum', es: 'Tulum' },
  'US-TX-Austin': { en: 'Austin', es: 'Austin' }
};

function levelOf(code) {
  if (code === 'INTL' || code === 'EU') return 'international';
  const parts = String(code).split('-');
  return parts.length === 1 ? 'national' : parts.length === 2 ? 'state' : 'local';
}

// Where is this report? Uses explicit answers first, then the place text.
function resolve(answers) {
  const a = answers || {};
  const country = String(a.country || '').toUpperCase();
  let state = /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(String(a.region || '')) ? a.region : '';
  if (!state && /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(String(a.jurisdiction || ''))) state = a.jurisdiction;
  let locality = '';
  const text = String(a.placeLabel || '');
  for (const p of PLACES) {
    if (!p.re.test(text) || !p.code.startsWith(country + '-')) continue;
    const lv = levelOf(p.code);
    if (lv === 'local' && !locality && (!state || p.code.startsWith(state + '-'))) { locality = p.code; if (!state) state = p.code.split('-').slice(0, 2).join('-'); }
    if (lv === 'state' && !state) state = p.code;
  }
  if (state && !state.startsWith(country + '-')) state = '';
  if (locality && !locality.startsWith(state + '-')) locality = '';
  const intl = hazard.EU_COUNTRIES.includes(country) ? ['INTL', 'EU'] : ['INTL'];
  return {
    country, state, locality,
    codes: { international: intl, national: country ? [country] : [], state: state ? [state] : [], local: locality ? [locality] : [] },
    name: c => NAMES[c] || (costs.COUNTRIES[c] && costs.COUNTRIES[c].name) || { en: c, es: c }
  };
}

// Topics of a report decide which rules are relevant.
const CATEGORY_TOPIC = { gas_smell: ['gas'], power_line: ['power'], flooding: ['flooding'], water_leak: ['water'], road: ['road'], streetlight: ['streetlight'], rental_repairs: ['tenant'], illegal_dumping: ['dumping', 'environment'], other_community: [] };

function topicsOf(inc) {
  const a = inc.answers || {};
  const type = (inc.assessment && inc.assessment.type) || '';
  const t = new Set(['safety_signs', 'reporting']);
  if (inc.domain === 'infrastructure') {
    if (/rent|tenant/.test(a.propertyType || '')) t.add('tenant');
    else { t.add('construction'); if (/condo|hoa/.test(a.propertyType || '')) t.add('condo'); }
  } else if (inc.domain === 'community') {
    (CATEGORY_TOPIC[a.category] || []).forEach(x => t.add(x));
  } else {
    t.add('environment');
    if (type === 'sargassum') t.add('sargassum');
    if (type === 'plastic_waste' || type === 'chemical_unknown') t.add('dumping');
  }
  return t;
}

function matches(rule, code, country) {
  if (rule.jurisdiction !== code) return false;
  // Treaties: only for countries where the app verified they apply.
  if (rule.countries && !rule.countries.includes(country)) return false;
  return true;
}

// Rules for a report, grouped by level, with honest coverage notes.
function forIncident(inc, opts) {
  const o = opts || {};
  const where = resolve(inc.answers);
  const topics = o.topics || topicsOf(inc);
  const all = laws.list();
  const layers = LEVELS.map(level => {
    const codes = where.codes[level];
    const national = hazard.standardFor(where.country).id !== 'ISO';
    const rules = all.filter(r => codes.some(c => matches(r, c, where.country)) && r.topics.some(tp => topics.has(tp)))
      // ISO 3864 is the fallback colour standard: hide it where a national one applies.
      .filter(r => !(r.id === 'std_iso3864' && national));
    const verifiedHere = all.some(r => codes.some(c => matches(r, c, where.country)));
    return {
      level,
      places: codes.map(c => ({ code: c, name: where.name(c) })),
      known: codes.length > 0,
      coverage: !codes.length ? 'place_unknown' : rules.length ? 'covered' : verifiedHere ? 'none_for_topic' : 'not_verified',
      rules: rules.map(r => ({ id: r.id, kind: r.kind, title: r.title, url: r.url, jurisdiction: r.jurisdiction, facts: r.facts, caution: r.caution, state: r.state, lastChecked: r.lastChecked }))
    };
  });
  return { where: { country: where.country, state: where.state, locality: where.locality, names: Object.fromEntries([...new Set(Object.values(where.codes).flat())].map(c => [c, where.name(c)])) }, topics: [...topics], layers };
}

// Laws that govern the app itself (privacy) where a person uses it.
function appCompliance(country, state) {
  const c = String(country || '').toUpperCase();
  const codes = ['INTL', c, state].filter(Boolean);
  if (hazard.EU_COUNTRIES.includes(c)) codes.push('EU');
  const rules = laws.list().filter(r => r.topics.includes('privacy') && codes.some(code => matches(r, code, c)));
  return { country: c, state: state || '', rules, covered: rules.length > 0 };
}

module.exports = { LEVELS, PLACES, resolve, topicsOf, forIncident, appCompliance, levelOf };
