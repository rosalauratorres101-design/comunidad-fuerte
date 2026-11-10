'use strict';
// Escalation when nobody answers.
//
// When the last follow-up date of a report passes without an answer (or the
// person marks "no answer"), the app suggests the next authority up the ladder
// (local -> state or province -> national -> international), using only rules
// and channels it has verified for that place (lib/laws.js, lib/jurisdiction.js),
// and drafts a short, polite escalation message in the person's language.
// If no higher channel is verified for the place, it says so.

const jurisdiction = require('./jurisdiction');

const ORDER = { private: 0, local: 1, state: 2, national: 3, international: 4 };

// Verified rules that are a channel to escalate to, and how to use them.
const LADDER = {
  atx_311: { level: 'local', how: { en: 'File a new 3-1-1 request that cites the earlier one and asks for a status and a date.', es: 'Presentar una nueva solicitud al 3-1-1 que cite la anterior y pida el estado y una fecha.' } },
  atx_code: { level: 'local', how: { en: 'Ask Austin Code Compliance (through 3-1-1) to inspect the unsafe condition.', es: 'Pedir a Cumplimiento de Código de Austin (por el 3-1-1) que inspeccione la condición insegura.' } },
  tulum_zofemat: { level: 'local', how: { en: 'Ask the Zofemat directorate of Tulum to schedule removal on this beach.', es: 'Pedir a la Dirección de Zofemat de Tulum que programe el retiro en esta playa.' } },
  qroo_ppa: { level: 'state', how: { en: 'File an environmental complaint with the Quintana Roo PPA, attaching the evidence file.', es: 'Presentar una denuncia ambiental ante la PPA de Quintana Roo con el expediente de evidencia.' } },
  tx_tceq: { level: 'state', how: { en: 'File an environmental complaint with TCEQ online or by phone; it can be anonymous.', es: 'Presentar una queja ambiental ante la TCEQ en línea o por teléfono; puede ser anónima.' } },
  mx_lgeepa_189: { level: 'national', how: { en: 'File a "denuncia popular" with PROFEPA (or with the municipality where there is no PROFEPA office).', es: 'Presentar una denuncia popular ante la PROFEPA (o ante el municipio donde no haya oficina de la PROFEPA).' } },
  us_epa_tips: { level: 'national', how: { en: 'Report the possible violation with EPA\'s online form; contact details are optional.', es: 'Reportar la posible violación con el formulario en línea de la EPA; los datos de contacto son opcionales.' } },
  intl_escazu: { level: 'international', how: { en: 'Cite your rights to environmental information, participation and justice under the Escazú Agreement in your next message.', es: 'Cite en su siguiente mensaje sus derechos de información, participación y justicia ambiental según el Acuerdo de Escazú.' } }
};

const PRIVATE_KINDS = new Set(['association', 'builder', 'landlord']);

function today() { return new Date().toISOString().slice(0, 10); }

function levelOfReport(r, inc) {
  if (PRIVATE_KINDS.has(r.kind)) return 'private';
  const known = Object.entries(LADDER).find(([id]) => r.targetId === id);
  if (known) return known[1].level;
  return 'local';
}

// Is this report waiting too long? Returns the date it became overdue, or null.
function overdueSince(r, now) {
  if (r.status === 'resolved' || r.status === 'answered') return null;
  const last = (r.followUps || []).map(f => f.date).sort().pop();
  if (r.status === 'no_answer') return (r.responseAt || '').slice(0, 10) || last || r.sentAt;
  if (last && last < (now || today())) return last;
  return null;
}

function nextSteps(inc, r, legal, now) {
  const from = levelOfReport(r, inc);
  const out = [];
  const rules = legal.layers.flatMap(l => l.rules.map(x => ({ ...x, layer: l.level })));
  const seen = new Set();
  for (const x of rules) {
    const step = LADDER[x.id];
    if (!step || seen.has(x.id) || x.id === r.targetId) continue;
    if (ORDER[step.level] < ORDER[from] || (ORDER[step.level] === ORDER[from] && from !== 'private')) continue;
    seen.add(x.id);
    out.push({ ruleId: x.id, level: step.level, how: step.how, title: x.title, url: x.url, state: x.state, lastChecked: x.lastChecked });
  }
  out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  // Builder ignored the Chapter 27 notice: the 60-day window opens legal options (shown first).
  if (r.kind === 'builder' && legal.layers.some(l => l.rules.some(x => x.id === 'tx_ch27'))) {
    // Chapter 27: 60 days after the notice (counted here from the date sent; the law counts from receipt).
    const day60 = new Date(Date.parse(r.sentAt + 'T00:00:00Z') + 60 * 864e5).toISOString().slice(0, 10);
    const passed = (now || today()) >= day60;
    out.unshift({ ruleId: 'tx_ch27', level: 'state', title: 'Texas Property Code, Chapter 27', url: 'https://tcss.legis.texas.gov/Docs/PR/htm/PR.27.htm', waitUntil: passed ? null : day60,
      how: passed
        ? { en: 'About 60 days have passed since the certified notice without a solution: talk to a construction-defect lawyer about the next legal step. Keep the green card and tracking number.', es: 'Pasaron unos 60 días desde el aviso certificado sin solución: hable con un abogado de defectos de construcción sobre el siguiente paso legal. Guarde la tarjeta verde y el número de rastreo.' }
        : { en: `Chapter 27 gives the builder 60 days after receiving the notice to make an offer (around ${day60} if it arrived the day it was sent). Wait until then before legal action; meanwhile keep documenting and you may consult a lawyer.`, es: `El capítulo 27 da al constructor 60 días desde que recibe el aviso para hacer una oferta (alrededor del ${day60} si llegó el mismo día del envío). Espere esa fecha antes de una acción legal; mientras tanto siga documentando y puede consultar a un abogado.` } });
  }
  return out.slice(0, 4);
}

function forIncident(inc, now) {
  const legal = jurisdiction.forIncident(inc);
  return (inc.reports || []).map(r => {
    const since = overdueSince(r, now);
    if (!since) return null;
    return { reportId: r.id, targetName: r.targetName, sentAt: r.sentAt, overdueSince: since, from: levelOfReport(r, inc), next: nextSteps(inc, r, legal, now) };
  }).filter(Boolean);
}

// A short escalation message written by the app (no third-party text).
function draft(inc, reportId, ruleId, lang, sender) {
  const es = lang === 'es';
  const items = forIncident(inc);
  const item = items.find(i => i.reportId === reportId) || (() => {
    const r = (inc.reports || []).find(x => x.id === reportId);
    if (!r) return null;
    return { reportId, targetName: r.targetName, sentAt: r.sentAt, next: nextSteps(inc, r, jurisdiction.forIncident(inc), today()) };
  })();
  if (!item) { const e = new Error(es ? 'Reporte no encontrado.' : 'Report not found.'); e.status = 400; throw e; }
  const step = item.next.find(n => n.ruleId === ruleId) || item.next[0];
  const place = inc.answers.placeLabel || (es ? 'el lugar indicado' : 'the place indicated');
  const type = inc.assessment.type;
  const name = (sender && sender.name) || (es ? 'Un/a residente' : 'A resident');
  const contact = sender && sender.contact ? `\n${sender.contact}` : '';
  const ref = inc.id;
  const basis = step ? `${step.title}\n${step.url}` : '';
  const subject = es ? `Seguimiento sin respuesta: problema reportado el ${item.sentAt} en ${place}` : `No answer yet: problem reported on ${item.sentAt} at ${place}`;
  const body = es
    ? `A quien corresponda:

El ${item.sentAt} reporté a ${item.targetName} un problema en ${place} (tipo: ${type}). Hasta hoy no he recibido respuesta ni veo una solución.

Solicito respetuosamente que:
1. Se registre este reporte y se me informe el número de folio o caso.
2. Se revise el lugar y se indique una fecha estimada de atención.
3. Si el asunto no es de su competencia, se turne a la autoridad que corresponda y se me informe.

Cuento con fotos fechadas y un expediente de evidencia con huellas digitales SHA-256 (referencia ${ref}), que puedo enviar.

Fundamento consultado:
${basis}

Atentamente,
${name}${contact}`
    : `To whom it may concern:

On ${item.sentAt} I reported to ${item.targetName} a problem at ${place} (type: ${type}). To date I have not received an answer and I do not see a solution.

I respectfully ask that you:
1. Log this report and give me a case or reference number.
2. Inspect the place and give an estimated date for action.
3. If this is not within your authority, forward it to the authority that is and let me know.

I have dated photos and an evidence file with SHA-256 fingerprints (reference ${ref}) that I can send.

Basis consulted:
${basis}

Sincerely,
${name}${contact}`;
  return { subject, body, step };
}

module.exports = { LADDER, forIncident, overdueSince, nextSteps, draft };
