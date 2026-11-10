'use strict';
// Safety engine. These rules are enforced in code, not only in AI prompts:
//  1. A rule-based "floor" tier is computed from the resident's answers.
//  2. The AI may raise the tier but never lower it below the floor.
//  3. Low AI confidence bumps the tier up one level.
//  4. Downgrades require new photo evidence, never insistence alone.
//  5. Red incidents can only fund testing, legal, advocacy and interpretation.
//  6. Questions that ask a person to approach a Red hazard are blocked.

const config = require('./config');

const TIERS = ['green', 'yellow', 'red'];
const rank = t => TIERS.indexOf(t);
const maxTier = (a, b) => (rank(a) >= rank(b) ? a : b);
const bump = t => TIERS[Math.min(rank(t) + 1, 2)];

const RED_WORDS = [
  'barrel', 'drum', 'container', 'chemical', 'solvent', 'pesticide', 'acid', 'mercury', 'toxic', 'unknown liquid', 'leak',
  'tambo', 'tambor', 'bidón', 'bidon', 'químico', 'quimico', 'solvente', 'plaguicida', 'ácido', 'mercurio', 'tóxico', 'toxico', 'fuga', 'desconocid'
];

const TYPE_BY_OBSERVATION = {
  sargassum_fresh: 'sargassum',
  sargassum_rotting: 'sargassum',
  oil: 'oil',
  foam_color: 'water_discoloration',
  dead_animals: 'wildlife_mortality',
  containers: 'chemical_unknown',
  plastic: 'plastic_waste',
  smoke: 'smoke_burning',
  other: 'unknown'
};

const ALLOWED_CATEGORIES = {
  green: ['ppe', 'tools', 'labor', 'transport', 'disposal', 'testing', 'advocacy', 'interpretation'],
  yellow: ['ppe', 'tools', 'labor', 'transport', 'disposal', 'testing', 'advocacy', 'interpretation'],
  red: ['testing', 'legal', 'advocacy', 'interpretation']
};

// Building and infrastructure hazards: the community funds evidence, warning
// barriers and pressure (engineer report, certified mail, legal advice), never
// the structural repair itself. The repair is owed by the responsible party and
// must be done by licensed professionals.
const INFRA_CATEGORIES = ['engineering', 'barriers', 'legal', 'advocacy', 'interpretation'];

const INFRA_OBS_TYPES = ['crack_anchor', 'crack', 'handrail_loose', 'rust_stain', 'gap_trip', 'falling_pieces', 'water_infiltration', 'other_infra'];

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// Building and infrastructure rules (stairs, railings, walkways, balconies).
// Nobody is ever asked to push, pull or load a damaged element to test it.
function infraAssessment(a) {
  const obs = asArray(a.observations);
  const flags = [];
  let floor = 'green';
  const raise = (tier, flag) => { floor = maxTier(floor, tier); flags.push(flag); };

  if (obs.includes('handrail_loose') || a.movement === 'yes') raise('red', 'railing_moves');
  if (obs.includes('falling_pieces')) raise('red', 'pieces_falling');
  if (a.injuries === 'serious') raise('red', 'serious_injury');

  if (obs.includes('crack_anchor')) raise('yellow', 'crack_at_railing_anchor');
  if (obs.includes('rust_stain')) raise('yellow', 'rust_from_embedded_steel');
  if (obs.includes('gap_trip')) raise('yellow', 'gap_or_trip_hazard');
  if (obs.includes('water_infiltration')) raise('yellow', 'water_entering_structure');
  if (['1to3', 'over3'].includes(a.crackWidth)) raise('yellow', a.crackWidth === 'over3' ? 'crack_wider_3mm' : 'crack_1_to_3mm');
  if (a.injuries === 'minor') raise('yellow', 'someone_fell_or_tripped');
  if (a.crackGrowing) raise('yellow', 'crack_growing');
  if (obs.length === 0 || obs.includes('other_infra')) raise('yellow', 'unclear_situation');

  return { floor, flags: [...new Set(flags)], emergency: a.injuries === 'serious', type: 'structural_damage' };
}

// Other community problems (gas, power lines, flooding, water, roads, lights,
// rental repairs, dumping). The category sets a starting tier; urgency, injuries
// and hazardous materials can only raise it.
const COMMUNITY_CATEGORIES = { green: ['barriers', 'advocacy', 'interpretation', 'legal'], yellow: ['barriers', 'advocacy', 'interpretation', 'legal'], red: ['advocacy', 'interpretation', 'legal'] };
const COMMUNITY_BASE = {
  gas_smell: 'red', power_line: 'red', flooding: 'yellow', water_leak: 'yellow', road: 'yellow',
  streetlight: 'green', rental_repairs: 'yellow', illegal_dumping: 'green', other_community: 'yellow'
};

function communityAssessment(a) {
  const category = COMMUNITY_BASE[a.category] ? a.category : 'other_community';
  const flags = ['category_' + category];
  let floor = COMMUNITY_BASE[category];
  const raise = (tier, flag) => { floor = maxTier(floor, tier); flags.push(flag); };
  if (category === 'gas_smell') flags.push('gas_leave_area');
  if (category === 'power_line') flags.push('downed_line_keep_away');
  if (a.urgency === 'immediate') raise(bump(COMMUNITY_BASE[category]), 'immediate_danger');
  if (a.injuries === 'minor') raise('yellow', 'someone_hurt');
  if (a.injuries === 'serious') raise('red', 'serious_injury');
  if (category === 'illegal_dumping' && a.hazardous === 'yes') raise('red', 'possible_hazardous_waste');
  const emergency = a.injuries === 'serious' || category === 'gas_smell' || (category === 'flooding' && a.urgency === 'immediate');
  return { floor, flags: [...new Set(flags)], emergency, type: 'cm_' + category };
}

// Returns { floor, flags[], emergency, type }
function ruleAssessment(answers) {
  const a = answers || {};
  if (a.domain === 'infrastructure') return infraAssessment(a);
  if (a.domain === 'community') return communityAssessment(a);
  const obs = asArray(a.observations);
  const symptoms = asArray(a.symptoms).filter(s => s !== 'none');
  const text = String(a.description || '').toLowerCase();
  const flags = [];
  let floor = 'green';

  const raise = (tier, flag) => {
    floor = maxTier(floor, tier);
    flags.push(flag);
  };

  // Red triggers
  if (obs.includes('containers') || a.containers === 'yes') raise('red', 'containers_or_drums');
  if (a.smell === 'chemical') raise('red', 'chemical_odor');
  if (symptoms.includes('breathing')) raise('red', 'breathing_difficulty');
  if (a.affected === 'people') raise('red', 'people_affected');
  if (a.affected === 'many_animals') raise('red', 'mass_animal_deaths');
  if (obs.includes('smoke')) raise('red', 'smoke_or_burning');
  if (obs.includes('foam_color') && (symptoms.length || (a.smell && a.smell !== 'none') || (a.affected && a.affected !== 'none'))) {
    raise('red', 'discolored_water_with_signs');
  }
  if (RED_WORDS.some(w => text.includes(w))) raise('red', 'hazard_words_in_description');

  // Yellow triggers
  if (obs.includes('sargassum_rotting')) raise('yellow', 'decomposing_sargassum');
  if (a.smell === 'rotten_egg') raise('yellow', 'rotten_egg_odor_h2s');
  if (a.smell === 'fuel') raise('yellow', 'fuel_odor');
  if (obs.includes('oil')) raise('yellow', 'oil_present');
  if (obs.includes('foam_color')) raise('yellow', 'discolored_water');
  if (obs.includes('dead_animals') || a.affected === 'few_animals') raise('yellow', 'dead_animals');
  if (symptoms.length) raise('yellow', 'symptoms_reported');
  if (obs.length === 0 || obs.includes('other')) raise('yellow', 'unclear_situation');

  const emergency = symptoms.includes('breathing') || a.affected === 'people';

  // Most specific type wins: chemical > others
  let type = 'unknown';
  const order = ['containers', 'smoke', 'oil', 'foam_color', 'dead_animals', 'sargassum_rotting', 'sargassum_fresh', 'plastic', 'other'];
  for (const o of order) {
    if (obs.includes(o)) { type = TYPE_BY_OBSERVATION[o]; break; }
  }
  if (type !== 'chemical_unknown' && flags.includes('hazard_words_in_description')) type = 'chemical_unknown';

  return { floor, flags: [...new Set(flags)], emergency, type };
}

// Combine rule floor with an AI opinion. AI can only raise the tier.
function combine(rule, ai) {
  let tier = rule.floor;
  const notes = [];
  if (ai && TIERS.includes(ai.tier)) {
    if (rank(ai.tier) > rank(tier)) notes.push('ai_raised_tier');
    if (rank(ai.tier) < rank(tier)) notes.push('ai_lower_than_rules_ignored');
    tier = maxTier(tier, ai.tier);
    const conf = Number(ai.confidence);
    if (!Number.isFinite(conf) || conf < config.aiConfidenceFloor) {
      const before = tier;
      tier = bump(tier);
      if (tier !== before) notes.push('low_confidence_bumped_up');
    }
  }
  return { tier, notes };
}

// A downgrade is only allowed when the reassessment includes new photo evidence.
function canChangeTier(currentTier, proposedTier, newPhotoCount) {
  if (rank(proposedTier) >= rank(currentTier)) return { allowed: true };
  if (!newPhotoCount) return { allowed: false, reason: 'downgrade_requires_new_photo_evidence' };
  return { allowed: true };
}

function allowedCategories(tier, domain) {
  if (domain === 'infrastructure') return INFRA_CATEGORIES;
  if (domain === 'community') return COMMUNITY_CATEGORIES[tier] || COMMUNITY_CATEGORIES.red;
  return ALLOWED_CATEGORIES[tier] || ALLOWED_CATEGORIES.red;
}

function validateMilestones(tier, milestones, domain) {
  const errors = [];
  const allowed = allowedCategories(tier, domain);
  (milestones || []).forEach((m, i) => {
    if (!allowed.includes(m.category)) errors.push(`Milestone ${i + 1} category "${m.category}" is not allowed for a ${tier} incident.`);
    if (!(Number(m.amount) > 0)) errors.push(`Milestone ${i + 1} needs an amount greater than zero.`);
    if (Number(m.amount) > config.maxPayoutPerMilestone) errors.push(`Milestone ${i + 1} exceeds the ${config.maxPayoutPerMilestone} USD per-milestone cap.`);
  });
  const work = (milestones || []).filter(m => m.category !== 'interpretation');
  if (domain !== 'infrastructure' && domain !== 'community' && tier === 'yellow' && work.length && work[0].category !== 'ppe') {
    errors.push('Yellow incidents must fund protective equipment (PPE) as the first milestone.');
  }
  return errors;
}

// Payout gate: verification, human approval, separation of duties, fund balance.
function payoutCheck({ incident, milestone, approver, recipient, available }) {
  const reasons = [];
  if (!incident || !milestone) return ['Incident or milestone not found.'];
  if (!allowedCategories(incident.assessment.tier, incident.domain).includes(milestone.category)) {
    reasons.push(`A ${incident.assessment.tier} incident cannot pay for "${milestone.category}".`);
  }
  const v = milestone.verification;
  if (!v || !['pass', 'needs_review'].includes(v.decision)) reasons.push('The milestone has not passed AI verification or been sent to human review.');
  if (!approver || !String(approver.name || '').trim()) reasons.push('A named community verifier must approve the payout.');
  if (approver && recipient && String(approver.email || '').trim().toLowerCase() === String(recipient.email || '').trim().toLowerCase()) {
    reasons.push('The verifier cannot approve a payout to themselves.');
  }
  if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(recipient.email || ''))) reasons.push('A valid PayPal email for the recipient is required.');
  if (Number(milestone.amount) > available + 1e-9) reasons.push(`Only ${available.toFixed(2)} USD is available in this incident's fund.`);
  if (milestone.status === 'paid') reasons.push('This milestone was already paid.');
  return reasons;
}

// Never acceptable at any tier: contact, tasting, opening, or sniffing on purpose
// (hydrogen sulfide can dull the sense of smell at dangerous levels).
// Also never: pushing, pulling or putting weight on a damaged railing or step to test it.
const ALWAYS_UNSAFE = /(touch|pick up|taste|open (the|it)|smell it|sniff|push|pull|shake|lean on|put (your )?weight|toca|toque|recoge|prueb|abr[ae] (el|la|lo)|huel[ae]lo|olfate|empuj|jal[ae]|sacud|recárga|recarga|apóya|apoya)/i;
// Not acceptable when a chemical hazard is possible: moving closer.
const RED_UNSAFE = /(closer|approach|get near|go near|walk (up|over)|acérca|acerc|aproxím|aproxim)/i;

function filterQuestions(questions, tier) {
  return (questions || []).filter(q => {
    const texts = typeof q === 'string' ? [q] : [q && q.text, q && q.en, q && q.es].filter(Boolean);
    if (!texts.length) return false;
    for (const text of texts) {
      if (ALWAYS_UNSAFE.test(text)) return false;
      if (tier === 'red' && RED_UNSAFE.test(text)) return false;
    }
    return true;
  });
}

module.exports = {
  TIERS, rank, maxTier, ruleAssessment, combine, canChangeTier,
  allowedCategories, validateMilestones, payoutCheck, filterQuestions, INFRA_OBS_TYPES, INFRA_CATEGORIES, COMMUNITY_CATEGORIES, COMMUNITY_BASE
};
