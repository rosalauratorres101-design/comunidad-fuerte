'use strict';
// AI layer. Live mode calls the Claude Messages API (vision + web search).
// Demo mode uses a transparent rule-based engine so the app works with no keys.
// In both modes, safety.js has the final word on tiers and payouts.

const fs = require('fs');
const config = require('./config');
const content = require('./content');
const safety = require('./safety');

const TODAY = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Claude API helpers
// ---------------------------------------------------------------------------
async function callClaude({ system, messages, tools, maxTokens = 1500 }) {
  const body = { model: config.claudeModel, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  const res = await fetch(config.anthropicBase + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json && json.error && json.error.message) || res.statusText;
    throw new Error('Claude API error ' + res.status + ': ' + msg);
  }
  return json;
}

function textOf(resp) {
  return (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const start = [firstObj, firstArr].filter(i => i >= 0).sort((a, b) => a - b)[0];
  if (start !== undefined) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    const end = text.lastIndexOf(close);
    if (end > start) candidates.push(text.slice(start, end + 1));
  }
  for (const c of candidates) {
    try { return JSON.parse(c); } catch (_) { /* try next */ }
  }
  return null;
}

// URLs Claude actually retrieved or cited in this response.
function retrievedSources(resp) {
  const urls = new Set();
  const citedText = [];
  for (const block of resp.content || []) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r && r.url) urls.add(normalizeUrl(r.url));
    }
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c.url) urls.add(normalizeUrl(c.url));
        if (c.cited_text) citedText.push(c.cited_text);
      }
    }
  }
  return { urls, citedText: citedText.join(' \n ') };
}

function normalizeUrl(u) {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).toLowerCase();
  } catch (_) {
    return String(u || '').toLowerCase();
  }
}

const PHONE = /\+?\d[\d\s().-]{6,}\d/g;

// Keep only items whose source URL was really retrieved; strip phone numbers
// that do not appear in the cited text. Returns { kept, dropped }.
function verifyAgainstSources(items, sources) {
  const kept = [];
  let dropped = 0;
  for (const it of items || []) {
    const url = it && it.source && it.source.url;
    if (!url || !sources.urls.has(normalizeUrl(url))) { dropped++; continue; }
    if (it.contact) {
      for (const key of Object.keys(it.contact)) {
        const val = String(it.contact[key] || '');
        const phones = val.match(PHONE) || [];
        const unconfirmed = phones.filter(p => !sources.citedText.replace(/\s/g, '').includes(p.replace(/\s/g, '')));
        if (unconfirmed.length) {
          it.contact[key] = val.replace(PHONE, m => (unconfirmed.includes(m) ? '[number not confirmed]' : m));
          it.phoneUnconfirmed = true;
        }
      }
    }
    it.source.checked = TODAY();
    it.source.how = 'live_search';
    kept.push(it);
  }
  return { kept, dropped };
}

function imageBlocks(photos, max = 3) {
  const blocks = [];
  for (const p of (photos || []).slice(0, max)) {
    try {
      const data = fs.readFileSync(p.privatePath).toString('base64');
      blocks.push({ type: 'image', source: { type: 'base64', media_type: p.mime || 'image/jpeg', data } });
    } catch (_) { /* missing file: skip */ }
  }
  return blocks;
}

function summarizeAnswers(a) {
  return JSON.stringify({
    observations: a.observations, smell: a.smell, symptoms: a.symptoms, affected: a.affected,
    containers: a.containers, description: a.description, place: a.placeLabel, country: a.country,
    helpers: a.helpers, tools: a.tools, domain: a.domain, propertyType: a.propertyType, builtYear: a.builtYear,
    injuries: a.injuries, movement: a.movement, crackWidth: a.crackWidth,
    category: a.category, urgency: a.urgency, hazardous: a.hazardous
  });
}

const SAFETY_SYSTEM = `You support community environmental first response for residents who are not experts.
Hard rules: never give instructions to handle, open, move, neutralize or smell an unknown substance; never ask a person to move closer to a possible chemical hazard; when unsure, choose the more cautious tier; record symptoms but never diagnose.
Tiers: green = community can act with basic care; yellow = act only with protection; red = do not touch, isolate and escalate.
For building and infrastructure hazards (stairs, railings, walkways): green = cosmetic, use with normal care; yellow = use with caution and report; red = do not use. Never ask anyone to push, pull, shake or put weight on a damaged railing or step to test it.
Answer only with the JSON requested.`;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
async function classify(answers, photos) {
  if (!config.aiLive) return demoClassify(answers, photos);
  const prompt = `Resident report (JSON): ${summarizeAnswers(answers)}
${answers.domain === 'infrastructure' ? 'This is a building or infrastructure hazard: use type "structural_damage" and look for cracks at railing anchors, rust staining, gaps and loose elements.\n' : ''}${answers.domain === 'community' ? `This is a community problem in category "${answers.category}": use type "cm_${answers.category}". Green = not urgent, report it; yellow = take care and report today; red = danger, move away and call for help. A gas smell or a fallen power line is always red.\n` : ''}Look at the photos too. Return JSON:
{"type": one of ${JSON.stringify(Object.keys(content.TYPE_LABELS))},
 "tier": "green"|"yellow"|"red", "confidence": 0..1,
 "observations_en": [short strings], "reasoning_en": "2 sentences", "reasoning_es": "2 frases",
 "follow_up": [{"en": "...", "es": "..."}] (at most 2 safe questions that do not require approaching the site)}`;
  const resp = await callClaude({
    system: SAFETY_SYSTEM,
    messages: [{ role: 'user', content: [...imageBlocks(photos), { type: 'text', text: prompt }] }],
    maxTokens: 900
  });
  const out = extractJson(textOf(resp)) || {};
  return {
    source: 'claude',
    type: content.TYPE_LABELS[out.type] ? out.type : 'unknown',
    tier: safety.TIERS.includes(out.tier) ? out.tier : 'red',
    confidence: Number(out.confidence) || 0,
    observations: out.observations_en || [],
    reasoning: { en: out.reasoning_en || '', es: out.reasoning_es || '' },
    followUp: out.follow_up || []
  };
}

function demoClassify(answers, photos) {
  const rule = safety.ruleAssessment(answers);
  const samples = (photos || []).map(p => p.sampleId).filter(Boolean);
  let confidence = 0.55;
  let observations = [];
  let reasoning;
  if (samples.some(s => s.startsWith('A_'))) {
    confidence = 0.86;
    observations = ['Thick brown seaweed mats along the tide line', 'Darkened, decomposing layers near the sand'];
  } else if (samples.some(s => s.startsWith('B_'))) {
    confidence = 0.8;
    observations = ['White foam and discolored water downstream of a discharge point', 'Containers visible at a distance on the bank'];
  } else if (samples.some(s => s.startsWith('C_'))) {
    confidence = 0.84;
    observations = ['Crack running from the handrail base plate through the top step', 'Rust staining on the riser and an open gap between steps'];
  } else if (photos && photos.length) {
    confidence = 0.62;
    observations = ['Photo received; demo mode cannot analyze custom photos, so the answers decide the tier'];
  }
  const label = content.TYPE_LABELS[rule.type] || content.TYPE_LABELS.unknown;
  if (answers.domain === 'community') {
    // The category rules decide the tier; demo mode does not guess beyond them.
    confidence = Math.max(confidence, 0.8);
    const lab = content.TYPE_LABELS[rule.type] || content.TYPE_LABELS.unknown;
    reasoning = rule.floor === 'red'
      ? { en: `${lab.en}: this can hurt someone right now. Move away, keep others away and call for help from a safe place.`, es: `${lab.es}: esto puede lastimar a alguien ahora mismo. Aléjate, mantén lejos a los demás y pide ayuda desde un lugar seguro.` }
      : rule.floor === 'yellow'
        ? { en: `${lab.en}: a real risk for people who pass by. Take care, warn others and report it today in writing.`, es: `${lab.es}: un riesgo real para quien pasa. Ten cuidado, avisa a otros y repórtalo hoy por escrito.` }
        : { en: `${lab.en}: not urgent, but it should be fixed. Report it so the responsible service has a record.`, es: `${lab.es}: no es urgente, pero debe arreglarse. Repórtalo para que el servicio responsable tenga el registro.` };
  } else if (answers.domain === 'infrastructure') {
    reasoning = rule.floor === 'red'
      ? { en: 'A loose railing, falling pieces or an injury means the stairs should not be used until a professional checks them.', es: 'Un barandal flojo, pedazos que caen o una lesión significan que la escalera no debe usarse hasta que un profesional la revise.' }
      : rule.floor === 'yellow'
        ? { en: 'The signs suggest damage beyond the surface, such as a crack at the railing anchor or corroding steel. Use with caution, report it in writing and request an inspection.', es: 'Las señales sugieren un daño más allá de la superficie, como una grieta en el anclaje del barandal o acero en corrosión. Úsala con precaución, repórtalo por escrito y pide una inspección.' }
        : { en: 'The damage looks cosmetic. Use with normal care, document it and report it for maintenance.', es: 'El daño parece superficial. Úsala con cuidado normal, documéntalo y repórtalo para mantenimiento.' };
  } else if (rule.floor === 'red') {
    reasoning = {
      en: `Signs point to ${label.en.toLowerCase()} with possible chemical exposure. Treat it as Red: keep distance and escalate.`,
      es: `Las señales indican ${label.es.toLowerCase()} con posible exposición química. Se trata como Rojo: mantener distancia y escalar.`
    };
  } else if (rule.floor === 'yellow') {
    reasoning = {
      en: `Signs point to ${label.en.toLowerCase()} with exposure risks. The community can act only with protection.`,
      es: `Las señales indican ${label.es.toLowerCase()} con riesgos de exposición. La comunidad puede actuar solo con protección.`
    };
  } else {
    reasoning = {
      en: `Signs point to ${label.en.toLowerCase()} with no exposure warnings reported. The community can act with basic care.`,
      es: `Las señales indican ${label.es.toLowerCase()} sin alertas de exposición. La comunidad puede actuar con cuidados básicos.`
    };
  }
  const followUp = [];
  if (answers.domain === 'community') {
    followUp.push({ en: 'Since when has this been happening, and has anyone reported it already?', es: '¿Desde cuándo pasa esto y alguien ya lo reportó?' });
    followUp.push({ en: 'Who is most affected nearby, for example children, older adults or people with disabilities?', es: '¿Quién está más afectado cerca, por ejemplo niños, personas mayores o personas con discapacidad?' });
  } else if (answers.domain === 'infrastructure') {
    followUp.push({ en: 'When did you first notice the damage, and has it been repaired or painted over before?', es: '¿Cuándo notaste el daño por primera vez, y ya lo habían reparado o pintado antes?' });
    followUp.push({ en: 'Do older adults, children or people with mobility aids use these stairs often?', es: '¿Personas mayores, niños o personas con andadera o silla de ruedas usan seguido esta escalera?' });
  } else {
    if (rule.floor !== 'red') {
      followUp.push({ en: 'How long has the material been on the shore or in the water?', es: '¿Cuánto tiempo lleva el material en la orilla o en el agua?' });
    }
    followUp.push({ en: 'Is anyone in the area pregnant, a young child, or living with asthma?', es: '¿Hay en la zona personas embarazadas, niños pequeños o con asma?' });
  }
  return { source: 'demo', type: rule.type, tier: rule.floor, confidence, observations, reasoning, followUp };
}

// ---------------------------------------------------------------------------
// Remediation finder
// ---------------------------------------------------------------------------
function libraryMethods(type, tier) {
  return content.REMEDIATION.filter(m => m.types.includes(type) && m.tiers.includes(tier));
}

// Returns only NEW live findings; the curated + approved knowledge base is
// merged in by knowledge.js so it can rank and age items over time.
async function remediation(incident) {
  const { type, tier } = incident.assessment;
  if (!config.aiLive) return { methods: [], dropped: 0, mode: 'demo' };
  const prompt = incident.domain === 'infrastructure'
    ? `Find up to 4 authoritative, practical steps residents can take about a damaged shared stair or railing (documenting, temporary safety measures, official inspection or complaint channels, tenant or owner rights) for: safety tier=${tier}, property type=${incident.answers.propertyType}, place=${incident.answers.placeLabel || 'unknown'}. Never include do-it-yourself structural repair. Use web search and cite an authoritative page for every item.
Return a JSON array: [{"title":{"en":"","es":""},"summary":{"en":"","es":""},"cost":"low|medium|high","skill":"basic|trained|specialist","evidence":"field_tested|lab_studied|experimental","materials":{"en":"","es":""},"time":{"en":"","es":""},"source":{"title":"","url":""}}]`
    : `Find up to 4 accessible, evidence-based remediation or protection methods a non-expert community could use for: type=${type}, safety tier=${tier}, place=${incident.answers.placeLabel || 'unknown'}.
Rules: for tier red, only list isolation, testing, legal or advocacy steps; never hands-on cleanup of unknown chemicals. Use web search and cite an authoritative page for every item.
Return a JSON array: [{"title":{"en":"","es":""},"summary":{"en":"","es":""},"cost":"low|medium|high","skill":"basic|trained|specialist","evidence":"field_tested|lab_studied|experimental","materials":{"en":"","es":""},"time":{"en":"","es":""},"source":{"title":"","url":""}}]`;
  const resp = await callClaude({
    system: SAFETY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    maxTokens: 2500
  });
  const items = extractJson(textOf(resp));
  const { kept, dropped } = verifyAgainstSources(Array.isArray(items) ? items : [], retrievedSources(resp));
  const live = kept.map(m => ({ ...m, origin: 'live', tiers: [tier], types: [type] }));
  return { methods: live, dropped, mode: 'live' };
}

// ---------------------------------------------------------------------------
// Help finder
// ---------------------------------------------------------------------------
function seedOrgs(country) {
  return content.ORGS.filter(o => o.countries.includes('*') || (country && o.countries.includes(country)));
}

async function helpFinder(incident) {
  const country = incident.answers.country || '';
  if (!config.aiLive) return { orgs: [], dropped: 0, mode: 'demo' };
  const prompt = `Find up to 5 organizations that can help a community right now with: type=${incident.assessment.type}, tier=${incident.assessment.tier}, place=${incident.answers.placeLabel || ''}, country=${country}.
${incident.domain === 'community' ? 'Prefer the official city service line, the utility responsible (gas, power, water), tenant rights organizations and legal aid.' : incident.domain === 'infrastructure' ? 'Prefer the city code enforcement or building safety office, tenant or homeowner rights organizations, legal aid and engineering licensing boards.' : 'Prefer local environmental authorities, NGOs, university labs and legal aid.'} Use web search; every item needs the page you found it on.
Return a JSON array: [{"name":{"en":"","es":""},"urgency":"immediate|authority|international|legal|science|funding|media","contact":{"en":"","es":""},"why":{"en":"","es":""},"source":{"title":"","url":""}}]
Only include a phone number if it appears on the cited page.`;
  const resp = await callClaude({
    system: SAFETY_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    maxTokens: 2500
  });
  const items = extractJson(textOf(resp));
  const { kept, dropped } = verifyAgainstSources(Array.isArray(items) ? items : [], retrievedSources(resp));
  const live = kept.map(o => ({ ...o, origin: 'live', confidence: 'located', countries: [country || '*'] }));
  return { orgs: live, dropped, mode: 'live' };
}

// ---------------------------------------------------------------------------
// Milestone verification
// ---------------------------------------------------------------------------
const DEMO_VERDICTS = {
  A_ppe: { decision: 'pass', confidence: 0.9, en: 'Gloves, boots, glasses and a gas monitor are visible with packaging. Matches the milestone.', es: 'Se ven guantes, botas, lentes y un monitor de gas con empaque. Coincide con la etapa.' },
  A_after_good: { decision: 'pass', confidence: 0.88, en: 'Same viewpoint as the before photo. Sand is visible along the tide line and material is bagged away from the water.', es: 'Mismo punto de vista que la foto de antes. Se ve la arena en la línea de marea y el material está embolsado lejos del agua.' },
  A_after_partial: { decision: 'fail', confidence: 0.83, en: 'Most of the tide line is still covered with sargassum. Upload a new photo when the section is cleared.', es: 'La mayor parte de la línea de marea sigue cubierta de sargazo. Sube una foto nueva cuando el tramo esté limpio.' },
  A_truck: { decision: 'pass', confidence: 0.85, en: 'Loaded truck visible. A photo at the receiving site would complete the record.', es: 'Se ve el camión cargado. Una foto en el sitio receptor completaría el registro.' },
  C_cones: { decision: 'pass', confidence: 0.86, en: 'Warning cones and tape are visible around the damaged step.', es: 'Se ven conos y cinta de advertencia alrededor del escalón dañado.' },
  C_mail: { decision: 'pass', confidence: 0.88, en: 'A certified mail receipt with a tracking number is visible.', es: 'Se ve un comprobante de correo certificado con número de rastreo.' },
  C_report: { decision: 'pass', confidence: 0.87, en: 'The cover page of an engineering report with a seal and signature is visible.', es: 'Se ve la portada de un informe de ingeniería con sello y firma.' },
  B_labslip: { decision: 'pass', confidence: 0.87, en: 'A laboratory chain-of-custody form with a sample ID is visible.', es: 'Se ve un formato de cadena de custodia del laboratorio con número de muestra.' }
};

async function verifyMilestone(milestone, beforePhoto, afterPhotos, lang) {
  if (!config.aiLive) {
    const sample = (afterPhotos || []).map(p => p.sampleId).find(Boolean);
    const v = sample && DEMO_VERDICTS[sample];
    if (v) return { source: 'demo', decision: v.decision, confidence: v.confidence, reasoning: { en: v.en, es: v.es } };
    return {
      source: 'demo', decision: 'needs_review', confidence: 0,
      reasoning: { en: 'Demo mode cannot analyze custom photos. A community verifier must review them in person or on screen.', es: 'El modo demo no puede analizar fotos propias. Una persona verificadora de la comunidad debe revisarlas en persona o en pantalla.' }
    };
  }
  const criteria = milestone.criteria && milestone.criteria.en;
  const content_ = [];
  if (beforePhoto) content_.push({ type: 'text', text: 'BEFORE photo:' }, ...imageBlocks([beforePhoto], 1));
  content_.push({ type: 'text', text: 'AFTER / evidence photos:' }, ...imageBlocks(afterPhotos, 3));
  content_.push({ type: 'text', text: `Milestone: ${milestone.title.en}. Acceptance criteria: ${criteria}.
Decide if the evidence shows the milestone was completed. Return JSON {"decision":"pass"|"fail"|"needs_review","confidence":0..1,"reasoning_en":"","reasoning_es":""}. Use needs_review if photos are unclear, possibly from another place, or possibly edited.` });
  const resp = await callClaude({ system: SAFETY_SYSTEM, messages: [{ role: 'user', content: content_ }], maxTokens: 600 });
  const out = extractJson(textOf(resp)) || {};
  let decision = ['pass', 'fail', 'needs_review'].includes(out.decision) ? out.decision : 'needs_review';
  const confidence = Number(out.confidence) || 0;
  if (decision === 'pass' && confidence < config.aiConfidenceFloor) decision = 'needs_review';
  return { source: 'claude', decision, confidence, reasoning: { en: out.reasoning_en || '', es: out.reasoning_es || '' } };
}

// ---------------------------------------------------------------------------
// Message drafting for organizations
// ---------------------------------------------------------------------------
async function draftMessage(incident, org, lang) {
  const a = incident.assessment;
  const label = (content.TYPE_LABELS[a.type] || content.TYPE_LABELS.unknown)[lang === 'es' ? 'es' : 'en'];
  const place = incident.answers.placeLabel || (lang === 'es' ? 'ubicación en el expediente' : 'location in the evidence file');
  const ref = incident.id;
  if (!config.aiLive || lang === 'en' || lang === 'es') {
    if (lang === 'es') {
      return `Asunto: Solicitud de apoyo — ${label} (nivel ${tierName(a.tier, 'es')}) en ${place}\n\nBuenos días:\n\nNuestra comunidad reporta ${label.toLowerCase()} en ${place}. La evaluación de seguridad es nivel ${tierName(a.tier, 'es')}. ${a.reasoning.es}\n\nAdjuntamos el expediente ${ref} con fotos, fecha, hora y huella digital SHA-256 de cada archivo para verificar que no fue alterado.\n\nSolicitamos: orientación inmediata, visita técnica y, si corresponde, análisis de laboratorio.\n\nQuedamos atentos.\nComunidad de ${place}`;
    }
    return `Subject: Request for support — ${label} (${tierName(a.tier, 'en')} tier) at ${place}\n\nHello,\n\nOur community is reporting ${label.toLowerCase()} at ${place}. The safety assessment is ${tierName(a.tier, 'en')}. ${a.reasoning.en}\n\nAttached is evidence file ${ref} with photos, date, time and a SHA-256 fingerprint of every file so you can verify nothing was altered.\n\nWe request: immediate guidance, a technical visit and, if needed, laboratory testing.\n\nThank you,\nCommunity of ${place}`;
  }
  const resp = await callClaude({
    system: 'Write short, formal, factual messages for communities requesting environmental help. No exaggeration.',
    messages: [{ role: 'user', content: `Write a message in language code "${lang}" to ${org.name.en} about: ${label}, tier ${a.tier}, place ${place}, evidence file ${ref}. Facts: ${a.reasoning.en}. Ask for guidance, a technical visit and lab testing if needed. Plain text with a subject line.` }],
    maxTokens: 600
  });
  return textOf(resp).trim();
}

function tierName(tier, lang) {
  const names = { green: { en: 'Green', es: 'Verde' }, yellow: { en: 'Yellow', es: 'Amarillo' }, red: { en: 'Red', es: 'Rojo' } };
  return (names[tier] || names.red)[lang];
}

// ---------------------------------------------------------------------------
// Translation of case text (summary) into the other app languages
// ---------------------------------------------------------------------------
const LANG_NAMES = { en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese', zh: 'Simplified Chinese', hi: 'Hindi', ar: 'Arabic', bn: 'Bengali', ru: 'Russian', id: 'Indonesian' };

async function translateSummary(summary, lang) {
  const payload = {
    title: summary.title,
    disclaimer: summary.disclaimer,
    sections: summary.sections.map(sec => (sec.fixed ? null : sec.items || []))
  };
  const resp = await callClaude({
    system: 'You translate community safety case summaries. Keep names of laws, organizations, places, dates, amounts, IDs and SHA-256 fingerprints unchanged. Plain, clear language. Answer only with JSON of the same shape.',
    messages: [{ role: 'user', content: `Translate every string value into ${LANG_NAMES[lang] || lang}. Keep null entries as null.\n${JSON.stringify(payload)}` }],
    maxTokens: 3000
  });
  const out = extractJson(textOf(resp));
  if (!out || !Array.isArray(out.sections) || out.sections.length !== summary.sections.length) throw new Error('Translation came back in an unexpected format.');
  return {
    ...summary,
    title: out.title || summary.title,
    disclaimer: out.disclaimer || summary.disclaimer,
    sections: summary.sections.map((sec, i) => (sec.fixed || !Array.isArray(out.sections[i]) || out.sections[i].length !== (sec.items || []).length ? sec : { ...sec, items: out.sections[i] }))
  };
}

// ---------------------------------------------------------------------------
// Rule and contact re-check (law watch). Never edits app text: it only reports
// whether each fact is still accurate, with a page the search really retrieved.
// ---------------------------------------------------------------------------
async function checkRule(rule) {
  if (!config.aiLive) return { result: 'unclear', note: 'Demo mode: no live check.', facts: [] };
  const prompt = `Today is ${TODAY()}. The app relies on these facts from "${rule.title}" (${rule.url}), jurisdiction ${rule.jurisdiction}:
${rule.facts.map((x, i) => `${i + 1}. ${x.en}`).join('\n')}
Use web search to check each fact against the current official source (amendments, new bills, changed phone numbers or hours).
Return JSON: {"results":[{"fact":1,"status":"still_accurate"|"changed"|"unclear","now_says":"what the source says today, if changed","source_url":"page you used","source_title":""}]}
Mark "changed" only if a page you retrieved says so.`;
  const resp = await callClaude({
    system: 'You check whether legal rules and public contact details are still accurate. Be conservative: if a retrieved page does not clearly confirm a change, answer "unclear". Answer only with the JSON requested.',
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    maxTokens: 1500
  });
  const out = extractJson(textOf(resp)) || {};
  const sources = retrievedSources(resp);
  const rows = (Array.isArray(out.results) ? out.results : []).map(r => ({
    fact: Number(r.fact) || 0, status: ['still_accurate', 'changed', 'unclear'].includes(r.status) ? r.status : 'unclear',
    nowSays: String(r.now_says || '').slice(0, 600), url: String(r.source_url || ''), title: String(r.source_title || '').slice(0, 200)
  })).map(r => (r.url && sources.urls.has(normalizeUrl(r.url)) ? r : { ...r, status: r.status === 'still_accurate' ? 'unclear' : r.status === 'changed' ? 'unclear' : r.status, unverified: true }));
  const changed = rows.filter(r => r.status === 'changed');
  if (changed.length) {
    return { result: 'changed', facts: changed.map(r => ({ fact: r.fact, nowSays: r.nowSays })), note: changed.map(r => `Fact ${r.fact}: ${r.nowSays}`).join(' '), sourceUrl: changed[0].url, sourceTitle: changed[0].title };
  }
  const ok = rows.length && rows.every(r => r.status === 'still_accurate');
  const first = rows.find(r => r.url && !r.unverified) || {};
  return { result: ok ? 'still_accurate' : 'unclear', facts: [], note: ok ? 'All facts confirmed against a retrieved page.' : 'Could not confirm every fact; a person should check.', sourceUrl: first.url || '', sourceTitle: first.title || '' };
}

module.exports = {
  checkRule,
  translateSummary,
  classify, remediation, helpFinder, verifyMilestone, draftMessage,
  // exported for tests
  extractJson, verifyAgainstSources, retrievedSources, normalizeUrl, demoClassify
};
